import sql from "@/lib/db";
import { put, del } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Verkleint de foto's die al in de opslag staan.
 *
 * HET PROBLEEM
 * De foto's zijn destijds ongewijzigd geüpload, tot 20 MB per stuk. Nieuwe foto's worden
 * bij het uploaden verkleind (zie lib/foto-verkleinen.ts), maar wat er al staat niet — en
 * dat is precies waardoor de datalimiet vol liep.
 *
 * DE TRUC MET DE WEBSITE
 * Comprimeren kan niet zonder de foto te lezen, en een origineel uit Blob halen kóst
 * dataverkeer — het probleem dat we juist oplossen. Daarom halen we niet het origineel op
 * maar de al geoptimaliseerde versie van de eigen website:
 *
 *   {WEBSITE_URL}/_next/image?url=<blob-url>&w=1920&q=75
 *
 * Kwaliteit 75 is met opzet: dat is de standaard van Next.js, dus precies de variant die
 * bezoekers opvragen. Met een andere waarde zou de cachesleutel niet matchen en zou Vercel
 * alsnog elk origineel ophalen — dan verlies je het hele voordeel.
 *
 * Ligt die variant al in de cache, dan raakt het ophalen de blob-opslag helemaal niet en
 * kost die foto niets. Ligt hij er niet, dan haalt Vercel het origineel alsnog op — even
 * duur als zelf downloaden, maar nooit duurder. En wat eruit komt is precies wat we willen opslaan: 1920 pixels breed,
 * WebP, dezelfde kwaliteit die bezoekers nu al zien.
 *
 * VEILIGHEID
 * De oude foto wordt pas verwijderd nadat de nieuwe is geüpload én de database is
 * bijgewerkt. Gaat er iets mis, dan blijft de oude staan en verandert er niets. Een auto
 * zonder foto's op de website is erger dan een auto met te grote foto's.
 */

/** Al verkleinde foto's dragen dit in hun naam, zodat ze niet nog eens langskomen. */
const MERK = "-k1920";

type Auto = { id: number; slug: string; data: Record<string, unknown> };

function fotosVan(data: Record<string, unknown>): string[] {
  const f = data?.fotos;
  return Array.isArray(f) ? f.filter((x): x is string => typeof x === "string") : [];
}

const teDoen = (u: string) =>
  u.includes("blob.vercel-storage.com") && !u.includes(MERK);

export async function POST(req: Request) {
  const gestart = Date.now();
  const DEADLINE = gestart + 45_000;

  const site = (process.env.WEBSITE_URL || "").replace(/\/+$/, "");
  if (!site) {
    return Response.json(
      { error: "WEBSITE_URL is niet ingesteld. Zonder het adres van de website kan de al geoptimaliseerde versie niet worden opgehaald." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const alleenTellen = body?.tellen === true;

  let autos: Auto[];
  try {
    autos = (await sql`SELECT id, slug, data FROM autos ORDER BY id`) as unknown as Auto[];
  } catch {
    return Response.json({ error: "De voorraad kon niet worden opgehaald." }, { status: 500 });
  }

  const openstaand = autos.reduce((n, a) => n + fotosVan(a.data).filter(teDoen).length, 0);
  if (alleenTellen) {
    return Response.json({
      totaal: autos.reduce((n, a) => n + fotosVan(a.data).length, 0),
      openstaand,
    });
  }
  if (openstaand === 0) {
    return Response.json({ gedaan: 0, mislukt: 0, resterend: 0, bespaard: 0, meldingen: [] });
  }

  let gedaan = 0;
  let mislukt = 0;
  let bespaard = 0;
  const meldingen: string[] = [];

  for (const auto of autos) {
    if (Date.now() > DEADLINE) break;

    const fotos = fotosVan(auto.data);
    if (!fotos.some(teDoen)) continue;

    const nieuw = [...fotos];
    const opTeRuimen: string[] = [];
    let gewijzigd = false;

    for (let i = 0; i < nieuw.length; i++) {
      if (Date.now() > DEADLINE) break;
      const oud = nieuw[i];
      if (!teDoen(oud)) continue;

      try {
        const bron = `${site}/_next/image?url=${encodeURIComponent(oud)}&w=1920&q=75`;
        const res = await fetch(bron, {
          headers: { accept: "image/webp,image/*" },
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) {
          mislukt++;
          meldingen.push(`${auto.slug} foto ${i + 1}: website gaf ${res.status}`);
          continue;
        }
        // Als Blob, want dat is wat put() accepteert zonder Node-buffers nodig te hebben.
        const bytes = new Blob([await res.arrayBuffer()], { type: "image/webp" });
        if (bytes.size < 5_000) {
          // Verdacht klein: dan is het waarschijnlijk een foutpagina en geen foto.
          mislukt++;
          meldingen.push(`${auto.slug} foto ${i + 1}: antwoord te klein om een foto te zijn`);
          continue;
        }

        // Alleen vervangen als het echt kleiner is. Anders is de moeite voor niets en
        // verlies je onnodig het origineel.
        const oudeMaat = Number(
          (await fetch(oud, { method: "HEAD", signal: AbortSignal.timeout(10_000) }).catch(() => null))
            ?.headers.get("content-length") ?? 0
        );
        if (oudeMaat > 0 && bytes.size >= oudeMaat) {
          meldingen.push(`${auto.slug} foto ${i + 1}: was al klein genoeg, ongemoeid gelaten`);
          continue;
        }

        const map = oud.split("/autos/")[1]?.split("/")[0] ?? String(auto.id);
        const naam = `autos/${map}/${String(i + 1).padStart(2, "0")}${MERK}.webp`;
        const blob = await put(naam, bytes, {
          access: "public",
          contentType: "image/webp",
          addRandomSuffix: true,
        });

        nieuw[i] = blob.url;
        opTeRuimen.push(oud);
        gewijzigd = true;
        if (oudeMaat > 0) bespaard += oudeMaat - bytes.size;
      } catch (e) {
        mislukt++;
        meldingen.push(`${auto.slug} foto ${i + 1}: ${e instanceof Error ? e.message : "onbekende fout"}`);
      }
    }

    if (!gewijzigd) continue;

    // Eerst de database, dan pas opruimen. Andersom zou een mislukte update foto's
    // achterlaten die nergens meer bestaan.
    try {
      await sql`
        UPDATE autos
        SET data = jsonb_set(data, '{fotos}', ${JSON.stringify(nieuw)}::jsonb, true)
        WHERE id = ${auto.id}
      `;
      gedaan += opTeRuimen.length;
      for (const weg of opTeRuimen) await del(weg).catch(() => null);
    } catch {
      // De nieuwe blobs blijven staan maar worden nergens gebruikt; de oude foto's doen
      // het nog gewoon. Volgende ronde probeert hij het opnieuw.
      mislukt += opTeRuimen.length;
      meldingen.push(`${auto.slug}: opslaan in de database mislukt, foto's ongewijzigd gelaten`);
    }
  }

  const na = (await sql`SELECT data FROM autos`) as unknown as { data: Record<string, unknown> }[];
  const resterend = na.reduce((n, a) => n + fotosVan(a.data).filter(teDoen).length, 0);

  return Response.json({ gedaan, mislukt, resterend, bespaard, meldingen: meldingen.slice(0, 8) });
}

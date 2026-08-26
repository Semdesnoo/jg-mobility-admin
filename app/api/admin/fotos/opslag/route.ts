import { NextRequest } from "next/server";
import { list, del } from "@vercel/blob";
import { getAutos, getAutoById, saveAuto } from "@/lib/autos-db";
import { revalidateWebsite } from "@/lib/revalidate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Wat staat er in de foto-opslag, en wat kan eruit?
 *
 * WAAROM DIT ER MOET ZIJN
 * De opslag liep vol en niemand kon dat zien aankomen. Het eerste signaal was dat de
 * foto's op de website verdwenen. Een voorraad die groeit is geen probleem; een voorraad
 * die groeit terwijl je er niet in kunt kijken wél.
 *
 * WAT ER ONGEMERKT BLIJFT LIGGEN
 * Twee soorten. Ten eerste foto's van auto's die allang verkocht zijn: die blijven met
 * twintig stuks per auto staan terwijl er op de website nog maar een paar nodig zijn.
 * Ten tweede weesfoto's — bestanden waar geen enkele auto meer naar verwijst. Die
 * ontstaan bij elke foto die je vervangt of weghaalt en bij elke auto die je verwijdert:
 * de regel in de database gaat weg, het bestand blijft.
 *
 * VEILIGHEID
 * Er staat alleen autofoto's in deze opslag; de website schrijft er niets in en
 * consignatiefoto's komen per mail binnen. Toch wordt er nooit iets verwijderd waar nog
 * een auto naar wijst, en een wees moet minstens een week oud zijn — anders zou een foto
 * die je net hebt geüpload maar nog niet hebt opgeslagen als afval worden aangezien.
 *
 * Verwijderen gebeurt in twee stappen: eerst een voorstel met exacte aantallen, en pas na
 * een bevestiging het echte werk. Bij verkochte auto's gaat de database eerst; pas als
 * daar de foto's uit staan wordt het bestand weggegooid. Andersom zou de website
 * verwijzen naar iets dat er niet meer is.
 */

/** Hoeveel foto's een verkochte auto houdt. Genoeg om hem op de website te laten zien. */
const HOUDEN_BIJ_VERKOCHT = 3;

/** Een wees moet minstens zo oud zijn voordat hij weg mag. */
const WEES_RIJPTIJD_DAGEN = 7;

/** De limiet van het gratis pakket, als ijkpunt voor de meter. */
const LIMIET_BYTES = 1024 * 1024 * 1024;

/** Al verkleinde foto's dragen dit in hun naam — gelijk aan fotos/verklein. */
const MERK = "-k1920";

type BlobRegel = { url: string; pathname: string; size: number; uploadedAt: string };

const padVan = (u: string): string => {
  try {
    return new URL(u).pathname.replace(/^\/+/, "");
  } catch {
    return "";
  }
};

/**
 * Alles in de opslag ophalen. In stukken, want er kunnen er duizenden zijn, met een
 * deadline zodat de functie nooit door de tijdslimiet van Vercel heen schiet.
 */
async function alleBlobs(deadline: number): Promise<{ blobs: BlobRegel[]; compleet: boolean }> {
  const blobs: BlobRegel[] = [];
  let cursor: string | undefined;
  for (let ronde = 0; ronde < 50; ronde++) {
    const r = await list({ cursor, limit: 1000 });
    for (const b of r.blobs) {
      blobs.push({
        url: b.url,
        pathname: b.pathname,
        size: Number(b.size) || 0,
        uploadedAt: String(b.uploadedAt),
      });
    }
    if (!r.hasMore) return { blobs, compleet: true };
    cursor = r.cursor;
    if (Date.now() > deadline) return { blobs, compleet: false };
  }
  return { blobs, compleet: false };
}

/** Welke bestanden nog in gebruik zijn, en of dat bij een verkochte auto is. */
async function inGebruik(): Promise<Map<string, { verkocht: boolean; autoId: number; naam: string }>> {
  const autos = await getAutos();
  const kaart = new Map<string, { verkocht: boolean; autoId: number; naam: string }>();
  for (const a of autos) {
    for (const f of a.fotos ?? []) {
      const pad = padVan(f);
      if (pad) {
        kaart.set(pad, {
          verkocht: Boolean(a.verkocht),
          autoId: a.id,
          naam: `${a.merk} ${a.model}`.trim(),
        });
      }
    }
  }
  return kaart;
}

export async function GET() {
  const deadline = Date.now() + 40_000;
  try {
    const [{ blobs, compleet }, gebruikt] = await Promise.all([alleBlobs(deadline), inGebruik()]);

    const grens = Date.now() - WEES_RIJPTIJD_DAGEN * 86400000;
    const groepen = {
      voorraad: { aantal: 0, bytes: 0 },
      verkocht: { aantal: 0, bytes: 0 },
      wezen: { aantal: 0, bytes: 0 },
      recent: { aantal: 0, bytes: 0 },
    };
    let onverkleindAantal = 0;
    let onverkleindBytes = 0;

    for (const b of blobs) {
      const info = gebruikt.get(b.pathname);
      if (info) {
        const g = info.verkocht ? groepen.verkocht : groepen.voorraad;
        g.aantal++;
        g.bytes += b.size;
        if (!b.pathname.includes(MERK)) {
          onverkleindAantal++;
          onverkleindBytes += b.size;
        }
      } else {
        const oud = new Date(b.uploadedAt).getTime() < grens;
        const g = oud ? groepen.wezen : groepen.recent;
        g.aantal++;
        g.bytes += b.size;
      }
    }

    // Wat een opruimbeurt bij verkochte auto's zou opleveren, zonder iets aan te raken.
    const autos = await getAutos();
    const perVerkochteAuto = autos
      .filter((a) => a.verkocht && (a.fotos?.length ?? 0) > HOUDEN_BIJ_VERKOCHT)
      .map((a) => ({
        id: a.id,
        naam: `${a.merk} ${a.model}`.trim(),
        aantal: a.fotos!.length,
        weg: a.fotos!.length - HOUDEN_BIJ_VERKOCHT,
      }));
    const teVerwijderenBijVerkocht = perVerkochteAuto.reduce((s, a) => s + a.weg, 0);

    return Response.json({
      bereikbaar: true,
      compleet,
      totaal: { aantal: blobs.length, bytes: blobs.reduce((s, b) => s + b.size, 0) },
      limiet_bytes: LIMIET_BYTES,
      groepen,
      onverkleind: { aantal: onverkleindAantal, bytes: onverkleindBytes },
      verkochte_autos: perVerkochteAuto,
      te_verwijderen_bij_verkocht: teVerwijderenBijVerkocht,
      houden_bij_verkocht: HOUDEN_BIJ_VERKOCHT,
      wees_rijptijd_dagen: WEES_RIJPTIJD_DAGEN,
    });
  } catch (err) {
    // Geblokkeerde of onbereikbare opslag is geen storing van dit scherm: gewoon melden.
    return Response.json({
      bereikbaar: false,
      fout: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Opruimen. Zonder `bevestigd` komt er alleen een voorstel terug — dan wordt er niets
 * verwijderd en zie je precies wat er zou gebeuren.
 */
export async function POST(req: NextRequest) {
  const deadline = Date.now() + 45_000;
  try {
    const body = await req.json().catch(() => ({}));
    const soort = String(body.soort ?? "");
    const bevestigd = body.bevestigd === true;

    if (soort !== "wezen" && soort !== "verkocht") {
      return Response.json({ error: "Onbekende opruimactie" }, { status: 400 });
    }

    // ── Weesfoto's: nergens meer in gebruik en oud genoeg ──
    if (soort === "wezen") {
      const [{ blobs }, gebruikt] = await Promise.all([alleBlobs(deadline), inGebruik()]);
      const grens = Date.now() - WEES_RIJPTIJD_DAGEN * 86400000;
      const wezen = blobs.filter(
        (b) => !gebruikt.has(b.pathname) && new Date(b.uploadedAt).getTime() < grens
      );
      const bytes = wezen.reduce((s, b) => s + b.size, 0);

      if (!bevestigd) {
        return Response.json({
          voorstel: true,
          aantal: wezen.length,
          bytes,
          voorbeelden: wezen.slice(0, 8).map((b) => b.pathname),
        });
      }

      let weg = 0;
      for (let i = 0; i < wezen.length; i += 100) {
        if (Date.now() > deadline) break;
        const stuk = wezen.slice(i, i + 100);
        await del(stuk.map((b) => b.url));
        weg += stuk.length;
      }
      return Response.json({ verwijderd: weg, bytes, klaar: weg === wezen.length });
    }

    // ── Verkochte auto's: alleen de eerste paar foto's houden ──
    const autos = await getAutos();
    const kandidaten = autos.filter(
      (a) => a.verkocht && (a.fotos?.length ?? 0) > HOUDEN_BIJ_VERKOCHT
    );
    const teVeel = kandidaten.reduce((s, a) => s + a.fotos!.length - HOUDEN_BIJ_VERKOCHT, 0);

    if (!bevestigd) {
      return Response.json({
        voorstel: true,
        aantal: teVeel,
        autos: kandidaten.map((a) => ({
          naam: `${a.merk} ${a.model}`.trim(),
          van: a.fotos!.length,
          naar: HOUDEN_BIJ_VERKOCHT,
        })),
      });
    }

    let weg = 0;
    let aangepast = 0;
    for (const kandidaat of kandidaten) {
      if (Date.now() > deadline) break;
      const auto = await getAutoById(kandidaat.id);
      if (!auto || !auto.verkocht) continue;
      const fotos = auto.fotos ?? [];
      if (fotos.length <= HOUDEN_BIJ_VERKOCHT) continue;

      const blijven = fotos.slice(0, HOUDEN_BIJ_VERKOCHT);
      const eruit = fotos.slice(HOUDEN_BIJ_VERKOCHT).filter((f) => f.includes("blob.vercel-storage.com"));

      // Eerst de database, dan pas het bestand: andersom zou de website even naar een
      // foto verwijzen die er niet meer is.
      auto.fotos = blijven;
      await saveAuto(auto);
      aangepast++;

      if (eruit.length > 0) {
        await del(eruit).catch(() => null);
        weg += eruit.length;
      }
    }

    if (aangepast > 0) await revalidateWebsite().catch(() => null);
    return Response.json({ verwijderd: weg, autos: aangepast, klaar: aangepast === kandidaten.length });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

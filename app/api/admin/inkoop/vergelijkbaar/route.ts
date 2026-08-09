import {
  haalVergelijkbaar,
  fitWaarde,
  zonderUitschieters,
  uitvoeringWoorden,
  type Vergelijkbare,
} from "@/lib/taxatie-vergelijk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Zoekt echte vergelijkbare auto's en rekent daar een waarde uit.
 *
 * Dit vervangt het "vraag een AI om wat advertenties te zoeken". Er komt hier geen model
 * aan te pas: de zoekpagina van AutoScout24 wordt opgehaald en uitgelezen. Dat kost niets,
 * duurt een seconde, en levert getelde auto's op in plaats van een gemeld getal.
 *
 * DE UITVOERING IS HET HELE PUNT
 * Op een Volkswagen Golf uit 2017 met 136.000 km, gemeten:
 *
 *   alles door elkaar   38 auto's   € 13.233   spreiding € 2.192
 *   alleen Comfortline   8 auto's   € 11.681   spreiding €   437
 *   alleen Highline      9 auto's   € 16.193
 *
 * Ruim vierduizend euro verschil op dezelfde auto, en een schatting die vijf keer scherper
 * wordt zodra je op uitvoering filtert. Het RDW weet die uitvoering niet — een kenteken
 * vertelt niet of het een Comfortline of een Highline is. Wie de auto voor zich heeft weet
 * dat wel, dus die vraag hoort gesteld te worden.
 */

/** Minimum aantal auto's voordat een schatting iets waard is. */
const MIN_AUTOS = 8;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const merk = String(body?.merk ?? "").trim();
  const model = String(body?.model ?? "").trim();
  const bouwjaar = Number(body?.bouwjaar) || 0;
  const km = Number(String(body?.km ?? "").replace(/\D/g, "")) || 0;
  const uitvoering = String(body?.uitvoering ?? "").trim().toLowerCase();

  if (!merk || !model || !bouwjaar) {
    return Response.json({ error: "Merk, model en bouwjaar zijn verplicht" }, { status: 400 });
  }

  const zoekvraag = {
    merk,
    model,
    bouwjaar,
    km,
    brandstof: String(body?.brandstof ?? ""),
    transmissie: String(body?.transmissie ?? ""),
    bodytype: String(body?.bodytype ?? ""),
  };

  // Zoekladder: begin scherp, en versoepel pas als er te weinig auto's zijn. Elke stap
  // wordt onthouden, want hoe ruimer je moest zoeken hoe minder de uitkomst zegt.
  const stappen = [
    { jaarMarge: 1, kmMarge: 25000, tekst: "bouwjaar ±1 jaar, kilometerstand ±25.000" },
    { jaarMarge: 2, kmMarge: 40000, tekst: "bouwjaar ±2 jaar, kilometerstand ±40.000" },
    { jaarMarge: 3, kmMarge: 60000, tekst: "bouwjaar ±3 jaar, kilometerstand ±60.000" },
  ];

  let alle: Vergelijkbare[] = [];
  let gebruikteStap = stappen[0];
  for (const stap of stappen) {
    gebruikteStap = stap;
    alle = await haalVergelijkbaar({ ...zoekvraag, ...stap }, 2);
    if (alle.length >= MIN_AUTOS) break;
  }

  if (alle.length === 0) {
    return Response.json({
      ok: true,
      aantal: 0,
      melding:
        "Geen vergelijkbare auto's gevonden op AutoScout24. Bij zeldzame modellen komt dat voor; de waarde komt dan uit de nieuwprijs.",
    });
  }

  // Welke uitvoeringen komen er in dit aanbod voor, en hoe vaak? Daarmee kan het scherm
  // een keuzelijst tonen die past bij déze auto in plaats van een algemene lijst.
  const telling = new Map<string, number>();
  for (const r of alle) {
    for (const u of uitvoeringWoorden(r.uitvoering)) telling.set(u, (telling.get(u) ?? 0) + 1);
  }
  const uitvoeringen = [...telling.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([naam, aantal]) => ({ naam, aantal }));

  // Filteren op uitvoering als die is opgegeven — maar alleen als er genoeg overblijft.
  // Een scherpe schatting op drie auto's is geen scherpe schatting.
  let gebruikt = alle;
  let opUitvoering = false;
  if (uitvoering) {
    const smal = alle.filter((r) => r.uitvoering.toLowerCase().includes(uitvoering));
    if (smal.length >= 4) {
      gebruikt = smal;
      opUitvoering = true;
    }
  }

  const schoon = zonderUitschieters(gebruikt);
  const nu = new Date();
  const leeftijdMnd = Math.max(0, (nu.getFullYear() - bouwjaar) * 12 + nu.getMonth() + 1 - 6);
  const fit = fitWaarde(schoon, km, leeftijdMnd);

  return Response.json({
    ok: true,
    aantal: schoon.length,
    aantalRuw: alle.length,
    opUitvoering,
    uitvoering: opUitvoering ? uitvoering : "",
    uitvoeringen,
    zoekbereik: gebruikteStap.tekst,
    genoeg: schoon.length >= MIN_AUTOS,
    fit,
    // Alleen wat het scherm nodig heeft om ze te tonen; niet de hele advertentie.
    vergelijkbare: schoon
      .slice()
      .sort((a, b) => a.prijs - b.prijs)
      .map((r) => ({
        prijs: r.prijs,
        km: r.km,
        bouwjaar: r.bouwjaar,
        uitvoering: r.uitvoering.slice(0, 70),
        transmissie: r.transmissie,
        handelaar: r.handelaar,
        plaats: r.plaats,
        url: r.url,
      })),
  });
}

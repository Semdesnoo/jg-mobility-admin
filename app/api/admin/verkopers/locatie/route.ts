import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Zoekt de coördinaten bij een plaatsnaam, adres of postcode.
 *
 * Gebruikt de Locatieserver van PDOK — de officiële Nederlandse adressendienst.
 * Geen sleutel nodig, geen kosten, en voor Nederlandse adressen nauwkeuriger dan
 * de internationale diensten. De coördinaten hebben we nodig om de straal op de
 * kaart te kunnen tekenen; zonder punt geen cirkel.
 */
/**
 * Een losse postcode zoals "2994 LA" wordt door PDOK fuzzy afgehandeld en levert
 * dan een willekeurige woonplaats op — in de test kwam er Knegsel uit voor een
 * Barendrechtse postcode. Zonder spatie herkent hij het wél als postcode.
 */
function normaliseerZoekterm(q: string): string {
  const postcode = q.match(/^\s*(\d{4})\s*([a-zA-Z]{2})\s*$/);
  return postcode ? `${postcode[1]}${postcode[2].toUpperCase()}` : q;
}

export async function GET(req: NextRequest) {
  const ruw = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (ruw.length < 2) return Response.json({ resultaten: [] });
  const q = normaliseerZoekterm(ruw);

  try {
    const url =
      "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free" +
      `?q=${encodeURIComponent(q)}&rows=6&fq=${encodeURIComponent("type:(woonplaats OR gemeente OR adres OR postcode)")}`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return Response.json({ resultaten: [], fout: `PDOK gaf ${res.status}` });

    const data = await res.json();
    const docs: unknown[] = data?.response?.docs ?? [];

    const resultaten = docs
      .map((d) => {
        const doc = d as { weergavenaam?: string; centroide_ll?: string; type?: string };
        // centroide_ll komt binnen als "POINT(4.5372 51.8561)" — lengte eerst.
        const m = (doc.centroide_ll ?? "").match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
        if (!m) return null;
        return {
          naam: doc.weergavenaam ?? q,
          soort: doc.type ?? "",
          lon: Number(m[1]),
          lat: Number(m[2]),
        };
      })
      .filter((r): r is { naam: string; soort: string; lon: number; lat: number } => r !== null);

    return Response.json({ resultaten });
  } catch (e) {
    // Geen coördinaten kunnen vinden mag het scherm niet blokkeren; je kunt het
    // vertrekpunt dan gewoon laten staan op wat het was.
    return Response.json({ resultaten: [], fout: String(e) });
  }
}

import { NextRequest } from "next/server";
import { getInkoopFacturen, createInkoopFactuur } from "@/lib/inkoopfacturen-db";

export const dynamic = "force-dynamic";

const rond = (n: number) => Math.round(n * 100) / 100;

/** "2026-07-19" of "19-07-2026" → dagen vanaf vandaag (negatief = nog te gaan). */
function dagenOver(datum: string, vandaag: Date): number | null {
  if (!datum) return null;
  const t = datum.trim();
  const iso = /^\d{4}-\d{2}-\d{2}/.test(t)
    ? t.slice(0, 10)
    : (() => {
        const m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
        return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
      })();
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return Math.round((vandaag.getTime() - d.getTime()) / 86_400_000);
}

export async function GET() {
  const facturen = await getInkoopFacturen();
  const nu = new Date();
  const vandaag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());

  const verrijkt = facturen.map((f) => ({ ...f, dagenOver: dagenOver(f.vervaldatum, vandaag) }));
  const open = verrijkt.filter((f) => f.status === "open");
  const teLaat = open.filter((f) => (f.dagenOver ?? -1) > 0);
  const binnenkort = open.filter((f) => {
    const d = f.dagenOver;
    return d !== null && d <= 0 && d >= -7;
  });

  // Terugvorderbare BTW op openstaande én betaalde inkoopfacturen — dat is de
  // voorbelasting die je in je aangifte mag aftrekken.
  const voorbelasting = rond(facturen.reduce((s, f) => s + f.btw_bedrag, 0));

  return Response.json({
    facturen: verrijkt,
    openTotaal: rond(open.reduce((s, f) => s + f.bedrag_incl, 0)),
    openAantal: open.length,
    teLaatTotaal: rond(teLaat.reduce((s, f) => s + f.bedrag_incl, 0)),
    teLaatAantal: teLaat.length,
    binnenkortAantal: binnenkort.length,
    voorbelasting,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const factuur = await createInkoopFactuur(body);
    return Response.json(factuur, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

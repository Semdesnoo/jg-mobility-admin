import { NextRequest } from "next/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Eigen tellerstand-historie: elke km-stand die we ooit bij dit kenteken noteerden
 * (taxaties en inruil). Gratis versie van wat Carfax verkoopt — hoe langer het
 * dashboard draait, hoe meer metingen. Werkt ook als het RDW plat ligt.
 */
export async function GET(req: NextRequest) {
  const kenteken = (req.nextUrl.searchParams.get("kenteken") ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (!kenteken) return Response.json([]);

  // Een tabel die nog nooit is aangemaakt mag de opzoeking niet slopen → per bron afgevangen.
  const [taxaties, inruil] = await Promise.all([
    sql`SELECT km, aangemaakt FROM taxatie_archief
        WHERE UPPER(REGEXP_REPLACE(kenteken, '[^a-zA-Z0-9]', '', 'g')) = ${kenteken} AND km > 0`
      .catch(() => [] as Record<string, unknown>[]),
    sql`SELECT km, aangemaakt FROM inruil_archief
        WHERE UPPER(REGEXP_REPLACE(kenteken, '[^a-zA-Z0-9]', '', 'g')) = ${kenteken} AND km > 0`
      .catch(() => [] as Record<string, unknown>[]),
  ]);

  const metingen = [
    ...taxaties.map((r) => ({ km: Number(r.km), datum: new Date(r.aangemaakt as string).toISOString(), bron: "taxatie" })),
    ...inruil.map((r) => ({ km: Number(r.km), datum: new Date(r.aangemaakt as string).toISOString(), bron: "inruil" })),
  ].sort((a, b) => a.datum.localeCompare(b.datum));

  return Response.json(metingen);
}

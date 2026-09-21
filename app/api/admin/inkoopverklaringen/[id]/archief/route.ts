import { NextRequest } from "next/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Archief van een inkoopverklaring.
 *
 * POST   — de betaling aan de verkoper is overgemaakt: verklaring naar het archief.
 * DELETE — terugzetten naar actueel (per ongeluk gearchiveerd).
 *
 * Bewust geen aparte tabel: één kolom `archief_op` op de verklaring zelf.
 * Leeg = actueel, gevuld = het moment van archiveren. Zo blijft het document
 * (verplicht bewijsstuk voor de margeregeling) gewoon vindbaar en printbaar.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r] = await sql`
    UPDATE inkoopverklaringen
    SET archief_op = ${new Date().toISOString()}
    WHERE id = ${id} AND (archief_op IS NULL OR archief_op = '')
    RETURNING archief_op
  `.catch(() => []);
  if (!r) {
    return Response.json({ error: "Verklaring niet gevonden of al gearchiveerd." }, { status: 409 });
  }
  return Response.json({ ok: true, archief_op: r.archief_op });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await sql`UPDATE inkoopverklaringen SET archief_op = '' WHERE id = ${id}`.catch(() => null);
  return Response.json({ ok: true });
}

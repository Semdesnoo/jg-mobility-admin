import { NextRequest } from "next/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Geeft deze consignatie een contractnummer, en onthoudt dat.
 *
 * Formaat CON-<jaar>-<3 cijfers>, naast de JGM-nummers van de facturen. Een contract en
 * een factuur zijn verschillende documenten over dezelfde auto, en die mogen niet
 * hetzelfde nummer dragen — anders kun je in de boekhouding niet zien waar iemand het over
 * heeft.
 *
 * Het volgnummer wordt in dezelfde UPDATE bepaald als waarin het wordt weggeschreven,
 * precies zoals bij de facturen (app/api/admin/facturen/route.ts). Twee mensen die
 * tegelijk op de knop drukken kunnen zo geen gelijk nummer krijgen.
 *
 * Heeft de consignatie al een nummer, dan komt dat terug. Een contract opnieuw afdrukken
 * hoort niet ineens een ander nummer op te leveren dan wat de klant getekend heeft.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const jaar = new Date().getFullYear();
    const prefix = `CON-${jaar}-`;

    const bestaand = await sql`SELECT contract_nr FROM cosignaties WHERE id = ${id}`;
    if (!bestaand[0]) {
      return Response.json({ error: "Deze consignatie bestaat niet (meer)." }, { status: 404 });
    }
    const huidig = (bestaand[0].contract_nr as string) ?? "";
    if (huidig) return Response.json({ contract_nr: huidig, nieuw: false });

    const rijen = await sql`
      UPDATE cosignaties SET
        contract_nr = ${prefix} || LPAD(
          (COALESCE((
            SELECT MAX(CAST(SPLIT_PART(contract_nr, '-', 3) AS INTEGER))
            FROM cosignaties WHERE contract_nr LIKE ${prefix + "%"}
          ), 0) + 1)::text, 3, '0'
        ),
        contract_op = ${new Date().toISOString()}
      WHERE id = ${id} AND (contract_nr IS NULL OR contract_nr = '')
      RETURNING contract_nr
    `;

    // Niets teruggekregen betekent dat iemand anders net voor was; dan geldt hun nummer.
    if (!rijen[0]) {
      const opnieuw = await sql`SELECT contract_nr FROM cosignaties WHERE id = ${id}`;
      return Response.json({ contract_nr: (opnieuw[0]?.contract_nr as string) ?? "", nieuw: false });
    }
    return Response.json({ contract_nr: rijen[0].contract_nr as string, nieuw: true });
  } catch {
    return Response.json(
      { error: "Het contractnummer kon niet worden aangemaakt. Probeer het zo nog een keer." },
      { status: 500 }
    );
  }
}

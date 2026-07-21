import { NextRequest } from "next/server";
import { getTaxatieArchief, bewaarTaxatie } from "@/lib/taxatie-archief-db";

export const dynamic = "force-dynamic";

/** Alle bewaarde markt-analyses, nieuwste eerst. De frontend groepeert per kwartaal. */
export async function GET() {
  try {
    const rijen = await getTaxatieArchief();
    return Response.json(rijen);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/** Bewaart één analyse in het archief. Aangeroepen door de taxatietool na elke
 *  geslaagde marktanalyse. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rij = await bewaarTaxatie(body);
    return Response.json(rij, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

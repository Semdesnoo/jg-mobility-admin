import { NextRequest } from "next/server";
import { getMarktArchief, bewaarMarktAnalyse } from "@/lib/markt-archief-db";

export const dynamic = "force-dynamic";

/** Alle bewaarde marktanalyses, nieuwste eerst. De frontend groepeert per kwartaal. */
export async function GET() {
  try {
    const rijen = await getMarktArchief();
    return Response.json(rijen);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/** Bewaart één marktanalyse in het archief. Aangeroepen door het Marktoverzicht na
 *  elke geslaagde analyse. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rij = await bewaarMarktAnalyse(body);
    return Response.json(rij, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

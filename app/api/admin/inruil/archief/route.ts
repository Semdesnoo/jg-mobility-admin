import { NextRequest } from "next/server";
import { getInruilArchief, bewaarInruil } from "@/lib/inruil-archief-db";

export const dynamic = "force-dynamic";

/** Alle bewaarde inruilen, nieuwste eerst. Het scherm groepeert per kwartaal. */
export async function GET() {
  try {
    const rijen = await getInruilArchief();
    return Response.json(rijen);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/** Bewaart één inruilberekening. Aangeroepen door de inruilpagina. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rij = await bewaarInruil(body);
    return Response.json(rij, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { deleteInruil, werkInruilBij } from "@/lib/inruil-archief-db";

export const dynamic = "force-dynamic";

/**
 * Een bewaarde inruil bijwerken. Wordt gebruikt terwijl je aan dezelfde inruil rekent en
 * vanaf de detailpagina in het archief.
 *
 * Bestaat de regel niet meer — verwijderd op een ander tabblad, of op een telefoon — dan
 * komt er 404 terug. De aanroeper maakt er dan een nieuwe van in plaats van de wijziging
 * stilletjes te laten verdampen.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const rij = await werkInruilBij(id, body);
    if (!rij) return Response.json({ error: "Deze inruil bestaat niet meer" }, { status: 404 });
    return Response.json(rij);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteInruil(id);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

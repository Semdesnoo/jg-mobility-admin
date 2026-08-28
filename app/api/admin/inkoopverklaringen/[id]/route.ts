import { NextRequest } from "next/server";
import { werkInkoopverklaringBij, verwijderInkoopverklaring } from "@/lib/inkoopverklaringen-db";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rij = await werkInkoopverklaringBij(id, await req.json());
    if (!rij) return Response.json({ error: "Deze inkoopverklaring bestaat niet meer" }, { status: 404 });
    return Response.json(rij);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await verwijderInkoopverklaring(id);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { deleteInruil } from "@/lib/inruil-archief-db";

export const dynamic = "force-dynamic";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteInruil(id);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

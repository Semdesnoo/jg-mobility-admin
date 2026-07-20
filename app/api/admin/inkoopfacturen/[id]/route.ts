import { NextRequest } from "next/server";
import { updateInkoopFactuur, deleteInkoopFactuur } from "@/lib/inkoopfacturen-db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await updateInkoopFactuur(id, body);
  return Response.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteInkoopFactuur(id);
  return Response.json({ ok: true });
}

import { NextRequest } from "next/server";
import { updateOproep, deleteOproep } from "@/lib/bellog-db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const ok = await updateOproep(id, body);
  if (!ok) return Response.json({ error: "Niet gevonden" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = await deleteOproep(id);
  if (!ok) return Response.json({ error: "Niet gevonden" }, { status: 404 });
  return Response.json({ ok: true });
}

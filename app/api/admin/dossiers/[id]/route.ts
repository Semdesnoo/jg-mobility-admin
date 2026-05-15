import { NextRequest } from "next/server";
import { updateDossier, deleteDossier } from "@/lib/dossiers-db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await updateDossier(Number(id), body);
  return Response.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteDossier(Number(id));
  return Response.json({ ok: true });
}

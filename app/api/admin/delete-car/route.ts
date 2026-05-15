import { NextRequest } from "next/server";
import { deleteAuto } from "@/lib/autos-db";
import { revalidateWebsite } from "@/lib/revalidate";

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get("id") ?? "0");

  if (!id) {
    return Response.json({ error: "id is verplicht" }, { status: 400 });
  }

  const deleted = await deleteAuto(id);
  if (deleted) await revalidateWebsite();
  return Response.json({ ok: deleted });
}

import { NextRequest } from "next/server";
import { getAutoById, saveAuto } from "@/lib/autos-db";
import { revalidateWebsite } from "@/lib/revalidate";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const auto = await getAutoById(Number(id));
  if (!auto) return Response.json({ error: "Auto niet gevonden" }, { status: 404 });

  if (typeof body.prijs === "number" && body.prijs > 0) {
    auto.prijs = body.prijs;
  } else if (body.status === "verkocht") {
    auto.verkocht = true;
    auto.gereserveerd = false;
    if (!auto.verkocht_op) auto.verkocht_op = new Date().toISOString();
  } else if (body.status === "gereserveerd") {
    auto.verkocht = false;
    auto.gereserveerd = true;
    auto.verkocht_op = undefined;
  } else if (body.status !== undefined) {
    auto.verkocht = false;
    auto.gereserveerd = false;
    auto.verkocht_op = undefined;
  }

  await saveAuto(auto);
  await revalidateWebsite();
  return Response.json({ ok: true });
}

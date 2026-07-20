import { NextRequest } from "next/server";
import { getAutoById, saveAuto } from "@/lib/autos-db";
import { revalidateWebsite } from "@/lib/revalidate";
import { syncDossierMetAuto } from "@/lib/dossiers-db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const auto = await getAutoById(Number(id));
  if (!auto) return Response.json({ error: "Auto niet gevonden" }, { status: 404 });

  // Prijs en status worden ONAFHANKELIJK verwerkt: je kunt in één PATCH beide zetten.
  if (typeof body.prijs === "number" && Number.isFinite(body.prijs) && body.prijs > 0) {
    auto.prijs = body.prijs;
  }

  if (body.status === "verkocht") {
    auto.verkocht = true;
    auto.gereserveerd = false;
    if (!auto.verkocht_op) auto.verkocht_op = new Date().toISOString();
  } else if (body.status === "gereserveerd") {
    auto.verkocht = false;
    auto.gereserveerd = true;
    auto.verkocht_op = undefined;
  } else if (body.status === "beschikbaar") {
    auto.verkocht = false;
    auto.gereserveerd = false;
    auto.verkocht_op = undefined;
  }

  await saveAuto(auto);
  // Status gewijzigd? Het calculatordossier verhuist mee van lopend naar archief.
  await syncDossierMetAuto(auto);
  await revalidateWebsite();
  return Response.json({ ok: true });
}

import { NextRequest } from "next/server";
import { getAutoById, saveAuto } from "@/lib/autos-db";
import { noteerVerkoopprijs, wisVerkoopprijs } from "@/lib/prijs-geheugen-db";
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

  // Zichtbaarheid staat los van de status: verbergen mag bij elke status, en zichtbaar
  // maken zet niets anders terug. Alleen een echte boolean telt — anders zou een PATCH
  // die alleen over de prijs gaat de auto ongemerkt op zichtbaar zetten.
  if (typeof body.verborgen === "boolean") {
    auto.verborgen = body.verborgen;
  }

  if (body.status === "verkocht") {
    auto.verkocht = true;
    auto.gereserveerd = false;
    if (!auto.verkocht_op) auto.verkocht_op = new Date().toISOString();

    // Waarvoor hij écht wegging. Dit is het getal waarop de taxatietool zichzelf ijkt:
    // zonder dit blijft "verkocht" een vinkje en weet het dashboard nooit of de
    // geadviseerde prijs klopte. Wordt het niet meegestuurd, dan blijft het leeg en kan
    // het later in het prijsgeheugen worden aangevuld — nooit de vraagprijs stilzwijgend
    // als verkoopprijs boeken, want dan meet je je eigen aanname.
    const bedrag = Number(body.verkoopprijs);
    if (Number.isFinite(bedrag) && bedrag > 0) {
      await noteerVerkoopprijs(auto.id, bedrag, "verkocht gemeld", auto.kenteken ?? "").catch(() => null);
    }
  } else if (body.status === "gereserveerd") {
    auto.verkocht = false;
    auto.gereserveerd = true;
    auto.verkocht_op = undefined;
  } else if (body.status === "beschikbaar") {
    auto.verkocht = false;
    auto.gereserveerd = false;
    auto.verkocht_op = undefined;
    // Terug in de verkoop: een eerder genoteerde verkoopprijs slaat nergens meer op en
    // zou de ijking vervuilen met een verkoop die niet is doorgegaan.
    await wisVerkoopprijs(auto.id).catch(() => null);
  }

  await saveAuto(auto);
  // Status gewijzigd? Het calculatordossier verhuist mee van lopend naar archief.
  await syncDossierMetAuto(auto);
  await revalidateWebsite();
  return Response.json({ ok: true });
}

import { NextRequest } from "next/server";
import { haalKalibratie } from "@/lib/kalibratie";
import { noteerVerkoopprijs, wisVerkoopprijs } from "@/lib/prijs-geheugen-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** De hele ijking: per auto de keten advies → inkoop → vraagprijs → verkoop, plus wat
 *  daar gemiddeld uit komt. */
export async function GET() {
  try {
    return Response.json(await haalKalibratie());
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/**
 * Vastleggen waarvoor een auto is weggegaan.
 *
 * Dit is de enige plek waar dat met de hand kan, en dat is met opzet: het is het getal
 * waarop de hele ijking rust. Een bedrag van 0 haalt de notitie weg — voor als je hem
 * verkeerd hebt ingetikt.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const autoId = Number(body.auto_id);
    const bedrag = Number(body.verkoopprijs);
    if (!Number.isFinite(autoId) || autoId <= 0) {
      return Response.json({ error: "Geen geldige auto" }, { status: 400 });
    }
    if (!Number.isFinite(bedrag) || bedrag <= 0) {
      await wisVerkoopprijs(autoId);
      return Response.json({ ok: true, gewist: true });
    }
    await noteerVerkoopprijs(autoId, bedrag, "handmatig", String(body.kenteken ?? ""));
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

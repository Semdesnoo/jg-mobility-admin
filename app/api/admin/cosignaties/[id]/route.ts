import { NextRequest } from "next/server";
import sql from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const {
    status, notitie, concurrent_prijs, platform_prijzen, naam, email, telefoon,
    merk, model, bouwjaar, km, vraagprijs, opmerking, kleur, brandstof, bodytype, apk, vermogen,
    // De contractgegevens. Getallen komen als tekst uit een invoerveld, dus die worden
    // hieronder omgezet; een lege string mag geen 0 worden waar dat "niet afgesproken"
    // betekent, dus alleen invullen wat er echt in staat.
    kenteken, vin, klant_adres, klant_postcode, klant_stad,
    bodemprijs, fee_percentage, fee_vast, looptijd_maanden, uitbetaling_dagen,
    terugname_kosten, bijzondere_afspraken, contract_nr, contract_op,
  } = body;

  const getal = (w: unknown) =>
    w === undefined || w === null || w === "" ? null : Number(String(w).replace(/[^0-9.,-]/g, "").replace(",", "."));

  const geaccepteerd_op =
    status === "geaccepteerd" ? new Date().toISOString().slice(0, 10) : undefined;

  await sql`
    UPDATE cosignaties SET
      status = COALESCE(${status ?? null}, status),
      notitie = COALESCE(${notitie ?? null}, notitie),
      concurrent_prijs = COALESCE(${concurrent_prijs ?? null}, concurrent_prijs),
      naam = COALESCE(${naam ?? null}, naam),
      email = COALESCE(${email ?? null}, email),
      telefoon = COALESCE(${telefoon ?? null}, telefoon),
      merk = COALESCE(${merk ?? null}, merk),
      model = COALESCE(${model ?? null}, model),
      bouwjaar = COALESCE(${bouwjaar ?? null}, bouwjaar),
      km = COALESCE(${km ?? null}, km),
      vraagprijs = COALESCE(${vraagprijs ?? null}, vraagprijs),
      opmerking  = COALESCE(${opmerking  ?? null}, opmerking),
      kleur      = COALESCE(${kleur      ?? null}, kleur),
      brandstof  = COALESCE(${brandstof  ?? null}, brandstof),
      bodytype   = COALESCE(${bodytype   ?? null}, bodytype),
      apk        = COALESCE(${apk        ?? null}, apk),
      vermogen   = COALESCE(${vermogen   ?? null}, vermogen),
      kenteken   = COALESCE(${kenteken ? String(kenteken).toUpperCase() : null}, kenteken),
      vin        = COALESCE(${vin ?? null}, vin),
      klant_adres    = COALESCE(${klant_adres    ?? null}, klant_adres),
      klant_postcode = COALESCE(${klant_postcode ?? null}, klant_postcode),
      klant_stad     = COALESCE(${klant_stad     ?? null}, klant_stad),
      bodemprijs        = COALESCE(${getal(bodemprijs)},        bodemprijs),
      fee_percentage    = COALESCE(${getal(fee_percentage)},    fee_percentage),
      fee_vast          = COALESCE(${getal(fee_vast)},          fee_vast),
      looptijd_maanden  = COALESCE(${getal(looptijd_maanden)},  looptijd_maanden),
      uitbetaling_dagen = COALESCE(${getal(uitbetaling_dagen)}, uitbetaling_dagen),
      terugname_kosten  = COALESCE(${getal(terugname_kosten)},  terugname_kosten),
      bijzondere_afspraken = COALESCE(${bijzondere_afspraken ?? null}, bijzondere_afspraken),
      contract_nr = COALESCE(${contract_nr ?? null}, contract_nr),
      contract_op = COALESCE(${contract_op ?? null}, contract_op),
      platform_prijzen = CASE
        WHEN ${platform_prijzen ? JSON.stringify(platform_prijzen) : null}::jsonb IS NOT NULL
        THEN ${platform_prijzen ? JSON.stringify(platform_prijzen) : null}::jsonb
        ELSE platform_prijzen
      END,
      geaccepteerd_op = CASE
        WHEN ${geaccepteerd_op ?? null} IS NOT NULL THEN ${geaccepteerd_op ?? null}::date
        ELSE geaccepteerd_op
      END
    WHERE id = ${id}
  `;
  return Response.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await sql`DELETE FROM cosignaties WHERE id = ${id}`;
  return Response.json({ ok: true });
}

import { NextRequest } from "next/server";
import sql from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { status, notitie, concurrent_prijs, platform_prijzen, naam, email, telefoon, merk, model, bouwjaar, km, vraagprijs, opmerking } = body;

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
      opmerking = COALESCE(${opmerking ?? null}, opmerking),
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

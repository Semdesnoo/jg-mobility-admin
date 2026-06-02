import { NextRequest } from "next/server";
import sql from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (body.fullUpdate) {
    const regels = JSON.stringify(Array.isArray(body.regels) ? body.regels : []);
    await sql`
      UPDATE facturen SET
        datum = ${body.datum ?? ""},
        vervaldatum = ${body.vervaldatum ?? ""},
        klant_naam = ${body.klant_naam ?? ""},
        klant_adres = ${body.klant_adres ?? ""},
        klant_postcode = ${body.klant_postcode ?? ""},
        klant_stad = ${body.klant_stad ?? ""},
        klant_email = ${body.klant_email ?? ""},
        klant_telefoon = ${body.klant_telefoon ?? ""},
        auto_merk = ${body.auto_merk ?? ""},
        auto_model = ${body.auto_model ?? ""},
        auto_bouwjaar = ${body.auto_bouwjaar ?? ""},
        auto_kenteken = ${body.auto_kenteken ?? ""},
        auto_km = ${body.auto_km ?? ""},
        auto_kleur = ${body.auto_kleur ?? ""},
        auto_vin = ${body.auto_vin ?? ""},
        verkoopprijs = ${body.verkoopprijs ?? 0},
        btw_type = ${body.btw_type ?? "marge"},
        betaalwijze = ${body.betaalwijze ?? "bank"},
        notitie = ${body.notitie ?? ""},
        regels = ${regels}
      WHERE id = ${id}
    `;
    const [factuur] = await sql`SELECT * FROM facturen WHERE id = ${id}`;
    return Response.json(factuur);
  }

  await sql`
    UPDATE facturen SET
      status = COALESCE(${body.status ?? null}, status),
      notitie = COALESCE(${body.notitie ?? null}, notitie),
      factuur_nr = COALESCE(${body.factuur_nr ?? null}, factuur_nr)
    WHERE id = ${id}
  `;
  return Response.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await sql`DELETE FROM facturen WHERE id = ${id}`;
  return Response.json({ ok: true });
}

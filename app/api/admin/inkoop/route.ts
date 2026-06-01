import sql from "@/lib/db";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM inkoop_dossiers ORDER BY aangemaakt DESC`;
    return Response.json(rows);
  } catch {
    return Response.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = randomUUID();
  const row = await sql`
    INSERT INTO inkoop_dossiers (id, datum, merk, model, bouwjaar, km, kenteken, kleur, vin,
      aanbod_prijs, bod_prijs, aankoopprijs, naam, telefoon, email, status, notitie)
    VALUES (${id}, ${body.datum ?? new Date().toLocaleDateString("nl-NL")},
            ${body.merk ?? ""}, ${body.model ?? ""}, ${body.bouwjaar ?? ""},
            ${body.km ?? ""}, ${body.kenteken ?? ""}, ${body.kleur ?? ""}, ${body.vin ?? ""},
            ${body.aanbod_prijs ?? 0}, ${body.bod_prijs ?? 0}, ${body.aankoopprijs ?? 0},
            ${body.naam ?? ""}, ${body.telefoon ?? ""}, ${body.email ?? ""},
            ${body.status ?? "nieuw"}, ${body.notitie ?? ""})
    RETURNING *
  `;
  return Response.json(row[0], { status: 201 });
}

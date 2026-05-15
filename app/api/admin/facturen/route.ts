import { NextRequest } from "next/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM facturen ORDER BY datum DESC`;
    return Response.json(rows);
  } catch {
    return Response.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const jaar = new Date().getFullYear();
    const rows = await sql`SELECT COUNT(*) as count FROM facturen WHERE factuur_nr LIKE ${"JGM-" + jaar + "-%"}`;
    const nr = String(Number(rows[0].count) + 1).padStart(3, "0");
    const factuur_nr = `JGM-${jaar}-${nr}`;

    const id = `fac_${Date.now()}`;
    const datum = body.datum || new Date().toLocaleDateString("nl-NL");

    const regels = JSON.stringify(Array.isArray(body.regels) ? body.regels : []);

    await sql`
      INSERT INTO facturen (
        id, factuur_nr, datum, vervaldatum,
        klant_naam, klant_adres, klant_postcode, klant_stad, klant_email, klant_telefoon,
        auto_merk, auto_model, auto_bouwjaar, auto_kenteken, auto_km, auto_kleur, auto_vin,
        verkoopprijs, btw_type, betaalwijze, notitie, status, regels
      ) VALUES (
        ${id}, ${factuur_nr}, ${datum}, ${body.vervaldatum ?? ""},
        ${body.klant_naam ?? ""}, ${body.klant_adres ?? ""}, ${body.klant_postcode ?? ""}, ${body.klant_stad ?? ""}, ${body.klant_email ?? ""}, ${body.klant_telefoon ?? ""},
        ${body.auto_merk ?? ""}, ${body.auto_model ?? ""}, ${body.auto_bouwjaar ?? ""}, ${body.auto_kenteken ?? ""}, ${body.auto_km ?? ""}, ${body.auto_kleur ?? ""}, ${body.auto_vin ?? ""},
        ${body.verkoopprijs ?? 0}, ${body.btw_type ?? "marge"}, ${body.betaalwijze ?? "bank"}, ${body.notitie ?? ""}, 'concept', ${regels}
      )
    `;

    const [factuur] = await sql`SELECT * FROM facturen WHERE id = ${id}`;
    return Response.json(factuur);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

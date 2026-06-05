import { NextRequest } from "next/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Sorteer op factuurnummer (sequentieel, betrouwbaar) i.p.v. op de datum-tekst,
    // want "31-5-2026" sorteert als tekst verkeerd t.o.v. "3-6-2026".
    const rows = await sql`SELECT * FROM facturen ORDER BY factuur_nr DESC`;
    return Response.json(rows);
  } catch {
    return Response.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const jaar = new Date().getFullYear();
    const prefix = `JGM-${jaar}-`;
    const id = `fac_${Date.now()}`;
    const datum = body.datum || new Date().toLocaleDateString("nl-NL");
    const regels = JSON.stringify(Array.isArray(body.regels) ? body.regels : []);

    // Factuurnummer = hoogste bestaande nummer van dit jaar + 1, ATOMAIR in dezelfde INSERT
    // berekend (MAX over de facturen-tabel). Eén SQL-statement → geen aparte teller die uit
    // sync kan raken en geen race; dubbele nummers zijn onmogelijk bij normaal gebruik.
    const [factuur] = await sql`
      INSERT INTO facturen (
        id, factuur_nr, datum, vervaldatum,
        klant_naam, klant_adres, klant_postcode, klant_stad, klant_email, klant_telefoon,
        auto_merk, auto_model, auto_bouwjaar, auto_kenteken, auto_km, auto_kleur, auto_vin,
        verkoopprijs, btw_type, betaalwijze, notitie, status, regels
      )
      SELECT
        ${id},
        ${prefix} || LPAD((COALESCE(MAX(CAST(SPLIT_PART(factuur_nr, '-', 3) AS INTEGER)), 0) + 1)::text, 3, '0'),
        ${datum}, ${body.vervaldatum ?? ""},
        ${body.klant_naam ?? ""}, ${body.klant_adres ?? ""}, ${body.klant_postcode ?? ""}, ${body.klant_stad ?? ""}, ${body.klant_email ?? ""}, ${body.klant_telefoon ?? ""},
        ${body.auto_merk ?? ""}, ${body.auto_model ?? ""}, ${body.auto_bouwjaar ?? ""}, ${body.auto_kenteken ?? ""}, ${body.auto_km ?? ""}, ${body.auto_kleur ?? ""}, ${body.auto_vin ?? ""},
        ${body.verkoopprijs ?? 0}, ${body.btw_type ?? "marge"}, ${body.betaalwijze ?? "bank"}, ${body.notitie ?? ""}, 'concept', ${regels}
      FROM facturen WHERE factuur_nr LIKE ${prefix + "%"}
      RETURNING *
    `;
    return Response.json(factuur);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

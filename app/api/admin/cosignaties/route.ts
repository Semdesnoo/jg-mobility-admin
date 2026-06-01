import sql from "@/lib/db";

export const dynamic = "force-dynamic";

async function migrate() {
  try {
    await sql`ALTER TABLE cosignaties ADD COLUMN IF NOT EXISTS concurrent_prijs TEXT`;
    await sql`ALTER TABLE cosignaties ADD COLUMN IF NOT EXISTS geaccepteerd_op DATE`;
    await sql`ALTER TABLE cosignaties ADD COLUMN IF NOT EXISTS platform_prijzen JSONB DEFAULT '{}'`;
    await sql`ALTER TABLE cosignaties ADD COLUMN IF NOT EXISTS kleur TEXT DEFAULT ''`;
    await sql`ALTER TABLE cosignaties ADD COLUMN IF NOT EXISTS brandstof TEXT DEFAULT ''`;
    await sql`ALTER TABLE cosignaties ADD COLUMN IF NOT EXISTS bodytype TEXT DEFAULT ''`;
    await sql`ALTER TABLE cosignaties ADD COLUMN IF NOT EXISTS apk TEXT DEFAULT ''`;
    await sql`ALTER TABLE cosignaties ADD COLUMN IF NOT EXISTS vermogen TEXT DEFAULT ''`;
  } catch { /* table may not exist yet */ }
}

export async function GET() {
  try {
    await migrate();
    const rows = await sql`SELECT * FROM cosignaties ORDER BY datum DESC, tijd DESC`;
    return Response.json(rows);
  } catch {
    return Response.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    await migrate();
    const {
      merk, model, bouwjaar, km, vraagprijs, naam, email, telefoon, opmerking,
      kleur, brandstof, bodytype, apk, vermogen,
    } = await req.json();
    const now = new Date();
    const id = `cos_${Date.now()}`;
    const datum = now.toLocaleDateString("nl-NL");
    const tijd = now.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
    const geaccepteerd_op = now.toISOString().slice(0, 10);
    await sql`
      INSERT INTO cosignaties (id, datum, tijd, naam, email, telefoon, merk, model, bouwjaar, km,
        vraagprijs, opmerking, aantal_fotos, status, notitie, geaccepteerd_op,
        kleur, brandstof, bodytype, apk, vermogen)
      VALUES (${id}, ${datum}, ${tijd}, ${naam ?? ""}, ${email ?? ""}, ${telefoon ?? ""},
              ${merk ?? ""}, ${model ?? ""}, ${bouwjaar ?? ""}, ${km ?? ""},
              ${vraagprijs ?? ""}, ${opmerking ?? ""}, 0, 'geaccepteerd', '', ${geaccepteerd_op}::date,
              ${kleur ?? ""}, ${brandstof ?? ""}, ${bodytype ?? ""}, ${apk ?? ""}, ${vermogen ?? ""})
    `;
    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

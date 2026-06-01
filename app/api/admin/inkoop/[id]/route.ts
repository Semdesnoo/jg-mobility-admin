import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await sql`
    UPDATE inkoop_dossiers SET
      datum        = COALESCE(${body.datum        ?? null}, datum),
      merk         = COALESCE(${body.merk         ?? null}, merk),
      model        = COALESCE(${body.model        ?? null}, model),
      bouwjaar     = COALESCE(${body.bouwjaar     ?? null}, bouwjaar),
      km           = COALESCE(${body.km           ?? null}, km),
      kenteken     = COALESCE(${body.kenteken     ?? null}, kenteken),
      kleur        = COALESCE(${body.kleur        ?? null}, kleur),
      vin          = COALESCE(${body.vin          ?? null}, vin),
      aanbod_prijs = COALESCE(${body.aanbod_prijs ?? null}, aanbod_prijs),
      bod_prijs    = COALESCE(${body.bod_prijs    ?? null}, bod_prijs),
      aankoopprijs = COALESCE(${body.aankoopprijs ?? null}, aankoopprijs),
      naam         = COALESCE(${body.naam         ?? null}, naam),
      telefoon     = COALESCE(${body.telefoon     ?? null}, telefoon),
      email        = COALESCE(${body.email        ?? null}, email),
      status       = COALESCE(${body.status       ?? null}, status),
      notitie      = COALESCE(${body.notitie      ?? null}, notitie)
    WHERE id = ${id}
  `;
  const row = await sql`SELECT * FROM inkoop_dossiers WHERE id = ${id}`;
  return Response.json(row[0] ?? null);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await sql`DELETE FROM inkoop_dossiers WHERE id = ${id}`;
  return Response.json({ ok: true });
}

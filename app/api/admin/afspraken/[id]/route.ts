import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await sql`
    UPDATE afspraken SET
      datum          = COALESCE(${body.datum          ?? null}, datum),
      tijd           = COALESCE(${body.tijd           ?? null}, tijd),
      type           = COALESCE(${body.type           ?? null}, type),
      klant_naam     = COALESCE(${body.klant_naam     ?? null}, klant_naam),
      klant_telefoon = COALESCE(${body.klant_telefoon ?? null}, klant_telefoon),
      klant_email    = COALESCE(${body.klant_email    ?? null}, klant_email),
      auto_naam      = COALESCE(${body.auto_naam      ?? null}, auto_naam),
      notitie        = COALESCE(${body.notitie        ?? null}, notitie),
      status         = COALESCE(${body.status         ?? null}, status)
    WHERE id = ${id}
  `;
  const row = await sql`SELECT * FROM afspraken WHERE id = ${id}`;
  return Response.json(row[0] ?? null);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await sql`DELETE FROM afspraken WHERE id = ${id}`;
  return Response.json({ ok: true });
}

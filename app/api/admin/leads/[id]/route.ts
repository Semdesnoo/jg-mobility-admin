import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await sql`
    UPDATE leads SET
      naam      = COALESCE(${body.naam      ?? null}, naam),
      telefoon  = COALESCE(${body.telefoon  ?? null}, telefoon),
      email     = COALESCE(${body.email     ?? null}, email),
      bron      = COALESCE(${body.bron      ?? null}, bron),
      interesse = COALESCE(${body.interesse ?? null}, interesse),
      budget    = COALESCE(${body.budget    ?? null}, budget),
      notitie   = COALESCE(${body.notitie   ?? null}, notitie),
      status    = COALESCE(${body.status    ?? null}, status)
    WHERE id = ${id}
  `;
  const row = await sql`SELECT * FROM leads WHERE id = ${id}`;
  return Response.json(row[0] ?? null);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await sql`DELETE FROM leads WHERE id = ${id}`;
  return Response.json({ ok: true });
}

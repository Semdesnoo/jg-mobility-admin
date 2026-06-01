import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await sql`
    UPDATE klanten SET
      naam     = COALESCE(${body.naam     ?? null}, naam),
      email    = COALESCE(${body.email    ?? null}, email),
      telefoon = COALESCE(${body.telefoon ?? null}, telefoon),
      adres    = COALESCE(${body.adres    ?? null}, adres),
      stad     = COALESCE(${body.stad     ?? null}, stad),
      notitie  = COALESCE(${body.notitie  ?? null}, notitie)
    WHERE id = ${id}
  `;
  const row = await sql`SELECT * FROM klanten WHERE id = ${id}`;
  return Response.json(row[0] ?? null);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await sql`DELETE FROM klanten WHERE id = ${id}`;
  return Response.json({ ok: true });
}

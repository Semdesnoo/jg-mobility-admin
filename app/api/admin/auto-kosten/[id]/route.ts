import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await sql`
    UPDATE auto_kosten SET
      omschrijving = COALESCE(${body.omschrijving ?? null}, omschrijving),
      bedrag       = COALESCE(${body.bedrag       ?? null}, bedrag),
      datum        = COALESCE(${body.datum        ?? null}, datum)
    WHERE id = ${id}
  `;
  const row = await sql`SELECT * FROM auto_kosten WHERE id = ${id}`;
  return Response.json(row[0] ?? null);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await sql`DELETE FROM auto_kosten WHERE id = ${id}`;
  return Response.json({ ok: true });
}

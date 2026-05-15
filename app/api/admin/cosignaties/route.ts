import sql from "@/lib/db";

export const dynamic = "force-dynamic";

async function migrate() {
  try {
    await sql`ALTER TABLE cosignaties ADD COLUMN IF NOT EXISTS concurrent_prijs TEXT`;
    await sql`ALTER TABLE cosignaties ADD COLUMN IF NOT EXISTS geaccepteerd_op DATE`;
    await sql`ALTER TABLE cosignaties ADD COLUMN IF NOT EXISTS platform_prijzen JSONB DEFAULT '{}'`;
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

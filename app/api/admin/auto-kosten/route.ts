import sql from "@/lib/db";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const autoId = searchParams.get("auto_id");
  try {
    const rows = autoId
      ? await sql`SELECT * FROM auto_kosten WHERE auto_id = ${Number(autoId)} ORDER BY aangemaakt DESC`
      : await sql`SELECT * FROM auto_kosten ORDER BY aangemaakt DESC`;
    return Response.json(rows);
  } catch {
    return Response.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = randomUUID();
  const row = await sql`
    INSERT INTO auto_kosten (id, auto_id, omschrijving, bedrag, datum)
    VALUES (${id}, ${body.auto_id}, ${body.omschrijving ?? ""}, ${body.bedrag ?? 0},
            ${body.datum ?? new Date().toLocaleDateString("nl-NL")})
    RETURNING *
  `;
  return Response.json(row[0], { status: 201 });
}

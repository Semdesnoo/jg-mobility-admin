import sql from "@/lib/db";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM afspraken ORDER BY datum DESC, tijd DESC`;
    return Response.json(rows);
  } catch {
    return Response.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = randomUUID();
  const row = await sql`
    INSERT INTO afspraken (id, datum, tijd, type, klant_naam, klant_telefoon, klant_email, auto_naam, notitie, status)
    VALUES (${id}, ${body.datum ?? ""}, ${body.tijd ?? ""}, ${body.type ?? "proefrit"},
            ${body.klant_naam ?? ""}, ${body.klant_telefoon ?? ""}, ${body.klant_email ?? ""},
            ${body.auto_naam ?? ""}, ${body.notitie ?? ""}, ${body.status ?? "gepland"})
    RETURNING *
  `;
  return Response.json(row[0], { status: 201 });
}

import sql from "@/lib/db";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM klanten ORDER BY aangemaakt DESC`;
    return Response.json(rows);
  } catch {
    return Response.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = randomUUID();
  const row = await sql`
    INSERT INTO klanten (id, naam, email, telefoon, adres, stad, notitie)
    VALUES (${id}, ${body.naam ?? ""}, ${body.email ?? ""}, ${body.telefoon ?? ""},
            ${body.adres ?? ""}, ${body.stad ?? ""}, ${body.notitie ?? ""})
    RETURNING *
  `;
  return Response.json(row[0], { status: 201 });
}

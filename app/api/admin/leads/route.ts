import sql from "@/lib/db";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM leads ORDER BY aangemaakt DESC`;
    return Response.json(rows);
  } catch {
    return Response.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = randomUUID();
  const row = await sql`
    INSERT INTO leads (id, naam, telefoon, email, bron, interesse, budget, notitie, status)
    VALUES (${id}, ${body.naam ?? ""}, ${body.telefoon ?? ""}, ${body.email ?? ""},
            ${body.bron ?? "website"}, ${body.interesse ?? ""}, ${body.budget ?? ""},
            ${body.notitie ?? ""}, ${body.status ?? "nieuw"})
    RETURNING *
  `;
  return Response.json(row[0], { status: 201 });
}

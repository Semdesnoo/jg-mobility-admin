import { NextRequest } from "next/server";
import { getAuthedClient } from "@/lib/gmail-client";
import { google } from "googleapis";
import sql from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { html } = await req.json();

  if (!html) {
    return Response.json({ error: "HTML ontbreekt" }, { status: 400 });
  }

  const rows = await sql`SELECT * FROM facturen WHERE id = ${id}`;
  if (rows.length === 0) {
    return Response.json({ error: "Factuur niet gevonden" }, { status: 404 });
  }

  const factuur = rows[0];
  if (!factuur.klant_email) {
    return Response.json({ error: "Klant heeft geen e-mailadres" }, { status: 400 });
  }

  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });

    const subject = `Factuur ${factuur.factuur_nr} - JG Mobility`;
    const rawMessage = [
      `To: ${factuur.klant_email}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      "",
      html,
    ].join("\r\n");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: Buffer.from(rawMessage).toString("base64url"),
      },
    });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

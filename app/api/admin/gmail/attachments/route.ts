import { NextRequest } from "next/server";
import { getAuthedClient } from "@/lib/gmail-client";
import { google } from "googleapis";
import { verzamelBijlagen, pdfEerst } from "@/lib/gmail-bijlagen";

export const dynamic = "force-dynamic";

/** Lijst van bijlagen bij een Gmail-bericht — gebruikt om de originele
 *  factuur-PDF te openen die een leverancier heeft meegestuurd. */
export async function GET(req: NextRequest) {
  const messageId = req.nextUrl.searchParams.get("messageId");
  if (!messageId) return Response.json({ error: "messageId ontbreekt" }, { status: 400 });

  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });
    const msg = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
    return Response.json({ bijlagen: pdfEerst(verzamelBijlagen(msg.data.payload ?? undefined)) });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

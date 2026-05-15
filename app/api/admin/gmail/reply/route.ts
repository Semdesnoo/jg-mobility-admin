import { NextRequest } from "next/server";
import { getAuthedClient } from "@/lib/gmail-client";
import { google } from "googleapis";

export async function POST(req: NextRequest) {
  const { threadId, to, subject, message, messageId } = await req.json();

  if (!threadId || !to || !message) {
    return Response.json({ error: "Verplichte velden ontbreken" }, { status: 400 });
  }

  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });

    const replySubject = subject?.startsWith("Re:") ? subject : `Re: ${subject}`;
    const rawMessage = [
      `To: ${to}`,
      `Subject: ${replySubject}`,
      `In-Reply-To: ${messageId}`,
      `References: ${messageId}`,
      `Content-Type: text/plain; charset=utf-8`,
      "",
      message,
    ].join("\r\n");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: Buffer.from(rawMessage).toString("base64url"),
        threadId,
      },
    });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

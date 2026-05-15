import { NextRequest } from "next/server";
import { getAuthedClient } from "@/lib/gmail-client";
import { google } from "googleapis";

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

function decodeBody(data?: string | null): string {
  if (!data) return "";
  try {
    return Buffer.from(data, "base64url").toString("utf-8");
  } catch {
    return "";
  }
}

function extractBody(payload: GmailPart): string {
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBody(payload.body.data);
  }
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBody(payload.body.data).replace(/\n/g, "<br>");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const body = extractBody(part);
      if (body) return body;
    }
  }
  return "";
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });

    const msg = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });

    await gmail.users.messages.modify({
      userId: "me",
      id,
      requestBody: { removeLabelIds: ["UNREAD"] },
    });

    const headers = msg.data.payload?.headers ?? [];
    const get = (name: string) =>
      headers.find((h) => h.name === name)?.value ?? "";

    return Response.json({
      id: msg.data.id,
      threadId: msg.data.threadId,
      from: get("From"),
      subject: get("Subject"),
      date: get("Date"),
      body: extractBody(msg.data.payload as GmailPart),
      messageId: get("Message-ID"),
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

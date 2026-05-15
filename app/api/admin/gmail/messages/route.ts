import { NextRequest } from "next/server";
import { getAuthedClient } from "@/lib/gmail-client";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const type = new URL(req.url).searchParams.get("type") ?? "inbox";

  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });

    const query =
      type === "cosignatie"
        ? "in:inbox subject:cosignatie OR subject:aanmelding OR subject:inkopen"
        : "in:inbox";

    const list = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 20,
    });

    const messages = list.data.messages ?? [];

    const details = await Promise.all(
      messages.slice(0, 15).map(async (m) => {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: m.id!,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });

        const headers = msg.data.payload?.headers ?? [];
        const get = (name: string) =>
          headers.find((h) => h.name === name)?.value ?? "";

        return {
          id: m.id,
          threadId: msg.data.threadId,
          from: get("From"),
          subject: get("Subject"),
          date: get("Date"),
          snippet: msg.data.snippet ?? "",
          unread: msg.data.labelIds?.includes("UNREAD") ?? false,
        };
      })
    );

    return Response.json(details);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

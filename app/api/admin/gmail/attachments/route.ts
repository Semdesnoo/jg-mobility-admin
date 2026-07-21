import { NextRequest } from "next/server";
import { getAuthedClient } from "@/lib/gmail-client";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

type Deel = {
  mimeType?: string | null;
  filename?: string | null;
  body?: { attachmentId?: string | null; size?: number | null } | null;
  parts?: unknown[];
};

type Bijlage = { attachmentId: string; filename: string; mimeType: string; size: number };

/** Loopt de MIME-boom af en verzamelt alle échte bijlagen: een bestandsnaam én
 *  een attachmentId. Inline handtekening-plaatjes (zonder naam) vallen zo af. */
function verzamelBijlagen(deel: Deel | undefined, uit: Bijlage[] = []): Bijlage[] {
  if (!deel) return uit;
  const naam = (deel.filename ?? "").trim();
  const attId = deel.body?.attachmentId ?? "";
  if (naam && attId) {
    uit.push({
      attachmentId: attId,
      filename: naam,
      mimeType: deel.mimeType ?? "application/octet-stream",
      size: deel.body?.size ?? 0,
    });
  }
  for (const kind of (deel.parts ?? []) as Deel[]) verzamelBijlagen(kind, uit);
  return uit;
}

/** Lijst van bijlagen bij een Gmail-bericht — gebruikt om de originele
 *  factuur-PDF te openen die een leverancier heeft meegestuurd. */
export async function GET(req: NextRequest) {
  const messageId = req.nextUrl.searchParams.get("messageId");
  if (!messageId) return Response.json({ error: "messageId ontbreekt" }, { status: 400 });

  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });
    const msg = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
    const bijlagen = verzamelBijlagen(msg.data.payload as Deel);
    // PDF's bovenaan — dat is doorgaans de factuur zelf.
    bijlagen.sort((a, b) => (a.mimeType === "application/pdf" ? 0 : 1) - (b.mimeType === "application/pdf" ? 0 : 1));
    return Response.json({ bijlagen });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

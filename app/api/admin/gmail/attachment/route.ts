import { NextRequest } from "next/server";
import { getAuthedClient } from "@/lib/gmail-client";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

/** Haalt één bijlage op uit een Gmail-bericht en stuurt de bytes terug. `inline`
 *  zodat een PDF direct in een nieuw tabblad opent; de bestandsnaam blijft
 *  behouden als je hem bewaart. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const messageId = sp.get("messageId");
  const attachmentId = sp.get("attachmentId");
  const mimeType = sp.get("mimeType") || "application/octet-stream";
  const naam = sp.get("name") || "bijlage";

  if (!messageId || !attachmentId) {
    return Response.json({ error: "messageId en attachmentId zijn verplicht" }, { status: 400 });
  }

  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });
    const att = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId,
    });
    const data = att.data.data;
    if (!data) return Response.json({ error: "Bijlage heeft geen inhoud" }, { status: 404 });

    const buf = Buffer.from(data, "base64url");
    // Alleen tekens die veilig zijn in een Content-Disposition header.
    const veiligeNaam = naam.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${veiligeNaam}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

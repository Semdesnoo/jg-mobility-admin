import { createOAuth2Client } from "@/lib/gmail-client";

export async function GET() {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return Response.json(
      { error: "GMAIL_CLIENT_ID en GMAIL_CLIENT_SECRET zijn niet ingesteld in .env.local" },
      { status: 503 }
    );
  }

  const auth = createOAuth2Client();
  const url = auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    // Alleen de rechten die we echt gebruiken: lezen (mailwidget), versturen
    // (facturen, cosignatie-updates, verkopersradar) en modify (een bericht als
    // gelezen markeren). gmail.compose stond hier ook, maar wordt nergens gebruikt —
    // eraf, want elk extra recht is er één die je niet nodig had.
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  });

  return Response.redirect(url);
}

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
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  });

  return Response.redirect(url);
}

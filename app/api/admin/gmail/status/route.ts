import { isGmailConnected } from "@/lib/gmail-client";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ connected: await isGmailConnected() });
}

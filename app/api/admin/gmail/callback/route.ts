import { NextRequest } from "next/server";
import { createOAuth2Client, saveTokens } from "@/lib/gmail-client";

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code");

  if (!code) {
    return Response.redirect(new URL("/admin/dashboard?gmail=error", req.url));
  }

  try {
    const auth = createOAuth2Client();
    const { tokens } = await auth.getToken(code);
    await saveTokens(tokens);
    return Response.redirect(new URL("/admin/dashboard?gmail=connected", req.url));
  } catch {
    return Response.redirect(new URL("/admin/dashboard?gmail=error", req.url));
  }
}

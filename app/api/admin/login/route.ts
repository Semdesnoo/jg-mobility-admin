import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return Response.json({ error: "ADMIN_PASSWORD is niet ingesteld" }, { status: 500 });
  }

  if (password !== adminPassword) {
    return Response.json({ error: "Ongeldig wachtwoord" }, { status: 401 });
  }

  const maxAge = 7 * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const response = Response.json({ ok: true });
  response.headers.set(
    "Set-Cookie",
    `admin_token=${adminPassword}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${maxAge}`
  );
  return response;
}

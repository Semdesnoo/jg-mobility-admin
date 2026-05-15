import { google } from "googleapis";
import sql from "./db";

const REDIRECT_URI =
  process.env.GMAIL_REDIRECT_URI ?? "http://localhost:3000/api/admin/gmail/callback";

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    REDIRECT_URI
  );
}

export async function isGmailConnected(): Promise<boolean> {
  try {
    const rows = await sql`SELECT value FROM settings WHERE key = 'gmail_tokens'`;
    if (rows.length === 0) return false;
    const tokens = JSON.parse(rows[0].value as string);
    return !!tokens.refresh_token;
  } catch {
    return false;
  }
}

export async function getAuthedClient() {
  const rows = await sql`SELECT value FROM settings WHERE key = 'gmail_tokens'`;
  if (rows.length === 0) throw new Error("Gmail niet gekoppeld");
  const tokens = JSON.parse(rows[0].value as string);
  const auth = createOAuth2Client();
  auth.setCredentials(tokens);

  // Sla vernieuwde tokens automatisch op zodat de access_token niet vervalt
  auth.on("tokens", async (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    await saveTokens(merged).catch(() => null);
  });

  return auth;
}

export async function saveTokens(tokens: object): Promise<void> {
  const value = JSON.stringify(tokens);
  await sql`
    INSERT INTO settings (key, value) VALUES ('gmail_tokens', ${value})
    ON CONFLICT (key) DO UPDATE SET value = ${value}
  `;
}

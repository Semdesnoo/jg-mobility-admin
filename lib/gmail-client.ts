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

/**
 * Is de koppeling blijvend, of heeft Google er een houdbaarheidsdatum aan gehangen?
 *
 * Normaal verloopt een refresh token niet en ontbreekt `refresh_token_expires_in`.
 * Staat dat veld er wél, dan is de koppeling tijdelijk — dat gebeurt als het
 * OAuth-toestemmingsscherm op External + Testing stond: Google geeft dan een token
 * dat na 7 dagen sterft. Zonder deze controle merk je dat pas op het moment dat je
 * iets wilt versturen, en dat is precies het verkeerde moment.
 */
export async function getTokenInfo(): Promise<{
  gekoppeld: boolean;
  blijvend: boolean;
  verlooptOp: string | null;
}> {
  try {
    const rijen = await sql`SELECT value FROM settings WHERE key = 'gmail_tokens'`;
    if (rijen.length === 0) return { gekoppeld: false, blijvend: false, verlooptOp: null };
    const t = JSON.parse(rijen[0].value as string);
    if (!t.refresh_token) return { gekoppeld: false, blijvend: false, verlooptOp: null };

    const resterend = Number(t.refresh_token_expires_in);
    if (!Number.isFinite(resterend) || resterend <= 0) {
      return { gekoppeld: true, blijvend: true, verlooptOp: null };
    }
    // `refresh_token_expires_in` is de resterende tijd op het moment van de laatste
    // vernieuwing; het access token verliep een uur na diezelfde vernieuwing.
    const laatsteVernieuwing = t.expiry_date ? Number(t.expiry_date) - 3600 * 1000 : Date.now();
    return {
      gekoppeld: true,
      blijvend: false,
      verlooptOp: new Date(laatsteVernieuwing + resterend * 1000).toISOString(),
    };
  } catch {
    return { gekoppeld: false, blijvend: false, verlooptOp: null };
  }
}

export async function saveTokens(tokens: object): Promise<void> {
  const value = JSON.stringify(tokens);
  await sql`
    INSERT INTO settings (key, value) VALUES ('gmail_tokens', ${value})
    ON CONFLICT (key) DO UPDATE SET value = ${value}
  `;
}

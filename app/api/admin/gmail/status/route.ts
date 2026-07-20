import { google } from "googleapis";
import { isGmailConnected, getAuthedClient } from "@/lib/gmail-client";

export const dynamic = "force-dynamic";

/**
 * Werkt de Gmail-koppeling écht?
 *
 * Alleen kijken of er een token in de database staat is niet genoeg: een refresh
 * token kan verlopen of ingetrokken zijn terwijl het er nog gewoon staat. Dat
 * gaf eerder "connected: true" bij een dood token, waardoor de mailwidget bleef
 * laden zonder uitleg. Daarom doet deze route één goedkope echte aanroep.
 */
export async function GET() {
  if (!(await isGmailConnected())) {
    return Response.json({ connected: false, reden: "niet_gekoppeld" });
  }

  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });
    // Lichtste aanroep die er is: alleen het profiel, geen berichten ophalen.
    const profiel = await gmail.users.getProfile({ userId: "me" });
    return Response.json({ connected: true, adres: profiel.data.emailAddress ?? "" });
  } catch (err) {
    const bericht = err instanceof Error ? err.message : String(err);
    const verlopen = bericht.includes("invalid_grant");
    return Response.json({
      connected: false,
      reden: verlopen ? "verlopen" : "fout",
      melding: verlopen
        ? "De Gmail-koppeling is verlopen. Koppel je mailbox opnieuw via Instellingen → Gmail."
        : bericht,
    });
  }
}

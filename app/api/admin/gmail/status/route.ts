import { google } from "googleapis";
import { isGmailConnected, getAuthedClient, getTokenInfo } from "@/lib/gmail-client";

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

    // Werkt hij nú? Mooi. Maar meld het ook als Google er een einddatum aan hangt,
    // zodat je het ziet aankomen in plaats van erachter komt bij het versturen.
    const info = await getTokenInfo();
    const dagen = info.verlooptOp
      ? Math.floor((new Date(info.verlooptOp).getTime() - Date.now()) / 86400000)
      : null;

    return Response.json({
      connected: true,
      adres: profiel.data.emailAddress ?? "",
      blijvend: info.blijvend,
      verlooptOp: info.verlooptOp,
      waarschuwing: info.blijvend
        ? null
        : `Deze koppeling is tijdelijk en verloopt${
            dagen !== null ? ` over ${dagen} dag${dagen === 1 ? "" : "en"}` : ""
          }. Dat gebeurt als het OAuth-scherm in Google Cloud op 'External' + 'Testing' staat. Zet het op 'Internal' en koppel daarna opnieuw.`,
    });
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

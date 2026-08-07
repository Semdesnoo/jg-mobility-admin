import { google } from "googleapis";
import sql from "./db";
import { getAuthedClient, getHandtekening } from "./gmail-client";
import { getLead, isGeblokkeerd, isGeldigEmail, logContact, type VerkoperLead } from "./verkopers-db";

/**
 * Verstuurt één bericht via Gmail (info@jgmobility.nl) en legt het vast.
 *
 * Alle veiligheidscontroles zitten HIER, niet in de knop erboven. Dat is bewust: of
 * een mens klikt of de autopilot draait, dezelfde poortwachters staan ertussen. Een
 * controle die alleen in de UI zit, is geen controle.
 */

/** Niet-ASCII in een e-mailonderwerp moet RFC 2047-gecodeerd (anders komen accenten verminkt aan). */
function codeerOnderwerp(onderwerp: string): string {
  if (/^[\x00-\x7F]*$/.test(onderwerp)) return onderwerp;
  return `=?UTF-8?B?${Buffer.from(onderwerp, "utf-8").toString("base64")}?=`;
}

/**
 * De verplichte afmeldregel. Kort en onderaan, onder de handtekening: het hoort
 * er juridisch te staan, maar het is geen onderdeel van de boodschap.
 */
const AFMELDREGEL = (advertentieUrl: string) =>
  `Je krijgt dit bericht eenmalig omdat je deze auto zelf openbaar te koop hebt gezet${
    advertentieUrl ? ` (${advertentieUrl})` : ""
  }. Liever geen bericht meer? Antwoord met "geen interesse" — dan hoor je nooit meer iets van ons.`;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Platte tekst naar HTML-alinea's, met de regelafbrekingen intact. */
function naarHtml(tekst: string): string {
  return escapeHtml(tekst).replace(/\r?\n/g, "<br>");
}

/** Grove tekstversie van HTML — voor de tekstvariant van de mail. */
function naarTekst(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Base64 in regels van 76 tekens, zoals MIME voorschrijft. */
function base64Mime(s: string): string {
  return (Buffer.from(s, "utf-8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");
}

/**
 * Bouwt de mail op als multipart/alternative: een nette HTML-versie mét de
 * handtekening uit Gmail, en een tekstversie voor mailprogramma's die geen HTML
 * tonen. Beide dragen dezelfde inhoud; alleen zo komt het logo mee én blijft de
 * mail leesbaar als HTML geweigerd wordt.
 */
function bouwBericht(opts: {
  aan: string;
  onderwerp: string;
  bericht: string;
  handtekeningHtml: string;
  afmeldregel: string;
}): { raw: string; tekstversie: string } {
  const grens = `jgm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  const handtekeningTekst = opts.handtekeningHtml ? naarTekst(opts.handtekeningHtml) : "";
  const tekstversie = [opts.bericht, handtekeningTekst, `—\n${opts.afmeldregel}`]
    .filter(Boolean)
    .join("\n\n");

  const htmlversie = [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6;">`,
    naarHtml(opts.bericht),
    opts.handtekeningHtml ? `<br><br>${opts.handtekeningHtml}` : "",
    `<br><br><hr style="border:none;border-top:1px solid #dddddd;margin:16px 0;">`,
    `<div style="font-size:11px;color:#888888;line-height:1.5;">${naarHtml(opts.afmeldregel)}</div>`,
    `</div>`,
  ].join("");

  const raw = [
    `To: ${opts.aan}`,
    `Subject: ${codeerOnderwerp(opts.onderwerp)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${grens}"`,
    "",
    `--${grens}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Mime(tekstversie),
    `--${grens}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Mime(htmlversie),
    `--${grens}--`,
    "",
  ].join("\r\n");

  return { raw, tekstversie };
}

export type VerzendResultaat =
  | { ok: true }
  | { ok: false; reden: string; status: number; geblokkeerd?: boolean };

/**
 * Hoeveel berichten zijn er vandaag al de deur uit? Telt uit het verzendlog, want dat
 * is de enige bron die ook meetelt wat handmatig of via een eerdere run is verstuurd.
 */
export async function aantalVandaagVerstuurd(): Promise<number> {
  const rijen = await sql`
    SELECT COUNT(*)::int AS n FROM verkoper_contactlog
    WHERE kanaal = 'mail' AND verstuurd_op >= date_trunc('day', now())
  `;
  return (rijen[0]?.n as number) ?? 0;
}

/**
 * De poortwachters. Geeft null terug als er niets aan de hand is, anders de reden
 * waarom er niet verstuurd mag worden.
 */
export async function controleerVerzendbaar(
  lead: VerkoperLead,
  onderwerp: string,
  bericht: string
): Promise<{ reden: string; status: number; geblokkeerd?: boolean } | null> {
  if (!bericht.trim()) return { reden: "Geen bericht om te versturen", status: 400 };
  if (!onderwerp.trim()) return { reden: "Geen onderwerp ingevuld", status: 400 };
  if (!lead.email) {
    return {
      reden: "Geen e-mailadres bekend. Gebruik het korte bericht via de berichtenbox van het platform.",
      status: 400,
    };
  }
  // Laatste vangnet tegen een verkeerd overgenomen of vertypt adres: een mail naar de
  // verkeerde ontvanger is niet terug te halen.
  if (!isGeldigEmail(lead.email)) {
    return { reden: `"${lead.email}" is geen geldig e-mailadres`, status: 400 };
  }
  if (lead.status === "verstuurd" || lead.status === "gereageerd" || lead.verstuurd_op) {
    return { reden: "Er is al een bericht naar deze verkoper gestuurd", status: 409 };
  }
  // Tussen vinden en versturen kan iemand zich hebben afgemeld.
  if (await isGeblokkeerd(lead.email, lead.telefoon)) {
    return { reden: "Deze verkoper staat op de blokkadelijst", status: 403, geblokkeerd: true };
  }
  return null;
}

/** Verstuurt daadwerkelijk. Voert zelf opnieuw alle controles uit. */
export async function verstuurBericht(
  leadId: string,
  onderwerpIn?: string,
  berichtIn?: string
): Promise<VerzendResultaat> {
  const lead = await getLead(leadId);
  if (!lead) return { ok: false, reden: "Lead niet gevonden", status: 404 };

  const onderwerp = (onderwerpIn ?? lead.onderwerp ?? "").trim();
  const bericht = (berichtIn ?? lead.bericht_mail ?? "").trim();

  const bezwaar = await controleerVerzendbaar(lead, onderwerp, bericht);
  if (bezwaar) {
    if (bezwaar.geblokkeerd) {
      await sql`UPDATE verkoper_leads SET status = 'afgewezen', notitie = 'Staat op blokkadelijst' WHERE id = ${leadId}`;
    }
    return { ok: false, ...bezwaar };
  }

  // De handtekening komt uit Gmail zelf, zodat een wijziging daar automatisch
  // meegaat. Lukt ophalen niet, dan gaat de mail gewoon zonder — beter een mail
  // zonder logo dan geen mail.
  const handtekening = await getHandtekening();
  const { raw, tekstversie } = bouwBericht({
    aan: lead.email,
    onderwerp,
    bericht,
    handtekeningHtml: handtekening,
    afmeldregel: AFMELDREGEL(lead.advertentie_url),
  });
  const volledigBericht = tekstversie;

  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: Buffer.from(raw, "utf-8").toString("base64url") },
    });
  } catch (err) {
    return { ok: false, reden: `Versturen mislukt: ${String(err)}`, status: 500 };
  }

  await sql`
    UPDATE verkoper_leads
    SET status = 'verstuurd', verstuurd_op = NOW(), verstuurd_via = 'mail'
    WHERE id = ${leadId}
  `;
  await logContact({
    leadId,
    kanaal: "mail",
    ontvanger: lead.email,
    onderwerp,
    inhoud: volledigBericht,
    advertentieUrl: lead.advertentie_url,
  }).catch(() => null);

  return { ok: true };
}

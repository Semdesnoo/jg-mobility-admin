import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import { getAuthedClient } from "@/lib/gmail-client";
import { bijMessageId, voegAanvraagToe } from "@/lib/aanvragen-db";

export const dynamic = "force-dynamic";
// Gmail ophalen plus één modelaanroep past ruim binnen een halve minuut; de
// modelaanroep heeft hieronder zelf ook nog een kortere afkapgrens.
export const maxDuration = 30;

/**
 * Zet één Gmail-bericht om in een aanvraag in het dagoverzicht.
 *
 * Hangt achter de knop "Zet in overzicht" bij een mail. De knop mag nooit stukgaan:
 * lukt het uitlezen door het model niet, dan komt de aanvraag er alsnog met wat er
 * uit de mailheaders te halen valt. Een aanvraag met minder velden is oneindig veel
 * beter dan een knop die niets doet.
 */

const MODEL = "claude-haiku-4-5-20251001";

/**
 * Wachttijd voor het model. Bewust kort: Vercel kapt de functie af, en dan zou de
 * gebruiker een foutmelding zien in plaats van een aanvraag. Loopt het model hier
 * overheen, dan valt hij terug op de headers en gaat de aanvraag er gewoon in.
 */
const MODEL_TIMEOUT_MS = 18000;

/** Zoveel tekens van de mail gaan naar het model. Genoeg voor de feiten, scheelt tijd. */
const MAX_BODY_TEKENS = 6000;

type GmailDeel = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailDeel[];
};

function decodeBody(data?: string | null): string {
  if (!data) return "";
  try {
    return Buffer.from(data, "base64url").toString("utf-8");
  } catch {
    return "";
  }
}

/**
 * Haalt de body uit de MIME-boom. Zelfde aanpak als de route die één mail toont
 * (`app/api/admin/gmail/message/[id]/route.ts`), zodat we hier hetzelfde te zien
 * krijgen als de gebruiker op zijn scherm.
 */
function haalBody(deel: GmailDeel): string {
  if (deel.mimeType === "text/html" && deel.body?.data) {
    return decodeBody(deel.body.data);
  }
  if (deel.mimeType === "text/plain" && deel.body?.data) {
    return decodeBody(deel.body.data).replace(/\n/g, "<br>");
  }
  if (deel.parts) {
    for (const p of deel.parts) {
      const body = haalBody(p);
      if (body) return body;
    }
  }
  return "";
}

/**
 * Van HTML naar leesbare tekst.
 *
 * De body komt als HTML binnen omdat het scherm die zo nodig heeft. Voor het model
 * en voor het notitieveld is opmaak alleen maar ruis die tokens en leesbaarheid kost.
 */
function naarTekst(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "Jan Jansen <jan@example.nl>" uit elkaar trekken. */
function splitsAfzender(from: string): { naam: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { naam: m[1].replace(/^"|"$/g, "").trim(), email: m[2].trim() };
  const kaal = from.trim();
  return kaal.includes("@") ? { naam: "", email: kaal } : { naam: kaal, email: "" };
}

/**
 * Vist het laatste JSON-object uit een antwoord. Zelfde aanpak als in
 * `lib/verkopers-bericht.ts`: van achteren naar voren haakjes tellen, zodat
 * inleidende tekst of een codeblok eromheen niet uitmaakt.
 */
function extractLaatsteJson(tekst: string): string | null {
  const eind = tekst.lastIndexOf("}");
  if (eind === -1) return null;
  let diepte = 0;
  for (let i = eind; i >= 0; i--) {
    const c = tekst[i];
    if (c === "}") diepte++;
    else if (c === "{") {
      diepte--;
      if (diepte === 0) return tekst.slice(i, eind + 1);
    }
  }
  return null;
}

const SYSTEEM = `Je haalt de feiten uit een e-mail aan JG Mobility, een autobedrijf in Barendrecht. Dit is overtypwerk, geen schrijfwerk.

Neem alleen over wat er staat. Verzin niets: staat er geen telefoonnummer, dan blijft dat veld leeg. Een leeg veld is beter dan een verkeerd veld, want de eigenaar belt de klant op wat hier komt te staan.

Let op:
- De afzender kan onder de mail anders ondertekenen dan in het afzenderadres staat; de ondertekening is meestal de echte naam.
- Een kenteken is Nederlands, zes tekens in groepen (bijvoorbeeld XX-123-A of 12-XXX-3). Streepjes mag je weglaten. Staat er geen kenteken, laat het veld dan leeg.
- Telefoonnummers overnemen zoals ze er staan, zonder spaties eromheen.
- Automatische mails, nieuwsbrieven en meldingen van portals hebben vaak geen persoon als afzender; laat naam dan leeg.

Antwoord met UITSLUITEND dit JSON-object, zonder tekst eromheen:
{
  "naam": "naam van de klant, leeg als die er niet is",
  "email": "e-mailadres van de klant",
  "telefoon": "telefoonnummer, leeg als het er niet in staat",
  "onderwerp": "in één korte Nederlandse regel waar de mail over gaat, bijvoorbeeld 'Vraagt proefrit Golf' of 'Wil auto laten taxeren'",
  "kenteken": "kenteken, leeg als er geen in staat",
  "advertentie_titel": "de auto waar de mail over gaat, zoals hij in de mail of in een advertentietitel staat — bijvoorbeeld 'Mercedes-Benz CLA 250 224pk 7G-DCT 2020 Zwart'. Leeg als er geen auto in staat.",
  "advertentie_url": "de link naar de advertentie als die in de mail staat (marktplaats.nl, autoscout24.nl, autotrack, gaspedaal). Leeg als er geen link in staat.",
  "bericht": "wat de klant LETTERLIJK schrijft, in zijn eigen woorden. Neem de kern van zijn tekst over zonder aanhef, ondertekening, disclaimers of platformruis. Vertaal niet en vat niet samen — dit moet leesbaar zijn als zijn bericht.",
  "samenvatting": "twee tot drie zinnen: wat de klant vraagt en wat er nodig is om te antwoorden"
}`;

type Uitgelezen = {
  naam?: string;
  email?: string;
  telefoon?: string;
  onderwerp?: string;
  kenteken?: string;
  advertentie_titel?: string;
  advertentie_url?: string;
  bericht?: string;
  samenvatting?: string;
};

/** Laat het model de feiten eruit halen. Geeft null terug als dat niet lukte. */
async function leesUit(
  onderwerp: string,
  afzender: string,
  datum: string,
  body: string
): Promise<Uitgelezen | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const controller = new AbortController();

  const opdracht = `Onderwerp: ${onderwerp || "(geen onderwerp)"}
Afzender: ${afzender || "(onbekend)"}
Datum: ${datum || "(onbekend)"}

Inhoud van de mail:
${body.slice(0, MAX_BODY_TEKENS)}`;

  const lezen = client.messages
    .create(
      {
        // Haiku 4.5: het goedkoopste model volstaat voor overtypwerk. Geen
        // `thinking` en geen `output_config.effort` — dit model geeft daar een
        // 400 op; alleen `max_tokens` dus.
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEEM,
        messages: [{ role: "user", content: opdracht }],
      },
      { signal: controller.signal }
    )
    .then((r) =>
      r.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
    )
    .catch(() => "");

  const afkappen = new Promise<string>((resolve) =>
    setTimeout(() => resolve(""), MODEL_TIMEOUT_MS)
  );
  const tekst = await Promise.race([lezen, afkappen]);
  controller.abort();

  const json = extractLaatsteJson(tekst);
  if (!json) return null;
  try {
    return JSON.parse(json) as Uitgelezen;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let messageId = "";
  try {
    const body = (await req.json()) as { messageId?: string };
    messageId = (body.messageId ?? "").trim();
  } catch {
    return Response.json(
      { error: "Onleesbaar verzoek. Probeer het opnieuw of ververs de pagina." },
      { status: 400 }
    );
  }

  if (!messageId) {
    return Response.json(
      { error: "Geen mail meegegeven. Open de mail opnieuw en probeer het nog een keer." },
      { status: 400 }
    );
  }

  // Staat deze mail er al? Twee keer op de knop drukken hoort niets te doen.
  let bestaand;
  try {
    bestaand = await bijMessageId(messageId);
  } catch {
    return Response.json(
      { error: "De database is even niet bereikbaar. Probeer het over een minuutje opnieuw." },
      { status: 503 }
    );
  }
  if (bestaand) return Response.json({ aanvraag: bestaand, bestond: true });

  // De mail ophalen. Bewust NIET als gelezen markeren: de gebruiker heeft hem open.
  let onderwerp = "";
  let afzender = "";
  let datum = "";
  let bodyHtml = "";
  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });
    const msg = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const headers = msg.data.payload?.headers ?? [];
    const header = (naam: string) =>
      headers.find((h) => h.name?.toLowerCase() === naam.toLowerCase())?.value ?? "";

    onderwerp = header("Subject");
    afzender = header("From");
    datum = header("Date");
    bodyHtml = haalBody((msg.data.payload ?? {}) as GmailDeel);
  } catch {
    return Response.json(
      {
        error:
          "De mail kon niet bij Gmail worden opgehaald. Controleer bij Instellingen of Gmail nog gekoppeld is en probeer het daarna opnieuw.",
      },
      { status: 502 }
    );
  }

  const bodyTekst = naarTekst(bodyHtml);
  const uitHeaders = splitsAfzender(afzender);

  // Faalt het model of ontbreekt de sleutel, dan gaat de aanvraag er alsnog in met
  // wat de headers ons vertellen. De knop moet altijd iets opleveren.
  const gelezen = await leesUit(onderwerp, afzender, datum, bodyTekst);

  const schoon = (w?: string) => (w ?? "").toString().trim();
  const kop = schoon(onderwerp) || "Mail zonder onderwerp";

  try {
    const aanvraag = await voegAanvraagToe({
      naam: schoon(gelezen?.naam) || uitHeaders.naam,
      email: schoon(gelezen?.email) || uitHeaders.email,
      telefoon: schoon(gelezen?.telefoon),
      bron: "mail",
      // `interesse` is het "waar gaat dit over"-regeltje in het overzicht; `onderwerp`
      // blijft de echte onderwerpregel van de mail, zodat je hem terugvindt.
      interesse: schoon(gelezen?.onderwerp) || kop,
      onderwerp: kop,
      kenteken: schoon(gelezen?.kenteken),
      // De auto en de link uit ZIJN advertentie, plus zijn eigen woorden. Zonder deze drie
      // moet je bij elk gesprek terugzoeken waar het ook alweer over ging — en dan belandt
      // de autotitel in het notitieveld, want daar was het de enige plek voor.
      advertentieTitel: schoon(gelezen?.advertentie_titel),
      advertentieUrl: schoon(gelezen?.advertentie_url),
      bericht: schoon(gelezen?.bericht) || bodyTekst.slice(0, 1200),
      notitie: schoon(gelezen?.samenvatting),
      gmailMessageId: messageId,
    });

    return Response.json({ aanvraag, bestond: false });
  } catch {
    return Response.json(
      { error: "De aanvraag kon niet worden opgeslagen. Probeer het zo nog een keer." },
      { status: 500 }
    );
  }
}

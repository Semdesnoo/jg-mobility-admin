import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthedClient } from "@/lib/gmail-client";
import {
  bestaandeGmailIds,
  createInkoopFactuur,
  vindDubbeleFactuur,
  normaliseerLeverancier,
  markeerGescand,
} from "@/lib/inkoopfacturen-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Zoekt inkoopfacturen in de mailbox en zet ze in het dashboard.
 *
 * Werkwijze:
 *   1. Gmail doorzoeken op mails met een PDF-bijlage die op een factuur lijken.
 *   2. Al geïmporteerde mails overslaan (unieke index op gmail_message_id).
 *   3. Per PDF de bedragen laten uitlezen door Claude.
 *
 * Per aanroep wordt een beperkt aantal verwerkt: Vercel kapt functies af op 60s
 * en één PDF uitlezen kost al enkele seconden. De respons vertelt hoeveel er nog
 * wachten, zodat je gewoon nog een keer kunt scannen.
 */

// Per aanroep verwerken we een handvol mails: Vercel kapt functies af op 60s en
// één factuur uitlezen kost enkele seconden. De frontend rijgt de rondes aan
// elkaar tot alles op is, dus dit hoeft niet hoog — vier houdt ruime marge.
const MAX_PER_RONDE = 4;

const SYSTEM_PROMPT = `Je leest inkoopfacturen voor een Nederlands autobedrijf. De
invoer is óf een factuur-PDF, óf de tekst van een e-mail (bijvoorbeeld een order-
of bestelbevestiging met een totaalbedrag).

- Bedragen als getal, zonder valutateken.
- "bedrag_incl" is het eindtotaal inclusief BTW (bij een bestelbevestiging is dat
  het genoemde totaalbedrag / "totale kosten").
- "btw_bedrag" is het apart vermelde BTW-bedrag; 0 als er geen BTW op staat.
- "btw_tarief" is 21, 9 of 0.
- Datums als JJJJ-MM-DD. Geen vervaldatum vermeld? Laat leeg.
- Staat er geen apart factuurnummer maar wel een order- of ordernummer, gebruik
  dat dan als "factuurnummer".
- "is_factuur" is alleen true als er een concreet, te betalen totaalbedrag in
  staat. Een offerte, een aanmaning zonder bedrag, een nieuwsbrief, reclame, een
  pakbon of een puur informatieve statusmail is GEEN factuur → false en laat de
  rest leeg.
- BELANGRIJK: dit is voor INKOOP-facturen (crediteuren) — wat JG Mobility aan een
  ander moet betalen. Is JG Mobility zélf de afzender/verkoper van de factuur
  (dus een factuur die JG heeft uitgeschreven aan een klant), dan is dat een
  VERKOOPfactuur → is_factuur = false. De leverancier is altijd een ander bedrijf
  dan JG Mobility. Een door JG doorgestuurde factuur van een echte leverancier
  (bijv. een garage of de KvK) is wél een inkoopfactuur; gebruik dan die
  leverancier, niet JG Mobility.

Gok nooit. Kun je iets niet met zekerheid aflezen, laat het leeg (0 bij bedragen)
en noem het in "onzeker". Een verkeerd bedrag is erger dan een leeg veld.`;

const CATEGORIEEN = [
  "Auto-inkoop", "Onderhoud & reparatie", "Poets & detailing", "Transport",
  "Advertentie & marketing", "Kantoor & software", "Overig",
];

type PdfBijlage = { data: string; naam: string };

type MimeDeel = {
  mimeType?: string | null;
  filename?: string | null;
  body?: { attachmentId?: string | null; data?: string | null } | null;
  parts?: unknown[];
};

/** Loopt de MIME-boom af en verzamelt alle PDF-bijlagen. */
function zoekPdfDelen(
  deel: MimeDeel | undefined,
  uit: { attachmentId: string; naam: string }[] = []
): { attachmentId: string; naam: string }[] {
  if (!deel) return uit;
  const naam = deel.filename ?? "";
  const isPdf = deel.mimeType === "application/pdf" || naam.toLowerCase().endsWith(".pdf");
  if (isPdf && deel.body?.attachmentId) {
    uit.push({ attachmentId: deel.body.attachmentId, naam: naam || "factuur.pdf" });
  }
  for (const kind of (deel.parts ?? []) as MimeDeel[]) {
    zoekPdfDelen(kind, uit);
  }
  return uit;
}

/** Ruwe HTML terugbrengen tot leesbare platte tekst voor het model. */
function striptHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&euro;/gi, "€")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Haalt de leesbare tekst uit een mail. Text/plain heeft de voorkeur; is er
 * alleen HTML, dan strippen we de opmaak. Gmail levert base64url.
 */
function haalMailTekst(deel: MimeDeel | undefined): string {
  let plat = "";
  let html = "";
  const loop = (d: MimeDeel | undefined) => {
    if (!d) return;
    const data = d.body?.data;
    if (data) {
      const tekst = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
      if (d.mimeType === "text/plain") plat += tekst + "\n";
      else if (d.mimeType === "text/html") html += tekst + "\n";
    }
    for (const kind of (d.parts ?? []) as MimeDeel[]) loop(kind);
  };
  loop(deel);
  const tekst = plat.trim() || striptHtml(html);
  // Ruim afkappen: een factuurbevestiging heeft alles bovenin staan, en het
  // scheelt tokens tegenover een lange mailfooter met voorwaarden.
  return tekst.slice(0, 6000);
}

/** Google geeft `invalid_grant` als het refresh-token is verlopen of ingetrokken.
 *  De gmail/status-route ziet dat niet: die kijkt alleen of er een token in de
 *  database staat. Daarom hier een eigen, begrijpelijke melding. */
function gmailFout(err: unknown): string {
  const bericht = err instanceof Error ? err.message : String(err);
  if (bericht.includes("invalid_grant")) {
    return "De Gmail-koppeling is verlopen. Koppel je mailbox opnieuw via Instellingen → Gmail; " +
      "daarna werkt het scannen weer.";
  }
  return bericht;
}

/** Zoekopdracht die de kandidaten oplevert. Breed opgezet zodat werkelijk elke
 *  factuur meekomt: elke mail met een PDF-bijlage (daar zit vrijwel elke echte
 *  factuur in) én elke mail met een betaalterm in de tekst (voor facturen die in
 *  de mail zelf staan, zoals een RDW-bevestiging met "totale kosten"). De AI
 *  filtert daarna op is_factuur, dus reclame met een PDF valt alsnog af. */
const ZOEKOPDRACHT =
  'newer_than:90d (filename:pdf OR factuur OR invoice OR nota OR rekening OR ' +
  '"te betalen" OR "totale kosten" OR betaalverzoek OR betalingsherinnering OR ' +
  'bestelbevestiging OR orderbevestiging)';

/**
 * Voorvertoning: laat zien welke mails de scan zou oppakken, zonder ze door de
 * AI te halen. Handig om te controleren of de zoekopdracht klopt voordat je
 * tokens uitgeeft, en om te zien wat er al geïmporteerd is.
 */
export async function GET() {
  let gmail;
  try {
    const auth = await getAuthedClient();
    gmail = google.gmail({ version: "v1", auth });
  } catch {
    return Response.json({ error: "Gmail is niet gekoppeld.", geenGmail: true }, { status: 200 });
  }

  try {
    const lijst = await gmail.users.messages.list({ userId: "me", q: ZOEKOPDRACHT, maxResults: 200 });
    const berichten = lijst.data.messages ?? [];
    const alGedaan = await bestaandeGmailIds();

    const kandidaten = await Promise.all(
      berichten.slice(0, 15).map(async (m) => {
        const volledig = await gmail.users.messages.get({
          userId: "me", id: m.id!, format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });
        const h = volledig.data.payload?.headers ?? [];
        const kop = (n: string) => h.find((x) => x.name?.toLowerCase() === n)?.value ?? "";
        return {
          id: m.id,
          onderwerp: kop("subject"),
          afzender: kop("from"),
          datum: kop("date"),
          alGeimporteerd: alGedaan.has(m.id!),
        };
      })
    );

    return Response.json({
      zoekopdracht: ZOEKOPDRACHT,
      gevonden: berichten.length,
      nieuw: kandidaten.filter((k) => !k.alGeimporteerd).length,
      kandidaten,
    });
  } catch (err) {
    return Response.json({ error: gmailFout(err), gmailVerlopen: String(err).includes("invalid_grant") }, { status: 200 });
  }
}

export async function POST() {
  // Beide voorwaarden vooraf controleren en samen melden. Eén voor één zou
  // betekenen dat je de ene oplost en dan pas de volgende ontdekt.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const blokkades: string[] = [];
  if (!apiKey) blokkades.push("ANTHROPIC_API_KEY is leeg — zonder die sleutel kan er niets uitgelezen worden.");

  let gmail;
  try {
    const auth = await getAuthedClient();
    gmail = google.gmail({ version: "v1", auth });
    // Echt uitproberen: een aanwezig token zegt niets over of het nog geldig is.
    await gmail.users.getProfile({ userId: "me" });
  } catch (err) {
    blokkades.push(gmailFout(err));
  }

  if (blokkades.length > 0 || !gmail) {
    return Response.json(
      {
        error: blokkades.join(" "),
        blokkades,
        ontbrekendeSleutel: !apiKey,
        gmailVerlopen: blokkades.some((b) => b.includes("verlopen")),
      },
      { status: 200 }
    );
  }

  try {
    const lijst = await gmail.users.messages.list({ userId: "me", q: ZOEKOPDRACHT, maxResults: 200 });
    const berichten = lijst.data.messages ?? [];

    const alGedaan = await bestaandeGmailIds();
    const nieuw = berichten.filter((m) => m.id && !alGedaan.has(m.id));

    const client = new Anthropic({ apiKey });
    const toegevoegd: { leverancier: string; bedrag: number; vervaldatum: string; onzeker: string[] }[] = [];
    const overgeslagen: { onderwerp: string; reden: string }[] = [];
    // Binnen één ronde kan dezelfde factuur zowel als PDF als in de tekst
    // langskomen. De database-check vangt dat pas na opslaan; deze set voorkomt
    // het al binnen de lopende ronde.
    const dezeRonde = new Set<string>();

    for (const bericht of nieuw.slice(0, MAX_PER_RONDE)) {
      const volledig = await gmail.users.messages.get({ userId: "me", id: bericht.id!, format: "full" });
      const headers = volledig.data.payload?.headers ?? [];
      const kop = (naam: string) => headers.find((h) => h.name?.toLowerCase() === naam)?.value ?? "";
      const onderwerp = kop("subject");
      const afzender = kop("from");

      // Elke bekeken mail onthouden — ook als hij wordt overgeslagen. Zonder dit
      // zou dezelfde niet-factuur bij elke volgende ronde opnieuw tokens kosten
      // en zou een doorlopende scan nooit klaar zijn.
      const slaOver = async (reden: string) => {
        overgeslagen.push({ onderwerp, reden });
        await markeerGescand(bericht.id!, reden, onderwerp).catch(() => null);
      };

      // PDF-bijlage heeft de voorkeur (meest volledige factuur); anders lezen we
      // de mailtekst zelf uit.
      const pdfs = zoekPdfDelen(volledig.data.payload ?? undefined);
      let bijlageBlok: Anthropic.ContentBlockParam;
      let herkomst: string;

      if (pdfs.length > 0) {
        const bijlage = await gmail.users.messages.attachments.get({
          userId: "me", messageId: bericht.id!, id: pdfs[0].attachmentId,
        });
        const ruw = bijlage.data.data;
        if (!ruw) {
          await slaOver("bijlage kon niet worden opgehaald");
          continue;
        }
        // Gmail levert base64url; de API verwacht standaard base64.
        const pdf: PdfBijlage = { data: ruw.replace(/-/g, "+").replace(/_/g, "/"), naam: pdfs[0].naam };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bijlageBlok = { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.data } } as any;
        herkomst = `Bijlage "${pdf.naam}" uit de mail "${onderwerp}" van ${afzender}. Lees de boekhoudgegevens uit.`;
      } else {
        const mailtekst = haalMailTekst(volledig.data.payload ?? undefined);
        if (mailtekst.length < 40) {
          await slaOver("geen PDF en geen leesbare tekst");
          continue;
        }
        bijlageBlok = { type: "text", text: `Onderwerp: ${onderwerp}\nAfzender: ${afzender}\n\n--- Mailtekst ---\n${mailtekst}` };
        herkomst =
          "Dit is de tekst van een e-mail, geen bijlage. Alleen als hier duidelijk een te " +
          "betalen bedrag in staat (een factuur, order- of bestelbevestiging met een totaalbedrag) " +
          "is het een factuur; een nieuwsbrief, reclame of statusupdate is dat niet. Lees de " +
          "boekhoudgegevens uit.";
      }

      const resp = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        thinking: { type: "adaptive" },
        output_config: {
          effort: "medium",
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: {
                is_factuur: { type: "boolean", description: "Is dit echt een factuur die betaald moet worden?" },
                leverancier: { type: "string" },
                factuurnummer: { type: "string" },
                datum: { type: "string" },
                vervaldatum: { type: "string" },
                bedrag_incl: { type: "number" },
                btw_bedrag: { type: "number" },
                btw_tarief: { type: "number" },
                omschrijving: { type: "string" },
                categorie: { type: "string", enum: CATEGORIEEN },
                onzeker: { type: "array", items: { type: "string" } },
              },
              required: ["is_factuur", "leverancier", "factuurnummer", "datum", "vervaldatum", "bedrag_incl", "btw_bedrag", "btw_tarief", "omschrijving", "categorie", "onzeker"],
              additionalProperties: false,
            },
          },
        },
        messages: [{
          role: "user",
          content: [bijlageBlok, { type: "text", text: herkomst }],
        }],
      });

      if (resp.stop_reason === "refusal") {
        await slaOver("geweigerd door het model");
        continue;
      }

      const tekst = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
      let uit: Record<string, unknown>;
      try {
        uit = JSON.parse(tekst);
      } catch {
        await slaOver("onleesbaar antwoord");
        continue;
      }

      if (!uit.is_factuur) {
        await slaOver("geen factuur");
        continue;
      }
      const bedrag = Number(uit.bedrag_incl) || 0;
      if (!bedrag) {
        await slaOver("geen bedrag gevonden");
        continue;
      }

      const leverancier = String(uit.leverancier ?? "") || afzender;

      // ── Eigen verkoopfacturen weren ───────────────────────────────
      // Een inkoopfactuur heeft per definitie een externe leverancier. Is JG
      // Mobility zélf de leverancier, dan is het een uitgaande verkoopfactuur
      // (die JG naar zichzelf of een klant stuurde) en hoort hij niet bij "nog te
      // betalen". Dit is het vangnet; de prompt vraagt het model dit ook al te
      // herkennen. Doorgestuurde facturen van een échte crediteur (afzender is
      // JG, maar leverancier is bijv. Burax of de KvK) blijven gewoon staan.
      if (normaliseerLeverancier(leverancier) === "jg mobility") {
        await slaOver("eigen verkoopfactuur van JG Mobility — geen inkoop");
        continue;
      }

      // ── Dubbel voorkomen ──────────────────────────────────────────
      // Zelfde leverancier + bedrag betekent vrijwel zeker dezelfde factuur,
      // ook als het een bevestigingsmail nu en de PDF-factuur later is (twee
      // verschillende mails). Al in deze ronde gezien, of al in de database?
      const kern = `${normaliseerLeverancier(leverancier)}|${bedrag.toFixed(2)}`;
      if (dezeRonde.has(kern)) {
        await slaOver(`dubbel in deze scan (${leverancier}, € ${bedrag.toFixed(2)})`);
        continue;
      }
      const bestaand = await vindDubbeleFactuur(leverancier, bedrag);
      if (bestaand) {
        await slaOver(
          `mogelijk al geboekt: ${bestaand.leverancier} € ${bestaand.bedrag_incl.toFixed(2)}` +
            `${bestaand.factuurnummer ? ` (${bestaand.factuurnummer})` : ""} — niet nogmaals toegevoegd`
        );
        continue;
      }
      dezeRonde.add(kern);

      await createInkoopFactuur({
        leverancier,
        factuurnummer: String(uit.factuurnummer ?? ""),
        datum: String(uit.datum ?? ""),
        vervaldatum: String(uit.vervaldatum ?? ""),
        bedrag_incl: bedrag,
        btw_bedrag: Number(uit.btw_bedrag) || 0,
        btw_tarief: Number(uit.btw_tarief) || 0,
        omschrijving: String(uit.omschrijving ?? "") || onderwerp,
        categorie: String(uit.categorie ?? "Overig"),
        bron: "email",
        gmail_message_id: bericht.id!,
        gmail_afzender: afzender,
      });

      await markeerGescand(bericht.id!, "geboekt", onderwerp).catch(() => null);
      toegevoegd.push({
        leverancier,
        bedrag,
        vervaldatum: String(uit.vervaldatum ?? ""),
        onzeker: Array.isArray(uit.onzeker) ? (uit.onzeker as string[]) : [],
      });
    }

    // Deze ronde zijn er MAX_PER_RONDE bekeken (of minder als er minder waren);
    // wat daarna nog "nieuw" is, wacht op de volgende ronde. De frontend rijgt
    // die rondes aaneen tot resterend 0 is.
    const bekekenDezeRonde = Math.min(nieuw.length, MAX_PER_RONDE);
    return Response.json({
      gevonden: berichten.length,
      nieuw: nieuw.length,
      verwerkt: toegevoegd.length,
      resterend: Math.max(nieuw.length - bekekenDezeRonde, 0),
      toegevoegd,
      overgeslagen,
    });
  } catch (err) {
    return Response.json({ error: gmailFout(err), gmailVerlopen: String(err).includes("invalid_grant") }, { status: 200 });
  }
}

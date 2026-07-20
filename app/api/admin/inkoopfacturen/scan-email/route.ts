import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthedClient } from "@/lib/gmail-client";
import { bestaandeGmailIds, createInkoopFactuur } from "@/lib/inkoopfacturen-db";

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

const MAX_PER_RONDE = 3;

const SYSTEM_PROMPT = `Je leest inkoopfacturen voor een Nederlands autobedrijf.

- Bedragen als getal, zonder valutateken.
- "bedrag_incl" is het eindtotaal inclusief BTW.
- "btw_bedrag" is het apart vermelde BTW-bedrag; 0 als er geen BTW op staat.
- "btw_tarief" is 21, 9 of 0.
- Datums als JJJJ-MM-DD. Geen vervaldatum vermeld? Laat leeg.
- Is dit géén factuur (maar bijvoorbeeld een offerte, aanmaning zonder bedragen,
  reclame of pakbon), zet dan "is_factuur" op false en laat de rest leeg.

Gok nooit. Kun je iets niet met zekerheid aflezen, laat het leeg (0 bij bedragen)
en noem het in "onzeker". Een verkeerd bedrag is erger dan een leeg veld.`;

const CATEGORIEEN = [
  "Auto-inkoop", "Onderhoud & reparatie", "Poets & detailing", "Transport",
  "Advertentie & marketing", "Kantoor & software", "Overig",
];

type PdfBijlage = { data: string; naam: string };

/** Loopt de MIME-boom af en verzamelt alle PDF-bijlagen. */
function zoekPdfDelen(
  deel: { mimeType?: string | null; filename?: string | null; body?: { attachmentId?: string | null } | null; parts?: unknown[] } | undefined,
  uit: { attachmentId: string; naam: string }[] = []
): { attachmentId: string; naam: string }[] {
  if (!deel) return uit;
  const naam = deel.filename ?? "";
  const isPdf = deel.mimeType === "application/pdf" || naam.toLowerCase().endsWith(".pdf");
  if (isPdf && deel.body?.attachmentId) {
    uit.push({ attachmentId: deel.body.attachmentId, naam: naam || "factuur.pdf" });
  }
  for (const kind of (deel.parts ?? []) as Parameters<typeof zoekPdfDelen>[0][]) {
    zoekPdfDelen(kind, uit);
  }
  return uit;
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

/** Zoekopdracht die de kandidaten oplevert. Ruim opgezet: liever een mail te
 *  veel bekijken dan een factuur missen — de AI filtert daarna alsnog. */
const ZOEKOPDRACHT = "has:attachment filename:pdf newer_than:90d (factuur OR invoice OR nota OR rekening)";

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
    const lijst = await gmail.users.messages.list({ userId: "me", q: ZOEKOPDRACHT, maxResults: 25 });
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
    const lijst = await gmail.users.messages.list({ userId: "me", q: ZOEKOPDRACHT, maxResults: 25 });
    const berichten = lijst.data.messages ?? [];

    const alGedaan = await bestaandeGmailIds();
    const nieuw = berichten.filter((m) => m.id && !alGedaan.has(m.id));

    const client = new Anthropic({ apiKey });
    const toegevoegd: { leverancier: string; bedrag: number; vervaldatum: string; onzeker: string[] }[] = [];
    const overgeslagen: { onderwerp: string; reden: string }[] = [];

    for (const bericht of nieuw.slice(0, MAX_PER_RONDE)) {
      const volledig = await gmail.users.messages.get({ userId: "me", id: bericht.id!, format: "full" });
      const headers = volledig.data.payload?.headers ?? [];
      const kop = (naam: string) => headers.find((h) => h.name?.toLowerCase() === naam)?.value ?? "";
      const onderwerp = kop("subject");
      const afzender = kop("from");

      const pdfs = zoekPdfDelen(volledig.data.payload ?? undefined);
      if (pdfs.length === 0) {
        overgeslagen.push({ onderwerp, reden: "geen PDF-bijlage gevonden" });
        continue;
      }

      // Alleen de eerste PDF: bij meerdere bijlagen is dat vrijwel altijd de factuur.
      const bijlage = await gmail.users.messages.attachments.get({
        userId: "me", messageId: bericht.id!, id: pdfs[0].attachmentId,
      });
      const ruw = bijlage.data.data;
      if (!ruw) {
        overgeslagen.push({ onderwerp, reden: "bijlage kon niet worden opgehaald" });
        continue;
      }
      // Gmail levert base64url; de API verwacht standaard base64.
      const pdf: PdfBijlage = { data: ruw.replace(/-/g, "+").replace(/_/g, "/"), naam: pdfs[0].naam };

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
          content: [
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.data } } as any,
            { type: "text", text: `Bijlage "${pdf.naam}" uit de mail "${onderwerp}" van ${afzender}. Lees de boekhoudgegevens uit.` },
          ],
        }],
      });

      if (resp.stop_reason === "refusal") {
        overgeslagen.push({ onderwerp, reden: "geweigerd door het model" });
        continue;
      }

      const tekst = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
      let uit: Record<string, unknown>;
      try {
        uit = JSON.parse(tekst);
      } catch {
        overgeslagen.push({ onderwerp, reden: "onleesbaar antwoord" });
        continue;
      }

      if (!uit.is_factuur) {
        overgeslagen.push({ onderwerp, reden: "geen factuur" });
        continue;
      }
      if (!Number(uit.bedrag_incl)) {
        overgeslagen.push({ onderwerp, reden: "geen bedrag gevonden" });
        continue;
      }

      await createInkoopFactuur({
        leverancier: String(uit.leverancier ?? "") || afzender,
        factuurnummer: String(uit.factuurnummer ?? ""),
        datum: String(uit.datum ?? ""),
        vervaldatum: String(uit.vervaldatum ?? ""),
        bedrag_incl: Number(uit.bedrag_incl) || 0,
        btw_bedrag: Number(uit.btw_bedrag) || 0,
        btw_tarief: Number(uit.btw_tarief) || 0,
        omschrijving: String(uit.omschrijving ?? "") || onderwerp,
        categorie: String(uit.categorie ?? "Overig"),
        bron: "email",
        gmail_message_id: bericht.id!,
        gmail_afzender: afzender,
      });

      toegevoegd.push({
        leverancier: String(uit.leverancier ?? "") || afzender,
        bedrag: Number(uit.bedrag_incl) || 0,
        vervaldatum: String(uit.vervaldatum ?? ""),
        onzeker: Array.isArray(uit.onzeker) ? (uit.onzeker as string[]) : [],
      });
    }

    return Response.json({
      gevonden: berichten.length,
      nieuw: nieuw.length,
      verwerkt: toegevoegd.length,
      resterend: Math.max(nieuw.length - MAX_PER_RONDE, 0),
      toegevoegd,
      overgeslagen,
    });
  } catch (err) {
    return Response.json({ error: gmailFout(err), gmailVerlopen: String(err).includes("invalid_grant") }, { status: 200 });
  }
}

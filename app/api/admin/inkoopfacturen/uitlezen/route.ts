import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
// Vercel Hobby kapt af op 60s; PDF's lezen kost tijd, dus ruim onder de grens blijven.
export const maxDuration = 60;

const SYSTEM_PROMPT = `Je leest inkoopfacturen voor een Nederlands autobedrijf en haalt er de
boekhoudkundige gegevens uit.

Regels:
- Bedragen in euro's, als getal zonder valutateken of duizendtallenscheiding.
- "bedrag_incl" is het eindtotaal dat betaald moet worden, inclusief BTW.
- "btw_bedrag" is het BTW-bedrag dat apart op de factuur staat. Staat er geen BTW
  op (margeregeling, particuliere inkoop, verlegd), vul dan 0 in.
- "btw_tarief" is 21, 9 of 0. Leid dit af uit de factuur, gok niet.
- Datums in formaat JJJJ-MM-DD. Staat er geen vervaldatum op, laat die dan leeg.
- Kies één categorie die het beste past.

Vul een veld NOOIT met een gok. Kun je iets niet met zekerheid van de factuur
aflezen, laat het veld dan leeg (of 0 bij bedragen) en noem het in "onzeker".
Een verkeerd bedrag in een boekhouding is erger dan een leeg veld.`;

const CATEGORIEEN = [
  "Auto-inkoop", "Onderhoud & reparatie", "Poets & detailing", "Transport",
  "Advertentie & marketing", "Kantoor & software", "Overig",
];

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY is niet ingesteld", ontbrekendeSleutel: true }, { status: 200 });
  }

  try {
    const { bestandBase64, mediaType, bestandsnaam } = await request.json();
    if (!bestandBase64 || !mediaType) {
      return Response.json({ error: "Geen bestand ontvangen." }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    // PDF's gaan als document, foto's als image — beide leest het model native.
    const bijlage =
      mediaType === "application/pdf"
        ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: bestandBase64 } }
        : { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data: bestandBase64 } };

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
              leverancier: { type: "string", description: "Bedrijfsnaam van de afzender" },
              factuurnummer: { type: "string" },
              datum: { type: "string", description: "Factuurdatum als JJJJ-MM-DD" },
              vervaldatum: { type: "string", description: "Vervaldatum als JJJJ-MM-DD, leeg als niet vermeld" },
              bedrag_incl: { type: "number", description: "Eindtotaal inclusief BTW" },
              btw_bedrag: { type: "number", description: "BTW-bedrag, 0 als er geen BTW op staat" },
              btw_tarief: { type: "number", description: "21, 9 of 0" },
              omschrijving: { type: "string", description: "Korte samenvatting van waar de factuur voor is" },
              categorie: { type: "string", enum: CATEGORIEEN },
              onzeker: {
                type: "array",
                items: { type: "string" },
                description: "Velden die je niet met zekerheid kon aflezen",
              },
            },
            required: ["leverancier", "factuurnummer", "datum", "vervaldatum", "bedrag_incl", "btw_bedrag", "btw_tarief", "omschrijving", "categorie", "onzeker"],
            additionalProperties: false,
          },
        },
      },
      messages: [{
        role: "user",
        content: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          bijlage as any,
          { type: "text", text: `Lees de boekhoudgegevens uit deze inkoopfactuur${bestandsnaam ? ` (${bestandsnaam})` : ""}.` },
        ],
      }],
    });

    if (resp.stop_reason === "refusal") {
      return Response.json({ error: "Het model heeft dit bestand geweigerd." }, { status: 200 });
    }

    const tekst = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
    try {
      return Response.json({ ...JSON.parse(tekst), bron: "ai" });
    } catch {
      return Response.json({ error: "Onverwacht antwoord van het model." }, { status: 200 });
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 200 });
  }
}

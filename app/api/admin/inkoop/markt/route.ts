import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const PULS_PROMPT = `Je bent een expert op de Nederlandse tweedehands automarkt. Analyseer de huidige markt voor een kleine autohandelaar in Nederland.

Zoek live naar actuele informatie op Marktplaats.nl, AutoScout24.nl en AutoWeek.nl over:
1. Welke gebruikte auto-modellen zijn nu het meest gevraagd en verkopen snel?
2. Welke segmenten groeien (SUV, EV, compacts)?
3. Welke modellen bieden de beste inkoopkansen (lage inkoopprijs, hoge vraag)?
4. Welke modellen zijn te vermijden (veel aanbod, dalende prijzen)?

Geef je antwoord UITSLUITEND als dit JSON object (geen andere tekst):
{
  "samenvatting": "2-3 zinnen actueel marktoverzicht in het Nederlands",
  "markt_temperatuur": 7,
  "hot_modellen": [
    { "rang": 1, "merk": "Volkswagen", "model": "Polo", "segment": "Hatchback", "gem_prijs": 14500, "aanbod_score": 5, "vraag_score": 8, "trend": "stijgend", "advies": "Goede doorlooptijd, stabiele vraag" }
  ],
  "te_vermijden": [
    { "merk": "...", "model": "...", "reden": "veel aanbod / dalende prijzen" }
  ],
  "trending_segmenten": [
    { "naam": "Compacte SUV", "trend": "stijgend", "score": 9, "reden": "..." },
    { "naam": "Elektrisch", "trend": "stabiel", "score": 6, "reden": "..." }
  ],
  "inzichten": [
    "Diesel onder €10.000 loopt goed bij particulieren",
    "SUVs met automaat hebben kortere standtijd",
    "Voorraad EV groeit maar marge staat onder druk"
  ]
}

Regels: gehele getallen, trend = stijgend/stabiel/dalend, scores 1-10, minimaal 5 hot_modellen, minimaal 3 te_vermijden, minimaal 3 trending_segmenten, minimaal 4 inzichten.`;

const ZOEK_PROMPT = (zoekterm: string) =>
  `Je bent een expert op de Nederlandse tweedehands automarkt. Analyseer de markt specifiek voor: "${zoekterm}"

Zoek live op Marktplaats.nl, AutoScout24.nl en AutoWeek.nl naar actuele vraagprijzen, aanbod en vraag voor dit specifieke segment.

Geef je antwoord UITSLUITEND als dit JSON object (geen andere tekst):
{
  "samenvatting": "2-3 zinnen analyse van '${zoekterm}' in het Nederlands",
  "markt_temperatuur": 7,
  "hot_modellen": [
    { "rang": 1, "merk": "...", "model": "...", "segment": "...", "gem_prijs": 18500, "aanbod_score": 5, "vraag_score": 8, "trend": "stabiel", "advies": "..." }
  ],
  "te_vermijden": [
    { "merk": "...", "model": "...", "reden": "..." }
  ],
  "trending_segmenten": [
    { "naam": "...", "trend": "stijgend", "score": 8, "reden": "..." }
  ],
  "inzichten": ["...", "...", "..."]
}

Regels: gehele getallen, trend = stijgend/stabiel/dalend, scores 1-10, focus op de opgegeven zoekopdracht.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY niet ingesteld" }, { status: 500 });

  const { type = "puls", zoekterm } = await req.json();
  const prompt = type === "zoek" && zoekterm ? ZOEK_PROMPT(zoekterm) : PULS_PROMPT;

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-opus-4-5-20251101",
    max_tokens: 4000,
    tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = [...response.content].reverse().find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return Response.json({ error: "Geen antwoord van AI" }, { status: 500 });
  }

  const jsonMatch = textBlock.text.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return Response.json({ error: "Kon marktdata niet ophalen", raw: textBlock.text }, { status: 422 });
  }

  try {
    const data = JSON.parse(jsonMatch[0]);
    return Response.json({ ...data, gegenereerd_op: new Date().toISOString(), type, zoekterm });
  } catch {
    return Response.json({ error: "Ongeldige data van AI", raw: jsonMatch[0] }, { status: 422 });
  }
}

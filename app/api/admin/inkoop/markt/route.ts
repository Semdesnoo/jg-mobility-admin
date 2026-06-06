import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JSON_VORM = `{
  "samenvatting": "2-3 zinnen actueel marktoverzicht in het Nederlands",
  "markt_temperatuur": 7,
  "hot_modellen": [
    { "rang": 1, "merk": "Volkswagen", "model": "Polo", "segment": "Hatchback", "gem_prijs": 14500, "aanbod_score": 5, "vraag_score": 8, "trend": "stijgend", "advies": "Goede doorlooptijd, stabiele vraag" }
  ],
  "te_vermijden": [
    { "merk": "...", "model": "...", "reden": "veel aanbod / dalende prijzen" }
  ],
  "trending_segmenten": [
    { "naam": "Compacte SUV", "trend": "stijgend", "score": 9, "reden": "..." }
  ],
  "inzichten": [
    "Diesel onder €10.000 loopt goed bij particulieren",
    "SUVs met automaat hebben kortere standtijd"
  ]
}`;

const PULS_PROMPT = `Je bent een expert op de Nederlandse tweedehands automarkt. Analyseer de huidige markt voor een kleine autohandelaar in Nederland.

Gebruik je web_search-tool om actuele informatie te zoeken (bijvoorbeeld op Marktplaats, AutoScout24 en AutoWeek) over:
1. Welke gebruikte auto-modellen zijn nu het meest gevraagd en verkopen snel?
2. Welke segmenten groeien (SUV, EV, compacts)?
3. Welke modellen bieden de beste inkoopkansen (lage inkoopprijs, hoge vraag)?
4. Welke modellen zijn te vermijden (veel aanbod, dalende prijzen)?

Geef je antwoord UITSLUITEND als dit JSON-object (geen andere tekst):
${JSON_VORM}

Regels: gehele getallen, trend = stijgend/stabiel/dalend, scores 1-10, minimaal 5 hot_modellen, minimaal 3 te_vermijden, minimaal 3 trending_segmenten, minimaal 4 inzichten. Lukt het zoeken niet, baseer je dan op je eigen kennis en vermeld dat kort in de samenvatting.`;

const ZOEK_PROMPT = (zoekterm: string) =>
  `Je bent een expert op de Nederlandse tweedehands automarkt. Analyseer de markt specifiek voor: "${zoekterm}"

Gebruik je web_search-tool om live te zoeken (bijvoorbeeld op Marktplaats, AutoScout24 en AutoWeek) naar actuele vraagprijzen, aanbod en vraag voor dit specifieke segment.

Geef je antwoord UITSLUITEND als dit JSON-object (geen andere tekst), met "samenvatting" toegespitst op '${zoekterm}':
${JSON_VORM}

Regels: gehele getallen, trend = stijgend/stabiel/dalend, scores 1-10, focus op de opgegeven zoekopdracht. Lukt het zoeken niet, baseer je dan op je eigen kennis en vermeld dat kort in de samenvatting.`;

// Laatste accolade-gebalanceerde JSON-object uit de tekst (robuust tegen omringende tekst).
function extractLaatsteJson(text: string): string | null {
  const eind = text.lastIndexOf("}");
  if (eind === -1) return null;
  let diepte = 0;
  for (let i = eind; i >= 0; i--) {
    const c = text[i];
    if (c === "}") diepte++;
    else if (c === "{") {
      diepte--;
      if (diepte === 0) return text.slice(i, eind + 1);
    }
  }
  return null;
}

// Eén analyse. useWebSearch=true gebruikt de server-side web_search (handelt pause_turn af);
// false valt terug op modelkennis.
async function vraagMarkt(client: Anthropic, prompt: string, useWebSearch: boolean, signal?: AbortSignal): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let laatsteTekst = "";
  for (let i = 0; i < 4; i++) {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 6000,
      ...(useWebSearch
        ? { tools: [{ type: "web_search_20250305" as const, name: "web_search", max_uses: 4 }] }
        : {}),
      messages,
    }, signal ? { signal } : undefined);
    const rondeTekst = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (rondeTekst) laatsteTekst = rondeTekst;
    if (resp.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: resp.content });
      continue;
    }
    break;
  }
  return laatsteTekst;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY niet ingesteld" }, { status: 500 });

  const { type = "puls", zoekterm } = await req.json();
  const prompt = type === "zoek" && zoekterm ? ZOEK_PROMPT(zoekterm) : PULS_PROMPT;

  const client = new Anthropic({ apiKey });

  // Web search met een HARDE 42s-grens via Promise.race (Vercel kapt de functie op 60s af).
  // Wint de timeout, dan stoppen we het zoeken en vallen terug op modelkennis binnen de marge —
  // altijd een antwoord, nooit een 504. 'live' = de live-zoekopdracht leverde bruikbare data.
  let tekst = "";
  const controller = new AbortController();
  const webSearch = vraagMarkt(client, prompt, true, controller.signal).catch(() => "");
  const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(""), 42000));
  tekst = await Promise.race([webSearch, timeout]);
  controller.abort();
  let live = !!extractLaatsteJson(tekst);
  if (!live) {
    tekst = await vraagMarkt(client, prompt, false);
  }

  const jsonText = extractLaatsteJson(tekst);
  if (!jsonText) {
    return Response.json({ error: "Kon marktdata niet ophalen", raw: tekst.slice(0, 300) }, { status: 422 });
  }

  // Web search voegt citatie-markup toe (<cite index="...">...</cite>); die strippen we eruit.
  const schoon = jsonText.replace(/<cite\b[^>]*>/gi, "").replace(/<\/cite>/gi, "");
  try {
    const data = JSON.parse(schoon);
    return Response.json({ ...data, gegenereerd_op: new Date().toISOString(), type, zoekterm, live });
  } catch {
    return Response.json({ error: "Ongeldige data van AI", raw: schoon.slice(0, 300) }, { status: 422 });
  }
}

import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

// Eén markt-analyse. useWebSearch=true gebruikt de server-side web_search (handelt pause_turn af);
// false valt terug op modelkennis (een schatting zonder live advertenties).
async function vraagMarkt(client: Anthropic, prompt: string, useWebSearch: boolean): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let laatsteTekst = "";
  for (let i = 0; i < 6; i++) {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      ...(useWebSearch
        ? { tools: [{ type: "web_search_20250305" as const, name: "web_search", max_uses: 5 }] }
        : {}),
      messages,
    });
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

  const { merk, model, bouwjaar, km, brandstof, gewenste_marge = 15, geschatte_kosten = 600 } = await req.json();

  if (!merk || !model || !bouwjaar) {
    return Response.json({ error: "Merk, model en bouwjaar zijn verplicht" }, { status: 400 });
  }

  const kmTxt = km ? `, circa ${parseInt(km).toLocaleString("nl-NL")} km` : "";
  const brandstofTxt = brandstof ? `, ${brandstof}` : "";

  const prompt = `Je bent een Nederlandse automarkt-expert. Bepaal de actuele marktwaarde van een ${merk} ${model} bouwjaar ${bouwjaar}${kmTxt}${brandstofTxt} op de Nederlandse occasionmarkt.

Gebruik je web_search-tool om actuele vraagprijzen van vergelijkbare exemplaren op te zoeken (zelfde merk en model, bouwjaar ±1 jaar, kilometerstand ±20.000 km) — bijvoorbeeld op Marktplaats en AutoScout24. Baseer je cijfers op de echt gevonden advertenties.

Geef je antwoord UITSLUITEND als dit JSON-object (geen andere tekst, geen uitleg):
{
  "gemiddelde_prijs": 18500,
  "min_prijs": 15500,
  "max_prijs": 22000,
  "aantal_aanbod": 34,
  "prijs_trend": "stabiel",
  "marktplaats_gemiddeld": 17800,
  "autoscout_gemiddeld": 19200,
  "vraag_score": 7,
  "advies": "Korte conclusie van maximaal 2 zinnen."
}

Regels:
- prijs_trend: "stijgend", "stabiel" of "dalend"
- vraag_score: geheel getal 1-10 (10 = zeer gewild/schaars, 1 = weinig vraag/veel aanbod)
- Gehele getallen voor prijzen (geen decimalen, geen punten of komma's)
- Laat een platform-veld (marktplaats_gemiddeld / autoscout_gemiddeld) weg als je dat platform niet kon doorzoeken
- advies: maximaal 2 zinnen in het Nederlands. Lukte het niet om actuele advertenties te vinden, baseer je dan op je eigen kennis en vermeld dat kort in het advies.`;

  const client = new Anthropic({ apiKey });

  // Eerst met web search; geen bruikbare JSON of een fout → terugval op modelkennis.
  let tekst = "";
  try {
    tekst = await vraagMarkt(client, prompt, true);
    if (!extractLaatsteJson(tekst)) tekst = await vraagMarkt(client, prompt, false);
  } catch {
    tekst = await vraagMarkt(client, prompt, false);
  }

  const jsonText = extractLaatsteJson(tekst);
  if (!jsonText) {
    return Response.json({ error: "Kon marktdata niet ophalen", raw: tekst.slice(0, 300) }, { status: 422 });
  }

  // Web search voegt citatie-markup toe (<cite index="...">...</cite>); die strippen we eruit.
  const schoon = jsonText.replace(/<cite\b[^>]*>/gi, "").replace(/<\/cite>/gi, "");
  let markt: Record<string, number | string>;
  try {
    markt = JSON.parse(schoon);
  } catch {
    return Response.json({ error: "Ongeldige marktdata", raw: schoon.slice(0, 300) }, { status: 422 });
  }

  const gemiddeld = Number(markt.gemiddelde_prijs) || 0;
  const margeDecimaal = gewenste_marge / 100;

  // Aanbevolen inkoopprijs: gemiddelde_marktprijs × (1 - marge%) - geschatte_kosten
  const maxInkoop = Math.round(gemiddeld * (1 - margeDecimaal) - geschatte_kosten);
  const verwachteVerkoop = Math.round(gemiddeld * 0.97); // licht onder marktgemiddeld voor snelle verkoop
  const geschatteMarge = verwachteVerkoop - maxInkoop - geschatte_kosten;
  const margePercentage = gemiddeld > 0 ? Math.round((geschatteMarge / verwachteVerkoop) * 100) : 0;

  const vraagScore = Number(markt.vraag_score) || 5;
  const aantalAanbod = Number(markt.aantal_aanbod) || 0;
  const aantrekkelijkheid = Math.round(
    vraagScore * 0.5 +
      (geschatteMarge > 2000 ? 3 : geschatteMarge > 1000 ? 2 : 1) +
      (aantalAanbod < 20 ? 2 : aantalAanbod < 50 ? 1 : 0)
  );

  return Response.json({
    markt,
    berekening: {
      max_inkoop: maxInkoop,
      verwachte_verkoop: verwachteVerkoop,
      geschatte_marge: geschatteMarge,
      marge_percentage: margePercentage,
      geschatte_kosten,
      gewenste_marge,
      aantrekkelijkheid: Math.min(10, Math.max(1, aantrekkelijkheid)),
    },
  });
}

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
      // Sonnet: betrouwbaarder met web search + nauwkeuriger redeneren dan Haiku (accuratere taxatie).
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      ...(useWebSearch
        ? { tools: [{ type: "web_search_20250305" as const, name: "web_search", max_uses: 6 }] }
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

  const { merk, model, bouwjaar, km, brandstof, vermogen, bodytype, gewenste_marge = 10, geschatte_kosten = 0 } = await req.json();

  if (!merk || !model || !bouwjaar) {
    return Response.json({ error: "Merk, model en bouwjaar zijn verplicht" }, { status: 400 });
  }

  const kmTxt = km ? `, kilometerstand circa ${parseInt(km).toLocaleString("nl-NL")} km` : "";
  const specs = [brandstof, vermogen].filter(Boolean).join(", ");
  const specsTxt = specs ? ` (${specs})` : "";
  const bodyTxt = bodytype ? `, carrosserie ${bodytype}` : "";

  const prompt = `Je bent een professionele Nederlandse auto-taxateur. Bepaal zo nauwkeurig mogelijk de actuele marktwaarde van deze occasion:

${merk} ${model}, bouwjaar ${bouwjaar}${kmTxt}${specsTxt}${bodyTxt}.

Doe GRONDIG onderzoek met je web_search-tool (meerdere zoekopdrachten) en zoek ECHTE, actuele advertenties van zo vergelijkbaar mogelijke exemplaren — zelfde merk en model, bouwjaar binnen ±1 jaar, kilometerstand binnen ±25.000 km, zelfde brandstof — op meerdere platforms: Marktplaats, AutoScout24, Gaspedaal.nl, AutoWeek en ANWB Auto.

Verzamel minimaal 4 (liefst 6-8) echte gevonden advertenties met hun werkelijke vraagprijs, bouwjaar, kilometerstand en het platform. Baseer het gemiddelde, minimum en maximum UITSLUITEND op die gevonden advertenties — niet op een schatting.

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
  "betrouwbaarheid": "hoog",
  "aantal_gevonden": 6,
  "vergelijkbare": [
    { "titel": "Volkswagen Golf 1.5 TSI Highline", "bouwjaar": 2019, "km": 82000, "prijs": 18950, "platform": "AutoScout24" }
  ],
  "advies": "Korte conclusie van maximaal 2 zinnen."
}

Regels:
- prijs_trend: "stijgend", "stabiel" of "dalend"
- vraag_score: geheel getal 1-10 (10 = zeer gewild/schaars, 1 = weinig vraag/veel aanbod)
- betrouwbaarheid: "hoog" als je 5+ echte vergelijkbare advertenties vond, "midden" bij 2-4, "laag" bij 0-1 (baseer je dan op je eigen kennis en vermeld dat in het advies)
- aantal_gevonden: aantal echte advertenties dat je voor de berekening gebruikte
- vergelijkbare: de gevonden advertenties (maximaal 8), elk met titel, bouwjaar, km, prijs (geheel getal) en platform
- Laat een platform-gemiddelde (marktplaats_gemiddeld / autoscout_gemiddeld) weg als je dat platform niet kon doorzoeken
- Gehele getallen voor alle prijzen en km (geen decimalen, geen punten of komma's)
- advies: maximaal 2 zinnen in het Nederlands, met je inschatting van de reële inkoopwaarde en eventuele aandachtspunten.`;

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
  let markt: Record<string, unknown>;
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

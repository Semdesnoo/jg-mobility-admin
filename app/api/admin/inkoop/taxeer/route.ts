import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY niet ingesteld" }, { status: 500 });

  const { merk, model, bouwjaar, km, brandstof, gewenste_marge = 15, geschatte_kosten = 600 } = await req.json();

  if (!merk || !model || !bouwjaar) {
    return Response.json({ error: "Merk, model en bouwjaar zijn verplicht" }, { status: 400 });
  }

  const kmTxt = km ? `, circa ${parseInt(km).toLocaleString("nl-NL")} km` : "";
  const brandstofTxt = brandstof ? `, ${brandstof}` : "";

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
    messages: [
      {
        role: "user",
        content: `Je bent een Nederlandse automarkt-expert. Analyseer de markt voor een ${merk} ${model} bouwjaar ${bouwjaar}${kmTxt}${brandstofTxt}.

Zoek op Marktplaats.nl EN AutoScout24.nl naar vergelijkbare exemplaren (zelfde merk, model, vergelijkbaar bouwjaar ±1 jaar, vergelijkbare kilometerstand ±20.000 km).

Geef je antwoord UITSLUITEND als dit JSON object (absoluut geen andere tekst, geen uitleg, alleen JSON):
{
  "gemiddelde_prijs": 18500,
  "min_prijs": 15500,
  "max_prijs": 22000,
  "aantal_aanbod": 34,
  "prijs_trend": "stabiel",
  "marktplaats_gemiddeld": 17800,
  "autoscout_gemiddeld": 19200,
  "vraag_score": 7,
  "advies": "De ${merk} ${model} is een populair model met redelijke doorlooptijd. Concurrentie is gemiddeld."
}

Regels:
- prijs_trend: "stijgend", "stabiel" of "dalend"
- vraag_score: 1-10 (10 = heel populair/schaars, 1 = weinig gevraagd/veel aanbod)
- Gebruik gehele getallen voor prijzen (geen decimalen)
- Als je een platform niet kunt doorzoeken, laat dan dat veld weg
- advies: maximaal 2 zinnen in het Nederlands`,
      },
    ],
  });

  const textBlock = [...response.content].reverse().find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return Response.json({ error: "Geen antwoord van AI" }, { status: 500 });
  }

  const jsonMatch = textBlock.text.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return Response.json({ error: "Kon marktdata niet ophalen", raw: textBlock.text }, { status: 422 });
  }

  let markt: Record<string, number | string>;
  try {
    markt = JSON.parse(jsonMatch[0]);
  } catch {
    return Response.json({ error: "Ongeldige marktdata", raw: jsonMatch[0] }, { status: 422 });
  }

  const gemiddeld = Number(markt.gemiddelde_prijs) || 0;
  const margeDecimaal = gewenste_marge / 100;

  // Bereken aanbevolen inkoopprijs
  // Formule: gemiddelde_marktprijs × (1 - marge%) - geschatte_kosten
  const maxInkoop = Math.round(gemiddeld * (1 - margeDecimaal) - geschatte_kosten);
  const verwachteVerkoop = Math.round(gemiddeld * 0.97); // licht onder marktgemiddeld voor snelle verkoop
  const geschatteMarge = verwachteVerkoop - maxInkoop - geschatte_kosten;
  const margePercentage = gemiddeld > 0 ? Math.round((geschatteMarge / verwachteVerkoop) * 100) : 0;

  // Aantrekkelijkheidsscore (1-10)
  const vraagScore = Number(markt.vraag_score) || 5;
  const aantalAanbod = Number(markt.aantal_aanbod) || 0;
  const aantrekkelijkheid = Math.round(
    (vraagScore * 0.5) +
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

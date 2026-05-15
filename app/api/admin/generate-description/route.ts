import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `Je bent een Nederlandse auto-expert en copywriter voor JG Mobility in Barendrecht.

Je krijgt kentekengegevens van een auto. Zoek op internet naar de volledige standaarduitrusting, het exacte trim-niveau en alle bekende opties voor dit specifieke model en bouwjaar.

Genereer daarna drie dingen: versie, omschrijving, en een zo VOLLEDIG mogelijke optielijst.

---

## VERSIE:
Formaat: "150 pk | DSG Automaat | Panoramadak | Navi | ACC"
Max 80 tekens. Altijd: pk + transmissie + 3-4 opvallende kenmerken of trim-naam.

---

## OMSCHRIJVING (2 alinea's, Nederlands):
- Eerste: introductie + sterkste punten
- Tweede: details + waardepropositie
- Bouwjaar + model in eerste zin. APK vermelden als bekend.
- Laatste zin: "Marge voertuig — voor particulieren komt er geen BTW meer bij." of "BTW-auto — BTW verrekenbaar voor zakelijke kopers."
- Geen prijs. Min 60 / max 120 woorden per alinea.

---

## OPTIES & UITRUSTING (zo volledig mogelijk, gebaseerd op internet + kennis):
Altijd 4 categorieën: Exterieur · Interieur · Technologie · Aandrijving
Minimaal 5, maximaal 10 items per categorie. Specifiek en concreet.

Exterieur: velgen (maat+type), verlichting, lak (kleur+type), dak, spiegels, stylingpakketten, sensoren
Interieur: bekleding (materiaal+kleur), stoelen (type+functies), stuurwiel, airco (type+zones), armsteun
Technologie: navigatie (naam+schermgrootte), CarPlay/Android Auto, camera, rijhulpen (ACC/Lane/BSM/etc), boordcomputer
Aandrijving: motortype + cc + pk (eerste item), versnellingsbak (type+trappen), verbruik, rijmodi, start/stop

---

## Output (ALLEEN geldig JSON, niets anders):
{
  "versie": "...",
  "omschrijving": "...",
  "opties": [
    { "categorie": "Exterieur", "items": ["...", "..."] },
    { "categorie": "Interieur", "items": ["...", "..."] },
    { "categorie": "Technologie", "items": ["...", "..."] },
    { "categorie": "Aandrijving", "items": ["...", "..."] }
  ]
}`;

function buildAutoInfo(body: Record<string, string>) {
  const {
    merk, model, versie, bouwjaar, km, brandstof, transmissie,
    vermogen, kleur, kleurExterieur, bodytype, apk, btw, bekleding,
    cilinderinhoud, aantalDeuren, aantalCilinders,
  } = body;

  return `
Merk: ${merk}
Model: ${model}
Bekende uitvoering: ${versie || "onbekend"}
Bouwjaar: ${bouwjaar}
Kilometerstand: ${Number(km || 0).toLocaleString("nl-NL")} km
Brandstof: ${brandstof}
Transmissie: ${transmissie}
Vermogen: ${vermogen || "onbekend"}
Cilinderinhoud: ${cilinderinhoud ? cilinderinhoud + " liter" : "onbekend"}
Aantal cilinders: ${aantalCilinders || "onbekend"}
Aantal deuren: ${aantalDeuren || "onbekend"}
Kleur: ${kleur}
Kleur exterieur: ${kleurExterieur || kleur}
Carrosserie: ${bodytype}
APK: ${apk}
BTW/Marge: ${btw}
Bekleding: ${bekleding}
  `.trim();
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is niet ingesteld in .env.local" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const autoInfo = buildAutoInfo(body);
    const { merk, model, vermogen } = body;

    const client = new Anthropic({ apiKey });

    const userPrompt = `Zoek op internet naar de volledige uitrusting van deze auto.
Zoek naar: "${merk} ${model} ${vermogen || ""} uitrusting specificaties standaard opties"

${autoInfo}

Genereer de versie, omschrijving en volledige optielijst als JSON.`;

    const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];
    let finalText = "";

    for (let i = 0; i < 8; i++) {
      const resp = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 5000,
        system: SYSTEM_PROMPT,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [{ type: "web_search_20250305", name: "web_search" } as any],
        messages,
      });

      for (const block of resp.content) {
        if (block.type === "text") finalText = block.text;
      }

      if (resp.stop_reason === "end_turn") break;

      if (resp.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: resp.content });
        const toolResults: Anthropic.ToolResultBlockParam[] = resp.content
          .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
          .map((b) => ({ type: "tool_result" as const, tool_use_id: b.id, content: "Search executed." }));
        if (toolResults.length > 0) messages.push({ role: "user", content: toolResults });
      }
    }

    const jsonMatch = finalText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "AI gaf geen geldig JSON terug" }, { status: 500 });
    }

    return Response.json(JSON.parse(jsonMatch[0]));

  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `Je bent een Nederlandse auto-expert en copywriter voor JG Mobility in Barendrecht.

Je krijgt kentekengegevens van een auto. Gebruik de web_search-tool om op internet de volledige standaarduitrusting, het exacte trim-niveau en alle bekende opties voor dit specifieke model en bouwjaar op te zoeken. Baseer je antwoord op die zoekresultaten plus je eigen kennis.

Genereer daarna vier dingen: versie, transmissie, omschrijving, en een zo VOLLEDIG mogelijke optielijst.

---

## VERSIE:
Formaat: "150 pk | DSG Automaat | Panoramadak | Navi | ACC"
Max 80 tekens. Altijd: pk + transmissie + 3-4 opvallende kenmerken of trim-naam.

---

## TRANSMISSIE:
Bepaal de transmissie van deze specifieke uitvoering en geef EXACT één van deze drie waarden terug:
"Handgeschakeld", "Automatisch" of "Semi-automaat". Bij twijfel: kies wat voor dit model/motor/bouwjaar het meest gangbaar is.

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

## Output (ALLEEN geldig JSON als LAATSTE bericht, niets erna):
{
  "versie": "...",
  "transmissie": "Handgeschakeld",
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
Transmissie (indicatie): ${transmissie || "onbekend"}
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

// Haalt het laatste, accolade-gebalanceerde JSON-object uit de tekst. Robuuster dan een
// greedy regex: een losse '{' in citaat-/voorbeeldtekst vóór het echte JSON-blok zorgt niet
// meer voor een te vroege start. We scannen vanaf de laatste '}' terug naar de bijbehorende '{'.
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

    const userPrompt = `Zoek op internet naar de volledige uitrusting van deze auto:
"${merk} ${model} ${vermogen || ""} uitrusting specificaties standaard opties"

${autoInfo}

Geef daarna de versie, transmissie, omschrijving en volledige optielijst als JSON.`;

    // web_search_20250305 is een SERVER-side tool: Anthropic voert de zoekopdracht(en) zelf
    // uit binnen de call en levert de resultaten direct aan het model. Geen handmatige
    // tool-loop nodig. Bij een lange zoekopdracht kan de API 'pause_turn' teruggeven; dan
    // zetten we de call voort door de assistant-content terug te sturen. We verzamelen alle
    // text-blocks; het eindantwoord (de JSON) zit aan het eind.
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];
    let laatsteTekst = ""; // alleen de tekst van de LAATSTE ronde (vermijdt proza uit zoekrondes)
    let stopReason: string | null = null;
    for (let i = 0; i < 6; i++) {
      const resp = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 } as any],
        messages,
      });
      stopReason = resp.stop_reason ?? null;
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

    if (stopReason === "max_tokens") {
      return Response.json(
        { error: "AI-antwoord werd afgekapt (te lang). Probeer opnieuw of vul handmatig in." },
        { status: 500 }
      );
    }

    const jsonText = extractLaatsteJson(laatsteTekst);
    if (!jsonText) {
      return Response.json({ error: "AI gaf geen geldig JSON terug" }, { status: 500 });
    }

    return Response.json(JSON.parse(jsonText));
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

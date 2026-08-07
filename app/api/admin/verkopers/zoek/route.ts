import Anthropic from "@anthropic-ai/sdk";
import { initVerkopersDB, voegLeadToe } from "@/lib/verkopers-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fase 1 van de zoekagent: kandidaat-advertenties opsporen.
 *
 * Bewust opgesplitst. Eén agent die zoekt én elke advertentie opent én beoordeelt
 * heeft twee tot vijf minuten nodig, en Vercel kapt een functie op 60 seconden af —
 * dan komt er niets terug. Deze route doet daarom alleen het snelle deel: zoeken en
 * advertentielinks verzamelen. Het openen en controleren van elke advertentie gebeurt
 * per stuk in /api/admin/verkopers/[id]/verrijk, dat per aanroep ruim binnen de tijd blijft.
 *
 * Verzamelt uitdrukkelijk geen persoonsgegevens: die staan pas in de verrijkingsstap
 * ter sprake, en dan alleen wat de verkoper zelf openbaar heeft gepubliceerd.
 */

type Kandidaat = {
  bron?: string;
  advertentie_url?: string;
  titel?: string;
  merk?: string;
  model?: string;
  bouwjaar?: string;
  vraagprijs?: number;
  plaats?: string;
  motivatie?: string;
};

const JSON_VORM = `{
  "kandidaten": [
    {
      "bron": "AutoScout24",
      "advertentie_url": "https://www.autoscout24.nl/aanbod/volkswagen-polo-...",
      "titel": "Volkswagen Polo 1.0 TSI Comfortline",
      "merk": "Volkswagen",
      "model": "Polo",
      "bouwjaar": "2018",
      "vraagprijs": 13950,
      "plaats": "Rotterdam",
      "motivatie": "wat je in het zoekresultaat zag"
    }
  ],
  "toelichting": "1-2 zinnen over wat je vond"
}`;

const ZOEK_PROMPT = (opdracht: string) =>
  `Je zoekt voor autobedrijf JG Mobility (Barendrecht) naar advertenties van PARTICULIEREN die hun auto zelf te koop hebben gezet.

Zoekopdracht: "${opdracht}"

Je taak in deze stap is beperkt en moet SNEL: verzamel links naar INDIVIDUELE advertenties. Je hoeft ze niet te openen en niet te controleren — een volgende stap doet dat per advertentie.

Gebruik web_search. Richt je op AutoScout24, AutoTrack, Gaspedaal en Marktplaats. Zoek naar losse advertentiepagina's, niet naar categorie- of filterpagina's.

Wat je oplevert:
- Alleen URL's die je daadwerkelijk in de zoekresultaten hebt gezien. Verzin er nooit één en pas nooit een URL aan.
- Neem ook overzichts-URL's NIET op — alleen pagina's van één specifieke auto.
- Vul merk, model, bouwjaar, prijs en plaats in voor zover die uit het zoekresultaat blijken. Weet je iets niet, laat het leeg.
- Maximaal 10 kandidaten. Liever 5 goede links dan 10 gokken.

Antwoord UITSLUITEND met dit JSON-object, zonder tekst eromheen:
${JSON_VORM}`;

/** Laatste accolade-gebalanceerde JSON-object uit de tekst (robuust tegen omringende tekst). */
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

/** Overzichts- en filterpagina's herkennen — die leveren geen bruikbare lead op. */
function isOverzichtsPagina(url: string): boolean {
  return /\/(l|lrp|zoeken|search|aanbod)\/?$|[?&](postcode|zoekterm|priceTo|price_to|sort)=|\/l\/auto-s\/[^/]+\/?$/i.test(
    url
  );
}

async function zoekKandidaten(
  client: Anthropic,
  prompt: string,
  signal: AbortSignal
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let laatsteTekst = "";
  // web_search kan de beurt pauzeren (pause_turn); dan sturen we het antwoord terug
  // en laat het model verder zoeken.
  for (let i = 0; i < 6; i++) {
    const resp = await client.messages.create(
      {
        model: "claude-opus-5",
        max_tokens: 4000,
        // Lage effort en alleen web_search: deze stap moet ruim binnen de 60s van
        // Vercel blijven. Thinking bewust AAN — met thinking uit schrijft Opus 5
        // tool-aanroepen soms als gewone tekst, waardoor er stilletjes niet gezocht wordt.
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
        messages,
      },
      { signal }
    );
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

  const { zoekopdracht } = await req.json();
  if (!zoekopdracht || typeof zoekopdracht !== "string" || zoekopdracht.trim().length < 3) {
    return Response.json({ error: "Geef een zoekopdracht op" }, { status: 400 });
  }

  await initVerkopersDB();
  const client = new Anthropic({ apiKey });

  // Harde grens: Vercel kapt op 60s af. Wint de timeout, dan melden we dat eerlijk.
  // Terugvallen op modelkennis doen we hier bewust NIET — dat levert verzonnen
  // advertenties op, en die zijn schadelijker dan geen resultaat.
  const controller = new AbortController();
  const zoeken = zoekKandidaten(client, ZOEK_PROMPT(zoekopdracht.trim()), controller.signal).catch(
    () => ""
  );
  const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(""), 45000));
  const tekst = await Promise.race([zoeken, timeout]);
  controller.abort();

  const jsonText = extractLaatsteJson(tekst);
  if (!jsonText) {
    return Response.json(
      {
        error:
          "De zoekopdracht leverde binnen de tijd niets bruikbaars op. Probeer het opnieuw met één merk en één regio, bijvoorbeeld 'Volkswagen Polo particulier Rotterdam'.",
      },
      { status: 422 }
    );
  }

  // Web search voegt citatie-markup toe (<cite index="...">...</cite>); die strippen we eruit.
  const schoon = jsonText.replace(/<cite\b[^>]*>/gi, "").replace(/<\/cite>/gi, "");
  let data: { kandidaten?: Kandidaat[]; toelichting?: string };
  try {
    data = JSON.parse(schoon);
  } catch {
    return Response.json({ error: "Ongeldige data van AI", raw: schoon.slice(0, 300) }, { status: 422 });
  }

  const ruw = Array.isArray(data.kandidaten) ? data.kandidaten : [];
  const nieuweIds: string[] = [];
  let overgeslagen = 0;

  for (const k of ruw) {
    const url = k.advertentie_url ?? "";
    if (!/^https?:\/\//i.test(url) || isOverzichtsPagina(url)) {
      overgeslagen++;
      continue;
    }
    // De blokkadelijst wordt hier nog niet geraadpleegd: in deze fase kennen we
    // nog geen contactgegevens. De verrijkingsstap controleert het zodra die er zijn.
    const id = await voegLeadToe({
      bron: k.bron ?? "",
      advertentie_url: url,
      titel: k.titel ?? "",
      merk: k.merk ?? "",
      model: k.model ?? "",
      bouwjaar: String(k.bouwjaar ?? ""),
      vraagprijs: Number(k.vraagprijs) || 0,
      plaats: k.plaats ?? "",
      // Scores blijven 0 tot de verrijkingsstap de advertentie echt heeft gelezen.
      particulier_score: 0,
      kans_score: 0,
      motivatie: k.motivatie ?? "",
      zoekopdracht: zoekopdracht.trim(),
    });
    if (id) nieuweIds.push(id);
    else overgeslagen++; // kenden we al (unieke index op advertentie_url)
  }

  return Response.json({
    ok: true,
    gevonden: ruw.length,
    toegevoegd: nieuweIds.length,
    overgeslagen,
    nieuwe_ids: nieuweIds,
    toelichting: data.toelichting ?? "",
  });
}

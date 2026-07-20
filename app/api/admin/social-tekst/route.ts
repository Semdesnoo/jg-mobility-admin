import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
// Vercel Hobby kapt functies af op 60s — ruim eronder blijven.
export const maxDuration = 60;

const CONTACTBLOK = `JG Mobility
\u{1F4CD} Arnhemseweg 10a 2994 LA Barendrecht
\u{1F4DE} Telefoon: +31 6 21331374 \u{1F4E7} E-mail: info@jgmobility.nl

Wij werken graag op afspraak, zodat we alle tijd voor u kunnen nemen. Tot snel!`;

const SYSTEM_PROMPT = `Je bent copywriter voor JG Mobility, een autobedrijf in Barendrecht.

Je krijgt de gegevens van een auto uit de voorraad en levert drie teksten.

## 1. MARKTPLAATS - INTRODUCTIETEKST
Kort en pakkend, 2 tot 3 zinnen, maximaal 40 woorden. Dit is de tekst boven de
advertentie. Noem model, bouwjaar en de twee of drie meest opvallende
eigenschappen. Eindig met een korte typering.
Toon als voorbeeld: "Luxe Tiguan 1.5 TSI R-Line 2019 DSG. Panoramadak, 9.2 inch
Navi en ArtVelours. Zeldzaam Urano Grey! De ultieme sportieve gezinsauto."

## 2. MARKTPLAATS - ADVERTENTIETEKST
Uitgebreid, 350 tot 500 woorden, in deze opbouw:
- Eerste regel is een titel: "Merk Model Uitvoering Bouwjaar - Transmissie | Optie | Optie"
- Openingsalinea met een vraag aan de lezer en waarom deze auto opvalt
- Tussenkopje over rijden en prestaties, met een alinea eronder
- Tussenkopje over interieur, luxe en technologie, met een alinea eronder
- De regel "De belangrijkste extra's op een rij:" met daaronder 5 tot 7 punten in
  de vorm "Naam van de optie: korte uitleg waarom het fijn is"
- Tussenkopje "Over deze auto" met een alinea over staat en karakter
- Afsluitende uitnodiging voor een proefrit in Barendrecht

Aanspreekvorm "u". Geen prijs noemen. Geen contactgegevens noemen, die worden er
automatisch onder gezet. Geen emoji in deze tekst.

## 3. INSTAGRAM
Vlot en levendig, 60 tot 110 woorden. Wissel per auto van opzet zodat je berichten
niet allemaal hetzelfde lijken. Kies de vorm die bij deze auto past:
 (a) opening met een vraag, daarna "De specs:" met bulletpunten
 (b) korte krachtige opening, daarna "Hoogtepunten:" met bulletpunten
 (c) verhalende opening over waar de auto goed in is, daarna 3 punten met vinkjes
Tutoyeren met "je", 3 tot 6 emoji, functioneel gebruikt. Sluit af met een
uitnodiging: langskomen voor een proefrit, een DM sturen, of de link in bio.
Prijs mag hier wel genoemd worden als die bekend is.

## 4. HASHTAGS
8 tot 12 stuks op een regel, gescheiden door spaties. Merk- en modelspecifiek,
plus #jgmobility en #barendrecht.

Belangrijk: verzin geen eigenschappen die niet in de gegevens staan. Weet je iets
niet, laat het dan weg in plaats van te gokken.`;

type AutoInvoer = {
  merk?: string; model?: string; versie?: string; bouwjaar?: number;
  km?: number; brandstof?: string; transmissie?: string; vermogen?: string;
  kleur?: string; apk?: string; btw?: string; bodytype?: string;
  prijs?: number; omschrijving?: string;
  opties?: { categorie?: string; items?: string[] }[];
  extra?: string;
};

function bouwPrompt(a: AutoInvoer): string {
  const regels: string[] = [];
  const voegToe = (label: string, waarde: unknown) => {
    if (waarde === undefined || waarde === null || waarde === "" || waarde === 0) return;
    regels.push(`${label}: ${waarde}`);
  };

  voegToe("Merk", a.merk);
  voegToe("Model", a.model);
  voegToe("Uitvoering", a.versie);
  voegToe("Bouwjaar", a.bouwjaar);
  voegToe("Kilometerstand", a.km ? `${a.km.toLocaleString("nl-NL")} km` : "");
  voegToe("Brandstof", a.brandstof);
  voegToe("Transmissie", a.transmissie);
  voegToe("Vermogen", a.vermogen);
  voegToe("Kleur", a.kleur);
  voegToe("Carrosserie", a.bodytype);
  voegToe("APK geldig tot", a.apk && a.apk !== "Onbekend" ? a.apk : "");
  voegToe("BTW", a.btw);

  const opties = (a.opties ?? [])
    .map((o) => (o.items?.length ? `${o.categorie}: ${o.items.join(", ")}` : ""))
    .filter(Boolean);
  if (opties.length) regels.push(`Opties:\n${opties.join("\n")}`);
  if (a.omschrijving) regels.push(`Bestaande omschrijving (ter inspiratie):\n${a.omschrijving}`);
  if (a.extra?.trim()) regels.push(`Extra aanwijzingen van de verkoper: ${a.extra.trim()}`);

  return `Gegevens van de auto:\n\n${regels.join("\n")}`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is niet ingesteld", ontbrekendeSleutel: true },
      { status: 200 }
    );
  }

  try {
    const body = (await request.json()) as AutoInvoer;
    if (!body.merk && !body.model && !body.extra) {
      return Response.json({ error: "Kies een auto of typ zelf een omschrijving." }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    // Gestructureerde uitvoer: intro, advertentie, bijschrift en hashtags komen
    // gescheiden terug, zodat elk zijn eigen kopieerknop kan krijgen.
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              intro: { type: "string", description: "Korte introductietekst voor boven de Marktplaats-advertentie" },
              advertentie: { type: "string", description: "De volledige Marktplaats-advertentietekst, zonder contactgegevens" },
              instagram: { type: "string", description: "Het Instagram-bijschrift zonder hashtags" },
              hashtags: { type: "string", description: "De hashtagregel, spaties ertussen" },
            },
            required: ["intro", "advertentie", "instagram", "hashtags"],
            additionalProperties: false,
          },
        },
      },
      messages: [{ role: "user", content: bouwPrompt(body) }],
    });

    if (resp.stop_reason === "refusal") {
      return Response.json({ error: "Het model heeft dit verzoek geweigerd." }, { status: 200 });
    }

    const tekst = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
    let uit: { intro?: string; advertentie?: string; instagram?: string; hashtags?: string } = {};
    try {
      uit = JSON.parse(tekst);
    } catch {
      return Response.json({ error: "Onverwacht antwoord van het model." }, { status: 200 });
    }

    // Contactgegevens plakken we er zelf onder in plaats van ze te laten
    // overtypen: een verkeerd telefoonnummer in een advertentie is een echte fout.
    const advertentie = uit.advertentie
      ? `${uit.advertentie.trimEnd()}

${CONTACTBLOK}`
      : "";

    return Response.json({
      intro: uit.intro ?? "",
      advertentie,
      instagram: uit.instagram ?? "",
      hashtags: uit.hashtags ?? "",
      verbruik: {
        invoer: resp.usage.input_tokens,
        uitvoer: resp.usage.output_tokens,
      },
    });
  } catch (err) {
    const bericht = err instanceof Error ? err.message : String(err);
    return Response.json({ error: bericht }, { status: 200 });
  }
}

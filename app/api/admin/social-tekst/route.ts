import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createHash, randomUUID } from "crypto";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";
// Vercel Hobby kapt functies af op 60s — ruim eronder blijven.
export const maxDuration = 60;

/** Harde limiet van het Marktplaats-introductieveld. */
const INTRO_MAX = 130;

const CONTACTBLOK = `JG Mobility
\u{1F4CD} Arnhemseweg 10a 2994 LA Barendrecht
\u{1F4DE} Telefoon: +31 6 21331374 \u{1F4E7} E-mail: info@jgmobility.nl

Wij werken graag op afspraak, zodat we alle tijd voor u kunnen nemen. Tot snel!`;

const SYSTEM_PROMPT = `Je bent copywriter voor JG Mobility, een autobedrijf in Barendrecht.

Je krijgt de gegevens van een auto uit de voorraad en levert drie teksten.

## 1. MARKTPLAATS - INTRODUCTIETEKST
ABSOLUUT MAXIMAAL ${INTRO_MAX} TEKENS, inclusief spaties en leestekens. Dit is een
harde limiet van Marktplaats: wat erboven komt wordt afgekapt. Tel de tekens en
blijf er zeker onder. Eén of twee korte zinnen, geen opsomming.
Noem het model, het bouwjaar en de twee meest opvallende eigenschappen, en sluit
af met een korte typering.
Toon als voorbeeld (109 tekens): "Luxe Tiguan 1.5 TSI R-Line 2019. Panoramadak,
9.2 inch Navi en ArtVelours. De sportieve gezinsauto."

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
  id?: number;
  merk?: string; model?: string; versie?: string; bouwjaar?: number;
  km?: number; brandstof?: string; transmissie?: string; vermogen?: string;
  kleur?: string; apk?: string; btw?: string; bodytype?: string;
  prijs?: number; omschrijving?: string;
  opties?: { categorie?: string; items?: string[] }[];
  extra?: string;
  /** true = archief overslaan en opnieuw laten schrijven (kost tokens). */
  opnieuw?: boolean;
};

/**
 * Kapt de introductietekst af op de Marktplaats-limiet. Het model houdt zich er
 * met de huidige prompt aan, maar dit is het vangnet: liever een nette zin korter
 * dan een advertentie die midden in een woord wordt afgesneden.
 */
function beperkIntro(ruw: string): { intro: string; ingekort: boolean } {
  const tekst = ruw.trim().replace(/\s+/g, " ");
  if (tekst.length <= INTRO_MAX) return { intro: tekst, ingekort: false };

  // Eerst proberen op een zinseinde te stoppen — dat leest het natuurlijkst.
  const zinnen = tekst.match(/[^.!?]+[.!?]+/g) ?? [];
  let opZin = "";
  for (const zin of zinnen) {
    if ((opZin + zin).trim().length > INTRO_MAX) break;
    opZin += zin;
  }
  if (opZin.trim().length >= 60) return { intro: opZin.trim(), ingekort: true };

  // Anders op een woordgrens, met beletselteken zodat zichtbaar is dat er meer was.
  let opWoord = "";
  for (const woord of tekst.split(" ")) {
    if (`${opWoord} ${woord}`.trim().length > INTRO_MAX - 1) break;
    opWoord = `${opWoord} ${woord}`.trim();
  }
  // Past zelfs het eerste woord niet, dan toch hard afkappen — anders houden
  // we alleen een beletselteken over.
  if (!opWoord) opWoord = tekst.slice(0, INTRO_MAX - 1);
  return { intro: `${opWoord.replace(/[,;:.\-]+$/, "")}…`, ingekort: true };
}

/**
 * Vingerafdruk van alles wat de tekst beïnvloedt. Verandert er niets aan de auto
 * of de aanwijzing, dan is de bestaande tekst nog geldig en hoeft het model niet
 * opnieuw te draaien.
 */
function invoerHash(a: AutoInvoer): string {
  const relevant = {
    merk: a.merk ?? "", model: a.model ?? "", versie: a.versie ?? "",
    bouwjaar: a.bouwjaar ?? 0, km: a.km ?? 0, brandstof: a.brandstof ?? "",
    transmissie: a.transmissie ?? "", vermogen: a.vermogen ?? "",
    kleur: a.kleur ?? "", apk: a.apk ?? "", btw: a.btw ?? "",
    bodytype: a.bodytype ?? "", prijs: a.prijs ?? 0,
    omschrijving: a.omschrijving ?? "",
    opties: (a.opties ?? []).map((o) => `${o.categorie ?? ""}:${(o.items ?? []).join(",")}`).sort(),
    extra: (a.extra ?? "").trim(),
    // Meeversioneren: na een promptwijziging horen oude teksten niet meer geldig te zijn.
    promptversie: `intro${INTRO_MAX}`,
  };
  return createHash("sha256").update(JSON.stringify(relevant)).digest("hex").slice(0, 32);
}

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

// De tabel kan ontbreken als init-db nog nooit is aangeroepen. Eén keer per
// koude start controleren is genoeg; daarna zit de belofte in het geheugen.
let tabelKlaar: Promise<void> | null = null;
function zorgVoorTabel(): Promise<void> {
  tabelKlaar ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS social_teksten (
        id TEXT PRIMARY KEY,
        auto_id INTEGER,
        auto_naam TEXT DEFAULT '',
        invoer_hash TEXT NOT NULL,
        extra TEXT DEFAULT '',
        intro TEXT DEFAULT '',
        advertentie TEXT DEFAULT '',
        instagram TEXT DEFAULT '',
        hashtags TEXT DEFAULT '',
        model TEXT DEFAULT '',
        tokens_in INTEGER DEFAULT 0,
        tokens_uit INTEGER DEFAULT 0,
        aangemaakt TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS social_teksten_hash_idx ON social_teksten (invoer_hash, aangemaakt DESC)`.catch(() => null);
    await sql`CREATE INDEX IF NOT EXISTS social_teksten_auto_idx ON social_teksten (auto_id, aangemaakt DESC)`.catch(() => null);
  })().catch((e) => {
    // Mislukt het aanmaken, dan mag een volgende aanroep het opnieuw proberen
    // in plaats van de fout voorgoed te onthouden.
    tabelKlaar = null;
    throw e;
  });
  return tabelKlaar;
}

type ArchiefRij = {
  id: string; auto_id: number | null; auto_naam: string; extra: string;
  intro: string; advertentie: string; instagram: string; hashtags: string;
  model: string; tokens_in: number; tokens_uit: number; aangemaakt: string;
};

/** Archiefoverzicht — optioneel gefilterd op auto via ?auto_id=. */
export async function GET(request: NextRequest) {
  try {
    await zorgVoorTabel();
    const autoId = request.nextUrl.searchParams.get("auto_id");
    const rijen = autoId
      ? ((await sql`
          SELECT * FROM social_teksten WHERE auto_id = ${Number(autoId)}
          ORDER BY aangemaakt DESC LIMIT 25
        `) as ArchiefRij[])
      : ((await sql`
          SELECT * FROM social_teksten ORDER BY aangemaakt DESC LIMIT 50
        `) as ArchiefRij[]);
    return Response.json(rijen);
  } catch {
    return Response.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  let body: AutoInvoer;
  try {
    body = (await request.json()) as AutoInvoer;
  } catch {
    return Response.json({ error: "Ongeldig verzoek." }, { status: 400 });
  }

  if (!body.merk && !body.model && !body.extra) {
    return Response.json({ error: "Kies een auto of typ zelf een omschrijving." }, { status: 400 });
  }

  const hash = invoerHash(body);
  const naam = [body.merk, body.model, body.versie].filter(Boolean).join(" ").trim();

  // ── 1. Archief: bestaat deze tekst al, dan is hij binnen een fractie terug ──
  if (!body.opnieuw) {
    try {
      await zorgVoorTabel();
      const eerder = (await sql`
        SELECT * FROM social_teksten WHERE invoer_hash = ${hash}
        ORDER BY aangemaakt DESC LIMIT 1
      `) as ArchiefRij[];
      if (eerder.length > 0) {
        const r = eerder[0];
        return Response.json({
          intro: r.intro,
          advertentie: r.advertentie,
          instagram: r.instagram,
          hashtags: r.hashtags,
          uitArchief: true,
          aangemaakt: r.aangemaakt,
          verbruik: { invoer: 0, uitvoer: 0 },
        });
      }
    } catch {
      // Archief onbereikbaar: gewoon doorgaan en opnieuw genereren.
    }
  }

  // ── 2. Niets in het archief (of expliciet opnieuw): het model laten schrijven ──
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is niet ingesteld", ontbrekendeSleutel: true },
      { status: 200 }
    );
  }

  try {
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
              intro: { type: "string", description: `Introductietekst voor boven de Marktplaats-advertentie, maximaal ${INTRO_MAX} tekens` },
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

    const { intro, ingekort } = beperkIntro(uit.intro ?? "");

    // Contactgegevens plakken we er zelf onder in plaats van ze te laten
    // overtypen: een verkeerd telefoonnummer in een advertentie is een echte fout.
    const advertentie = uit.advertentie
      ? `${uit.advertentie.trimEnd()}

${CONTACTBLOK}`
      : "";

    const instagram = uit.instagram ?? "";
    const hashtags = uit.hashtags ?? "";

    // ── 3. In het archief zetten, zodat dezelfde auto geen tokens meer kost ──
    let aangemaakt = new Date().toISOString();
    try {
      await zorgVoorTabel();
      const rij = (await sql`
        INSERT INTO social_teksten
          (id, auto_id, auto_naam, invoer_hash, extra, intro, advertentie, instagram, hashtags,
           model, tokens_in, tokens_uit)
        VALUES
          (${randomUUID()}, ${body.id ?? null}, ${naam}, ${hash}, ${(body.extra ?? "").trim()},
           ${intro}, ${advertentie}, ${instagram}, ${hashtags},
           ${resp.model}, ${resp.usage.input_tokens}, ${resp.usage.output_tokens})
        RETURNING aangemaakt
      `) as { aangemaakt: string }[];
      if (rij[0]?.aangemaakt) aangemaakt = rij[0].aangemaakt;
    } catch {
      // Opslaan mislukt: de tekst is er wel, die geven we gewoon terug.
    }

    return Response.json({
      intro,
      introIngekort: ingekort,
      advertentie,
      instagram,
      hashtags,
      uitArchief: false,
      aangemaakt,
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

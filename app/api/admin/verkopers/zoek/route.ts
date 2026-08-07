import Anthropic from "@anthropic-ai/sdk";
import { initVerkopersDB, voegLeadToe } from "@/lib/verkopers-db";
import {
  leesCriteria,
  criteriaAlsTekst,
  volgendeMerken,
  type Criteria,
} from "@/lib/verkopers-criteria";

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

const ZOEK_PROMPT = (extraWens: string, criteria: Criteria, merken: string[]) =>
  `Je zoekt voor autobedrijf JG Mobility (Barendrecht) naar advertenties van PARTICULIEREN die hun auto zelf te koop hebben gezet.

ZOEKGRENZEN:
${criteriaAlsTekst(criteria)}
${extraWens ? `\nEXTRA WENS van de gebruiker (binnen bovenstaande grenzen): "${extraWens}"\n` : ""}
MERKEN VOOR DEZE RONDE: ${merken.join(", ")}
Gebruik deze merken om je zoekopdrachten concreet te maken — bijvoorbeeld "${merken[0]} particulier te koop ${criteria.vertrekpunt.naam.split(",")[0]}" of "${merken[1] ?? merken[0]} particulier aangeboden Zuid-Holland". Dat is bewust: zoeken zonder merk levert alleen categorie- en dealerpagina's op, met merk vind je losse advertenties. Een volgende zoekronde krijgt andere merken, dus je hoeft ze hier niet allemaal te dekken.

Vind je bij een merk niets bruikbaars, ga dan door naar het volgende merk uit het rijtje. Kom je een geschikte advertentie van een ánder merk tegen, neem die gerust mee — de merken hierboven sturen je zoekopdracht, ze zijn geen filter.

Je taak in deze stap is beperkt en moet SNEL: verzamel links naar INDIVIDUELE advertenties. Je hoeft ze niet te openen en niet te controleren — een volgende stap doet dat per advertentie.

Gebruik web_search, en gebruik hem ruim: doe meerdere zoekopdrachten, minstens één per merk uit het rijtje, en varieer je formulering en plaatsnaam als een zoekopdracht weinig oplevert. Richt je op AutoScout24, AutoTrack, Gaspedaal en Marktplaats. Zoek naar losse advertentiepagina's, niet naar categorie- of filterpagina's.

OPBRENGST IS HET DOEL. Verzamel er zo veel als je er eerlijk kunt vinden — een volgende stap opent elke advertentie afzonderlijk en gooit weg wat een handelaar blijkt of buiten de grenzen valt. Een twijfelgeval dat daar sneuvelt kost bijna niets; een advertentie die je hier niet meeneemt is definitief weg.

Wat je oplevert:
- Alleen URL's die je daadwerkelijk in de zoekresultaten hebt gezien. Verzin er nooit één en pas nooit een URL aan. Dit is de enige harde regel: een verzonnen link is erger dan geen link.
- Neem ook overzichts-URL's NIET op — alleen pagina's van één specifieke auto.
- Vul merk, model, bouwjaar, prijs en plaats in voor zover die uit het zoekresultaat blijken. Weet je iets niet, laat het leeg.
- Tot 30 kandidaten. Stop niet bij vijf omdat dat genoeg voelt; ga door zolang je nog echte advertenties vindt.
- Valt een advertentie duidelijk buiten de zoekgrenzen (verkeerd land, ver buiten de prijsklasse), laat hem weg. Twijfel je? Neem hem mee — de volgende stap controleert het.

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

/**
 * Houdt alleen de links over die echt bestaan.
 *
 * Dit is de grendel tegen verzonnen advertenties. Een lichter model levert dat vaker
 * op dan een zwaar model, en een verzonnen link is de duurste soort rommel: hij ziet
 * er goed uit, komt in je lijst terecht, en kost je pas een aanroep bij het uitlezen
 * voordat blijkt dat er niets achter zit. Eén keer echt ophalen kost bijna niets en
 * maakt het probleem hard onmogelijk.
 *
 * We halen alleen de kop op, niet de hele pagina, en gooien alleen weg bij een hard
 * "bestaat niet" (404 of 410). Bij een 403, een storing of een time-out blijft de link
 * staan: dat kan net zo goed aan de andere kant liggen, en goede leads verliezen aan
 * een haperend netwerk is erger dan een rotte link die de uitleesstap er toch uit haalt.
 *
 * Getest op de echte sites: een bestaande Marktplaats- en AutoScout24-advertentie geeft
 * 200, een verzonnen of afgekapte URL geeft 404.
 */
async function filterBestaandeUrls(urls: string[], budgetMs: number): Promise<Set<string>> {
  const uniek = [...new Set(urls.filter(Boolean))];
  const goed = new Set<string>(uniek);
  if (uniek.length === 0) return goed;

  const stop = Date.now() + budgetMs;
  const wachtrij = [...uniek];

  const werker = async () => {
    for (;;) {
      const url = wachtrij.shift();
      if (!url || Date.now() > stop) return;
      try {
        const res = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(Math.min(6000, Math.max(1000, stop - Date.now()))),
          headers: { "user-agent": "Mozilla/5.0 (compatible; JGMobility/1.0)" },
        });
        if (res.status === 404 || res.status === 410) goed.delete(url);
      } catch {
        /* netwerkfout of time-out: laten staan, de uitleesstap kijkt er nog naar */
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(8, uniek.length) }, werker));
  return goed;
}

/** Overzichts- en filterpagina's herkennen — die leveren geen bruikbare lead op. */
function isOverzichtsPagina(url: string): boolean {
  return /\/(l|lrp|zoeken|search|aanbod)\/?$|[?&](postcode|zoekterm|priceTo|price_to|sort)=|\/l\/auto-s\/[^/]+\/?$/i.test(
    url
  );
}

/**
 * @param opvang Vangt op wat er onderweg al binnenkwam. Wint de tijdklok tijdens een
 *   tussenronde (het model zoekt in meerdere beurten), dan staat hier de tekst van de
 *   laatste voltooide beurt in plaats van niets.
 */
async function zoekKandidaten(
  client: Anthropic,
  prompt: string,
  signal: AbortSignal,
  opvang: { tekst: string; afgekapt: boolean }
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let laatsteTekst = "";
  // web_search kan de beurt pauzeren (pause_turn); dan sturen we het antwoord terug
  // en laat het model verder zoeken.
  for (let i = 0; i < 6; i++) {
    const resp = await client.messages.create(
      {
        // Haiku 4.5 — het goedkoopste model dat dit aankan. Deze stap verzamelt
        // links; het oordeel of het echt een particulier is valt pas in de volgende
        // stap, en bij "blijf zoeken" draait dit tientallen keren achter elkaar.
        //
        // Het risico van een lichter model is dat het een link verzint. Daar staat
        // hieronder een harde controle tegenover: elke URL wordt echt opgehaald
        // voordat hij bewaard wordt. Zo kan een verzonnen link er niet doorheen.
        //
        // De instellingen wijken af van de zwaardere modellen; alle drie geverifieerd
        // tegen de echte API: "adaptive" thinking en output_config/effort geven een
        // 400 op Haiku, en van web_search werkt alleen de oudere _20250305.
        model: "claude-haiku-4-5-20251001",
        // Ruim genoeg voor een lijst van dertig kandidaten; op vierduizend paste
        // die niet en brak het antwoord halverwege af.
        max_tokens: 8000,
        // Thinking bewust AAN: met thinking uit schrijven modellen hun tool-aanroepen
        // soms als gewone tekst, waardoor er stilletjes niet gezocht wordt.
        thinking: { type: "enabled", budget_tokens: 2048 },
        // Vijf zoekacties was te krap voor acht merken. Tien past nog binnen de
        // tijd die Vercel geeft en laat ruimte om een formulering te variëren als
        // de eerste poging bij een merk niets oplevert.
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 10 }],
        messages,
      },
      { signal }
    );
    const rondeTekst = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (rondeTekst) {
      laatsteTekst = rondeTekst;
      opvang.tekst = rondeTekst;
    }
    // Op max_tokens breekt het antwoord middenin de lijst af. Dat moet je weten:
    // de laatste accolade sluit dan een losse kandidaat in plaats van het geheel,
    // en dat leest als een geldig maar leeg antwoord.
    if (resp.stop_reason === "max_tokens") opvang.afgekapt = true;
    if (resp.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: resp.content });
      continue;
    }
    break;
  }
  return laatsteTekst;
}

export async function POST(req: Request) {
  // De klok begint hier, niet pas bij het zoeken. Vercel kapt het hele verzoek af op
  // 60 seconden, en daar valt ook het opzetten van de database, het lezen van de
  // criteria en het wegschrijven van de vondsten onder. Rekenden we de tijd pas vanaf
  // het zoeken, dan kon een trage start de bewaarstap eruit duwen: de leads stonden
  // dan wel in de database, maar het antwoord bereikte het scherm nooit.
  const gestart = Date.now();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY niet ingesteld" }, { status: 500 });

  // De zoekopdracht is optioneel: de zoekgrenzen zijn de opdracht. Wie een extra
  // wens heeft ("automaat", "stationwagen") kan die meegeven, maar hoeft niet.
  let extraWens = "";
  try {
    const body = await req.json();
    extraWens = typeof body?.zoekopdracht === "string" ? body.zoekopdracht.trim().slice(0, 300) : "";
  } catch {
    /* lege body is prima */
  }

  await initVerkopersDB();
  const criteria = await leesCriteria();
  // Merken voor deze ronde; de teller schuift meteen door zodat de volgende klik
  // andere merken pakt en je over een paar rondes de hele lijst hebt gehad.
  const merken = await volgendeMerken(8);
  const client = new Anthropic({ apiKey });

  // Wat er van de 60 seconden overblijft, min een marge om de vondsten nog te kunnen
  // wegschrijven en te antwoorden. Terugvallen op modelkennis doen we hier bewust
  // NIET — dat levert verzonnen advertenties op, en die zijn schadelijker dan geen
  // resultaat.
  // Ruimte laten voor het natrekken van de links en het wegschrijven daarna; die
  // stappen komen ná deze en vallen binnen dezelfde 60 seconden van Vercel.
  const budget = Math.max(10_000, 38_000 - (Date.now() - gestart));
  const controller = new AbortController();
  const opvang = { tekst: "", afgekapt: false };
  let apiFout: unknown = null;
  const zoeken = zoekKandidaten(
    client,
    ZOEK_PROMPT(extraWens, criteria, merken),
    controller.signal,
    opvang
  ).catch((e: unknown) => {
    apiFout = e;
    return "";
  });
  const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(""), budget));
  const tekst = await Promise.race([zoeken, timeout]);
  controller.abort();

  // Een sleutel die niet werkt of een limiet die vol zit hoort niet als "niets
  // gevonden" te eindigen — dan blijf je de actieradius verruimen terwijl het
  // probleem ergens anders zit.
  const status = (apiFout as { status?: number } | null)?.status;
  if (status === 401 || status === 403) {
    return Response.json(
      { error: "De AI-sleutel wordt geweigerd. Controleer ANTHROPIC_API_KEY in de Vercel-instellingen." },
      { status: 502 }
    );
  }
  if (status === 429) {
    return Response.json(
      { error: "De AI zit even aan zijn limiet. Wacht een minuut en probeer het opnieuw." },
      { status: 502 }
    );
  }

  // Bij een tijdklok-afbreking is `tekst` leeg; val dan terug op wat er onderweg al
  // binnenkwam.
  const jsonText = extractLaatsteJson(tekst || opvang.tekst);
  if (!jsonText) {
    return Response.json(
      {
        error:
          "De zoekopdracht leverde binnen de tijd niets bruikbaars op. Probeer het nog eens — advertentiesites zijn wisselend doorzoekbaar. Helpt dat niet, zet de actieradius dan ruimer of verbreed de prijsklasse.",
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

  // Zonder kandidatenlijst is dit niet het bedoelde antwoord maar een afgekapt of
  // half stuk tekst waar toevallig een geldig blokje in stond. Dat als "0 gevonden"
  // doorgeven zou een hele zoekronde stil laten verdwijnen.
  if (!Array.isArray(data.kandidaten)) {
    return Response.json(
      {
        error: opvang.afgekapt
          ? "Het antwoord van de AI werd halverwege afgekapt. Probeer het nog eens."
          : "De AI gaf geen bruikbare lijst terug. Probeer het nog eens.",
      },
      { status: 422 }
    );
  }

  // Eerst de vorm nakijken, dan pas of de pagina echt bestaat — dat scheelt
  // netwerkverkeer voor links die er sowieso niet doorheen komen.
  const ruw = data.kandidaten.filter((k) => {
    const url = k.advertentie_url ?? "";
    return /^https?:\/\//i.test(url) && !isOverzichtsPagina(url);
  });
  let overgeslagen = data.kandidaten.length - ruw.length;

  const echt = await filterBestaandeUrls(
    ruw.map((k) => k.advertentie_url ?? ""),
    Math.max(3000, 52_000 - (Date.now() - gestart))
  );
  overgeslagen += ruw.length - echt.size;

  const nieuweIds: string[] = [];

  for (const k of ruw) {
    const url = k.advertentie_url ?? "";
    if (!echt.has(url)) continue;
    // Prijsgrens ook hier nog eens nakijken. De AI houdt zich er meestal aan, maar
    // een instructie is geen garantie en een lead buiten je klasse kost je tijd.
    const prijs = Number(k.vraagprijs) || 0;
    if (prijs > 0) {
      if (criteria.prijsMin > 0 && prijs < criteria.prijsMin) {
        overgeslagen++;
        continue;
      }
      if (criteria.prijsMax > 0 && prijs > criteria.prijsMax) {
        overgeslagen++;
        continue;
      }
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
      zoekopdracht: extraWens || `binnen ${criteria.straalKm} km van ${criteria.vertrekpunt.naam}`,
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
    merken,
    toelichting: data.toelichting ?? "",
  });
}

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
async function vraagMarkt(client: Anthropic, prompt: string, useWebSearch: boolean, signal?: AbortSignal): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let laatsteTekst = "";
  for (let i = 0; i < 4; i++) {
    const resp = await client.messages.create({
      // Sonnet + web search voor de echte taxatie; bij terugval snel Haiku zonder tools (modelkennis).
      model: useWebSearch ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001",
      max_tokens: useWebSearch ? 4500 : 2500,
      ...(useWebSearch
        ? { tools: [{ type: "web_search_20250305" as const, name: "web_search", max_uses: 3 }] }
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

// ── Koerslijst-waardebepaling (afschrijvingsmodel op de RDW-catalogusprijs) ──
// Aandeel van de nieuwprijs (incl. BTW/BPM) dat een occasion gemiddeld nog waard is per
// leeftijd in jaren — benadering van de Nederlandse afschrijvingscurve.
function retentieFactor(leeftijdJaren: number): number {
  // Aandeel van de nieuwprijs per leeftijd, incl. de directe nieuw→occasion afschrijving
  // (index 0 ≈ dit jaar gekentekend). Afgestemd op de huidige, relatief hoge NL-occasionmarkt.
  const curve = [0.85, 0.78, 0.70, 0.63, 0.57, 0.51, 0.46, 0.42, 0.38, 0.34, 0.30, 0.27, 0.24, 0.21, 0.18, 0.15];
  if (!Number.isFinite(leeftijdJaren) || leeftijdJaren <= 0) return curve[0];
  if (leeftijdJaren >= 15) return curve[15];
  const i = Math.floor(leeftijdJaren);
  const frac = leeftijdJaren - i;
  return curve[i] + (curve[i + 1] - curve[i]) * frac;
}

// Correctie voor kilometerstand t.o.v. het verwachte aantal (~14.000 km/jaar in NL).
function kmFactor(km: number, leeftijdJaren: number): number {
  if (!km || km <= 0) return 1.0;
  const verwacht = Math.max(leeftijdJaren, 0.5) * 14000;
  const afwijking = km - verwacht; // positief = bovengemiddeld → lagere waarde
  const pct = -(afwijking / 30000) * 0.06; // ~6% per 30.000 km afwijking
  return Math.max(0.75, Math.min(1.25, 1 + pct));
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY niet ingesteld" }, { status: 500 });

  const body = await req.json();
  const { merk, model, bouwjaar, km, brandstof, vermogen, bodytype } = body;
  const huidigJaar = new Date().getFullYear();
  const bouwjaarNum = Number(bouwjaar);
  const catalogus = Number(body.catalogusprijs) || 0;
  const kostenNum = Number(body.geschatte_kosten) || 0;
  const margeNum = Number.isFinite(Number(body.gewenste_marge))
    ? Math.min(90, Math.max(0, Number(body.gewenste_marge)))
    : 10;

  if (!merk || !model || !Number.isInteger(bouwjaarNum) || bouwjaarNum < 1950 || bouwjaarNum > huidigJaar + 1) {
    return Response.json({ error: "Merk, model en een geldig bouwjaar zijn verplicht" }, { status: 400 });
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
  "gemiddelde_prijs": 0,
  "min_prijs": 0,
  "max_prijs": 0,
  "aantal_gevonden": 0,
  "vergelijkbare": [
    { "titel": "", "bouwjaar": 0, "km": 0, "prijs": 0, "platform": "" }
  ],
  "advies": "Korte conclusie van maximaal 2 zinnen."
}

Regels:
- Vul de prijzen met gehele getallen, zonder punten of komma's. Laat ze op 0 als je niets vond.
- aantal_gevonden: het aantal ECHTE advertenties dat je hebt gebruikt. Niet schatten.
- vergelijkbare: die advertenties zelf (maximaal 8), elk met titel, bouwjaar, km, prijs en platform.
  Alleen advertenties die je daadwerkelijk in de zoekresultaten hebt gezien. Verzin er nooit één.
- Vond je niets bruikbaars? Zet dan alle prijzen op 0 en vergelijkbare op een lege lijst. Dat is een
  eerlijk antwoord; een verzonnen gemiddelde is dat niet.
- advies: maximaal 2 zinnen in het Nederlands, over wat je opviel aan het aanbod.

Wat je NIET moet invullen: hoeveel van deze auto's er landelijk te koop staan, of de prijstrend, of
hoe gewild het model is. Dat kun je met een handvol zoekopdrachten niet weten, en een getal dat er
gezaghebbend uitziet maar een gok is, is schadelijker dan geen getal.`;

  const client = new Anthropic({ apiKey });

  // Eenvoudige, betrouwbare terugval-prompt (modelkennis) voor als het live zoeken te traag is.
  const fallbackPrompt = `Je bent een Nederlandse auto-taxateur. Schat de marktwaarde van een ${merk} ${model}, bouwjaar ${bouwjaar}${kmTxt}${specsTxt}${bodyTxt} op de Nederlandse occasionmarkt, op basis van je eigen kennis (niet live zoeken).
Geef UITSLUITEND dit JSON-object met realistische gehele getallen:
{"gemiddelde_prijs": 0, "min_prijs": 0, "max_prijs": 0, "aantal_gevonden": 0, "vergelijkbare": [], "advies": "Schatting op basis van kennis; geen live advertenties opgehaald."}`;

  // Live zoeken met een harde grens, want Vercel kapt de functie op 60s af. De terugval
  // krijgt zijn eigen budget: die stond hiervoor zonder grens ná 48 seconden te beginnen,
  // en liep dus regelmatig tegen een time-out zonder antwoord.
  const gestart = Date.now();
  const controller = new AbortController();
  const webSearch = vraagMarkt(client, prompt, true, controller.signal).catch(() => "");
  const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(""), 40_000));
  let tekst = await Promise.race([webSearch, timeout]);
  controller.abort();

  // Kwam er niets bruikbaars uit het live zoeken, dan een schatting uit modelkennis. Die
  // wordt hieronder NIET als marktdata gepresenteerd — dat was de kern van het probleem:
  // een herinnering die als onderzoek op het scherm kwam.
  const live = !!extractLaatsteJson(tekst);
  if (!live) {
    const rest = Math.max(6_000, 52_000 - (Date.now() - gestart));
    const terugval = vraagMarkt(client, fallbackPrompt, false).catch(() => "");
    tekst = await Promise.race([
      terugval,
      new Promise<string>((resolve) => setTimeout(() => resolve(""), rest)),
    ]);
  }

  const jsonText = extractLaatsteJson(tekst);
  if (!jsonText) {
    return Response.json({ error: "Kon marktdata niet ophalen", raw: tekst.slice(0, 300) }, { status: 422 });
  }

  // Web search voegt citatie-markup toe (<cite index="...">...</cite>); die strippen we eruit.
  const schoon = jsonText.replace(/<cite[^>]*>/gi, "").replace(/<\/cite>/gi, "");
  let markt: Record<string, unknown>;
  try {
    markt = JSON.parse(schoon);
  } catch {
    return Response.json({ error: "Ongeldige marktdata", raw: schoon.slice(0, 300) }, { status: 422 });
  }

  const margeDecimaal = margeNum / 100;
  const leeftijd = Math.max(0, huidigJaar - bouwjaarNum);
  const kmNum = parseInt(String(km)) || 0;

  // ── 1) Koerslijst uit de RDW-nieuwprijs (afschrijving + km-correctie) ──
  const koerslijstWaarde = catalogus > 0
    ? Math.round(catalogus * retentieFactor(leeftijd) * kmFactor(kmNum, leeftijd))
    : 0;

  // ── 2) Marktwaarde uit de gevonden advertenties ──
  //
  // Tellen wat er écht in de lijst staat, niet wat het model zegt dat het gevonden heeft.
  // Dat waren twee verschillende getallen, en juist het zelfgerapporteerde getal bepaalde
  // hoe zwaar de marktwaarde meewoog. Een advertentie telt alleen mee als er een prijs bij
  // staat die ergens op slaat.
  const ruweVergelijkbare = Array.isArray(markt.vergelijkbare) ? markt.vergelijkbare : [];
  const vergelijkbare = (ruweVergelijkbare as Record<string, unknown>[]).filter((v) => {
    const prijs = Number(v?.prijs) || 0;
    return prijs >= 200 && prijs <= 500_000;
  });
  const echtGevonden = live ? vergelijkbare.length : 0;

  const marktGemiddeld = Number(markt.gemiddelde_prijs) || 0;
  // Vraagprijzen liggen boven de verkoopprijs. De 4% hieronder is een aanname en geen
  // meting; zie het plan in het archief — die hoort op JG's eigen verkoopcijfers geijkt
  // te worden zodra daar genoeg van zijn.
  let marktVerkoop = marktGemiddeld > 0 && echtGevonden > 0 ? Math.round(marktGemiddeld * 0.96) : 0;

  // Een marktwaarde die mijlenver van de koerslijst ligt is vrijwel altijd een verkeerde
  // auto (ander model, ander bouwjaar) in plaats van een bijzondere prijs. Die gooien we
  // weg in plaats van hem 85% van het gewicht te geven.
  let marktAfgekeurd = "";
  if (marktVerkoop > 0 && koerslijstWaarde > 0) {
    const verhouding = marktVerkoop / koerslijstWaarde;
    if (verhouding < 0.4 || verhouding > 2.0) {
      marktAfgekeurd = `De gevonden advertenties leverden € ${marktVerkoop.toLocaleString("nl-NL")} op, ${
        verhouding > 1 ? "ruim boven" : "ver onder"
      } wat deze auto op basis van de nieuwprijs waard hoort te zijn. Waarschijnlijk zijn het andere uitvoeringen. Niet meegerekend.`;
      marktVerkoop = 0;
    }
  }

  // ── 3) Wegen ──
  let wMarkt = 0, wKoers = 0;
  if (marktVerkoop > 0 && koerslijstWaarde > 0) {
    if (echtGevonden >= 5) { wMarkt = 0.85; wKoers = 0.15; }
    else if (echtGevonden >= 3) { wMarkt = 0.72; wKoers = 0.28; }
    else { wMarkt = 0.55; wKoers = 0.45; }
  } else if (marktVerkoop > 0) { wMarkt = 1; }
  else if (koerslijstWaarde > 0) { wKoers = 1; }

  const verwachteVerkoop =
    Math.round(marktVerkoop * wMarkt + koerslijstWaarde * wKoers) || marktVerkoop || koerslijstWaarde || 0;

  if (verwachteVerkoop <= 0) {
    return Response.json(
      {
        error:
          "Geen bruikbare waarde te bepalen. Er zijn geen vergelijkbare advertenties gevonden en de RDW-nieuwprijs ontbreekt (die is er meestal niet voor auto's van vóór 2005). Vul de verkoopwaarde handmatig in.",
      },
      { status: 422 }
    );
  }

  // De bron benoemt nu wat er écht gebeurd is. Hiervoor stond er altijd "koerslijst + live
  // markt", ook als het live zoeken niets had opgeleverd en het antwoord uit modelkennis kwam.
  const bron = !live
    ? "schatting uit modelkennis (geen live advertenties)"
    : koerslijstWaarde > 0 && marktVerkoop > 0
      ? `koerslijst + ${echtGevonden} gevonden advertenties`
      : marktVerkoop > 0
        ? `${echtGevonden} gevonden advertenties`
        : "koerslijst (RDW-nieuwprijs)";

  // ── 4) Van verkoopwaarde naar wat je maximaal kunt bieden ──
  //
  // Hier zat de grootste rekenfout: de BTW werd nooit afgetrokken.
  //
  // Marge-auto (wat je van een particulier koopt is dit altijd): je betaalt en verkoopt
  // inclusief, en draagt 21/121 van je brutomarge af. Wil je netto M% overhouden, dan moet
  // je brutomarge 1,21 × (M% + kosten) zijn.
  //
  // BTW-auto (van een bedrijf, met btw-factuur): de verkoopprijs is inclusief btw, dus die
  // gaat er eerst af. Alles daarna gebeurt netto.
  const btwType = String(body.btw_type ?? "marge") === "btw" ? "btw" : "marge";

  let maxInkoop: number;
  let nettoVerkoop: number;
  if (btwType === "btw") {
    nettoVerkoop = Math.round(verwachteVerkoop / 1.21);
    maxInkoop = Math.max(0, Math.round(nettoVerkoop * (1 - margeDecimaal) - kostenNum));
  } else {
    nettoVerkoop = verwachteVerkoop;
    maxInkoop = Math.max(
      0,
      Math.round(verwachteVerkoop - 1.21 * (margeDecimaal * verwachteVerkoop + kostenNum))
    );
  }

  // Wat er daadwerkelijk aan overblijft, ná btw en kosten. Bij marge is dat iets anders dan
  // "verkoop min inkoop min kosten" — die afdracht moet er nog vanaf.
  const brutoMarge = verwachteVerkoop - maxInkoop;
  const btwAfdracht = btwType === "btw"
    ? verwachteVerkoop - nettoVerkoop
    : Math.round((brutoMarge * 21) / 121);
  const nettoMarge = Math.round(brutoMarge - btwAfdracht - kostenNum);
  const margePercentage = verwachteVerkoop > 0 ? Math.round((nettoMarge / verwachteVerkoop) * 100) : 0;

  return Response.json({
    // Alleen de velden die ergens op gebaseerd zijn. Wat het model niet kan weten
    // (landelijk aanbod, prijstrend, hoe gewild het model is) staat er niet meer in —
    // en dus ook niet meer op het scherm.
    markt: {
      gemiddelde_prijs: marktGemiddeld,
      min_prijs: Number(markt.min_prijs) || 0,
      max_prijs: Number(markt.max_prijs) || 0,
      aantal_gevonden: echtGevonden,
      vergelijkbare,
      advies: String(markt.advies ?? ""),
    },
    berekening: {
      max_inkoop: maxInkoop,
      verwachte_verkoop: verwachteVerkoop,
      netto_verkoop: nettoVerkoop,
      btw_type: btwType,
      btw_afdracht: btwAfdracht,
      netto_marge: nettoMarge,
      marge_percentage: margePercentage,
      geschatte_kosten: kostenNum,
      gewenste_marge: margeNum,
      catalogusprijs: catalogus,
      koerslijst_waarde: koerslijstWaarde,
      markt_waarde: marktVerkoop,
      bron,
      /** Kwamen de cijfers uit echt gezochte advertenties, of uit modelkennis? Dit is het
       *  verschil tussen onderzoek en een herinnering, en dat hoort op het scherm. */
      live,
      ...(marktAfgekeurd ? { markt_afgekeurd: marktAfgekeurd } : {}),
    },
  });
}

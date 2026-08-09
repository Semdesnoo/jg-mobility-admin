import {
  haalVergelijkbaar,
  fitWaarde,
  zonderUitschieters,
  uitvoeringWoorden,
  type Vergelijkbare,
} from "@/lib/taxatie-vergelijk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * De waardebepaling.
 *
 * Twee bronnen, die elkaar controleren:
 *  1. de koerslijst — de RDW-nieuwprijs met afschrijving en een kilometercorrectie;
 *  2. echte advertenties van vergelijkbare auto's, opgehaald bij AutoScout24.
 *
 * De tweede weegt het zwaarst zodra er genoeg auto's zijn gevonden, want dat is wat de
 * markt vandaag vraagt. De koerslijst vangt het volledig op bij zeldzame auto's, precies
 * waar advertenties middelen faalt.
 *
 * Er komt geen AI aan te pas bij het bepalen van de waarde. Dat was hiervoor wel zo, en
 * het probleem was niet dat het model slecht rekende — het probleem was dat niets van wat
 * het meldde te controleren viel. Zie lib/taxatie-vergelijk.ts.
 */

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
  const { merk, model, bouwjaar, km, brandstof, bodytype } = body;
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

  // ── Vergelijkbare auto's ophalen ──
  //
  // Hier stond een AI die met web_search "wat advertenties" ging zoeken. Wat daaruit kwam
  // was niet te controleren: het aantal en het gemiddelde waren zelfgerapporteerd, en als
  // het zoeken niets opleverde kwam er een schatting uit modelkennis die als marktonderzoek
  // op het scherm belandde.
  //
  // Nu halen we de zoekpagina van AutoScout24 zelf op en lezen we de advertenties uit. Dat
  // duurt een seconde, kost niets, en levert getelde auto's op. Zie lib/taxatie-vergelijk.ts.
  const uitvoering = String(body.uitvoering ?? "").trim().toLowerCase();
  const stappen = [
    { jaarMarge: 1, kmMarge: 25000, tekst: "bouwjaar ±1 jaar, kilometerstand ±25.000" },
    { jaarMarge: 2, kmMarge: 40000, tekst: "bouwjaar ±2 jaar, kilometerstand ±40.000" },
    { jaarMarge: 3, kmMarge: 60000, tekst: "bouwjaar ±3 jaar, kilometerstand ±60.000" },
  ];

  const kmVoorZoeken = parseInt(String(km)) || 0;
  let alle: Vergelijkbare[] = [];
  let zoekbereik = stappen[0].tekst;
  for (const stap of stappen) {
    zoekbereik = stap.tekst;
    alle = await haalVergelijkbaar(
      {
        merk, model, bouwjaar: bouwjaarNum, km: kmVoorZoeken,
        brandstof: String(brandstof ?? ""),
        transmissie: String(body.transmissie ?? ""),
        bodytype: String(bodytype ?? ""),
        ...stap,
      },
      2
    ).catch(() => []);
    if (alle.length >= 8) break;
  }

  // Welke uitvoeringen zitten er in dit aanbod? Daarmee kan het scherm een keuzelijst tonen
  // die bij déze auto past, in plaats van een algemene lijst.
  const telling = new Map<string, number>();
  for (const r of alle) {
    for (const u of uitvoeringWoorden(r.uitvoering)) telling.set(u, (telling.get(u) ?? 0) + 1);
  }
  const uitvoeringen = [...telling.entries()]
    .filter(([, n]) => n >= 2)
    .sort((x, y) => y[1] - x[1])
    .map(([naam, aantal]) => ({ naam, aantal }));

  // Op uitvoering filteren als die is opgegeven — maar alleen als er genoeg overblijft.
  // Een scherpe schatting op drie auto's is geen scherpe schatting.
  let gebruikt = alle;
  let opUitvoering = false;
  if (uitvoering) {
    const smal = alle.filter((r) => r.uitvoering.toLowerCase().includes(uitvoering));
    if (smal.length >= 4) { gebruikt = smal; opUitvoering = true; }
  }

  const schoon = zonderUitschieters(gebruikt);
  const nu = new Date();
  const leeftijdMnd = Math.max(0, (nu.getFullYear() - bouwjaarNum) * 12 + nu.getMonth() + 1 - 6);
  const fit = fitWaarde(schoon, kmVoorZoeken, leeftijdMnd);
  const live = !!fit;

  const margeDecimaal = margeNum / 100;
  const leeftijd = Math.max(0, huidigJaar - bouwjaarNum);
  const kmNum = parseInt(String(km)) || 0;

  // ── 1) Koerslijst uit de RDW-nieuwprijs (afschrijving + km-correctie) ──
  const koerslijstWaarde = catalogus > 0
    ? Math.round(catalogus * retentieFactor(leeftijd) * kmFactor(kmNum, leeftijd))
    : 0;

  // ── 2) Marktwaarde uit de gevonden advertenties ──
  //
  // De waarde komt uit een lijn door de gevonden auto's, niet uit een gemiddelde. Een
  // gemiddelde husselt de auto's met veel kilometers en die met weinig door elkaar; met
  // een lijn reken je dat verschil uit én kun je het uitleggen ("zoveel per 1.000 km").
  const echtGevonden = schoon.length;
  const marktGemiddeld = fit?.gemPrijs ?? 0;

  // Vraagprijzen liggen boven de verkoopprijs. De 4% hieronder is een aanname en geen
  // meting; die hoort geijkt te worden op JG's eigen verkoopcijfers zodra daar genoeg
  // van zijn — hij heeft vraagprijs én verkoopprijs per kenteken in de database staan.
  let marktVerkoop = fit ? Math.round(fit.waarde * 0.96) : 0;

  // Een marktwaarde die mijlenver van de koerslijst ligt is vrijwel altijd een verkeerde
  // auto (ander model, ander bouwjaar) in plaats van een bijzondere prijs.
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
      min_prijs: schoon.length ? Math.min(...schoon.map((r) => r.prijs)) : 0,
      max_prijs: schoon.length ? Math.max(...schoon.map((r) => r.prijs)) : 0,
      aantal_gevonden: echtGevonden,
      vergelijkbare: schoon
        .slice()
        .sort((x, y) => x.prijs - y.prijs)
        .map((r) => ({
          titel: r.uitvoering.slice(0, 70),
          bouwjaar: r.bouwjaar,
          km: r.km,
          prijs: r.prijs,
          platform: "AutoScout24",
          url: r.url,
        })),
      advies: fit
        ? `${echtGevonden} vergelijkbare auto's gevonden${opUitvoering ? ` met uitvoering ${uitvoering}` : ""}. In dit aanbod scheelt elke 1.000 km ongeveer € ${Math.abs(fit.perDuizendKm)}.`
        : "Geen vergelijkbare auto's gevonden; de waarde komt uit de nieuwprijs.",
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
      // Voor de uitleg aan de klant: dit zijn de cijfers waar het verhaal op rust.
      zoekbereik,
      op_uitvoering: opUitvoering,
      uitvoering: opUitvoering ? uitvoering : "",
      uitvoeringen,
      ...(fit
        ? {
            gem_km: fit.gemKm,
            gem_prijs: fit.gemPrijs,
            per_duizend_km: fit.perDuizendKm,
            spreiding: fit.spreiding,
          }
        : {}),
      ...(marktAfgekeurd ? { markt_afgekeurd: marktAfgekeurd } : {}),
    },
  });
}

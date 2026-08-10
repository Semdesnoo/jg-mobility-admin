/**
 * Vergelijkbare auto's ophalen en er een waarde uit rekenen.
 *
 * WAAROM DIT BESTAAT
 * De taxatie vroeg een AI om "zoek eens wat vergelijkbare advertenties". Wat daaruit
 * kwam was niet te controleren: het aantal was zelfgerapporteerd, de gemiddelde prijs
 * ook, en als het zoeken niets opleverde kwam er een schatting uit modelkennis die als
 * marktonderzoek op het scherm belandde.
 *
 * Hier gebeurt geen schatting. We halen de zoekpagina van AutoScout24 op met de filters
 * die er echt in zitten (bouwjaar, kilometers, brandstof, transmissie, carrosserie), en
 * lezen per advertentie de prijs, de kilometerstand, de datum eerste toelating en de
 * uitvoeringstekst uit. Dat zijn getelde, controleerbare auto's.
 *
 * WAT DIT NIET KAN
 * Vraagprijzen zijn geen verkoopprijzen. En het RDW kent geen commerciële uitvoering:
 * een kenteken vertelt je niet of het een Comfortline of een Highline is, terwijl dat
 * op een Golf van dertienduizend euro zo'n tweeduizend euro scheelt. Daarom hoort er
 * een uitvoering ingevuld te worden door wie de auto voor zich heeft — die weet het.
 */

export type Vergelijkbare = {
  /** Van welke site deze advertentie komt. */
  bron: "AutoScout24" | "Marktplaats";
  prijs: number;
  km: number;
  /** Maanden sinds eerste toelating. */
  leeftijdMnd: number;
  bouwjaar: number;
  uitvoering: string;
  transmissie: string;
  brandstof: string;
  /** Nieuwprijs, als AutoScout24 die meegeeft. Staat er maar bij een deel bij. */
  nieuwprijs: number;
  handelaar: boolean;
  plaats: string;
  url: string;
};

const BROWSER = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "accept-language": "nl-NL,nl;q=0.9",
};

/** Merk- en modelnaam naar het stukje url dat AutoScout24 gebruikt. */
function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Brandstof zoals AutoScout24 hem in de url wil. */
const BRANDSTOF: Record<string, string> = {
  benzine: "B",
  diesel: "D",
  elektrisch: "E",
  elektriciteit: "E",
  hybride: "2",
  lpg: "L",
  cng: "C",
  waterstof: "H",
};

/** Carrosserie zoals AutoScout24 hem in de url wil. */
const CARROSSERIE: Record<string, string> = {
  hatchback: "1",
  stationwagen: "5",
  stationwagon: "5",
  sedan: "6",
  suv: "4",
  cabrio: "2",
  cabriolet: "2",
  coupe: "3",
  mpv: "12",
};

export type Zoekvraag = {
  merk: string;
  model: string;
  bouwjaar: number;
  km: number;
  brandstof?: string;
  transmissie?: string;
  bodytype?: string;
  /** Hoe ver het bouwjaar mag afwijken. */
  jaarMarge?: number;
  /** Hoe ver de kilometerstand mag afwijken. */
  kmMarge?: number;
};

/**
 * Haalt vergelijkbare advertenties op bij AutoScout24.
 *
 * De zoekpagina onder /lst/ is voor gewone bezoekers toegestaan; we halen er hooguit een
 * paar pagina's per taxatie op en bewaren niets van wat we niet gebruiken.
 */
/** Welke modelschrijfwijze op AutoScout24 echt bestaat. Scheelt mislukte pogingen. */
const as24Modellen = new Map<string, string | null>();

/**
 * Van "Tiguan 1.5 TSI R-Line" naar iets waar AutoScout24 een pagina voor heeft.
 *
 * Het modelveld in de voorraad bevat vaak de hele uitvoering, en soms nog een keer het
 * merk ("Fiat FIAT 500"). De zoek-URL is /lst/{merk}/{model}, en zo'n naam geeft dan een
 * 404 die nergens zichtbaar wordt: je krijgt gewoon nul vergelijkbare auto's, precies
 * alsof het model zeldzaam is. Gemeten op de eigen voorraad gebeurde dat bij 7 van de 13
 * merk/model-combinaties — meer dan de helft van de auto's kreeg dus helemaal geen
 * marktvergelijking, zonder dat iemand dat kon zien.
 *
 * Van lang naar kort proberen, want de volledige naam is specifieker als hij bestaat:
 * "Golf GTE" is een echte pagina en een betere vergelijking dan "Golf".
 */
function modelVarianten(merk: string, model: string): string[] {
  let woorden = model.trim().split(/\s+/).filter(Boolean);
  if (woorden.length > 1 && slug(woorden[0]) === slug(merk)) woorden = woorden.slice(1);

  const uit: string[] = [];
  for (let n = woorden.length; n >= 1; n--) {
    const s = slug(woorden.slice(0, n).join(" "));
    if (s && !uit.includes(s)) uit.push(s);
  }

  // BMW kent geen "216i" of "330e" als model — daar heet het de serie waar zo'n type in
  // valt: 2er en 3er. Het typenummer begint met het seriecijfer, dus dat is af te leiden.
  // Zonder deze regel blijven juist de BMW's zonder marktvergelijking zitten.
  if (slug(merk) === "bmw") {
    // Let op de letter die er vaak achter plakt: 216i, 330e, 520d. Een woordgrens eisen
    // na het derde cijfer laat juist die typen vallen.
    const cijfer = woorden.join(" ").match(/\b([1-8])\d{2}[a-z]?\b/i);
    if (cijfer) uit.push(`${cijfer[1]}er`);
  }
  return uit;
}

export async function haalVergelijkbaar(
  v: Zoekvraag,
  maxPaginas = 2
): Promise<Vergelijkbare[]> {
  const jaarMarge = v.jaarMarge ?? 1;
  const kmMarge = v.kmMarge ?? 25000;

  const p = new URLSearchParams({
    atype: "C",
    cy: "NL",
    fregfrom: String(v.bouwjaar - jaarMarge),
    fregto: String(v.bouwjaar + jaarMarge),
  });
  if (v.km > 0) {
    p.set("kmfrom", String(Math.max(0, v.km - kmMarge)));
    p.set("kmto", String(v.km + kmMarge));
  }
  const brandstofCode = BRANDSTOF[(v.brandstof ?? "").toLowerCase()];
  if (brandstofCode) p.set("fuel", brandstofCode);
  const bodyCode = CARROSSERIE[(v.bodytype ?? "").toLowerCase()];
  if (bodyCode) p.set("body", bodyCode);
  if (v.transmissie) {
    const t = v.transmissie.toLowerCase();
    if (t.startsWith("hand")) p.set("gear", "M");
    else if (t.startsWith("auto") || t.includes("semi")) p.set("gear", "A");
  }

  const uit: Vergelijkbare[] = [];
  const gezien = new Set<string>();

  // Welke schrijfwijze van het model heeft AutoScout24 echt? De eerste die auto's oplevert.
  const sleutel = `${slug(v.merk)}|${slug(v.model)}`;
  const onthouden = as24Modellen.get(sleutel);
  const teProberen =
    onthouden === undefined ? modelVarianten(v.merk, v.model) : onthouden ? [onthouden] : [];

  for (const modelSlug of teProberen) {
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    p.set("page", String(pagina));
    const url = `https://www.autoscout24.nl/lst/${slug(v.merk)}/${modelSlug}?${p}`;

    let html = "";
    try {
      const res = await fetch(url, { headers: BROWSER, signal: AbortSignal.timeout(12000) });
      if (!res.ok) break;
      html = (await res.text()).replace(/\\u002F/g, "/");
    } catch {
      break;
    }

    const begin = html.indexOf('"listings":[');
    if (begin < 0) break;
    const stukken = html.slice(begin).split('{"id":"').slice(1);
    if (stukken.length === 0) break;

    for (const stuk of stukken) {
      const blok = stuk.slice(0, 30000);
      const pak = (re: RegExp) => blok.match(re)?.[1] ?? "";

      const prijs = Number(pak(/"priceRaw":(\d+)/)) || 0;
      const pad = pak(/"url":"(\/aanbod\/[^"]+)"/);
      if (prijs < 200 || !pad || gezien.has(pad)) continue;
      gezien.add(pad);

      // "03-2017" → maand en jaar. Hiermee wordt leeftijd een aantal maanden in plaats
      // van een heel jaar; dat scheelt tot zeven procent bij auto's rond de jaargrens.
      const det = pak(/"firstRegistration":"(\d{2}-\d{4})"/);
      const [maand, jaar] = det ? det.split("-").map(Number) : [0, 0];
      if (!jaar) continue;
      const nu = new Date();
      const leeftijdMnd = (nu.getFullYear() - jaar) * 12 + (nu.getMonth() + 1 - maand);

      uit.push({
        bron: "AutoScout24",
        prijs,
        km: Number(pak(/"mileage":"?(\d+)/)) || 0,
        leeftijdMnd: Math.max(0, leeftijdMnd),
        bouwjaar: jaar,
        uitvoering: pak(/"modelVersionInput":"([^"]*)"/),
        transmissie: pak(/"transmission":"([^"]*)"/),
        brandstof: pak(/"fuel":"([^"]*)"/),
        // "€ 24.567" → 24567. Staat er maar bij een deel van de advertenties bij.
        nieuwprijs: Number(pak(/"suggestedRetailPrice":"[^0-9]*([\d.]+)"/).replace(/\./g, "")) || 0,
        handelaar: blok.includes('"type":"Dealer"'),
        plaats: pak(/"location":\{[^}]*"city":"([^"]*)"/).trim(),
        url: `https://www.autoscout24.nl${pad}`,
      });
    }

    // Minder dan een volle pagina betekent dat we aan het eind zijn.
    if (stukken.length < 15) break;
  }

    // Deze schrijfwijze leverde auto's op — dan hoeven de kortere niet meer, en de
    // volgende taxatie van dezelfde auto begint meteen goed.
    if (uit.length > 0) {
      as24Modellen.set(sleutel, modelSlug);
      break;
    }
  }
  // Geen enkele variant werkte. Onthouden, zodat we niet elke keer opnieuw alle
  // schrijfwijzen aflopen voor een model dat AutoScout24 simpelweg niet kent.
  if (uit.length === 0) as24Modellen.set(sleutel, null);

  return uit;
}

/**
 * Vergelijkbare advertenties bij Marktplaats.
 *
 * Waarom een tweede bron: AutoScout24 is dealer-zwaar. Marktplaats staat vol met
 * particulieren, en die vragen aantoonbaar minder — gemeten scheelde dat bijna acht
 * procent op dezelfde kilometerstand. Reken je alleen met dealerprijzen, dan schat je
 * de markt te hoog in en bied je te veel.
 *
 * Marktplaats kent geen bruikbare filters in de url, dus we halen het merk-en-model
 * overzicht op en filteren hier op bouwjaar, kilometerstand, brandstof en transmissie.
 * Die staan allemaal per advertentie in de pagina.
 *
 * Belangrijk: alleen advertenties met een vaste vraagprijs tellen mee. Een kwart van het
 * aanbod is "bieden vanaf", en dat is geen vraagprijs — die meerekenen drukt je
 * marktbeeld kunstmatig omlaag.
 */
export async function haalVergelijkbaarMarktplaats(
  v: Zoekvraag,
  maxPaginas = 6
): Promise<Vergelijkbare[]> {
  const jaarMarge = v.jaarMarge ?? 1;
  const kmMarge = v.kmMarge ?? 25000;

  // De modelpagina levert per pagina veel meer bruikbare treffers op dan een vrije
  // zoekopdracht: gemeten 9 passende auto's tegen 6, en alle 9 van particulieren.
  // Lukt het opzoeken niet, dan valt hij terug op zoeken op tekst.
  const modelPad = await vindModelPad(v.merk, v.model);
  const basis = modelPad ?? `/q/${encodeURIComponent(`${v.merk} ${v.model}`.trim()).replace(/%20/g, "+")}/`;

  const uit: Vergelijkbare[] = [];
  const gezien = new Set<string>();
  const nu = new Date();

  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    let html = "";
    try {
      const url = `https://www.marktplaats.nl${basis}${pagina > 1 ? `p/${pagina}/` : ""}`;
      const res = await fetch(url, { headers: BROWSER, signal: AbortSignal.timeout(12000) });
      if (!res.ok) break;
      html = await res.text();
    } catch {
      break;
    }

    const stukken = html.split('"itemId":"').slice(1);
    if (stukken.length === 0) break;
    let nieuwOpPagina = 0;

    for (const stuk of stukken) {
      const itemId = stuk.slice(0, stuk.indexOf('"'));
      if (!/^[am][0-9]+$/.test(itemId) || gezien.has(itemId)) continue;
      gezien.add(itemId);
      nieuwOpPagina++;

      const blok = stuk.slice(0, 9000);
      const attr = (sleutel: string) =>
        blok.match(new RegExp(`"key":"${sleutel}","value":"([^"]*)"`))?.[1] ?? "";

      // Alleen een vaste vraagprijs. "Bieden vanaf" is geen prijs.
      if (!/"priceType":"FIXED"/.test(blok)) continue;
      const prijs = Math.round((Number(blok.match(/"priceCents":([0-9]+)/)?.[1]) || 0) / 100);
      if (prijs < 200) continue;

      const jaar = Number(attr("constructionYear")) || 0;
      const km = Number(attr("mileage")) || 0;
      if (!jaar || !km) continue;

      // Marktplaats filtert niet in de url, dus hier.
      if (Math.abs(jaar - v.bouwjaar) > jaarMarge) continue;
      if (v.km > 0 && Math.abs(km - v.km) > kmMarge) continue;

      const brandstof = attr("fuel");
      if (v.brandstof && brandstof && !brandstof.toLowerCase().startsWith(v.brandstof.slice(0, 4).toLowerCase()))
        continue;

      const bak = attr("transmission");
      if (v.transmissie && bak) {
        const wil = v.transmissie.toLowerCase().startsWith("hand");
        const is = bak.toLowerCase().startsWith("hand");
        if (wil !== is) continue;
      }

      // De url staat elders in de pagina en bevat het itemId.
      const url = html.match(new RegExp(`/v/auto-s/[a-z0-9-]+/${itemId}-[a-z0-9-]*`, "i"))?.[0] ?? "";

      uit.push({
        bron: "Marktplaats",
        prijs,
        km,
        leeftijdMnd: Math.max(0, (nu.getFullYear() - jaar) * 12 + nu.getMonth() + 1 - 6),
        bouwjaar: jaar,
        uitvoering: ontsnapMp(blok.match(/"title":"([^"]*)"/)?.[1] ?? ""),
        transmissie: bak,
        brandstof,
        nieuwprijs: 0,
        handelaar: /"showWebsiteUrl":true/.test(blok),
        plaats: ontsnapMp(blok.match(/"cityName":"([^"]*)"/)?.[1] ?? ""),
        url: url ? `https://www.marktplaats.nl${url}` : "",
      });
    }

    if (nieuwOpPagina === 0) break;
  }

  return uit;
}

/**
 * Zoekt het pad naar de modelpagina op Marktplaats op.
 *
 * Marktplaats gebruikt eigen nummers voor modellen ("/f/golf/1260/"), en die staan
 * nergens gedocumenteerd. Ze staan wél in de filterlijst op de merkpagina, dus die halen
 * we één keer op en onthouden we. Nummers veranderen zelden, maar hardcoderen zou
 * betekenen dat een nieuw model stilletjes niets oplevert.
 */
const modelPaden = new Map<string, string | null>();

/** Tekens die in een modelnaam kunnen zitten en in een zoekpatroon iets anders betekenen. */
function ontsnapRegex(s: string): string {
  return s.replace(/[-.*+?^${}()|[\]\\]/g, "\\$&");
}

async function vindModelPad(merk: string, model: string): Promise<string | null> {
  const sleutel = `${merk}|${model}`.toLowerCase();
  const bekend = modelPaden.get(sleutel);
  if (bekend !== undefined) return bekend;

  let pad: string | null = null;
  try {
    const res = await fetch(`https://www.marktplaats.nl/l/auto-s/${slug(merk)}/`, {
      headers: BROWSER,
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const html = (await res.text()).replace(/\u002F/g, "/");
      // De filterlijst koppelt een modelnaam aan zijn pad. Eerst exact zoeken, dan op
      // het eerste woord — "Golf Plus" en "Golf" zijn verschillende modellen, maar een
      // model dat als "3-serie" in het RDW staat heet daar "3 Serie".
      const namen = [model, model.split(/[ -]/)[0]].filter(Boolean);
      for (const naam of namen) {
        const re = new RegExp(
          `for="model-${ontsnapRegex(naam)}"[^>]*>\s*<a[^>]*href="(/l/auto-s/[^"]+/f/[^"]+/[0-9]+/)"`,
          "i"
        );
        const m = html.match(re);
        if (m) { pad = m[1]; break; }
      }
    }
  } catch {
    /* niet gevonden; dan zoeken we op tekst */
  }

  modelPaden.set(sleutel, pad);
  return pad;
}

/** JSON-ontsnapping in de ruwe Marktplaats-pagina ongedaan maken. */
function ontsnapMp(s: string): string {
  return s
    .replace(/\\u([0-9a-f]{4})/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/\\"/g, '"')
    .trim();
}

/**
 * Dezelfde auto op twee sites is één auto.
 *
 * Dealers zetten hun voorraad op allebei. Zonder ontdubbelen telt zo'n auto dubbel mee en
 * weegt de prijs van juist die dealers twee keer zo zwaar. Zonder kenteken is de
 * combinatie van prijs, kilometerstand en bouwjaar de beste sleutel die we hebben — dat
 * drietal exact gelijk is vrijwel altijd dezelfde auto.
 */
export function ontdubbel(rijen: Vergelijkbare[]): Vergelijkbare[] {
  const gezien = new Set<string>();
  const uit: Vergelijkbare[] = [];
  for (const r of rijen) {
    const sleutel = `${r.prijs}|${Math.round(r.km / 500)}|${r.bouwjaar}`;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push(r);
  }
  return uit;
}

/**
 * Uitvoeringswoorden uit een advertentietitel.
 *
 * Het RDW kent geen commerciële uitvoering — een kenteken vertelt niet of het een
 * Comfortline of een Highline is. De advertentietekst wel, en dat is het enige gratis
 * signaal dat we hebben voor het verschil dat op een Golf van dertienduizend euro zo'n
 * tweeduizend euro uitmaakt.
 */
const UITVOERINGEN = [
  "highline", "comfortline", "trendline", "r-line", "gti", "gtd", "gte", "join", "lounge",
  "business", "executive", "ambition", "style", "elegance", "avantgarde", "amg", "m-sport",
  "s-line", "sport", "premium", "luxury", "exclusive", "titanium", "st-line", "vignale",
  "n-line", "gt-line", "zetec", "active", "allure", "gt", "edition", "connected series",
  "life", "united", "iq.drive", "first edition", "black edition",
];

export function uitvoeringWoorden(tekst: string): string[] {
  const t = (tekst || "").toLowerCase();
  return UITVOERINGEN.filter((u) => t.includes(u));
}

export type Fit = {
  /** De geschatte vraagprijs voor déze auto. */
  waarde: number;
  /** Spreiding rond die schatting — hoe goed de vergelijkbare auto's het verklaren. */
  spreiding: number;
  /** Hoeveel auto's er in de berekening zaten. */
  aantal: number;
  /** Wat een kilometer meer of minder doet, in euro per 1.000 km. */
  perDuizendKm: number;
  /** Wat een maand ouder doet, in euro. */
  perMaand: number;
  /** Gemiddelde kilometerstand en leeftijd van de vergelijkbare auto's. */
  gemKm: number;
  gemLeeftijdMnd: number;
  gemPrijs: number;
};

/**
 * Past een rechte lijn door de gevonden advertenties: prijs verklaard uit kilometerstand
 * en leeftijd, en daarna uitgerekend voor déze auto.
 *
 * Waarom niet gewoon het gemiddelde nemen — wat de tool hiervoor deed? Omdat een
 * gemiddelde de auto's met veel kilometers en die met weinig door elkaar husselt. Zit
 * jouw auto op 140.000 km terwijl het gemiddelde 110.000 is, dan is het gemiddelde
 * simpelweg een andere auto dan die van jou. Met een lijn reken je dat verschil uit in
 * plaats van het weg te middelen, en je kunt het bovendien uitleggen: "zoveel euro per
 * duizend kilometer".
 *
 * Kleinste-kwadraten met twee verklarende variabelen, met de hand uitgeschreven. Geen
 * bibliotheek nodig voor een 3x3-stelsel, en zo is te volgen wat er gebeurt.
 */
export function fitWaarde(rijen: Vergelijkbare[], km: number, leeftijdMnd: number): Fit | null {
  const n = rijen.length;
  if (n < 3) return null;

  const gemPrijs = rijen.reduce((s, r) => s + r.prijs, 0) / n;
  const gemKm = rijen.reduce((s, r) => s + r.km, 0) / n;
  const gemLft = rijen.reduce((s, r) => s + r.leeftijdMnd, 0) / n;

  // Gecentreerd rekenen: dan is de constante gewoon de gemiddelde prijs en blijven de
  // getallen klein genoeg om nauwkeurig te blijven.
  let sxx = 0, syy = 0, sxy = 0, sxp = 0, syp = 0;
  for (const r of rijen) {
    const x = r.km - gemKm;
    const y = r.leeftijdMnd - gemLft;
    const p = r.prijs - gemPrijs;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
    sxp += x * p;
    syp += y * p;
  }

  const noemer = sxx * syy - sxy * sxy;
  let bKm = 0, bLft = 0;
  if (Math.abs(noemer) > 1e-6) {
    bKm = (syy * sxp - sxy * syp) / noemer;
    bLft = (sxx * syp - sxy * sxp) / noemer;
  } else if (sxx > 0) {
    // Leeftijd varieert niet (of te weinig): dan alleen op kilometers.
    bKm = sxp / sxx;
  }

  // Onzin-uitkomsten afvangen: meer kilometers of ouder hoort nooit duurder te maken.
  if (bKm > 0) bKm = 0;
  if (bLft > 0) bLft = 0;

  const voorspel = (r: { km: number; leeftijdMnd: number }) =>
    gemPrijs + bKm * (r.km - gemKm) + bLft * (r.leeftijdMnd - gemLft);

  const restKwadraat = rijen.reduce((s, r) => s + (r.prijs - voorspel(r)) ** 2, 0);
  const vrijheidsgraden = Math.max(1, n - 3);
  const spreiding = Math.sqrt(restKwadraat / vrijheidsgraden);

  return {
    waarde: Math.round(voorspel({ km, leeftijdMnd })),
    spreiding: Math.round(spreiding),
    aantal: n,
    perDuizendKm: Math.round(bKm * 1000),
    perMaand: Math.round(bLft),
    gemKm: Math.round(gemKm),
    gemLeeftijdMnd: Math.round(gemLft),
    gemPrijs: Math.round(gemPrijs),
  };
}

/**
 * Gooit uitschieters eruit voordat er een lijn door gaat.
 *
 * Tussen de gevonden advertenties zit altijd wel een schadeauto, een exportprijs of een
 * dealer die er honderd procent bovenop zet. Eén zo'n advertentie trekt een lijn door
 * dertig auto's merkbaar scheef.
 */
export function zonderUitschieters(rijen: Vergelijkbare[]): Vergelijkbare[] {
  if (rijen.length < 6) return rijen;
  const prijzen = [...rijen].map((r) => r.prijs).sort((a, b) => a - b);
  const q = (f: number) => prijzen[Math.min(prijzen.length - 1, Math.floor(prijzen.length * f))];
  const q1 = q(0.25);
  const q3 = q(0.75);
  const marge = (q3 - q1) * 1.5;
  return rijen.filter((r) => r.prijs >= q1 - marge && r.prijs <= q3 + marge);
}

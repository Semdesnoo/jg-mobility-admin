import sql from "./db";
import { afstandKm, type Criteria } from "./verkopers-criteria";

/**
 * Advertenties rechtstreeks van de bron halen, zonder zoekmachine.
 *
 * WAAROM DIT BESTAAT
 * De radar vroeg eerst aan een zoekmachine om losse advertenties. Dat werkte niet:
 * gemeten leverde dat nul advertenties op voor Marktplaats en AutoScout24. Zoekmachines
 * indexeren van advertentiesites vooral de categoriepagina's — de losse advertenties
 * verversen te snel om er een index op bij te houden.
 *
 * De overzichtspagina's van de sites zélf ophalen levert er wél dertig per merk op, elke
 * keer. Bovendien staat in die pagina's al genoeg om handelaren eruit te filteren vóórdat
 * er ook maar één advertentie wordt geopend, en dat openen is de duurste stap.
 *
 * Er komt in dit hele bestand geen AI aan te pas. Dat is het punt: een lijst afgaan is
 * geen denkwerk. Het is sneller, het kost niets, en een programma kan geen advertentie
 * verzinnen die er niet is.
 */

export type Vondst = {
  bron: string;
  advertentie_url: string;
  titel: string;
  merk: string;
  vraagprijs: number;
  plaats: string;
  verkoper_naam: string;
  verkoper_profiel: string;
  /** Alleen AutoScout24 levert dit: particulieren zetten daar hun nummer wél in de
   *  advertentie. Op Marktplaats blijft dit leeg. */
  telefoon?: string;
  /** Waarom dit een handelaar lijkt. Leeg = mogelijk particulier, dus de moeite waard. */
  handelaar_reden: string;
};

const BROWSER = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "accept-language": "nl-NL,nl;q=0.9",
};

async function haalPagina(url: string, timeoutMs = 12000): Promise<string> {
  const res = await fetch(url, {
    headers: BROWSER,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) return "";
  return await res.text();
}

/**
 * Namen waaraan je een bedrijf herkent.
 *
 * Marktplaats zet er geen "particulier of handelaar" bij, dus dit is het beste dat er
 * gratis in zit. Het hoeft niet waterdicht: wat hier doorheen glipt wordt bij het
 * uitlezen alsnog beoordeeld. Het scheelt alleen dat je niet voor honderd handelaren
 * een advertentie hoeft te openen.
 */
const BEDRIJFSNAAM = new RegExp(
  [
    // Losstaande woorden
    "\\b(b\\.?v\\.?|v\\.?o\\.?f\\.?|n\\.?v\\.?|cars?|motors?|garage|lease|dealer|company|holding|group|trading|import|export|centrum|centre)\\b",
    // Woorddelen: "Autostad" en "Autocentrum" zijn net zo goed bedrijven als "Auto's".
    // Een particulier heet niet "Auto" iets, dus dit mag ruim.
    "\\bauto\\w*",
    "\\w*bedrijf\\b",
    "\\bhandel\\w*",
    "\\boccasion\\w*",
    "\\bservice\\w*",
    "\\bmobilit(y|eit)\\b",
  ].join("|"),
  "i"
);

/** Hoe AutoScout24 brandstof in zijn url noteert. */
const AS24_BRANDSTOF: Record<string, string> = {
  benzine: "B",
  diesel: "D",
  hybride: "2",
  elektrisch: "E",
};

/** Vervoegt een merknaam tot het stukje url dat Marktplaats gebruikt. */
function merkSlug(merk: string): string {
  return merk
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Marktplaats: de merkpagina ophalen en er advertenties uit trekken.
 *
 * De pagina bevat per advertentie een blok met titel, prijs, plaats, coördinaten en
 * verkoper. Die coördinaten zijn goud waard: daarmee reken je de afstand tot Barendrecht
 * exact uit, zonder iets te hoeven opzoeken.
 */
export async function haalMarktplaats(merk: string): Promise<Vondst[]> {
  const html = await haalPagina(`https://www.marktplaats.nl/l/auto-s/${merkSlug(merk)}/`);
  if (!html) return [];

  // Elk item begint bij "itemId" en loopt tot het volgende. Zo blijven titel, prijs,
  // plaats en verkoper bij elkaar horen in plaats van los door de pagina te zwerven.
  const stukken = html.split('"itemId":"').slice(1);
  const perVerkoper = new Map<string, number>();
  const ruw: (Vondst & { verkoperId: string })[] = [];

  for (const stuk of stukken) {
    const itemId = stuk.slice(0, stuk.indexOf('"'));
    if (!/^[am]\d+$/.test(itemId)) continue;

    const blok = stuk.slice(0, 6000);
    const pak = (re: RegExp) => blok.match(re)?.[1] ?? "";

    const titel = pak(/^[^"]*","title":"((?:[^"\\]|\\.)*)"/) || pak(/"title":"((?:[^"\\]|\\.)*)"/);
    const prijs = Math.round(Number(pak(/"priceCents":(\d+)/) || 0) / 100);
    const plaats = pak(/"cityName":"((?:[^"\\]|\\.)*)"/);
    const naam = pak(/"sellerName":"((?:[^"\\]|\\.)*)"/);
    const verkoperId = pak(/"sellerId":(\d+)/);
    const website = /"showWebsiteUrl":true/.test(blok);

    // De url staat elders in de pagina; hij bevat het itemId, dus daarop zoeken we hem op.
    const urlMatch = html.match(new RegExp(`/v/auto-s/[a-z0-9-]+/${itemId}-[a-z0-9-]*`, "i"));
    if (!urlMatch) continue;

    const redenen: string[] = [];
    if (website) redenen.push("eigen website");
    if (BEDRIJFSNAAM.test(naam)) redenen.push("bedrijfsnaam");

    ruw.push({
      bron: "Marktplaats",
      advertentie_url: `https://www.marktplaats.nl${urlMatch[0]}`,
      titel: ontsnap(titel),
      merk,
      vraagprijs: prijs,
      plaats: ontsnap(plaats),
      verkoper_naam: ontsnap(naam),
      verkoper_profiel: verkoperId ? `https://www.marktplaats.nl/u/x/${verkoperId}/` : "",
      handelaar_reden: redenen.join(" + "),
      verkoperId,
      // Coördinaten hangen we er los aan; zie hieronder.
      ...ontleedPositie(blok),
    });

    if (verkoperId) perVerkoper.set(verkoperId, (perVerkoper.get(verkoperId) ?? 0) + 1);
  }

  // Drie of meer advertenties van dezelfde verkoper op één pagina: dat is geen
  // particulier die zijn auto verkoopt. Deze controle kan pas als alles binnen is.
  return ruw.map((v) => {
    const aantal = perVerkoper.get(v.verkoperId) ?? 0;
    if (aantal >= 3) {
      const extra = `${aantal} advertenties`;
      return { ...v, handelaar_reden: v.handelaar_reden ? `${v.handelaar_reden} + ${extra}` : extra };
    }
    return v;
  });
}

/** Coördinaten uit een Marktplaats-blok, als ze erin staan. */
function ontleedPositie(blok: string): { lat?: number; lon?: number } {
  const lat = Number(blok.match(/"latitude":(-?\d+\.?\d*)/)?.[1]);
  const lon = Number(blok.match(/"longitude":(-?\d+\.?\d*)/)?.[1]);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : {};
}

/** JSON-ontsnapping in de ruwe pagina ongedaan maken (/ en \" en \\). */
function ontsnap(s: string): string {
  return s
    .replace(/\\u([0-9a-f]{4})/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

/**
 * AutoScout24: hun eigen particulier-filter gebruiken.
 *
 * `custtype=P` levert uitsluitend particulieren op — gemeten: twintig advertenties,
 * allemaal met verkopertype "Person" en geen enkele handelaar. Dat is beter dan welk
 * eigen filter ook, want het komt van de site zelf.
 *
 * Hun straal-parameter (zipr) doet aantoonbaar niets — er kwamen advertenties uit
 * Limburg terug bij een straal van 50 km rond Barendrecht. De afstand wordt daarom
 * hieronder zelf nagerekend.
 */
export async function haalAutoScout24(merk: string, criteria: Criteria): Promise<Vondst[]> {
  const p = new URLSearchParams({ atype: "C", cy: "NL", custtype: "P", sort: "age", desc: "1" });
  if (criteria.prijsMin > 0) p.set("pricefrom", String(criteria.prijsMin));
  if (criteria.prijsMax > 0) p.set("priceto", String(criteria.prijsMax));
  // AutoScout24 kent brandstof als letters: B benzine, D diesel, 2 hybride, E elektrisch.
  const brandstofLetters = criteria.brandstof
    .map((b) => AS24_BRANDSTOF[b])
    .filter(Boolean)
    .join(",");
  if (brandstofLetters) p.set("fuel", brandstofLetters);

  // Het merk hoort in het pad, niet in de queryreeks: als queryparameter wordt hij
  // genegeerd en krijg je gewoon alle merken terug.
  const ruw = await haalPagina(`https://www.autoscout24.nl/lst/${merkSlug(merk)}?${p}`);
  if (!ruw) return [];
  const html = ruw.replace(/\\u002F/g, "/");

  // De pagina bevat een lijst met per advertentie een compleet blok: prijs, kilometers,
  // plaats, verkopertype en zelfs een telefoonnummer. Alles netjes uit één blok halen in
  // plaats van uit de omgeving — die eerste aanpak pikte gegevens van de buuradvertentie
  // op en leverde een Polo van 63.500 euro op.
  const begin = html.indexOf('"listings":[');
  if (begin < 0) return [];
  const stukken = html.slice(begin).split('{"id":"').slice(1);

  const uit: Vondst[] = [];
  for (const stuk of stukken) {
    const blok = stuk.slice(0, 4000);
    const pak = (re: RegExp) => blok.match(re)?.[1] ?? "";

    // Alleen particulieren. Dit komt van AutoScout24 zelf, dus betrouwbaarder dan
    // welk eigen filter ook — maar we controleren het per advertentie in plaats van
    // erop te vertrouwen dat de filter-URL zijn werk deed.
    //
    // Bewust op de losse tekst zoeken en niet met een regex over het verkopersblok:
    // dat blok begint met "dealer":{} en elke poging om "tot de sluitende accolade"
    // te lezen stopt daar, waardoor het type nooit in beeld kwam.
    if (!blok.includes('"type":"PrivateSeller"')) continue;

    const pad = pak(/"url":"(\/aanbod\/[^"]+)"/);
    if (!pad) continue;

    // Het telefoonnummer staat er bij particulieren gewoon bij — anders dan op
    // Marktplaats, waar particulieren niets publiceren.
    const telefoon = pak(/"callTo":"(\+?[\d\s-]{8,})"/).replace(/[\s-]/g, "");
    const verkoperId = pak(/"seller":\{[\s\S]{0,120}?"id":"(\d+)"/);

    uit.push({
      bron: "AutoScout24",
      advertentie_url: `https://www.autoscout24.nl${pad}`,
      titel: ontsnap(
        [pak(/"make":"([^"]*)"/), pak(/"model":"([^"]*)"/), pak(/"modelVersionInput":"([^"]*)"/)]
          .filter(Boolean)
          .join(" ")
      ).slice(0, 120),
      merk,
      vraagprijs: Number(pak(/"priceRaw":(\d+)/)) || 0,
      plaats: ontsnap(pak(/"location":\{[^}]*"city":"([^"]*)"/)).trim(),
      verkoper_naam: "",
      telefoon,
      verkoper_profiel: verkoperId ? `https://www.autoscout24.nl/lst?cid=${verkoperId}` : "",
      // Leeg: AutoScout24 heeft hem zelf al als particulier bestempeld.
      handelaar_reden: "",
    });
  }
  return uit;
}

/**
 * Plaatsnamen omzetten naar coördinaten, met een blijvend geheugen.
 *
 * AutoScout24 geeft alleen een plaatsnaam, geen coördinaten. Opzoeken kan bij PDOK, maar
 * dat is een verzoek per plaats en dezelfde plaatsen komen elke ronde terug. Eén keer
 * opzoeken en bewaren dus.
 */
async function plaatsPositie(naam: string): Promise<{ lat: number; lon: number } | null> {
  const sleutel = naam.trim().toLowerCase();
  if (!sleutel) return null;

  try {
    const rij = await sql`SELECT lat, lon FROM plaats_posities WHERE naam = ${sleutel}`;
    if (rij[0]) {
      const lat = Number(rij[0].lat);
      const lon = Number(rij[0].lon);
      // lat 0 betekent: eerder gezocht en niets gevonden. Niet nog eens proberen.
      return lat === 0 && lon === 0 ? null : { lat, lon };
    }
  } catch {
    /* tabel bestaat nog niet; wordt hieronder aangemaakt */
  }

  let gevonden: { lat: number; lon: number } | null = null;
  // Onderscheid tussen "gevraagd en niets gevonden" en "de vraag mislukte". Alleen het
  // eerste mag onthouden worden. Anders zou één trage bui bij PDOK — of een limiet die
  // even volloopt — Rotterdam voorgoed als "onbekend" vastleggen, en dan valt de
  // afstandscontrole daar permanent weg zonder dat iemand het merkt.
  let gelukt = false;
  try {
    const res = await fetch(
      `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(naam)}&fq=type:woonplaats&rows=1`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (res.ok) {
      const d = await res.json();
      gelukt = true;
      const punt = d?.response?.docs?.[0]?.centroide_ll as string | undefined;
      const c = punt?.match(/POINT\(([\d.]+) ([\d.]+)\)/);
      if (c) gevonden = { lat: Number(c[2]), lon: Number(c[1]) };
    }
  } catch {
    /* time-out of netwerkfout: niets onthouden, volgende keer opnieuw proberen */
  }

  if (gelukt) {
    await sql`
      INSERT INTO plaats_posities (naam, lat, lon)
      VALUES (${sleutel}, ${gevonden?.lat ?? 0}, ${gevonden?.lon ?? 0})
      ON CONFLICT (naam) DO NOTHING
    `.catch(() => null);
  }

  return gevonden;
}

export async function initBronnenDB(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS plaats_posities (
      naam TEXT PRIMARY KEY,
      lat DOUBLE PRECISION NOT NULL DEFAULT 0,
      lon DOUBLE PRECISION NOT NULL DEFAULT 0
    )
  `;
}

/**
 * Houdt alleen over wat binnen jouw zoekgrenzen valt.
 *
 * Prijs en handelaar-signalen worden meteen afgehandeld; de afstand kost soms een
 * opzoekactie en gebeurt daarom als laatste, alleen voor wat de rest heeft overleefd.
 */
export async function filterOpCriteria(
  vondsten: (Vondst & { lat?: number; lon?: number })[],
  criteria: Criteria,
  /** Tijdstip waarop het opzoeken van plaatsnamen moet stoppen. Komt van de aanroeper,
   *  die als enige weet hoeveel tijd het hele verzoek nog heeft. */
  stopOpzoekenOp: number
): Promise<{ goed: Vondst[]; handelaren: number; buitenGrenzen: number }> {
  let handelaren = 0;
  let buitenGrenzen = 0;

  const naPrijs = vondsten.filter((v) => {
    if (v.handelaar_reden) {
      handelaren++;
      return false;
    }
    if (v.vraagprijs > 0) {
      if (criteria.prijsMin > 0 && v.vraagprijs < criteria.prijsMin) {
        buitenGrenzen++;
        return false;
      }
      if (criteria.prijsMax > 0 && v.vraagprijs > criteria.prijsMax) {
        buitenGrenzen++;
        return false;
      }
    }
    return true;
  });

  // Plaatsnamen die nog opgezocht moeten worden eerst in één keer afhandelen, een
  // paar tegelijk. Stuk voor stuk wachten liep bij honderd advertenties op tot een
  // halve minuut, en dat past niet binnen de tijd die Vercel per verzoek geeft.
  const opTeZoeken = [
    ...new Set(naPrijs.filter((v) => v.lat == null && v.plaats).map((v) => v.plaats)),
  ];
  const posities = new Map<string, { lat: number; lon: number } | null>();
  const stop = Math.min(Date.now() + 12_000, stopOpzoekenOp);
  const rij = [...opTeZoeken];
  await Promise.all(
    Array.from({ length: Math.min(6, rij.length) }, async () => {
      for (;;) {
        const plaats = rij.shift();
        if (!plaats || Date.now() > stop) return;
        posities.set(plaats, await plaatsPositie(plaats));
      }
    })
  );

  const goed: Vondst[] = [];
  for (const v of naPrijs) {
    const positie =
      v.lat != null && v.lon != null
        ? { lat: v.lat, lon: v.lon }
        : (posities.get(v.plaats) ?? null);

    // Zonder positie laten we hem staan: liever een lead te veel beoordelen dan een
    // goede weggooien omdat we de plaats niet konden thuisbrengen.
    if (positie && afstandKm(criteria.vertrekpunt, positie) > criteria.straalKm) {
      buitenGrenzen++;
      continue;
    }
    goed.push(v);
  }

  return { goed, handelaren, buitenGrenzen };
}

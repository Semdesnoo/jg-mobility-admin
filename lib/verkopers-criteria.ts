import sql from "./db";

/**
 * De zoekinstellingen van de verkopersradar: waar je zoekt, hoe ver, welke
 * brandstof en in welke prijsklasse.
 *
 * Bewust opgeslagen en niet per zoekopdracht opnieuw invullen: dit zijn instellingen
 * die maanden hetzelfde blijven. Je typt alleen nog wat je zoekt.
 *
 * Merk staat er met opzet NIET bij. Het gaat om particulieren die hun auto
 * verkopen; welk merk dat is maakt voor de benadering niet uit.
 */

export const BRANDSTOFFEN = ["benzine", "diesel", "hybride", "elektrisch"] as const;
export type Brandstof = (typeof BRANDSTOFFEN)[number];

/**
 * Alleen Nederland. België en Duitsland zaten er eerst bij als keuze, maar JG
 * Mobility werkt niet over de grens: een Belgische verkoper met een Belgisch
 * kenteken levert een traject op dat je niet wilt. Een straal van 100 km rond
 * Barendrecht loopt vanzelf tot voorbij Antwerpen, dus zonder deze grens sluipen
 * die advertenties er alsnog in.
 */
export const LANDEN = [{ code: "NL", naam: "Nederland" }] as const;

export type Criteria = {
  /** Leeg = alle brandstoffen. */
  brandstof: Brandstof[];
  /** 0 = geen ondergrens / geen bovengrens. */
  prijsMin: number;
  prijsMax: number;
  straalKm: number;
  vertrekpunt: { naam: string; lat: number; lon: number };
  /** Altijd alleen Nederland; blijft als veld bestaan zodat opgeslagen instellingen
   *  van vóór deze wijziging gewoon inleesbaar zijn. */
  landen: string[];
};

const KEY = "verkopers_criteria";

export const STANDAARD: Criteria = {
  brandstof: [],
  prijsMin: 0,
  prijsMax: 0,
  straalKm: 50,
  // Het bedrijfsadres: Arnhemseweg 10a, Barendrecht.
  vertrekpunt: { naam: "Barendrecht", lat: 51.8561, lon: 4.5372 },
  landen: ["NL"],
};

const getal = (v: unknown, standaard: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : standaard;
};

/** Ruwe invoer terugbrengen tot iets waar de rest van de code op kan vertrouwen. */
export function normaliseerCriteria(ruw: unknown): Criteria {
  const b = (ruw ?? {}) as Partial<Criteria> & { vertrekpunt?: Partial<Criteria["vertrekpunt"]> };

  const brandstof = Array.isArray(b.brandstof)
    ? (b.brandstof.filter((x) => (BRANDSTOFFEN as readonly string[]).includes(x)) as Brandstof[])
    : STANDAARD.brandstof;

  // Landen ligt vast op Nederland; oudere opgeslagen instellingen met BE of DE
  // worden hier stilzwijgend teruggebracht.
  const landen = ["NL"];

  const lat = Number(b.vertrekpunt?.lat);
  const lon = Number(b.vertrekpunt?.lon);

  return {
    brandstof,
    prijsMin: getal(b.prijsMin, STANDAARD.prijsMin, 0, 1_000_000),
    prijsMax: getal(b.prijsMax, STANDAARD.prijsMax, 0, 1_000_000),
    straalKm: getal(b.straalKm, STANDAARD.straalKm, 5, 500),
    vertrekpunt: {
      naam: String(b.vertrekpunt?.naam ?? STANDAARD.vertrekpunt.naam).slice(0, 120),
      // Buiten Europa is een tikfout, geen bedoeling.
      lat: Number.isFinite(lat) && lat > 35 && lat < 60 ? lat : STANDAARD.vertrekpunt.lat,
      lon: Number.isFinite(lon) && lon > -5 && lon < 20 ? lon : STANDAARD.vertrekpunt.lon,
    },
    landen,
  };
}

export async function leesCriteria(): Promise<Criteria> {
  try {
    const rijen = await sql`SELECT value FROM settings WHERE key = ${KEY}`;
    if (rijen.length === 0) return STANDAARD;
    return normaliseerCriteria(JSON.parse(rijen[0].value as string));
  } catch {
    return STANDAARD;
  }
}

export async function schrijfCriteria(ruw: unknown): Promise<Criteria> {
  const schoon = normaliseerCriteria(ruw);
  const waarde = JSON.stringify(schoon);
  await sql`
    INSERT INTO settings (key, value) VALUES (${KEY}, ${waarde})
    ON CONFLICT (key) DO UPDATE SET value = ${waarde}
  `;
  return schoon;
}

/**
 * Merken om de zoekopdrachten mee te vullen.
 *
 * Nodig omdat een zoekmachine iets concreets moet hebben: zoeken op "particulier
 * auto te koop Barendrecht" levert alleen categorie- en dealerpagina's op, terwijl
 * "Opel Corsa particulier Rotterdam" wél losse advertenties oplevert. Dat is in de
 * praktijk getest — zonder merk kwam er twee keer op rij niets bruikbaars terug.
 *
 * De gebruiker typt nog steeds geen merk: het systeem loopt de lijst zelf rond, dus
 * over een aantal zoekrondes komen alle merken aan bod. Volgorde loopt van veel naar
 * minder voorkomend op de Nederlandse tweedehandsmarkt, zodat de eerste ronde meteen
 * de grootste kans op resultaat heeft.
 */
export const MERKEN = [
  "Volkswagen", "Opel", "Renault", "Peugeot", "Ford", "Toyota",
  "Kia", "Hyundai", "Citroën", "Škoda", "Seat", "Nissan",
  "Fiat", "BMW", "Mercedes-Benz", "Audi", "Volvo", "Mazda",
  "Honda", "Suzuki", "Dacia", "Mini", "Mitsubishi", "Alfa Romeo",
] as const;

const MERK_KEY = "verkopers_merk_rondgang";

/**
 * De merken voor deze zoekronde, en meteen doorschuiven voor de volgende.
 * Zo krijg je bij elke klik andere merken in plaats van steeds dezelfde Golf.
 */
export async function volgendeMerken(aantal = 4): Promise<string[]> {
  let start = 0;
  try {
    const rijen = await sql`SELECT value FROM settings WHERE key = ${MERK_KEY}`;
    start = Number(rijen[0]?.value ?? 0) || 0;
  } catch {
    start = 0;
  }

  const gekozen = Array.from(
    { length: Math.min(aantal, MERKEN.length) },
    (_, i) => MERKEN[(start + i) % MERKEN.length]
  );

  // Eentje extra opschuiven. Zou hij precies `gekozen.length` doorschuiven, dan komt
  // de teller na drie rondes van acht merken exact terug op zijn beginwaarde — 24 is
  // ook de lengte van de lijst — en zoekt elke klik weer dezelfde drie groepjes.
  // Met die ene stap erbij schuift het venster elke keer op.
  const volgende = String((start + gekozen.length + 1) % MERKEN.length);
  await sql`
    INSERT INTO settings (key, value) VALUES (${MERK_KEY}, ${volgende})
    ON CONFLICT (key) DO UPDATE SET value = ${volgende}
  `.catch(() => null);

  return gekozen;
}

/** Hemelsbrede afstand in kilometers tussen twee punten. */
export function afstandKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * De criteria als leesbare zin voor de zoekopdracht aan de AI.
 * Eén plek, zodat het scherm en de agent gegarandeerd hetzelfde bedoelen.
 */
export function criteriaAlsTekst(c: Criteria): string {
  const regels: string[] = [];

  regels.push(
    "Uitsluitend advertenties uit NEDERLAND, met een Nederlands kenteken en een Nederlandse plaatsnaam. Advertenties uit België of Duitsland tellen niet mee, ook niet als ze dichterbij liggen dan een Nederlandse."
  );
  regels.push(
    `Binnen ongeveer ${c.straalKm} km hemelsbreed van ${c.vertrekpunt.naam}. Ligt de plaats verder weg, neem de advertentie dan niet op.`
  );

  regels.push(
    c.brandstof.length
      ? `Alleen deze brandstofsoorten: ${c.brandstof.join(", ")}.`
      : "Alle brandstofsoorten zijn goed."
  );

  if (c.prijsMin > 0 && c.prijsMax > 0) {
    regels.push(`Vraagprijs tussen € ${c.prijsMin.toLocaleString("nl-NL")} en € ${c.prijsMax.toLocaleString("nl-NL")}.`);
  } else if (c.prijsMax > 0) {
    regels.push(`Vraagprijs maximaal € ${c.prijsMax.toLocaleString("nl-NL")}.`);
  } else if (c.prijsMin > 0) {
    regels.push(`Vraagprijs minimaal € ${c.prijsMin.toLocaleString("nl-NL")}.`);
  } else {
    regels.push("Elke vraagprijs is goed.");
  }

  regels.push(
    "ALLE MERKEN EN MODELLEN. Beperk je niet tot een paar bekende merken en zoek niet steeds dezelfde auto's op — spreid je zoekopdrachten juist over verschillende merken en carrosserievormen. Het enige wat telt is dat het een PARTICULIERE verkoper is."
  );
  return regels.map((r) => `- ${r}`).join("\n");
}

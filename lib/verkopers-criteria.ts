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

export const LANDEN = [
  { code: "NL", naam: "Nederland" },
  { code: "BE", naam: "België" },
  { code: "DE", naam: "Duitsland" },
] as const;

export type Criteria = {
  /** Leeg = alle brandstoffen. */
  brandstof: Brandstof[];
  /** 0 = geen ondergrens / geen bovengrens. */
  prijsMin: number;
  prijsMax: number;
  straalKm: number;
  vertrekpunt: { naam: string; lat: number; lon: number };
  /** Landcodes die meetellen. */
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
  // Alleen Nederland. België en Duitsland kun je zelf aanzetten; een straal van
  // 100 km rond Barendrecht loopt anders zomaar tot voorbij Antwerpen.
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

  const landen = Array.isArray(b.landen)
    ? b.landen.filter((x) => LANDEN.some((l) => l.code === x))
    : STANDAARD.landen;

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
    // Zonder land zou de zoekopdracht de hele wereld beslaan; val dan terug op Nederland.
    landen: landen.length ? landen : STANDAARD.landen,
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

  const landnamen = c.landen
    .map((code) => LANDEN.find((l) => l.code === code)?.naam ?? code)
    .join(" en ");
  regels.push(
    `Alleen advertenties uit ${landnamen}. Advertenties uit andere landen tellen niet mee, ook niet als ze dichtbij liggen.`
  );
  regels.push(
    `Binnen ongeveer ${c.straalKm} km hemelsbreed van ${c.vertrekpunt.naam}. Ligt de plaats verder weg, neem de advertentie dan niet op.`
  );

  if (c.brandstof.length) {
    regels.push(`Alleen deze brandstofsoorten: ${c.brandstof.join(", ")}.`);
  }

  if (c.prijsMin > 0 && c.prijsMax > 0) {
    regels.push(`Vraagprijs tussen € ${c.prijsMin.toLocaleString("nl-NL")} en € ${c.prijsMax.toLocaleString("nl-NL")}.`);
  } else if (c.prijsMax > 0) {
    regels.push(`Vraagprijs maximaal € ${c.prijsMax.toLocaleString("nl-NL")}.`);
  } else if (c.prijsMin > 0) {
    regels.push(`Vraagprijs minimaal € ${c.prijsMin.toLocaleString("nl-NL")}.`);
  }

  regels.push("Merk en model maken niet uit — het gaat erom dat het een particuliere verkoper is.");
  return regels.map((r) => `- ${r}`).join("\n");
}

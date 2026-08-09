import sql from "./db";

/**
 * De uitgavenrem op de verkopersradar.
 *
 * WAAROM DIT IN DE SERVER ZIT EN NIET IN HET SCHERM
 * Een rem in het scherm werkt alleen zolang je dát scherm openhebt. Een oud tabblad,
 * een tweede tabblad, of een pagina die nog de vorige versie draait, loopt er zo omheen.
 * Deze rem zit achter elke betaalde stap, dus hij geldt altijd — ook voor een scherm dat
 * er niets van weet.
 *
 * HOE HET WERKT
 * Er is een potje. Elke AI-aanroep die geld kost boekt zijn werkelijke kosten af. Is het
 * potje leeg, dan weigeren de betaalde stappen totdat jij het opnieuw vrijgeeft. Zo kan
 * één druk op de knop nooit meer kosten dan wat je hebt vrijgegeven, hoe lang hij ook
 * doorloopt.
 *
 * De kosten worden berekend uit het werkelijke tokengebruik dat de AI teruggeeft, niet
 * uit een schatting vooraf. Een grote advertentiepagina kost meer dan een kleine, en dat
 * weet je pas achteraf.
 */

const SLEUTEL_BESTEED = "verkopers_besteed_centen";
const SLEUTEL_POTJE = "verkopers_potje_centen";

/** Wat er per keer wordt vrijgegeven als je op de knop drukt. */
export const POTJE_CENTEN = 250;

/** Prijs van Haiku 4.5, in dollar per miljoen tokens. */
const PRIJS_IN = 1;
const PRIJS_UIT = 5;
/** Grove omrekening naar euro. Hoeft niet exact: dit is een rem, geen boekhouding. */
const DOLLAR_NAAR_EURO = 0.92;

export type Budget = { besteed: number; potje: number; over: number };

async function lees(sleutel: string): Promise<number> {
  try {
    const rij = await sql`SELECT value FROM settings WHERE key = ${sleutel}`;
    return Number(rij[0]?.value ?? 0) || 0;
  } catch {
    return 0;
  }
}

async function schrijf(sleutel: string, waarde: number): Promise<void> {
  const v = String(Math.round(waarde));
  await sql`
    INSERT INTO settings (key, value) VALUES (${sleutel}, ${v})
    ON CONFLICT (key) DO UPDATE SET value = ${v}
  `.catch(() => null);
}

export async function leesBudget(): Promise<Budget> {
  const [besteed, potje] = await Promise.all([lees(SLEUTEL_BESTEED), lees(SLEUTEL_POTJE)]);
  return { besteed, potje, over: Math.max(0, potje - besteed) };
}

/**
 * Mag er nog uitgegeven worden?
 *
 * Bewust vóór de aanroep, met een kleine marge: is er minder dan een halve cent over,
 * dan begint hij er niet meer aan. Anders zou de laatste aanroep het potje net
 * overschrijden en klopt de belofte niet meer.
 */
export async function magUitgeven(): Promise<{ mag: boolean; budget: Budget }> {
  const budget = await leesBudget();
  return { mag: budget.over > 0, budget };
}

/** Boekt het werkelijke verbruik van één AI-aanroep af. */
export async function boekVerbruik(usage: {
  input_tokens?: number;
  output_tokens?: number;
}): Promise<void> {
  const dollar =
    ((usage.input_tokens ?? 0) * PRIJS_IN + (usage.output_tokens ?? 0) * PRIJS_UIT) / 1_000_000;
  const centen = dollar * DOLLAR_NAAR_EURO * 100;
  if (centen <= 0) return;
  const besteed = await lees(SLEUTEL_BESTEED);
  await schrijf(SLEUTEL_BESTEED, besteed + centen);
}

/** Geeft opnieuw een potje vrij. Dit is wat er achter jouw knop zit. */
export async function geefVrij(): Promise<Budget> {
  const besteed = await lees(SLEUTEL_BESTEED);
  await schrijf(SLEUTEL_POTJE, besteed + POTJE_CENTEN);
  return leesBudget();
}

/** Nette melding als het potje leeg is. */
export const BUDGET_OP =
  `Het budget is op. Geef op het tabblad Radar opnieuw € ${(POTJE_CENTEN / 100).toFixed(2)} vrij ` +
  `om verder te gaan — zo kan er nooit meer weglopen dan je zelf hebt goedgekeurd.`;

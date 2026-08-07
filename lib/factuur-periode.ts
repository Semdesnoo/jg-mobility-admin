/**
 * Datums en periodes voor de inkoopfacturen.
 *
 * Factuurdatums staan als vrije tekst in de database en komen uit twee bronnen:
 * met de hand ingetypt of door de AI uit een PDF gehaald. In de praktijk staan er
 * dus zowel "2026-07-19" als "19-07-2026" in. Eén plek die dat allebei aankan,
 * gedeeld door server en scherm, voorkomt dat een factuur in het ene overzicht in
 * juli valt en in het andere nergens.
 */

/** "2026-07-19", "19-07-2026" of "19/07/2026" → Date op middernacht. Anders null. */
export function parseDatum(waarde: string | null | undefined): Date | null {
  const t = (waarde ?? "").trim();
  if (!t) return null;

  let iso: string | null = null;
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(t)) {
    const [j, m, d] = t.slice(0, 10).split("-");
    iso = `${j}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  } else {
    const m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (m) iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (!iso) return null;

  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/** Kwartaalnummer 1-4. */
export function kwartaalVan(d: Date): number {
  return Math.floor(d.getMonth() / 3) + 1;
}

/** "2026-07" — sleutel om op maand te groeperen. */
export function maandSleutel(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MAANDEN = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

/** "2026-07" → "juli 2026". */
export function maandNaam(sleutel: string): string {
  const [j, m] = sleutel.split("-");
  const i = Number(m) - 1;
  return `${MAANDEN[i] ?? m} ${j}`;
}

/**
 * "2026-07-01" uit een Date, in de lokale tijdzone.
 *
 * Niet `toISOString()` gebruiken: die rekent om naar UTC, en in Nederland (UTC+1/+2)
 * wordt middernacht 1 juli dan 30 juni 22:00 — het derde kwartaal leek daardoor op
 * 30 juni te beginnen.
 */
export function lokaleDatum(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Eerste en laatste dag van een kwartaal (laatste dag op 23:59:59.999). */
export function kwartaalGrenzen(jaar: number, kwartaal: number): { van: Date; tot: Date } {
  const startMaand = (kwartaal - 1) * 3;
  return {
    van: new Date(jaar, startMaand, 1, 0, 0, 0, 0),
    tot: new Date(jaar, startMaand + 3, 0, 23, 59, 59, 999),
  };
}

/**
 * Welke datum telt voor de boekhouding? De factuurdatum bepaalt in welk kwartaal
 * de BTW valt. Ontbreekt die, dan is de vervaldatum de beste benadering — beter
 * dan de factuur helemaal buiten het overzicht laten vallen.
 */
export function boekDatum(f: { datum: string; vervaldatum: string }): Date | null {
  return parseDatum(f.datum) ?? parseDatum(f.vervaldatum);
}

/**
 * Welke datum telt voor "wanneer moet ik dit betalen"? De vervaldatum, met de
 * factuurdatum als terugval.
 */
export function betaalDatum(f: { datum: string; vervaldatum: string }): Date | null {
  return parseDatum(f.vervaldatum) ?? parseDatum(f.datum);
}

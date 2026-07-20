/**
 * Client-side spiegel van het koerslijst-model uit /api/admin/inkoop/taxeer.
 *
 * Waarom een kopie: de eerste helft van de waardeketen (nieuwprijs → afschrijving →
 * kilometercorrectie → koerslijstwaarde) is pure rekenkunde op RDW-data. Door die hier
 * te herhalen kan de Taxatietool die schakels al invullen zodra het kenteken bekend is,
 * dus vóór en tijdens de ~30 seconden durende marktscan. Alleen de laatste drie schakels
 * wachten echt op live marktdata.
 *
 * Deze curves moeten gelijk blijven aan die in app/api/admin/inkoop/taxeer/route.ts.
 */

const CURVE = [0.85, 0.78, 0.7, 0.63, 0.57, 0.51, 0.46, 0.42, 0.38, 0.34, 0.3, 0.27, 0.24, 0.21, 0.18, 0.15];

/** Aandeel van de nieuwprijs dat een occasion gemiddeld nog waard is, per leeftijd in jaren. */
export function retentieFactor(leeftijdJaren: number): number {
  if (!Number.isFinite(leeftijdJaren) || leeftijdJaren <= 0) return CURVE[0];
  if (leeftijdJaren >= 15) return CURVE[15];
  const i = Math.floor(leeftijdJaren);
  const frac = leeftijdJaren - i;
  return CURVE[i] + (CURVE[i + 1] - CURVE[i]) * frac;
}

/** Verwacht aantal kilometers in Nederland: ~14.000 per jaar. */
export const KM_PER_JAAR = 14000;

/** Correctie op de waarde voor de kilometerstand t.o.v. het verwachte aantal. */
export function kmFactor(km: number, leeftijdJaren: number): number {
  if (!km || km <= 0) return 1.0;
  const verwacht = Math.max(leeftijdJaren, 0.5) * KM_PER_JAAR;
  const afwijking = km - verwacht;
  const pct = -(afwijking / 30000) * 0.06;
  return Math.max(0.75, Math.min(1.25, 1 + pct));
}

export type KoerslijstPreview = {
  leeftijd: number;
  catalogus: number;
  /** Restwaarde na alleen de leeftijdsafschrijving. */
  naAfschrijving: number;
  afschrijving: number;
  afschrijvingPct: number;
  kmCorrectie: number;
  koerslijst: number;
  verwachtKm: number;
  kmPerJaar: number;
  /** Afwijking van de kilometerstand t.o.v. verwacht, in procenten. */
  kmAfwijkingPct: number;
};

/**
 * Berekent de eerste schakels van de waardeketen uit bouwjaar, catalogusprijs en km-stand.
 * Geeft null zolang er geen bruikbare catalogusprijs is (dan draagt de RDW-kant niets bij).
 */
export function berekenKoerslijst(
  bouwjaar: number | undefined,
  catalogusprijs: number | undefined,
  km: number,
  peiljaar = new Date().getFullYear()
): KoerslijstPreview | null {
  const catalogus = Number(catalogusprijs) || 0;
  if (!bouwjaar || catalogus <= 0) return null;

  const leeftijd = Math.max(0, peiljaar - bouwjaar);
  const retentie = retentieFactor(leeftijd);
  const naAfschrijving = Math.round(catalogus * retentie);
  const koerslijst = Math.round(catalogus * retentie * kmFactor(km, leeftijd));
  const verwachtKm = Math.round(Math.max(leeftijd, 0.5) * KM_PER_JAAR);

  return {
    leeftijd,
    catalogus,
    naAfschrijving,
    afschrijving: catalogus - naAfschrijving,
    afschrijvingPct: Math.round((1 - retentie) * 100),
    kmCorrectie: koerslijst - naAfschrijving,
    koerslijst,
    verwachtKm,
    kmPerJaar: leeftijd > 0 && km > 0 ? Math.round(km / leeftijd) : 0,
    kmAfwijkingPct: km > 0 && verwachtKm > 0 ? Math.round(((km - verwachtKm) / verwachtKm) * 100) : 0,
  };
}

/**
 * Weging tussen koerslijst en live markt, gelijk aan de serverlogica: hoe meer
 * advertenties er gevonden zijn, hoe zwaarder de live markt weegt.
 */
export function weging(aantalGevonden: number, heeftMarkt: boolean, heeftKoerslijst: boolean) {
  if (heeftMarkt && heeftKoerslijst) {
    if (aantalGevonden >= 5) return { markt: 0.85, koerslijst: 0.15 };
    if (aantalGevonden >= 3) return { markt: 0.72, koerslijst: 0.28 };
    return { markt: 0.55, koerslijst: 0.45 };
  }
  if (heeftMarkt) return { markt: 1, koerslijst: 0 };
  if (heeftKoerslijst) return { markt: 0, koerslijst: 1 };
  return { markt: 0, koerslijst: 0 };
}

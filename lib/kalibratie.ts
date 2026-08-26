import sql from "./db";
import { getAutos } from "./autos-db";
import { getDossiers } from "./dossiers-db";
import { getPrijsHistorie, type PrijsPunt } from "./prijs-geheugen-db";
import { getTaxatieArchief } from "./taxatie-archief-db";
import { getInruilArchief } from "./inruil-archief-db";

/**
 * De ijking: hoe goed klopt de prijs die de tool noemt met wat er in het echt gebeurde?
 *
 * WAT HIER GEBEURT
 * Van elke auto die door het bedrijf is gegaan wordt de hele keten naast elkaar gelegd:
 *
 *    wat de tool adviseerde  →  wat je betaalde  →  wat je vroeg  →  waarvoor hij wegging
 *
 * Die vier stonden tot nu toe in vier verschillende hoeken van het dashboard: het advies
 * in het taxatie- en inruilarchief, de inkoopprijs in de marge-dossiers, de vraagprijs in
 * de voorraad en de verkoopprijs op de factuur. Los van elkaar zeggen ze niets. Naast
 * elkaar vertellen ze of je te duur inkoopt, te hoog begint, of te snel zakt.
 *
 * GEKOPPELD OP KENTEKEN
 * Dat is het enige wat door alle vier de administraties heen hetzelfde is. Auto's zonder
 * kenteken doen niet mee aan de koppeling, maar tellen wel gewoon mee in wat de voorraad
 * heeft gedaan.
 *
 * WAT ER MEE GEBEURT
 * Uit de verkochte auto's rolt één getal: de realisatiefactor — wat je gemiddeld krijgt
 * ten opzichte van je eigen eerste vraagprijs. In app/api/admin/inkoop/taxeer stond daar
 * een aanname van 0,96 (een advertentie gaat voor 4% onder de vraagprijs weg). Die
 * aanname wordt vervangen door je eigen cijfer zodra er genoeg verkopen zijn.
 *
 * WAT ER BEWUST NIET MEE GEBEURT
 * De afwijking van het advies (verkoop tegenover wat de tool voorspelde) wordt WEL
 * gemeten maar NIET automatisch verrekend. Anders corrigeer je twee keer voor hetzelfde:
 * de realisatiefactor zit al in dat advies. Die afwijking is de scorekaart waarmee je kunt
 * zien of het ijken werkt, en dat is iets anders dan een knop waar het model aan draait.
 */

const AFRONDEN = (n: number) => Math.round(n * 1000) / 1000;

/** De aanname waarmee de taxatietool rekent zolang er te weinig eigen verkopen zijn. */
export const STANDAARD_FACTOR = 0.96;

/** Vanaf hoeveel verkopen we het eigen cijfer vertrouwen boven de aanname. */
export const MINIMAAL_VOOR_FACTOR = 5;

/** Vanaf hoeveel verkopen van één merk we een eigen factor voor dat merk gebruiken. */
export const MINIMAAL_PER_MERK = 4;

/**
 * Grenzen waarbinnen een realisatie geloofwaardig is.
 *
 * Onder de 0,60 of boven de 1,15 is het vrijwel altijd geen prijsonderhandeling maar iets
 * anders: een auto die aan een handelaar ging, een verkeerd ingetikt bedrag, of een prijs
 * die na de verkoop nog is aangepast. Zulke gevallen zijn echt, maar ze zeggen niets over
 * wat een gewone klant betaalt — en ze trekken een gemiddelde over tien auto's zo scheef.
 */
const ONDERGRENS = 0.6;
const BOVENGRENS = 1.15;

export type AutoIJking = {
  auto_id: number;
  kenteken: string;
  merk: string;
  model: string;
  bouwjaar: number;
  verkocht: boolean;
  toegevoegd_op: string | null;
  verkocht_op: string | null;
  /** Dagen tussen binnenkomst en verkoop, of tot vandaag als hij nog staat. */
  standtijd: number | null;

  // ── Wat de tool adviseerde (taxatie- of inruilarchief, op kenteken) ──
  advies_verkoop: number | null;
  advies_inkoop: number | null;
  advies_bron: string;

  // ── Wat je werkelijk betaalde (marge-dossier) ──
  inkoop: number | null;
  kosten: number;

  // ── Wat je vroeg (prijsgeheugen) ──
  eerste_vraagprijs: number | null;
  huidige_vraagprijs: number | null;
  verlagingen: number;
  verlaagd_met: number;
  /**
   * Is die eerste vraagprijs echt gemeten, of is het de laatst bekende prijs van een auto
   * die er al stond voordat dit geheugen bestond?
   *
   * Dat verschil is niet cosmetisch. Ben je bij zo'n auto ooit gezakt, dan weten we dat
   * niet en rekenen we de verkoop af tegen de vráág­prijs van ná die verlaging. De
   * realisatie valt dan te gunstig uit. Wie dat niet op het scherm zet, laat de tool zich
   * ijken op een te rooskleurig beeld.
   */
  vraagprijs_gemeten: boolean;

  // ── Waarvoor hij wegging ──
  verkocht_voor: number | null;
  verkoop_bron: string;

  // ── Wat dat zegt ──
  /** Verkoopprijs gedeeld door de eerste vraagprijs. 0,94 = je zakte 6%. */
  realisatie: number | null;
  /** Verkoopprijs gedeeld door wat de tool voorspelde. Onder 1 = de tool zat te hoog. */
  advies_afwijking: number | null;
  /** Wat je er netto aan overhield, ná btw over de marge en de kosten. */
  netto_marge: number | null;
};

export type MerkIJking = {
  merk: string;
  aantal: number;
  factor: number;
  gem_standtijd: number | null;
};

export type Kalibratie = {
  autos: AutoIJking[];
  /** Auto's die verkocht zijn maar waarvan de verkoopprijs nog ontbreekt. */
  ontbreekt: AutoIJking[];

  /** Gemiddelde verkoopprijs ÷ eerste vraagprijs over de bruikbare verkopen. */
  factor: number | null;
  aantal_verkopen: number;
  /** Hoeveel verkopen buiten de grenzen vielen en dus niet meetellen. */
  buiten_grenzen: number;
  per_merk: MerkIJking[];

  /** Gemiddelde afwijking van het advies. Alleen als scorekaart, niet als correctie. */
  advies_afwijking: number | null;
  aantal_met_advies: number;
  /**
   * Hoeveel van de gemeten verkopen nog geen echte prijsgeschiedenis hadden. Bij die
   * auto's is tegen de laatst bekende vraagprijs gerekend, en valt de realisatie dus
   * eerder te hoog dan te laag uit.
   */
  zonder_historie: number;

  /** Wat de taxatietool op dit moment gebruikt, en waarom. */
  gebruikte_factor: number;
  gebruikt_eigen_cijfer: boolean;

  // ── Wat de voorraad doet ──
  gem_standtijd_verkocht: number | null;
  gem_verlaging: number | null;
  aantal_verlaagd: number;
};

const dagenTussen = (a: string | null, b: string | null): number | null => {
  if (!a) return null;
  const van = new Date(a).getTime();
  const tot = b ? new Date(b).getTime() : Date.now();
  if (isNaN(van) || isNaN(tot)) return null;
  return Math.max(0, Math.round((tot - van) / 86400000));
};

const gemiddelde = (lijst: number[]): number | null =>
  lijst.length ? AFRONDEN(lijst.reduce((s, n) => s + n, 0) / lijst.length) : null;

/**
 * Wat er netto overblijft, met dezelfde btw-regels als de marge-calculator en de
 * taxatietool. Eén rekenwijze in het hele dashboard, anders klopt geen enkele vergelijking.
 */
function nettoMarge(verkoop: number, kostprijs: number, btwType: string): number {
  if (btwType === "21" || btwType === "btw") {
    return Math.round(verkoop / 1.21 - kostprijs);
  }
  const bruto = verkoop - kostprijs;
  const btw = bruto > 0 ? Math.round((bruto * 21) / 121) : 0;
  return bruto - btw;
}

/** Kenteken zonder streepjes en in hoofdletters — de enige manier om ze te vergelijken. */
const kaal = (k: string | undefined | null) => (k ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

export async function haalKalibratie(): Promise<Kalibratie> {
  const [autos, dossiers, historie, taxaties, inruilen, facturen] = await Promise.all([
    getAutos().catch(() => []),
    getDossiers().catch(() => []),
    getPrijsHistorie().catch(() => [] as PrijsPunt[]),
    getTaxatieArchief().catch(() => []),
    getInruilArchief().catch(() => []),
    sql`SELECT auto_kenteken, verkoopprijs FROM facturen`.catch(() => [] as Record<string, unknown>[]),
  ]);

  // ── Opzoeklijsten op kenteken ──
  const adviesPerKenteken = new Map<string, { verkoop: number; inkoop: number | null; bron: string; moment: string }>();

  // Taxaties: het advies zoals de tool het gaf. De oudste telt, want dat is het advies
  // waarop je besloot te kopen — een latere hertaxatie is een ander moment.
  for (const t of taxaties) {
    const k = kaal(t.kenteken);
    if (!k || !t.verwachte_verkoop) continue;
    const bestaand = adviesPerKenteken.get(k);
    if (!bestaand || t.aangemaakt < bestaand.moment) {
      adviesPerKenteken.set(k, {
        verkoop: t.verwachte_verkoop,
        inkoop: t.max_inkoop || null,
        bron: "taxatietool",
        moment: t.aangemaakt,
      });
    }
  }

  // Inruilen: bij een inruil is de verwachte opbrengst het advies en het bod de inkoop.
  // Een inruil weegt zwaarder dan een losse taxatie van hetzelfde kenteken: hier is de
  // auto ook echt binnengekomen.
  for (const i of inruilen) {
    const k = kaal(i.kenteken);
    if (!k || !i.verkoopwaarde) continue;
    adviesPerKenteken.set(k, {
      verkoop: i.verkoopwaarde,
      inkoop: i.bod || null,
      bron: "inruil",
      moment: i.aangemaakt,
    });
  }

  const factuurPerKenteken = new Map<string, number>();
  for (const f of facturen as Record<string, unknown>[]) {
    const k = kaal(f.auto_kenteken as string);
    const bedrag = Number(f.verkoopprijs) || 0;
    if (k && bedrag > 0) factuurPerKenteken.set(k, bedrag);
  }

  const dossierPerAuto = new Map<number, { inkoop: number; kosten: number; btw: string }>();
  for (const d of dossiers) {
    if (d.auto_id == null) continue;
    dossierPerAuto.set(d.auto_id, {
      inkoop: Number(d.inkoop) || 0,
      kosten: (d.kosten ?? []).reduce((s, k) => s + (parseFloat(k.bedrag) || 0), 0),
      btw: d.btw_type,
    });
  }

  const historiePerAuto = new Map<number, PrijsPunt[]>();
  for (const p of historie) {
    const lijst = historiePerAuto.get(p.auto_id) ?? [];
    lijst.push(p);
    historiePerAuto.set(p.auto_id, lijst);
  }

  // ── Per auto de keten opbouwen ──
  const rijen: AutoIJking[] = autos.map((a) => {
    const k = kaal(a.kenteken);
    const punten = historiePerAuto.get(a.id) ?? [];
    const vraagpunten = punten.filter((p) => p.soort === "vraagprijs");
    const verkooppunt = punten.find((p) => p.soort === "verkocht");
    const advies = k ? adviesPerKenteken.get(k) : undefined;
    const dossier = dossierPerAuto.get(a.id);

    // De eerste vraagprijs is de oudste die we onthouden hebben. Van auto's die er al
    // stonden voordat dit geheugen bestond weten we alleen de huidige prijs; die telt dan
    // als beginpunt, en zolang er niets veranderd is klopt dat ook.
    const eerste = vraagpunten.length ? vraagpunten[0].bedrag : a.prijs || null;
    const huidige = a.prijs || (vraagpunten.length ? vraagpunten[vraagpunten.length - 1].bedrag : null);

    // Verlagingen tellen: alleen stappen omlaag. Een prijs die omhoog gaat is meestal een
    // correctie van een typefout en zegt niets over onderhandelen.
    let verlagingen = 0;
    for (let i = 1; i < vraagpunten.length; i++) {
      if (vraagpunten[i].bedrag < vraagpunten[i - 1].bedrag) verlagingen++;
    }

    // De verkoopprijs: eerst wat er met de hand is gemeld, anders de factuur. De factuur
    // is het hardste bewijs, maar niet elke verkoop krijgt er meteen een.
    const uitFactuur = k ? factuurPerKenteken.get(k) : undefined;
    const verkochtVoor = verkooppunt?.bedrag ?? uitFactuur ?? null;
    const verkoopBron = verkooppunt ? verkooppunt.bron : uitFactuur ? "factuur" : "";

    const standtijd = dagenTussen(a.toegevoegd_op ?? null, a.verkocht_op ?? null);
    const kostprijs = dossier ? dossier.inkoop + dossier.kosten : null;

    return {
      auto_id: a.id,
      kenteken: (a.kenteken ?? "").toUpperCase(),
      merk: a.merk,
      model: a.model,
      bouwjaar: a.bouwjaar,
      verkocht: Boolean(a.verkocht),
      toegevoegd_op: a.toegevoegd_op ?? null,
      verkocht_op: a.verkocht_op ?? null,
      standtijd,
      advies_verkoop: advies?.verkoop ?? null,
      advies_inkoop: advies?.inkoop ?? null,
      advies_bron: advies?.bron ?? "",
      inkoop: dossier && dossier.inkoop > 0 ? dossier.inkoop : null,
      kosten: dossier?.kosten ?? 0,
      eerste_vraagprijs: eerste,
      huidige_vraagprijs: huidige,
      verlagingen,
      verlaagd_met: eerste && huidige && eerste > huidige ? eerste - huidige : 0,
      vraagprijs_gemeten: vraagpunten.length > 0,
      verkocht_voor: verkochtVoor,
      verkoop_bron: verkoopBron,
      realisatie: verkochtVoor && eerste ? AFRONDEN(verkochtVoor / eerste) : null,
      advies_afwijking:
        verkochtVoor && advies?.verkoop ? AFRONDEN(verkochtVoor / advies.verkoop) : null,
      netto_marge:
        verkochtVoor && kostprijs && kostprijs > 0
          ? nettoMarge(verkochtVoor, kostprijs, dossier?.btw ?? "marge")
          : null,
    };
  });

  // ── Wat er uit de verkopen te leren valt ──
  const verkocht = rijen.filter((r) => r.verkocht);
  const metRealisatie = verkocht.filter((r) => r.realisatie != null);
  const bruikbaar = metRealisatie.filter(
    (r) => r.realisatie! >= ONDERGRENS && r.realisatie! <= BOVENGRENS
  );

  const factor = gemiddelde(bruikbaar.map((r) => r.realisatie!));
  const adviesAfwijking = gemiddelde(
    verkocht.filter((r) => r.advies_afwijking != null).map((r) => r.advies_afwijking!)
  );

  // Per merk, maar alleen als er genoeg van dat merk door je handen is gegaan. Twee
  // auto's van een merk zeggen niets; dan is het toeval en geen patroon.
  const perMerkMap = new Map<string, AutoIJking[]>();
  for (const r of bruikbaar) {
    const m = (r.merk || "").trim();
    if (!m) continue;
    perMerkMap.set(m, [...(perMerkMap.get(m) ?? []), r]);
  }
  const per_merk: MerkIJking[] = [...perMerkMap.entries()]
    .filter(([, lijst]) => lijst.length >= MINIMAAL_PER_MERK)
    .map(([merk, lijst]) => ({
      merk,
      aantal: lijst.length,
      factor: gemiddelde(lijst.map((r) => r.realisatie!))!,
      gem_standtijd: gemiddelde(lijst.filter((r) => r.standtijd != null).map((r) => r.standtijd!)),
    }))
    .sort((a, b) => b.aantal - a.aantal);

  const genoeg = bruikbaar.length >= MINIMAAL_VOOR_FACTOR && factor != null;

  return {
    autos: rijen,
    ontbreekt: verkocht.filter((r) => r.verkocht_voor == null),
    factor,
    aantal_verkopen: bruikbaar.length,
    buiten_grenzen: metRealisatie.length - bruikbaar.length,
    per_merk,
    advies_afwijking: adviesAfwijking,
    aantal_met_advies: verkocht.filter((r) => r.advies_afwijking != null).length,
    zonder_historie: bruikbaar.filter((r) => !r.vraagprijs_gemeten).length,
    gebruikte_factor: genoeg ? factor! : STANDAARD_FACTOR,
    gebruikt_eigen_cijfer: genoeg,
    gem_standtijd_verkocht: gemiddelde(
      verkocht.filter((r) => r.standtijd != null).map((r) => r.standtijd!)
    ),
    gem_verlaging: gemiddelde(
      verkocht.filter((r) => r.verlaagd_met > 0).map((r) => r.verlaagd_met)
    ),
    aantal_verlaagd: verkocht.filter((r) => r.verlaagd_met > 0).length,
  };
}

/**
 * Alleen het getal dat de taxatietool nodig heeft, zonder de hele analyse.
 *
 * De tool draait dit bij elke taxatie; die mag niet gaan hangen op een berekening over de
 * hele historie. Gaat er iets mis, dan komt de aanname van 0,96 terug — een taxatie die
 * faalt omdat het ijken faalt zou het middel erger maken dan de kwaal.
 *
 * Er zit een grendel op de uitkomst. Een factor boven de 1 zou betekenen dat je structureel
 * bóven je vraagprijs verkoopt, en onder de 0,85 dat je stelselmatig vijftien procent
 * zakt; allebei komt vaker door een verkeerd ingetikt bedrag dan door de markt.
 */
export async function haalVerkoopfactor(merk?: string): Promise<{ factor: number; eigen: boolean; aantal: number }> {
  try {
    const k = await haalKalibratie();
    if (merk) {
      const m = k.per_merk.find((x) => x.merk.toUpperCase() === merk.trim().toUpperCase());
      if (m) return { factor: Math.min(1, Math.max(0.85, m.factor)), eigen: true, aantal: m.aantal };
    }
    if (k.gebruikt_eigen_cijfer) {
      return {
        factor: Math.min(1, Math.max(0.85, k.gebruikte_factor)),
        eigen: true,
        aantal: k.aantal_verkopen,
      };
    }
    return { factor: STANDAARD_FACTOR, eigen: false, aantal: k.aantal_verkopen };
  } catch {
    return { factor: STANDAARD_FACTOR, eigen: false, aantal: 0 };
  }
}

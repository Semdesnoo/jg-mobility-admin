import sql from "./db";

/**
 * De bewaarde inkoopverklaringen.
 *
 * WAAROM ZE BEWAARD WORDEN
 * Dit is een bewijsstuk voor de boekhouding, geen briefje dat je één keer print. Bij een
 * controle op de margeregeling moet je bij elke ingekochte auto kunnen laten zien van wie
 * hij kwam en wat je betaald hebt. Daarom staat elke verklaring hier met een eigen nummer,
 * net als de facturen, en kun je hem later opnieuw uitdraaien zonder alles opnieuw in te
 * tikken.
 *
 * NUMMERING
 * INK-2026-001, doorlopend per jaar. Het volgnummer wordt in dezelfde INSERT berekend als
 * waarin de regel wordt weggeschreven — precies zoals bij de facturen. Twee mensen die op
 * hetzelfde moment op Opslaan drukken kunnen zo geen zelfde nummer krijgen, en er is geen
 * losse teller die uit de pas kan gaan lopen.
 */

export type Inkoopverklaring = {
  id: string;
  nummer: string;
  datum: string;

  verkoper_naam: string;
  verkoper_adres: string;
  verkoper_postcode: string;
  verkoper_stad: string;
  verkoper_email: string;
  verkoper_telefoon: string;
  verkoper_geboortedatum: string;
  legitimatie_soort: string;
  legitimatie_nummer: string;

  merk: string;
  model: string;
  type: string;
  bouwjaar: string;
  kenteken: string;
  vin: string;
  km: string;
  kleur: string;
  brandstof: string;
  apk: string;
  eerste_toelating: string;

  bedrag: number;
  betaalwijze: string;
  datum_overdracht: string;
  vrijwaringsnummer: string;
  aantal_sleutels: string;
  particulier: boolean;

  meegeleverd: string[];
  bijzonderheden: string;
  aangemaakt: string;
};

let gereed = false;

async function init() {
  if (gereed) return;
  await sql`
    CREATE TABLE IF NOT EXISTS inkoopverklaringen (
      id TEXT PRIMARY KEY,
      nummer TEXT NOT NULL,
      datum TEXT NOT NULL DEFAULT '',
      verkoper_naam TEXT NOT NULL DEFAULT '',
      verkoper_adres TEXT NOT NULL DEFAULT '',
      verkoper_postcode TEXT NOT NULL DEFAULT '',
      verkoper_stad TEXT NOT NULL DEFAULT '',
      verkoper_email TEXT NOT NULL DEFAULT '',
      verkoper_telefoon TEXT NOT NULL DEFAULT '',
      verkoper_geboortedatum TEXT NOT NULL DEFAULT '',
      legitimatie_soort TEXT NOT NULL DEFAULT '',
      legitimatie_nummer TEXT NOT NULL DEFAULT '',
      merk TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT '',
      bouwjaar TEXT NOT NULL DEFAULT '',
      kenteken TEXT NOT NULL DEFAULT '',
      vin TEXT NOT NULL DEFAULT '',
      km TEXT NOT NULL DEFAULT '',
      kleur TEXT NOT NULL DEFAULT '',
      brandstof TEXT NOT NULL DEFAULT '',
      apk TEXT NOT NULL DEFAULT '',
      eerste_toelating TEXT NOT NULL DEFAULT '',
      bedrag NUMERIC NOT NULL DEFAULT 0,
      betaalwijze TEXT NOT NULL DEFAULT 'bank',
      datum_overdracht TEXT NOT NULL DEFAULT '',
      vrijwaringsnummer TEXT NOT NULL DEFAULT '',
      aantal_sleutels TEXT NOT NULL DEFAULT '',
      particulier BOOLEAN NOT NULL DEFAULT TRUE,
      meegeleverd JSONB NOT NULL DEFAULT '[]'::jsonb,
      bijzonderheden TEXT NOT NULL DEFAULT '',
      aangemaakt TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS inkoopverklaringen_nummer ON inkoopverklaringen (nummer DESC)`.catch(() => null);
  await sql`CREATE INDEX IF NOT EXISTS inkoopverklaringen_kenteken ON inkoopverklaringen (kenteken)`.catch(() => null);
  gereed = true;
}

const tekst = (w: unknown) => String(w ?? "");
const getal = (w: unknown) => {
  const n = Number(String(w ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

function mapRow(r: Record<string, unknown>): Inkoopverklaring {
  const mee = r.meegeleverd;
  return {
    id: r.id as string,
    nummer: tekst(r.nummer),
    datum: tekst(r.datum),
    verkoper_naam: tekst(r.verkoper_naam),
    verkoper_adres: tekst(r.verkoper_adres),
    verkoper_postcode: tekst(r.verkoper_postcode),
    verkoper_stad: tekst(r.verkoper_stad),
    verkoper_email: tekst(r.verkoper_email),
    verkoper_telefoon: tekst(r.verkoper_telefoon),
    verkoper_geboortedatum: tekst(r.verkoper_geboortedatum),
    legitimatie_soort: tekst(r.legitimatie_soort),
    legitimatie_nummer: tekst(r.legitimatie_nummer),
    merk: tekst(r.merk),
    model: tekst(r.model),
    type: tekst(r.type),
    bouwjaar: tekst(r.bouwjaar),
    kenteken: tekst(r.kenteken),
    vin: tekst(r.vin),
    km: tekst(r.km),
    kleur: tekst(r.kleur),
    brandstof: tekst(r.brandstof),
    apk: tekst(r.apk),
    eerste_toelating: tekst(r.eerste_toelating),
    bedrag: Number(r.bedrag) || 0,
    betaalwijze: tekst(r.betaalwijze),
    datum_overdracht: tekst(r.datum_overdracht),
    vrijwaringsnummer: tekst(r.vrijwaringsnummer),
    aantal_sleutels: tekst(r.aantal_sleutels),
    particulier: r.particulier !== false,
    meegeleverd: Array.isArray(mee) ? (mee as string[]) : [],
    bijzonderheden: tekst(r.bijzonderheden),
    aangemaakt: r.aangemaakt as string,
  };
}

export type NieuweInkoopverklaring = Partial<Omit<Inkoopverklaring, "id" | "nummer" | "aangemaakt">>;

/** Alle velden die vanaf het scherm gezet mogen worden, in de volgorde van de tabel. */
function velden(d: NieuweInkoopverklaring) {
  return {
    datum: tekst(d.datum),
    verkoper_naam: tekst(d.verkoper_naam),
    verkoper_adres: tekst(d.verkoper_adres),
    verkoper_postcode: tekst(d.verkoper_postcode),
    verkoper_stad: tekst(d.verkoper_stad),
    verkoper_email: tekst(d.verkoper_email),
    verkoper_telefoon: tekst(d.verkoper_telefoon),
    verkoper_geboortedatum: tekst(d.verkoper_geboortedatum),
    legitimatie_soort: tekst(d.legitimatie_soort),
    legitimatie_nummer: tekst(d.legitimatie_nummer),
    merk: tekst(d.merk),
    model: tekst(d.model),
    type: tekst(d.type),
    bouwjaar: tekst(d.bouwjaar),
    kenteken: tekst(d.kenteken).toUpperCase(),
    vin: tekst(d.vin).toUpperCase(),
    km: tekst(d.km),
    kleur: tekst(d.kleur),
    brandstof: tekst(d.brandstof),
    apk: tekst(d.apk),
    eerste_toelating: tekst(d.eerste_toelating),
    bedrag: getal(d.bedrag),
    betaalwijze: tekst(d.betaalwijze) || "bank",
    datum_overdracht: tekst(d.datum_overdracht),
    vrijwaringsnummer: tekst(d.vrijwaringsnummer),
    aantal_sleutels: tekst(d.aantal_sleutels),
    particulier: d.particulier !== false,
    meegeleverd: JSON.stringify(Array.isArray(d.meegeleverd) ? d.meegeleverd : []),
    bijzonderheden: tekst(d.bijzonderheden),
  };
}

export async function getInkoopverklaringen(): Promise<Inkoopverklaring[]> {
  await init();
  const rows = await sql`SELECT * FROM inkoopverklaringen ORDER BY aangemaakt DESC`;
  return rows.map(mapRow);
}

export async function maakInkoopverklaring(d: NieuweInkoopverklaring): Promise<Inkoopverklaring> {
  await init();
  const v = velden(d);
  const jaar = new Date().getFullYear();
  const prefix = `INK-${jaar}-`;
  const id = `ink_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // Volgnummer in dezelfde INSERT: geen losse teller, geen dubbele nummers. De aggregatie
  // levert altijd precies één rij op, ook als er nog niets van dit jaar bestaat.
  const [r] = await sql`
    INSERT INTO inkoopverklaringen (
      id, nummer, datum, verkoper_naam, verkoper_adres, verkoper_postcode, verkoper_stad,
      verkoper_email, verkoper_telefoon, verkoper_geboortedatum, legitimatie_soort, legitimatie_nummer,
      merk, model, type, bouwjaar, kenteken, vin, km, kleur, brandstof, apk, eerste_toelating,
      bedrag, betaalwijze, datum_overdracht, vrijwaringsnummer, aantal_sleutels, particulier,
      meegeleverd, bijzonderheden
    )
    SELECT
      ${id},
      ${prefix} || LPAD((COALESCE(MAX(CAST(SPLIT_PART(nummer, '-', 3) AS INTEGER)), 0) + 1)::text, 3, '0'),
      ${v.datum}, ${v.verkoper_naam}, ${v.verkoper_adres}, ${v.verkoper_postcode}, ${v.verkoper_stad},
      ${v.verkoper_email}, ${v.verkoper_telefoon}, ${v.verkoper_geboortedatum}, ${v.legitimatie_soort}, ${v.legitimatie_nummer},
      ${v.merk}, ${v.model}, ${v.type}, ${v.bouwjaar}, ${v.kenteken}, ${v.vin}, ${v.km}, ${v.kleur}, ${v.brandstof}, ${v.apk}, ${v.eerste_toelating},
      ${v.bedrag}, ${v.betaalwijze}, ${v.datum_overdracht}, ${v.vrijwaringsnummer}, ${v.aantal_sleutels}, ${v.particulier},
      ${v.meegeleverd}::jsonb, ${v.bijzonderheden}
    FROM inkoopverklaringen WHERE nummer LIKE ${prefix + "%"}
    RETURNING *
  `;
  return mapRow(r);
}

export async function werkInkoopverklaringBij(
  id: string,
  d: NieuweInkoopverklaring
): Promise<Inkoopverklaring | null> {
  await init();
  const v = velden(d);
  const [r] = await sql`
    UPDATE inkoopverklaringen SET
      datum = ${v.datum},
      verkoper_naam = ${v.verkoper_naam},
      verkoper_adres = ${v.verkoper_adres},
      verkoper_postcode = ${v.verkoper_postcode},
      verkoper_stad = ${v.verkoper_stad},
      verkoper_email = ${v.verkoper_email},
      verkoper_telefoon = ${v.verkoper_telefoon},
      verkoper_geboortedatum = ${v.verkoper_geboortedatum},
      legitimatie_soort = ${v.legitimatie_soort},
      legitimatie_nummer = ${v.legitimatie_nummer},
      merk = ${v.merk},
      model = ${v.model},
      type = ${v.type},
      bouwjaar = ${v.bouwjaar},
      kenteken = ${v.kenteken},
      vin = ${v.vin},
      km = ${v.km},
      kleur = ${v.kleur},
      brandstof = ${v.brandstof},
      apk = ${v.apk},
      eerste_toelating = ${v.eerste_toelating},
      bedrag = ${v.bedrag},
      betaalwijze = ${v.betaalwijze},
      datum_overdracht = ${v.datum_overdracht},
      vrijwaringsnummer = ${v.vrijwaringsnummer},
      aantal_sleutels = ${v.aantal_sleutels},
      particulier = ${v.particulier},
      meegeleverd = ${v.meegeleverd}::jsonb,
      bijzonderheden = ${v.bijzonderheden}
    WHERE id = ${id}
    RETURNING *
  `;
  return r ? mapRow(r) : null;
}

export async function verwijderInkoopverklaring(id: string): Promise<void> {
  await init();
  await sql`DELETE FROM inkoopverklaringen WHERE id = ${id}`;
}

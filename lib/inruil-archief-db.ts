import sql from "./db";

/**
 * Het inruilarchief: wat er op een moment over tafel ging.
 *
 * WAAROM EEN EIGEN TABEL
 * Een inkoopdossier is een lopend traject dat verandert tot de auto binnen is; dit is een
 * logboek van een gesprek en verandert niet meer. Dat zijn twee verschillende dingen, en
 * ze door elkaar zetten maakt allebei de lijsten onbruikbaar: je zou nooit meer kunnen
 * zien wat je die dinsdag ook alweer geboden had, want dat bedrag was allang overschreven
 * door de prijs waarop je uiteindelijk uitkwam.
 *
 * WAT ERIN GAAT
 * Alle bedragen los in kolommen — zo is er later op te zoeken en mee te rekenen zonder
 * JSON open te breken — plus in `gegevens` de rest die je nodig hebt om de berekening
 * precies zo terug te zetten als hij was: de RDW-gegevens, de taxatie, de uitvoering en
 * de kostenposten.
 *
 * De vraagprijs van onze auto wordt ook in euro's bewaard en niet alleen als verwijzing
 * naar de auto. Verkoop je hem later voor minder, dan hoort in het archief nog steeds te
 * staan wat je die dag hebt voorgerekend.
 */

export type InruilArchiefRij = {
  id: string;
  /** Naam of telefoonnummer van de klant, zoals ingetikt. Mag leeg zijn. */
  klant: string;
  kenteken: string;
  merk: string;
  model: string;
  bouwjaar: number;
  km: number;
  /** Onze auto uit de voorraad. Null als er een los bedrag is ingevuld. */
  auto_id: number | null;
  auto_naam: string;
  vraagprijs: number;
  korting: number;
  /** Wat zijn auto naar verwachting opbrengt. */
  verkoopwaarde: number;
  /** Wat wij voor zijn auto gaven. */
  bod: number;
  /** Positief: de klant betaalt bij. Negatief: wij betalen hem uit. */
  verschil: number;
  /** Wat er aan zijn auto overbleef, ná btw en klaarmaakkosten. */
  netto_marge: number;
  /** De gewenste marge in procenten waarmee gerekend is. */
  marge: number;
  kosten: number;
  btw_type: string;
  /** Wat de klant maximaal wilde bijbetalen. 0 als het niet ter sprake kwam. */
  max_bijbetaling: number;
  /** Waar de verkoopwaarde vandaan kwam: koerslijst, advertenties, of met de hand. */
  bron: string;
  /** RDW-gegevens, taxatie, uitvoering en kostenposten — genoeg om het terug te zetten. */
  gegevens: unknown;
  jaar: number;
  kwartaal: number;
  aangemaakt: string;
};

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS inruil_archief (
      id TEXT PRIMARY KEY,
      klant TEXT NOT NULL DEFAULT '',
      kenteken TEXT NOT NULL DEFAULT '',
      merk TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      bouwjaar INTEGER NOT NULL DEFAULT 0,
      km INTEGER NOT NULL DEFAULT 0,
      auto_id INTEGER,
      auto_naam TEXT NOT NULL DEFAULT '',
      vraagprijs NUMERIC NOT NULL DEFAULT 0,
      korting NUMERIC NOT NULL DEFAULT 0,
      verkoopwaarde NUMERIC NOT NULL DEFAULT 0,
      bod NUMERIC NOT NULL DEFAULT 0,
      verschil NUMERIC NOT NULL DEFAULT 0,
      netto_marge NUMERIC NOT NULL DEFAULT 0,
      marge NUMERIC NOT NULL DEFAULT 0,
      kosten NUMERIC NOT NULL DEFAULT 0,
      btw_type TEXT NOT NULL DEFAULT 'marge',
      max_bijbetaling NUMERIC NOT NULL DEFAULT 0,
      bron TEXT NOT NULL DEFAULT '',
      gegevens JSONB NOT NULL DEFAULT '{}'::jsonb,
      jaar INTEGER NOT NULL,
      kwartaal INTEGER NOT NULL,
      aangemaakt TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Terugkijken gaat per periode; zoeken gaat op kenteken.
  await sql`CREATE INDEX IF NOT EXISTS inruil_archief_kwartaal ON inruil_archief (jaar DESC, kwartaal DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS inruil_archief_kenteken ON inruil_archief (kenteken)`;
}

function mapRow(r: Record<string, unknown>): InruilArchiefRij {
  return {
    id: r.id as string,
    klant: (r.klant as string) ?? "",
    kenteken: (r.kenteken as string) ?? "",
    merk: (r.merk as string) ?? "",
    model: (r.model as string) ?? "",
    bouwjaar: Number(r.bouwjaar) || 0,
    km: Number(r.km) || 0,
    auto_id: r.auto_id == null ? null : Number(r.auto_id),
    auto_naam: (r.auto_naam as string) ?? "",
    vraagprijs: Number(r.vraagprijs) || 0,
    korting: Number(r.korting) || 0,
    verkoopwaarde: Number(r.verkoopwaarde) || 0,
    bod: Number(r.bod) || 0,
    verschil: Number(r.verschil) || 0,
    netto_marge: Number(r.netto_marge) || 0,
    marge: Number(r.marge) || 0,
    kosten: Number(r.kosten) || 0,
    btw_type: (r.btw_type as string) ?? "marge",
    max_bijbetaling: Number(r.max_bijbetaling) || 0,
    bron: (r.bron as string) ?? "",
    gegevens: r.gegevens ?? {},
    jaar: Number(r.jaar) || 0,
    kwartaal: Number(r.kwartaal) || 0,
    aangemaakt: r.aangemaakt as string,
  };
}

export type NieuweInruil = {
  klant?: string;
  kenteken?: string;
  merk?: string;
  model?: string;
  bouwjaar?: number;
  km?: number;
  auto_id?: number | null;
  auto_naam?: string;
  vraagprijs?: number;
  korting?: number;
  verkoopwaarde?: number;
  bod?: number;
  verschil?: number;
  netto_marge?: number;
  marge?: number;
  kosten?: number;
  btw_type?: string;
  max_bijbetaling?: number;
  bron?: string;
  gegevens?: unknown;
};

const geheel = (v: unknown) => Math.round(Number(v) || 0);

export async function bewaarInruil(data: NieuweInruil): Promise<InruilArchiefRij> {
  await init();
  const nu = new Date();
  const jaar = nu.getFullYear();
  const kwartaal = Math.floor(nu.getMonth() / 3) + 1;
  const id = `inr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const [r] = await sql`
    INSERT INTO inruil_archief (
      id, klant, kenteken, merk, model, bouwjaar, km,
      auto_id, auto_naam, vraagprijs, korting,
      verkoopwaarde, bod, verschil, netto_marge,
      marge, kosten, btw_type, max_bijbetaling, bron, gegevens, jaar, kwartaal
    ) VALUES (
      ${id}, ${data.klant ?? ""}, ${(data.kenteken ?? "").toUpperCase()}, ${data.merk ?? ""},
      ${data.model ?? ""}, ${geheel(data.bouwjaar)}, ${geheel(data.km)},
      ${data.auto_id ?? null}, ${data.auto_naam ?? ""}, ${geheel(data.vraagprijs)}, ${geheel(data.korting)},
      ${geheel(data.verkoopwaarde)}, ${geheel(data.bod)}, ${geheel(data.verschil)}, ${geheel(data.netto_marge)},
      ${geheel(data.marge)}, ${geheel(data.kosten)}, ${data.btw_type === "btw" ? "btw" : "marge"},
      ${geheel(data.max_bijbetaling)}, ${data.bron ?? ""},
      ${JSON.stringify(data.gegevens ?? {})}, ${jaar}, ${kwartaal}
    ) RETURNING *
  `;
  return mapRow(r);
}

export async function getInruilArchief(): Promise<InruilArchiefRij[]> {
  await init();
  const rows = await sql`SELECT * FROM inruil_archief ORDER BY aangemaakt DESC`;
  return rows.map(mapRow);
}

export async function deleteInruil(id: string): Promise<void> {
  await init();
  await sql`DELETE FROM inruil_archief WHERE id = ${id}`;
}

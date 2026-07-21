import sql from "./db";

/**
 * Eigen archief voor markt-analyses (taxaties). Elke keer dat de taxatietool een
 * marktanalyse doet, wordt de volledige uitslag hier bewaard — mét het kwartaal
 * waarin het gebeurde — zodat je altijd terug kunt naar wat de analyse toen gaf.
 * Bewust een aparte tabel: dossiers zijn lopende inkooptrajecten, dit is een
 * onveranderlijk logboek van wat de tool op een moment adviseerde.
 */

export type TaxatieArchiefRij = {
  id: string;
  kenteken: string;
  merk: string;
  model: string;
  bouwjaar: number;
  km: number;
  marge: number;
  kosten: number;
  max_inkoop: number;
  verwachte_verkoop: number;
  betrouwbaarheid: string;
  /** De volledige TaxatieResultaat (markt + berekening) als JSON. */
  resultaat: unknown;
  jaar: number;
  kwartaal: number;
  aangemaakt: string;
};

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS taxatie_archief (
      id TEXT PRIMARY KEY,
      kenteken TEXT NOT NULL DEFAULT '',
      merk TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      bouwjaar INTEGER NOT NULL DEFAULT 0,
      km INTEGER NOT NULL DEFAULT 0,
      marge NUMERIC NOT NULL DEFAULT 0,
      kosten NUMERIC NOT NULL DEFAULT 0,
      max_inkoop NUMERIC NOT NULL DEFAULT 0,
      verwachte_verkoop NUMERIC NOT NULL DEFAULT 0,
      betrouwbaarheid TEXT NOT NULL DEFAULT '',
      resultaat JSONB NOT NULL DEFAULT '{}'::jsonb,
      jaar INTEGER NOT NULL,
      kwartaal INTEGER NOT NULL,
      aangemaakt TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Op kwartaal filteren/sorteren is de kernhandeling van dit archief.
  await sql`CREATE INDEX IF NOT EXISTS taxatie_archief_kwartaal ON taxatie_archief (jaar DESC, kwartaal DESC)`;
}

function mapRow(r: Record<string, unknown>): TaxatieArchiefRij {
  return {
    id: r.id as string,
    kenteken: (r.kenteken as string) ?? "",
    merk: (r.merk as string) ?? "",
    model: (r.model as string) ?? "",
    bouwjaar: Number(r.bouwjaar) || 0,
    km: Number(r.km) || 0,
    marge: Number(r.marge) || 0,
    kosten: Number(r.kosten) || 0,
    max_inkoop: Number(r.max_inkoop) || 0,
    verwachte_verkoop: Number(r.verwachte_verkoop) || 0,
    betrouwbaarheid: (r.betrouwbaarheid as string) ?? "",
    resultaat: r.resultaat ?? {},
    jaar: Number(r.jaar) || 0,
    kwartaal: Number(r.kwartaal) || 0,
    aangemaakt: r.aangemaakt as string,
  };
}

export type NieuweTaxatie = {
  kenteken?: string;
  merk?: string;
  model?: string;
  bouwjaar?: number;
  km?: number;
  marge?: number;
  kosten?: number;
  max_inkoop?: number;
  verwachte_verkoop?: number;
  betrouwbaarheid?: string;
  resultaat?: unknown;
};

export async function bewaarTaxatie(data: NieuweTaxatie): Promise<TaxatieArchiefRij> {
  await init();
  const nu = new Date();
  const jaar = nu.getFullYear();
  const kwartaal = Math.floor(nu.getMonth() / 3) + 1;
  const id = `tax_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const [r] = await sql`
    INSERT INTO taxatie_archief (
      id, kenteken, merk, model, bouwjaar, km, marge, kosten,
      max_inkoop, verwachte_verkoop, betrouwbaarheid, resultaat, jaar, kwartaal
    ) VALUES (
      ${id}, ${data.kenteken ?? ""}, ${data.merk ?? ""}, ${data.model ?? ""},
      ${data.bouwjaar ?? 0}, ${data.km ?? 0}, ${data.marge ?? 0}, ${data.kosten ?? 0},
      ${data.max_inkoop ?? 0}, ${data.verwachte_verkoop ?? 0}, ${data.betrouwbaarheid ?? ""},
      ${JSON.stringify(data.resultaat ?? {})}, ${jaar}, ${kwartaal}
    ) RETURNING *
  `;
  return mapRow(r);
}

export async function getTaxatieArchief(): Promise<TaxatieArchiefRij[]> {
  await init();
  const rows = await sql`SELECT * FROM taxatie_archief ORDER BY aangemaakt DESC`;
  return rows.map(mapRow);
}

export async function deleteTaxatie(id: string): Promise<void> {
  await init();
  await sql`DELETE FROM taxatie_archief WHERE id = ${id}`;
}

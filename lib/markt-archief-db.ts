import sql from "./db";

/**
 * Archief voor de brede marktanalyses (het tabblad "Marktoverzicht"): marktpuls
 * en gerichte zoekopdrachten. Net als het taxatie-archief per kwartaal bewaard,
 * zodat je altijd terug kunt naar het marktbeeld van dat moment.
 */

export type MarktArchiefRij = {
  id: string;
  type: string; // "puls" | "zoek"
  zoekterm: string;
  samenvatting: string;
  markt_temperatuur: number;
  /** De volledige MarktOverzicht als JSON. */
  resultaat: unknown;
  jaar: number;
  kwartaal: number;
  aangemaakt: string;
};

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS markt_archief (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'puls',
      zoekterm TEXT NOT NULL DEFAULT '',
      samenvatting TEXT NOT NULL DEFAULT '',
      markt_temperatuur NUMERIC NOT NULL DEFAULT 0,
      resultaat JSONB NOT NULL DEFAULT '{}'::jsonb,
      jaar INTEGER NOT NULL,
      kwartaal INTEGER NOT NULL,
      aangemaakt TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS markt_archief_kwartaal ON markt_archief (jaar DESC, kwartaal DESC)`;
}

function mapRow(r: Record<string, unknown>): MarktArchiefRij {
  return {
    id: r.id as string,
    type: (r.type as string) ?? "puls",
    zoekterm: (r.zoekterm as string) ?? "",
    samenvatting: (r.samenvatting as string) ?? "",
    markt_temperatuur: Number(r.markt_temperatuur) || 0,
    resultaat: r.resultaat ?? {},
    jaar: Number(r.jaar) || 0,
    kwartaal: Number(r.kwartaal) || 0,
    aangemaakt: r.aangemaakt as string,
  };
}

export type NieuweMarktAnalyse = {
  type?: string;
  zoekterm?: string;
  samenvatting?: string;
  markt_temperatuur?: number;
  resultaat?: unknown;
};

export async function bewaarMarktAnalyse(data: NieuweMarktAnalyse): Promise<MarktArchiefRij> {
  await init();
  const nu = new Date();
  const jaar = nu.getFullYear();
  const kwartaal = Math.floor(nu.getMonth() / 3) + 1;
  const id = `mkt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const [r] = await sql`
    INSERT INTO markt_archief (id, type, zoekterm, samenvatting, markt_temperatuur, resultaat, jaar, kwartaal)
    VALUES (
      ${id}, ${data.type ?? "puls"}, ${data.zoekterm ?? ""}, ${data.samenvatting ?? ""},
      ${data.markt_temperatuur ?? 0}, ${JSON.stringify(data.resultaat ?? {})}, ${jaar}, ${kwartaal}
    ) RETURNING *
  `;
  return mapRow(r);
}

export async function getMarktArchief(): Promise<MarktArchiefRij[]> {
  await init();
  const rows = await sql`SELECT * FROM markt_archief ORDER BY aangemaakt DESC`;
  return rows.map(mapRow);
}

export async function deleteMarktAnalyse(id: string): Promise<void> {
  await init();
  await sql`DELETE FROM markt_archief WHERE id = ${id}`;
}

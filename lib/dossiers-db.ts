import sql from "./db";

export type KostenRegel = { label: string; bedrag: string };

export type Dossier = {
  id: number;
  auto_naam: string;
  inkoop: number;
  btw_type: "marge" | "21";
  verkoopprijs: number;
  kosten: KostenRegel[];
  aangemaakt: string;
};

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS marge_dossiers (
      id SERIAL PRIMARY KEY,
      auto_naam TEXT NOT NULL DEFAULT '',
      inkoop NUMERIC NOT NULL DEFAULT 0,
      btw_type TEXT NOT NULL DEFAULT 'marge',
      verkoopprijs NUMERIC NOT NULL DEFAULT 0,
      kosten JSONB NOT NULL DEFAULT '[]',
      aangemaakt TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function mapRow(r: Record<string, unknown>): Dossier {
  return {
    id: r.id as number,
    auto_naam: r.auto_naam as string,
    inkoop: Number(r.inkoop),
    btw_type: r.btw_type as "marge" | "21",
    verkoopprijs: Number(r.verkoopprijs),
    kosten: Array.isArray(r.kosten) ? (r.kosten as KostenRegel[]) : [],
    aangemaakt: r.aangemaakt as string,
  };
}

export async function getDossiers(): Promise<Dossier[]> {
  await init();
  const rows = await sql`SELECT * FROM marge_dossiers ORDER BY aangemaakt DESC`;
  return rows.map(mapRow);
}

export async function createDossier(auto_naam: string, verkoopprijs = 0): Promise<Dossier> {
  await init();
  const [r] = await sql`
    INSERT INTO marge_dossiers (auto_naam, verkoopprijs) VALUES (${auto_naam}, ${verkoopprijs}) RETURNING *
  `;
  return mapRow(r);
}

export async function updateDossier(
  id: number,
  data: { auto_naam: string; inkoop: number; btw_type: string; verkoopprijs: number; kosten: KostenRegel[] }
): Promise<void> {
  await init();
  await sql`
    UPDATE marge_dossiers
    SET auto_naam = ${data.auto_naam},
        inkoop = ${data.inkoop},
        btw_type = ${data.btw_type},
        verkoopprijs = ${data.verkoopprijs},
        kosten = ${JSON.stringify(data.kosten)}
    WHERE id = ${id}
  `;
}

export async function deleteDossier(id: number): Promise<void> {
  await init();
  await sql`DELETE FROM marge_dossiers WHERE id = ${id}`;
}

import sql from "./db";

/** Een factuur die JG Mobility moet betalen (crediteur). */
export type InkoopFactuur = {
  id: string;
  leverancier: string;
  factuurnummer: string;
  datum: string;
  vervaldatum: string;
  /** Totaalbedrag inclusief BTW. */
  bedrag_incl: number;
  /** BTW-bedrag; bij margeregeling of een particuliere inkoop is dit 0. */
  btw_bedrag: number;
  btw_tarief: number;
  omschrijving: string;
  categorie: string;
  status: "open" | "betaald";
  betaald_op: string | null;
  /** Waar de bedragen vandaan komen: handmatig of door AI uitgelezen. */
  bron: "handmatig" | "ai" | "email";
  gmail_message_id: string | null;
  gmail_afzender: string;
  aangemaakt: string;
};

export const CATEGORIEEN = [
  "Auto-inkoop",
  "Onderhoud & reparatie",
  "Poets & detailing",
  "Transport",
  "Advertentie & marketing",
  "Kantoor & software",
  "Overig",
] as const;

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS inkoop_facturen (
      id TEXT PRIMARY KEY,
      leverancier TEXT NOT NULL DEFAULT '',
      factuurnummer TEXT NOT NULL DEFAULT '',
      datum TEXT NOT NULL DEFAULT '',
      vervaldatum TEXT NOT NULL DEFAULT '',
      bedrag_incl NUMERIC NOT NULL DEFAULT 0,
      btw_bedrag NUMERIC NOT NULL DEFAULT 0,
      btw_tarief NUMERIC NOT NULL DEFAULT 21,
      omschrijving TEXT NOT NULL DEFAULT '',
      categorie TEXT NOT NULL DEFAULT 'Overig',
      status TEXT NOT NULL DEFAULT 'open',
      betaald_op TEXT,
      bron TEXT NOT NULL DEFAULT 'handmatig',
      aangemaakt TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Herkomst uit de mailbox. De unieke index is de duplicaatbescherming: een
  // tweede scan over dezelfde mail voegt niets toe.
  await sql`ALTER TABLE inkoop_facturen ADD COLUMN IF NOT EXISTS gmail_message_id TEXT`;
  await sql`ALTER TABLE inkoop_facturen ADD COLUMN IF NOT EXISTS gmail_afzender TEXT DEFAULT ''`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS inkoop_facturen_gmail_uniek
    ON inkoop_facturen (gmail_message_id) WHERE gmail_message_id IS NOT NULL
  `;
}

/** Gmail-id's die we al hebben geïmporteerd — voorkomt dubbele boekingen. */
export async function bestaandeGmailIds(): Promise<Set<string>> {
  await init();
  const rows = await sql`SELECT gmail_message_id FROM inkoop_facturen WHERE gmail_message_id IS NOT NULL`;
  return new Set(rows.map((r) => r.gmail_message_id as string));
}

function mapRow(r: Record<string, unknown>): InkoopFactuur {
  return {
    id: r.id as string,
    leverancier: (r.leverancier as string) ?? "",
    factuurnummer: (r.factuurnummer as string) ?? "",
    datum: (r.datum as string) ?? "",
    vervaldatum: (r.vervaldatum as string) ?? "",
    bedrag_incl: Number(r.bedrag_incl) || 0,
    btw_bedrag: Number(r.btw_bedrag) || 0,
    btw_tarief: Number(r.btw_tarief) || 0,
    omschrijving: (r.omschrijving as string) ?? "",
    categorie: (r.categorie as string) ?? "Overig",
    status: (r.status as "open" | "betaald") ?? "open",
    betaald_op: (r.betaald_op as string) ?? null,
    bron: (r.bron as InkoopFactuur["bron"]) ?? "handmatig",
    gmail_message_id: (r.gmail_message_id as string) ?? null,
    gmail_afzender: (r.gmail_afzender as string) ?? "",
    aangemaakt: r.aangemaakt as string,
  };
}

export async function getInkoopFacturen(): Promise<InkoopFactuur[]> {
  await init();
  // Open bovenaan, daarbinnen de oudste vervaldatum eerst — dat is de volgorde
  // waarin je ze wilt betalen.
  const rows = await sql`
    SELECT * FROM inkoop_facturen
    ORDER BY (status = 'open') DESC, vervaldatum ASC NULLS LAST, aangemaakt DESC
  `;
  return rows.map(mapRow);
}

export async function createInkoopFactuur(data: Partial<InkoopFactuur>): Promise<InkoopFactuur> {
  await init();
  const id = `inko_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const [r] = await sql`
    INSERT INTO inkoop_facturen (
      id, leverancier, factuurnummer, datum, vervaldatum,
      bedrag_incl, btw_bedrag, btw_tarief, omschrijving, categorie, status, bron,
      gmail_message_id, gmail_afzender
    ) VALUES (
      ${id}, ${data.leverancier ?? ""}, ${data.factuurnummer ?? ""},
      ${data.datum ?? ""}, ${data.vervaldatum ?? ""},
      ${data.bedrag_incl ?? 0}, ${data.btw_bedrag ?? 0}, ${data.btw_tarief ?? 21},
      ${data.omschrijving ?? ""}, ${data.categorie ?? "Overig"},
      ${data.status ?? "open"}, ${data.bron ?? "handmatig"},
      ${data.gmail_message_id ?? null}, ${data.gmail_afzender ?? ""}
    ) ON CONFLICT DO NOTHING RETURNING *
  `;
  // Bij een duplicaat (zelfde gmail_message_id) geeft de INSERT niets terug.
  // Dan bestaat de factuur al — geef die terug in plaats van te crashen.
  if (!r) {
    const [bestaand] = await sql`
      SELECT * FROM inkoop_facturen WHERE gmail_message_id = ${data.gmail_message_id ?? null}
    `;
    if (!bestaand) throw new Error("Factuur kon niet worden opgeslagen.");
    return mapRow(bestaand);
  }
  return mapRow(r);
}

export async function updateInkoopFactuur(id: string, data: Partial<InkoopFactuur>): Promise<void> {
  await init();
  // Status en betaaldatum lopen samen op: "betaald" zonder datum is nutteloos
  // in een boekhouding, en "open" met een betaaldatum is tegenstrijdig.
  const betaaldOp =
    data.status === "betaald"
      ? (data.betaald_op ?? new Date().toISOString().slice(0, 10))
      : data.status === "open"
        ? null
        : (data.betaald_op ?? null);

  await sql`
    UPDATE inkoop_facturen SET
      leverancier   = COALESCE(${data.leverancier ?? null}, leverancier),
      factuurnummer = COALESCE(${data.factuurnummer ?? null}, factuurnummer),
      datum         = COALESCE(${data.datum ?? null}, datum),
      vervaldatum   = COALESCE(${data.vervaldatum ?? null}, vervaldatum),
      bedrag_incl   = COALESCE(${data.bedrag_incl ?? null}, bedrag_incl),
      btw_bedrag    = COALESCE(${data.btw_bedrag ?? null}, btw_bedrag),
      btw_tarief    = COALESCE(${data.btw_tarief ?? null}, btw_tarief),
      omschrijving  = COALESCE(${data.omschrijving ?? null}, omschrijving),
      categorie     = COALESCE(${data.categorie ?? null}, categorie),
      status        = COALESCE(${data.status ?? null}, status),
      -- Alleen aanraken als de status meeverandert; anders blijft de bestaande
      -- betaaldatum staan (een gewone veldwijziging mag hem niet wissen).
      betaald_op    = CASE
                        WHEN ${data.status ?? null}::text = 'betaald' THEN ${betaaldOp}
                        WHEN ${data.status ?? null}::text = 'open'    THEN NULL
                        ELSE betaald_op
                      END
    WHERE id = ${id}
  `;
}

export async function deleteInkoopFactuur(id: string): Promise<void> {
  await init();
  await sql`DELETE FROM inkoop_facturen WHERE id = ${id}`;
}

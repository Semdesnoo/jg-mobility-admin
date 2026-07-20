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
  /** Gekoppelde auto uit de voorraad. Null bij handmatig aangemaakte dossiers. */
  auto_id: number | null;
  /** Verkochte auto's verhuizen naar het archief i.p.v. te verdwijnen. */
  gearchiveerd: boolean;
  gearchiveerd_op: string | null;
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
  // Migraties voor bestaande installaties — deze kolommen kwamen later.
  await sql`ALTER TABLE marge_dossiers ADD COLUMN IF NOT EXISTS auto_id INTEGER`;
  await sql`ALTER TABLE marge_dossiers ADD COLUMN IF NOT EXISTS gearchiveerd BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE marge_dossiers ADD COLUMN IF NOT EXISTS gearchiveerd_op TIMESTAMPTZ`;
  // Eén dossier per auto: voorkomt dubbele mappen als save-car twee keer draait.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS marge_dossiers_auto_id_uniek ON marge_dossiers (auto_id) WHERE auto_id IS NOT NULL`;
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
    auto_id: r.auto_id == null ? null : Number(r.auto_id),
    gearchiveerd: Boolean(r.gearchiveerd),
    gearchiveerd_op: (r.gearchiveerd_op as string) ?? null,
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

/**
 * Houdt het calculatordossier in de pas met een auto uit de voorraad.
 *
 * - Auto op voorraad zonder dossier → er wordt er één aangemaakt, met de
 *   vraagprijs alvast als verkoopprijs zodat je alleen inkoop en kosten hoeft
 *   in te vullen.
 * - Auto verkocht → dossier naar het archief (niet weggegooid; de cijfers
 *   blijven nodig voor je marge-overzicht).
 * - Auto terug op voorraad → dossier komt weer uit het archief.
 *
 * Bewust tolerant: een fout hier mag het opslaan van een auto nooit blokkeren.
 */
export async function syncDossierMetAuto(auto: {
  id: number;
  merk: string;
  model: string;
  bouwjaar?: number;
  prijs: number;
  verkocht?: boolean;
}): Promise<void> {
  try {
    await init();
    const isVerkocht = Boolean(auto.verkocht);
    const naam = [`${auto.merk} ${auto.model}`.trim(), auto.bouwjaar ? `(${auto.bouwjaar})` : ""]
      .filter(Boolean)
      .join(" ");

    const [bestaand] = await sql`SELECT id, gearchiveerd FROM marge_dossiers WHERE auto_id = ${auto.id}`;

    if (!bestaand) {
      // Eerst kijken of er al een handmatig dossier voor deze auto bestaat.
      // Die adopteren we — daar staan inkoop en kosten al in, en een tweede
      // dossier ernaast zou de lijst vervuilen en de marges dubbel tellen.
      const [wees] = await sql`
        SELECT id FROM marge_dossiers
        WHERE auto_id IS NULL AND LOWER(TRIM(auto_naam)) = LOWER(TRIM(${naam}))
        ORDER BY aangemaakt ASC LIMIT 1
      `;
      if (wees) {
        await sql`
          UPDATE marge_dossiers
          SET auto_id = ${auto.id},
              gearchiveerd = ${isVerkocht},
              gearchiveerd_op = ${isVerkocht ? new Date().toISOString() : null}
          WHERE id = ${wees.id}
        `;
        return;
      }

      // Ook verkochte auto's krijgen een dossier — meteen gearchiveerd. Zonder
      // dat kun je de inkoopprijs van eerder verkochte auto's nooit meer
      // vastleggen, en dan klopt je marge-BTW en je resultaat niet.
      await sql`
        INSERT INTO marge_dossiers (auto_naam, verkoopprijs, auto_id, gearchiveerd, gearchiveerd_op)
        VALUES (${naam}, ${auto.prijs}, ${auto.id}, ${isVerkocht}, ${isVerkocht ? new Date().toISOString() : null})
        ON CONFLICT DO NOTHING
      `;
      return;
    }

    const nuGearchiveerd = Boolean(bestaand.gearchiveerd);

    // Naam meeveranderen als merk/model/bouwjaar zijn aangepast. De vraagprijs
    // loopt mee zolang de auto nog op voorraad staat: pas je de prijs aan in de
    // voorraad, dan klopt de calculator meteen.
    //
    // Bij een gearchiveerd (verkocht) dossier blijft de verkoopprijs staan —
    // daar hangen je marge, BTW-afdracht en resultatenrekening aan vast, en die
    // mogen niet achteraf verschuiven als iemand de prijs van de auto wijzigt.
    if (nuGearchiveerd) {
      await sql`UPDATE marge_dossiers SET auto_naam = ${naam} WHERE id = ${bestaand.id}`;
    } else {
      await sql`
        UPDATE marge_dossiers
        SET auto_naam = ${naam}, verkoopprijs = ${auto.prijs}
        WHERE id = ${bestaand.id}
      `;
    }

    if (isVerkocht && !nuGearchiveerd) {
      await sql`UPDATE marge_dossiers SET gearchiveerd = TRUE, gearchiveerd_op = NOW() WHERE id = ${bestaand.id}`;
    } else if (!isVerkocht && nuGearchiveerd) {
      await sql`UPDATE marge_dossiers SET gearchiveerd = FALSE, gearchiveerd_op = NULL WHERE id = ${bestaand.id}`;
    }
  } catch {
    /* koppeling is een extraatje — nooit het opslaan van de auto laten falen */
  }
}

import { neon } from "@neondatabase/serverless";

// Lazy database-client. De Neon client wordt pas aangemaakt bij het eerste
// SQL-statement, zodat `next build` op Vercel niet faalt als DATABASE_URL niet
// in de build-omgeving staat (Vercel injecteert env vars pas bij runtime).
//
// Tijdens de build probeert Next.js ook statische routes als /sitemap.xml te
// collecten. Als de import-keten van zo'n route via deze module loopt, werd de
// `neon()`-call eerder direct op module-load gedaan en crashte de build met
// "No database connection string was provided".
type Neon = ReturnType<typeof neon>;
let _sql: Neon | null = null;
function sql(): Neon {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is niet gezet. Voeg de Neon connection string toe aan " +
        "Vercel → Project → Settings → Environment Variables."
    );
  }
  _sql = neon(url);
  return _sql;
}

/**
 * Tagged-template handler die naar de lazy Neon client doorgeeft. Neon is zelf
 * een tagged-template-functie. We exposen dezelfde generieke signature zodat
 * aanroepen zoals `const autos = await sql<{data: Auto}>\`SELECT data FROM autos\``
 * getypeerd blijven zoals de Neon client zelf zou doen.
 */
interface SqlTag {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <T extends Record<string, any> = Record<string, any>>(
    strings: TemplateStringsArray,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...values: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<T[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transaction<T>(fn: (tx: any) => Promise<T>): Promise<T>;
  // Sommige plekken in het project gebruiken `sql.query(text, params)` voor
  // dynamische table/column-namen die niet in een tagged-template passen.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T extends Record<string, any> = Record<string, any>>(
    text: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params?: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<T[]>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const taggedFn = ((strings: TemplateStringsArray, ...values: unknown[]) => {
  const client = sql() as unknown as <T extends Record<string, unknown>>(
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<T[]>;
  return client(strings, ...values);
}) as unknown as <T extends Record<string, unknown>>(
  s: TemplateStringsArray,
  ...v: unknown[]
) => Promise<T[]>;

const handler = Object.assign(taggedFn, {
  transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const client = sql() as unknown as { transaction: <U>(f: (tx: unknown) => Promise<U>) => Promise<U> };
    return client.transaction(fn);
  },
  query<T extends Record<string, unknown>>(
    text: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const client = sql() as unknown as <T extends Record<string, unknown>>(
      text: string,
      params: unknown[]
    ) => Promise<T[]>;
    return client(text, params);
  },
}) as unknown as SqlTag;

export default handler;

export async function initDB() {
  // Gebruikt de lazy Neon client direct. Door de cast naar `any` aan de grens
  // accepteert TS de tagged-template-syntax zonder gedoe met Object.assign.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = sql() as any;
  await client`
    CREATE TABLE IF NOT EXISTS autos (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      data JSONB NOT NULL
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS bellog (
      id TEXT PRIMARY KEY,
      datum TEXT NOT NULL,
      tijd TEXT NOT NULL,
      nummer TEXT DEFAULT '',
      naam TEXT DEFAULT '',
      notitie TEXT DEFAULT '',
      terugbellen BOOLEAN DEFAULT false,
      afgehandeld BOOLEAN DEFAULT false
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS facturen (
      id TEXT PRIMARY KEY,
      factuur_nr TEXT NOT NULL,
      datum TEXT NOT NULL,
      vervaldatum TEXT DEFAULT '',
      klant_naam TEXT DEFAULT '',
      klant_adres TEXT DEFAULT '',
      klant_postcode TEXT DEFAULT '',
      klant_stad TEXT DEFAULT '',
      klant_email TEXT DEFAULT '',
      klant_telefoon TEXT DEFAULT '',
      auto_merk TEXT DEFAULT '',
      auto_model TEXT DEFAULT '',
      auto_bouwjaar TEXT DEFAULT '',
      auto_kenteken TEXT DEFAULT '',
      auto_km TEXT DEFAULT '',
      auto_kleur TEXT DEFAULT '',
      auto_vin TEXT DEFAULT '',
      verkoopprijs INTEGER DEFAULT 0,
      btw_type TEXT DEFAULT 'marge',
      betaalwijze TEXT DEFAULT 'bank',
      notitie TEXT DEFAULT '',
      status TEXT DEFAULT 'concept',
      regels TEXT DEFAULT '[]'
    )
  `;
  await client`ALTER TABLE facturen ADD COLUMN IF NOT EXISTS regels TEXT DEFAULT '[]'`.catch(() => null);
  // Houdt bij wanneer elke mail naar de klant is verstuurd (ISO-tijdstring, leeg = nog niet verstuurd)
  await client`ALTER TABLE facturen ADD COLUMN IF NOT EXISTS factuurmail_verstuurd_op TEXT DEFAULT ''`.catch(() => null);
  await client`ALTER TABLE facturen ADD COLUMN IF NOT EXISTS bedankmail_verstuurd_op TEXT DEFAULT ''`.catch(() => null);
  await client`ALTER TABLE facturen ADD COLUMN IF NOT EXISTS reviewmail_verstuurd_op TEXT DEFAULT ''`.catch(() => null);
  // Welke kwartaalpakketten (inkoopfacturen-zip) al gedownload zijn. Zo weet de
  // meldingenbel of een afgesloten kwartaal nog aandacht vraagt of al bij de
  // boekhouder ligt.
  await client`
    CREATE TABLE IF NOT EXISTS kwartaal_exports (
      sleutel TEXT PRIMARY KEY,
      gedownload_op TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.catch(() => null);
  await client`
    CREATE TABLE IF NOT EXISTS cosignaties (
      id TEXT PRIMARY KEY,
      datum TEXT NOT NULL,
      tijd TEXT NOT NULL,
      naam TEXT DEFAULT '',
      email TEXT DEFAULT '',
      telefoon TEXT DEFAULT '',
      merk TEXT DEFAULT '',
      model TEXT DEFAULT '',
      bouwjaar TEXT DEFAULT '',
      km TEXT DEFAULT '',
      vraagprijs TEXT DEFAULT '',
      opmerking TEXT DEFAULT '',
      aantal_fotos INTEGER DEFAULT 0,
      status TEXT DEFAULT 'nieuw',
      notitie TEXT DEFAULT ''
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS klanten (
      id TEXT PRIMARY KEY,
      naam TEXT DEFAULT '',
      email TEXT DEFAULT '',
      telefoon TEXT DEFAULT '',
      adres TEXT DEFAULT '',
      stad TEXT DEFAULT '',
      notitie TEXT DEFAULT '',
      aangemaakt TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS afspraken (
      id TEXT PRIMARY KEY,
      datum TEXT NOT NULL,
      tijd TEXT NOT NULL,
      type TEXT DEFAULT 'proefrit',
      klant_naam TEXT DEFAULT '',
      klant_telefoon TEXT DEFAULT '',
      klant_email TEXT DEFAULT '',
      auto_naam TEXT DEFAULT '',
      notitie TEXT DEFAULT '',
      status TEXT DEFAULT 'gepland',
      aangemaakt TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS inkoop_dossiers (
      id TEXT PRIMARY KEY,
      datum TEXT NOT NULL,
      merk TEXT DEFAULT '',
      model TEXT DEFAULT '',
      bouwjaar TEXT DEFAULT '',
      km TEXT DEFAULT '',
      kenteken TEXT DEFAULT '',
      kleur TEXT DEFAULT '',
      vin TEXT DEFAULT '',
      aanbod_prijs INTEGER DEFAULT 0,
      bod_prijs INTEGER DEFAULT 0,
      aankoopprijs INTEGER DEFAULT 0,
      naam TEXT DEFAULT '',
      telefoon TEXT DEFAULT '',
      email TEXT DEFAULT '',
      status TEXT DEFAULT 'nieuw',
      notitie TEXT DEFAULT '',
      aangemaakt TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      naam TEXT DEFAULT '',
      telefoon TEXT DEFAULT '',
      email TEXT DEFAULT '',
      bron TEXT DEFAULT 'website',
      interesse TEXT DEFAULT '',
      budget TEXT DEFAULT '',
      notitie TEXT DEFAULT '',
      status TEXT DEFAULT 'nieuw',
      aangemaakt TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Archief van gegenereerde social-teksten. De invoer_hash dekt alle autovelden
  // die de tekst beïnvloeden plus de extra aanwijzing: verandert er niets, dan
  // komt de tekst uit dit archief in plaats van opnieuw bij het model.
  await client`
    CREATE TABLE IF NOT EXISTS social_teksten (
      id TEXT PRIMARY KEY,
      auto_id INTEGER,
      auto_naam TEXT DEFAULT '',
      invoer_hash TEXT NOT NULL,
      extra TEXT DEFAULT '',
      intro TEXT DEFAULT '',
      advertentie TEXT DEFAULT '',
      instagram TEXT DEFAULT '',
      hashtags TEXT DEFAULT '',
      model TEXT DEFAULT '',
      tokens_in INTEGER DEFAULT 0,
      tokens_uit INTEGER DEFAULT 0,
      aangemaakt TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await client`CREATE INDEX IF NOT EXISTS social_teksten_hash_idx ON social_teksten (invoer_hash, aangemaakt DESC)`.catch(() => null);
  await client`CREATE INDEX IF NOT EXISTS social_teksten_auto_idx ON social_teksten (auto_id, aangemaakt DESC)`.catch(() => null);
  await client`
    CREATE TABLE IF NOT EXISTS auto_kosten (
      id TEXT PRIMARY KEY,
      auto_id INTEGER NOT NULL,
      omschrijving TEXT DEFAULT '',
      bedrag INTEGER DEFAULT 0,
      datum TEXT DEFAULT '',
      aangemaakt TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Backfill standtijd-startdatum voor bestaande auto's: vanaf nu wordt de showroom-tijd
  // bijgehouden. Eenmalig + idempotent (alleen waar het veld nog ontbreekt).
  await client`
    UPDATE autos
    SET data = jsonb_set(data, '{toegevoegd_op}', to_jsonb(now()::text), true)
    WHERE NOT (data ? 'toegevoegd_op')
  `.catch(() => null);
}

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export default sql;

export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS autos (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      data JSONB NOT NULL
    )
  `;
  await sql`
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
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;
  await sql`
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
  await sql`ALTER TABLE facturen ADD COLUMN IF NOT EXISTS regels TEXT DEFAULT '[]'`.catch(() => null);
  // Houdt bij wanneer elke mail naar de klant is verstuurd (ISO-tijdstring, leeg = nog niet verstuurd)
  await sql`ALTER TABLE facturen ADD COLUMN IF NOT EXISTS factuurmail_verstuurd_op TEXT DEFAULT ''`.catch(() => null);
  await sql`ALTER TABLE facturen ADD COLUMN IF NOT EXISTS bedankmail_verstuurd_op TEXT DEFAULT ''`.catch(() => null);
  await sql`
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
  await sql`
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
  await sql`
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
  await sql`
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
  await sql`
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
  await sql`
    CREATE TABLE IF NOT EXISTS auto_kosten (
      id TEXT PRIMARY KEY,
      auto_id INTEGER NOT NULL,
      omschrijving TEXT DEFAULT '',
      bedrag INTEGER DEFAULT 0,
      datum TEXT DEFAULT '',
      aangemaakt TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

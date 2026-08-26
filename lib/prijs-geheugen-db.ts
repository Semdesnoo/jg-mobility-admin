import sql from "./db";

/**
 * Het prijsgeheugen: wat een auto in het echt heeft gedaan.
 *
 * WAAROM DIT ER MOET ZIJN
 * De taxatietool zegt wat een auto zou moeten opbrengen. Wat hij écht opbracht wist het
 * dashboard tot nu toe niet, en daardoor kon de tool nooit beter worden dan de dag dat
 * hij gebouwd is.
 *
 * Twee getallen gingen namelijk verloren:
 *
 *  1. DE VRAAGPRIJS DIE VERANDERT. In de voorraad staat één veld `prijs`. Zak je van
 *     € 21.950 naar € 20.950, dan wordt dat veld overschreven en is nergens meer te zien
 *     dat je gezakt bent — laat staan hoeveel en na hoeveel dagen. Precies dat is de
 *     interessantste informatie die een handelaar heeft.
 *
 *  2. WAARVOOR HIJ WEGGING. "Verkocht" was een vinkje. Voor welk bedrag stond alleen op
 *     de factuur, en alleen als er een factuur was gemaakt.
 *
 * Alles wat hier bij komt zijn dus die twee. De rest — het advies van de tool, wat je
 * werkelijk hebt ingekocht, wat je voor een inruilauto gaf — staat al ergens in dit
 * dashboard en wordt op kenteken gekoppeld in lib/kalibratie.ts. Dat bewust niet
 * overschrijven naar hier: twee kopieën van hetzelfde bedrag lopen vroeg of laat uit
 * elkaar, en dan weet je niet meer welke de echte was.
 */

export type PrijsSoort = "vraagprijs" | "verkocht";

export type PrijsPunt = {
  id: number;
  auto_id: number;
  kenteken: string;
  soort: PrijsSoort;
  bedrag: number;
  /** Waar dit vandaan kwam: "voorraad", "factuur", "handmatig". */
  bron: string;
  moment: string;
};

let gereed = false;

async function init() {
  if (gereed) return;
  await sql`
    CREATE TABLE IF NOT EXISTS prijs_historie (
      id SERIAL PRIMARY KEY,
      auto_id INTEGER NOT NULL,
      kenteken TEXT NOT NULL DEFAULT '',
      soort TEXT NOT NULL,
      bedrag NUMERIC NOT NULL DEFAULT 0,
      bron TEXT NOT NULL DEFAULT '',
      moment TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS prijs_historie_auto ON prijs_historie (auto_id, moment)`;
  // Van "verkocht" hoort er precies één per auto te zijn. Zonder deze regel zou elke keer
  // dat je de status opnieuw zet er een verkoopprijs bij komen, en telt dezelfde verkoop
  // straks drie keer mee in de ijking.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS prijs_historie_verkocht_uniek
    ON prijs_historie (auto_id) WHERE soort = 'verkocht'
  `.catch(() => null);
  gereed = true;
}

function mapRow(r: Record<string, unknown>): PrijsPunt {
  return {
    id: Number(r.id),
    auto_id: Number(r.auto_id),
    kenteken: (r.kenteken as string) ?? "",
    soort: (r.soort as PrijsSoort) ?? "vraagprijs",
    bedrag: Number(r.bedrag) || 0,
    bron: (r.bron as string) ?? "",
    moment: r.moment as string,
  };
}

/**
 * Een nieuwe vraagprijs vastleggen.
 *
 * Alleen als hij echt verandert: bij elk opslaan van een auto opnieuw hetzelfde bedrag
 * wegschrijven maakt van de geschiedenis een lijst van momenten waarop je op Opslaan hebt
 * gedrukt, en daar kun je niets uit aflezen.
 */
export async function noteerVraagprijs(auto: {
  id: number;
  kenteken?: string;
  prijs: number;
}, bron = "voorraad"): Promise<void> {
  if (!auto.id || !(auto.prijs > 0)) return;
  await init();
  const [laatste] = await sql`
    SELECT bedrag FROM prijs_historie
    WHERE auto_id = ${auto.id} AND soort = 'vraagprijs'
    ORDER BY moment DESC LIMIT 1
  `;
  if (laatste && Math.round(Number(laatste.bedrag)) === Math.round(auto.prijs)) return;
  await sql`
    INSERT INTO prijs_historie (auto_id, kenteken, soort, bedrag, bron)
    VALUES (${auto.id}, ${(auto.kenteken ?? "").toUpperCase()}, 'vraagprijs', ${Math.round(auto.prijs)}, ${bron})
  `;
}

/**
 * Vastleggen waarvoor de auto werkelijk is weggegaan.
 *
 * Eén per auto: een tweede melding overschrijft de eerste. Een factuur weegt zwaarder dan
 * een bedrag dat je snel bij het verkocht melden intikte, maar allebei zijn beter dan het
 * vinkje dat er eerst stond.
 */
export async function noteerVerkoopprijs(
  auto_id: number,
  bedrag: number,
  bron = "handmatig",
  kenteken = ""
): Promise<void> {
  if (!auto_id || !(bedrag > 0)) return;
  await init();
  await sql`
    INSERT INTO prijs_historie (auto_id, kenteken, soort, bedrag, bron)
    VALUES (${auto_id}, ${kenteken.toUpperCase()}, 'verkocht', ${Math.round(bedrag)}, ${bron})
    ON CONFLICT (auto_id) WHERE soort = 'verkocht'
    DO UPDATE SET bedrag = ${Math.round(bedrag)}, bron = ${bron}, moment = NOW()
  `;
}

/** Een verkoopprijs weghalen — als je hem verkeerd hebt ingetikt. */
export async function wisVerkoopprijs(auto_id: number): Promise<void> {
  await init();
  await sql`DELETE FROM prijs_historie WHERE auto_id = ${auto_id} AND soort = 'verkocht'`;
}

export async function getPrijsHistorie(): Promise<PrijsPunt[]> {
  await init();
  const rows = await sql`SELECT * FROM prijs_historie ORDER BY auto_id, moment ASC`;
  return rows.map(mapRow);
}

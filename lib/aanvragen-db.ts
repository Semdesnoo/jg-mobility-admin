import sql from "@/lib/db";

/**
 * Aanvragen: alles wat een klant of verkoper aan ons vraagt, op één plek.
 *
 * WAAROM DIT OP DE BESTAANDE `leads`-TABEL ZIT
 * Die tabel bestond al, met precies de velden die hiervoor nodig zijn — naam, telefoon,
 * e-mail, kanaal, waar het over gaat, notitie en een statuspijplijn. Er hing alleen geen
 * scherm aan: `LeadsContent.tsx` was volledig geschreven en werkend, maar stond in geen
 * enkel menu. Een tweede tabel ernaast bouwen zou betekenen dat dezelfde klant op twee
 * plekken kan staan, en dat is precies het overzicht kwijtraken waar dit tegen moet
 * beschermen.
 *
 * Wat er wél bij moest: waar de aanvraag vandaan kwam (welke mail), waar het over gaat in
 * één regel, een kenteken zodat je kunt doortaxeren, en het conceptantwoord.
 */

export type Aanvraag = {
  id: string;
  naam: string;
  telefoon: string;
  email: string;
  /** Waar het binnenkwam: mail, whatsapp, instagram, telefoon, balie, website, … */
  bron: string;
  /** Waar het over gaat, in één regel. */
  interesse: string;
  budget: string;
  notitie: string;
  status: string;
  aangemaakt: string;
  /** Uit welke Gmail-mail dit is overgenomen. Voorkomt dat dezelfde mail twee keer belandt. */
  gmail_message_id: string | null;
  /** De onderwerpregel van die mail, of een eigen kopje bij handmatige invoer. */
  onderwerp: string;
  /** Kenteken, als het over een concrete auto gaat. Hiermee kun je direct doortaxeren. */
  kenteken: string;
  /**
   * Welke auto uit de eigen voorraad het betreft.
   *
   * Op één auto reageren doorgaans meerdere mensen. Alleen op datum sorteren verspreidt
   * die reacties dan over een week aan dagen, en juist als je met een van hen belt wil je
   * in één oogopslag zien wie er verder nog achteraan staat en wat die boden.
   */
  auto_id: number | null;
  auto_naam: string;
  /** Wat deze persoon geboden heeft. Vrije tekst: "17.500" of "17.5 met inruil". */
  bod: string;
  /** Wat hij wil inruilen, in zijn eigen woorden. Leeg als hij niets inruilt. */
  inruil: string;
  /**
   * De auto uit ZIJN advertentie, en de link erheen.
   *
   * Dit is iets anders dan `auto_naam`: dat is een auto uit de eigen voorraad waar iemand
   * op reageert. Hier gaat het om de auto die hij zelf te koop heeft of wil inruilen. Zonder
   * de titel en de link moet je bij elk gesprek eerst terugzoeken waar het ook alweer over ging.
   */
  advertentie_titel: string;
  advertentie_url: string;
  /** Wat hij letterlijk schreef of zei. Zijn woorden, niet onze samenvatting. */
  bericht: string;
  /** Het antwoord dat klaarstaat. Je kunt het aanpassen voor je het verstuurt. */
  antwoord: string;
  antwoord_verstuurd_op: string | null;
  /** Afgehandeld: uit het dagoverzicht, maar niet weg. */
  afgehandeld_op: string | null;
};

/** Kanalen waarlangs een aanvraag binnenkomt. Volgorde = hoe vaak het voorkomt. */
export const KANALEN = [
  "mail",
  "whatsapp",
  "instagram",
  "telefoon",
  "balie",
  "website",
  "marktplaats",
  "autoscout",
  "overig",
] as const;

export const STATUSSEN = ["nieuw", "contact_gehad", "afspraak", "deal", "verloren"] as const;

let gereed = false;

/**
 * Kolommen bijzetten op de bestaande tabel. Elke ALTER is los en faalt stil: een tabel
 * die de kolom al heeft mag geen reden zijn dat de rest niet wordt aangemaakt.
 */
async function init(): Promise<void> {
  if (gereed) return;
  const kolommen = [
    "gmail_message_id TEXT",
    "onderwerp TEXT DEFAULT ''",
    "kenteken TEXT DEFAULT ''",
    "antwoord TEXT DEFAULT ''",
    "antwoord_verstuurd_op TIMESTAMPTZ",
    "afgehandeld_op TIMESTAMPTZ",
    "auto_id INTEGER",
    "auto_naam TEXT DEFAULT ''",
    "bod TEXT DEFAULT ''",
    "inruil TEXT DEFAULT ''",
    "advertentie_titel TEXT DEFAULT ''",
    "advertentie_url TEXT DEFAULT ''",
    "bericht TEXT DEFAULT ''",
  ];
  for (const k of kolommen) {
    await sql.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ${k}`).catch(() => null);
  }
  // Dezelfde mail mag niet twee keer in het overzicht komen. Partieel, want handmatige
  // aanvragen hebben geen message-id en die zijn er straks veel meer dan mails.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS leads_gmail_uniek
    ON leads (gmail_message_id) WHERE gmail_message_id IS NOT NULL
  `.catch(() => null);
  await sql`CREATE INDEX IF NOT EXISTS leads_aangemaakt ON leads (aangemaakt DESC)`.catch(() => null);
  // Voor het groeperen per auto: alle reacties op één auto bij elkaar.
  await sql`CREATE INDEX IF NOT EXISTS leads_auto ON leads (auto_id) WHERE auto_id IS NOT NULL`.catch(() => null);
  gereed = true;
}

function rij(r: Record<string, unknown>): Aanvraag {
  return {
    id: String(r.id),
    naam: (r.naam as string) ?? "",
    telefoon: (r.telefoon as string) ?? "",
    email: (r.email as string) ?? "",
    bron: (r.bron as string) ?? "overig",
    interesse: (r.interesse as string) ?? "",
    budget: (r.budget as string) ?? "",
    notitie: (r.notitie as string) ?? "",
    status: (r.status as string) ?? "nieuw",
    aangemaakt: String(r.aangemaakt ?? ""),
    gmail_message_id: (r.gmail_message_id as string) ?? null,
    onderwerp: (r.onderwerp as string) ?? "",
    kenteken: (r.kenteken as string) ?? "",
    auto_id: r.auto_id != null ? Number(r.auto_id) : null,
    auto_naam: (r.auto_naam as string) ?? "",
    bod: (r.bod as string) ?? "",
    inruil: (r.inruil as string) ?? "",
    advertentie_titel: (r.advertentie_titel as string) ?? "",
    advertentie_url: (r.advertentie_url as string) ?? "",
    bericht: (r.bericht as string) ?? "",
    antwoord: (r.antwoord as string) ?? "",
    antwoord_verstuurd_op: (r.antwoord_verstuurd_op as string) ?? null,
    afgehandeld_op: (r.afgehandeld_op as string) ?? null,
  };
}

/** Alles, nieuwste eerst. Het scherm groepeert zelf per dag. */
export async function alleAanvragen(): Promise<Aanvraag[]> {
  await init();
  const rijen = await sql`SELECT * FROM leads ORDER BY aangemaakt DESC LIMIT 500`;
  return rijen.map((r) => rij(r as Record<string, unknown>));
}

export async function eenAanvraag(id: string): Promise<Aanvraag | null> {
  await init();
  const rijen = await sql`SELECT * FROM leads WHERE id = ${id}`;
  return rijen[0] ? rij(rijen[0] as Record<string, unknown>) : null;
}

/** Staat deze mail al in het overzicht? Zo ja, welke aanvraag is het. */
export async function bijMessageId(messageId: string): Promise<Aanvraag | null> {
  await init();
  if (!messageId) return null;
  const rijen = await sql`SELECT * FROM leads WHERE gmail_message_id = ${messageId}`;
  return rijen[0] ? rij(rijen[0] as Record<string, unknown>) : null;
}

export type NieuweAanvraag = {
  naam?: string;
  telefoon?: string;
  email?: string;
  bron?: string;
  interesse?: string;
  budget?: string;
  notitie?: string;
  onderwerp?: string;
  kenteken?: string;
  gmailMessageId?: string;
  autoId?: number | null;
  autoNaam?: string;
  bod?: string;
  inruil?: string;
  advertentieTitel?: string;
  advertentieUrl?: string;
  bericht?: string;
};

/**
 * Nieuwe aanvraag. Komt hij uit een mail die er al staat, dan geeft dit de bestaande
 * terug in plaats van een tweede — twee keer op dezelfde knop drukken hoort niets te doen.
 */
export async function voegAanvraagToe(a: NieuweAanvraag): Promise<Aanvraag> {
  await init();
  if (a.gmailMessageId) {
    const bestaat = await bijMessageId(a.gmailMessageId);
    if (bestaat) return bestaat;
  }
  const id = `aan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const rijen = await sql`
    INSERT INTO leads (
      id, naam, telefoon, email, bron, interesse, budget, notitie,
      status, onderwerp, kenteken, gmail_message_id,
      auto_id, auto_naam, bod, inruil,
      advertentie_titel, advertentie_url, bericht
    ) VALUES (
      ${id}, ${a.naam ?? ""}, ${a.telefoon ?? ""}, ${a.email ?? ""},
      ${a.bron ?? "overig"}, ${a.interesse ?? ""}, ${a.budget ?? ""}, ${a.notitie ?? ""},
      'nieuw', ${a.onderwerp ?? ""}, ${(a.kenteken ?? "").toUpperCase()},
      ${a.gmailMessageId ?? null},
      ${a.autoId ?? null}, ${a.autoNaam ?? ""}, ${a.bod ?? ""}, ${a.inruil ?? ""},
      ${a.advertentieTitel ?? ""}, ${a.advertentieUrl ?? ""}, ${a.bericht ?? ""}
    )
    ON CONFLICT DO NOTHING
    RETURNING *
  `;
  // Botsing op de unieke index: een andere aanvraag was ons net voor.
  if (!rijen[0]) {
    const bestaand = a.gmailMessageId ? await bijMessageId(a.gmailMessageId) : null;
    if (bestaand) return bestaand;
    throw new Error("Aanvraag kon niet worden opgeslagen");
  }
  return rij(rijen[0] as Record<string, unknown>);
}

const TE_WIJZIGEN = [
  "naam", "telefoon", "email", "bron", "interesse", "budget",
  "notitie", "status", "onderwerp", "kenteken", "antwoord",
  "auto_naam", "bod", "inruil",
  "advertentie_titel", "advertentie_url", "bericht",
] as const;

export async function wijzigAanvraag(
  id: string,
  velden: Partial<Record<(typeof TE_WIJZIGEN)[number], string>>
): Promise<Aanvraag | null> {
  await init();
  for (const veld of TE_WIJZIGEN) {
    const w = velden[veld];
    if (w === undefined) continue;
    const waarde = veld === "kenteken" ? w.toUpperCase() : w;
    // De kolomnaam komt uit TE_WIJZIGEN en nooit uit het verzoek, dus hij kan niet
    // gestuurd worden; de waarde gaat wel als parameter mee.
    await sql.query(`UPDATE leads SET ${veld} = $1 WHERE id = $2`, [waarde, id]);
  }
  return eenAanvraag(id);
}

/** Afgehandeld of juist weer terug in het overzicht. */
export async function zetAfgehandeld(id: string, aan: boolean): Promise<Aanvraag | null> {
  await init();
  if (aan) await sql`UPDATE leads SET afgehandeld_op = NOW() WHERE id = ${id}`;
  else await sql`UPDATE leads SET afgehandeld_op = NULL WHERE id = ${id}`;
  return eenAanvraag(id);
}

export async function noteerAntwoordVerstuurd(id: string): Promise<void> {
  await init();
  await sql`UPDATE leads SET antwoord_verstuurd_op = NOW(), status = 'contact_gehad' WHERE id = ${id}`;
}

export async function verwijderAanvraag(id: string): Promise<void> {
  await init();
  await sql`DELETE FROM leads WHERE id = ${id}`;
}

/**
 * Alle reacties gegroepeerd per auto, drukste eerst.
 *
 * Dit is de tweede manier om naar dezelfde lijst te kijken. Per dag zie je wat er
 * binnenkwam; per auto zie je wie er allemaal achter dezelfde auto aan zitten, wat ze
 * boden en wat ze willen inruilen. Bel je er een, dan wil je dat rijtje ernaast hebben.
 */
export async function perAuto(): Promise<
  { autoId: number | null; naam: string; aanvragen: Aanvraag[] }[]
> {
  const alles = await alleAanvragen();
  const groepen = new Map<string, { autoId: number | null; naam: string; aanvragen: Aanvraag[] }>();
  for (const a of alles) {
    // Zonder auto-koppeling valt hij onder het kenteken, en anders onder wat er gevraagd
    // werd. Beter een groep van één dan een aanvraag die nergens te vinden is.
    const naam = a.auto_naam || a.kenteken || a.interesse || "Zonder auto";
    const sleutel = a.auto_id != null ? `id:${a.auto_id}` : `naam:${naam.toLowerCase()}`;
    const g = groepen.get(sleutel) ?? { autoId: a.auto_id, naam, aanvragen: [] };
    g.aanvragen.push(a);
    groepen.set(sleutel, g);
  }
  return [...groepen.values()].sort((x, y) => y.aanvragen.length - x.aanvragen.length);
}

/** Hoeveel mensen er op deze auto hebben gereageerd. Voor een teller bij de voorraad. */
export async function aantalPerAuto(): Promise<Map<number, number>> {
  await init();
  const rijen = await sql`
    SELECT auto_id, COUNT(*)::int AS n FROM leads
    WHERE auto_id IS NOT NULL GROUP BY auto_id
  `;
  return new Map(rijen.map((r) => [Number(r.auto_id), Number(r.n)]));
}

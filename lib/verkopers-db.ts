import sql from "./db";

/**
 * Verkopersradar — particuliere autoverkopers vinden en benaderen.
 *
 * Juridische kern (bepaalt het hele ontwerp):
 * Ongevraagde commerciële berichten naar particulieren mogen niet zomaar
 * (Telecommunicatiewet art. 11.7). De uitzondering die wij gebruiken: contactgegevens
 * die iemand ZELF openbaar heeft gemaakt mogen worden gebruikt voor het doel waarvoor
 * ze gepubliceerd zijn. Iemand die zijn auto te koop zet mét telefoonnummer nodigt uit
 * tot contact OVER DIE AUTO. Daarom:
 *
 *  1. elk bericht gaat over de specifiek geadverteerde auto (nooit een algemene mailing);
 *  2. wij openen met concrete interesse in de auto — het cosignatie-aanbod is het
 *     alternatief dat we erbij noemen, niet een losse reclameboodschap;
 *  3. een mens keurt elk bericht goed vóór verzending (geen automatische bulkverzending);
 *  4. alles wat verstuurd is wordt gelogd (AVG-verantwoordingsplicht);
 *  5. wie zich afmeldt komt op de blokkadelijst en wordt nooit opnieuw benaderd.
 */

export const TOEGESTANE_STATUS = [
  "nieuw",
  "goedgekeurd",
  "verstuurd",
  "gereageerd",
  "cosignatie",
  "afgewezen",
] as const;

export type VerkoperStatus = (typeof TOEGESTANE_STATUS)[number];

export type VerkoperLead = {
  id: string;
  // Advertentie
  bron: string;
  advertentie_url: string;
  titel: string;
  merk: string;
  model: string;
  bouwjaar: string;
  km: string;
  brandstof: string;
  vraagprijs: number;
  plaats: string;
  // Contactgegevens zoals openbaar op de advertentie. Bij particulieren zijn telefoon
  // en e-mail vrijwel altijd leeg — die zetten dat niet in hun advertentie.
  naam: string;
  telefoon: string;
  email: string;
  /** Link naar de profielpagina van de verkoper op het platform, als die er stond.
   *  Dit is de betrouwbaarste manier om dezelfde persoon bij een tweede advertentie
   *  te herkennen. Zie {@link verkoperSleutel}. */
  verkoper_profiel: string;
  // Beoordeling door de AI
  particulier_score: number;
  kans_score: number;
  motivatie: string;
  // Gegenereerd bericht
  onderwerp: string;
  bericht_mail: string;
  bericht_kort: string;
  // Werkstroom
  status: VerkoperStatus;
  verstuurd_op: string | null;
  verstuurd_via: string;
  notitie: string;
  zoekopdracht: string;
  gevonden_op: string;
};

/** Idempotent: draait bij elke route-aanroep, doet niets als alles al bestaat. */
export async function initVerkopersDB(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS verkoper_leads (
      id TEXT PRIMARY KEY,
      bron TEXT DEFAULT '',
      advertentie_url TEXT DEFAULT '',
      titel TEXT DEFAULT '',
      merk TEXT DEFAULT '',
      model TEXT DEFAULT '',
      bouwjaar TEXT DEFAULT '',
      km TEXT DEFAULT '',
      brandstof TEXT DEFAULT '',
      vraagprijs INTEGER DEFAULT 0,
      plaats TEXT DEFAULT '',
      naam TEXT DEFAULT '',
      telefoon TEXT DEFAULT '',
      email TEXT DEFAULT '',
      particulier_score INTEGER DEFAULT 0,
      kans_score INTEGER DEFAULT 0,
      motivatie TEXT DEFAULT '',
      onderwerp TEXT DEFAULT '',
      bericht_mail TEXT DEFAULT '',
      bericht_kort TEXT DEFAULT '',
      status TEXT DEFAULT 'nieuw',
      verstuurd_op TIMESTAMPTZ,
      verstuurd_via TEXT DEFAULT '',
      notitie TEXT DEFAULT '',
      zoekopdracht TEXT DEFAULT '',
      gevonden_op TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Eén lead per advertentie: een tweede zoekronde op hetzelfde segment mag geen
  // dubbele kaarten opleveren (en zeker geen tweede bericht aan dezelfde persoon).
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS verkoper_leads_url_idx
    ON verkoper_leads (advertentie_url) WHERE advertentie_url <> ''
  `.catch(() => null);
  await sql`CREATE INDEX IF NOT EXISTS verkoper_leads_status_idx ON verkoper_leads (status, gevonden_op DESC)`.catch(() => null);

  // Negeerlijst: advertenties die jij hebt weggegooid.
  //
  // Waarom apart van de blokkadelijst: die werkt op e-mailadres of telefoonnummer, en
  // particulieren zetten die niet in hun advertentie — er valt dus niets te blokkeren.
  // En waarom apart van de leads: als je een lead verwijdert verdwijnt ook de unieke
  // sleutel op de advertentie-URL, en dan komt dezelfde advertentie bij de volgende
  // zoekronde gewoon weer binnen. Dat kost je elke keer opnieuw tijd en tokens.
  await sql`
    CREATE TABLE IF NOT EXISTS verkoper_genegeerd (
      advertentie_url TEXT PRIMARY KEY,
      verkoper_sleutel TEXT DEFAULT '',
      reden TEXT DEFAULT '',
      aangemaakt TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS verkoper_genegeerd_sleutel_idx
    ON verkoper_genegeerd (verkoper_sleutel) WHERE verkoper_sleutel <> ''
  `.catch(() => null);

  // Blokkadelijst: e-mailadressen en telefoonnummers die we nooit (meer) benaderen.
  // Gevuld door afmeldingen, klachten, of handmatig door de gebruiker.
  await sql`
    CREATE TABLE IF NOT EXISTS verkoper_blokkade (
      waarde TEXT PRIMARY KEY,
      soort TEXT DEFAULT '',
      reden TEXT DEFAULT '',
      aangemaakt TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Verzendlog — los van de lead, zodat het bewaard blijft als de lead wordt verwijderd.
  // Dit is de AVG-verantwoording: wie is wanneer waarover benaderd.
  await sql`
    CREATE TABLE IF NOT EXISTS verkoper_contactlog (
      id TEXT PRIMARY KEY,
      lead_id TEXT DEFAULT '',
      kanaal TEXT DEFAULT '',
      ontvanger TEXT DEFAULT '',
      onderwerp TEXT DEFAULT '',
      inhoud TEXT DEFAULT '',
      advertentie_url TEXT DEFAULT '',
      verstuurd_op TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS verkoper_contactlog_lead_idx ON verkoper_contactlog (lead_id, verstuurd_op DESC)`.catch(() => null);

  // Genormaliseerde ontvanger: het e-mailadres in kleine letters, of het
  // telefoonnummer als kale landcode + cijfers. Dit is de sleutel waarmee we
  // vaststellen of we een PERSOON al eens hebben benaderd.
  //
  // De unieke index op advertentie_url beschermt tegen dezelfde advertentie, maar
  // niet tegen dezelfde verkoper met twee auto's te koop. Die krijgt anders twee
  // keer een bericht van ons — precies wat je nooit wilt.
  // Twee sleutels per regel — mail én telefoon — en niet twee regels, want dan zou
  // één verzending twee keer in het verzendlog verschijnen.
  await sql`ALTER TABLE verkoper_contactlog ADD COLUMN IF NOT EXISTS ontvanger_sleutel TEXT DEFAULT ''`;
  await sql`ALTER TABLE verkoper_contactlog ADD COLUMN IF NOT EXISTS ontvanger_sleutel2 TEXT DEFAULT ''`;
  // Derde sleutel: de verkoper zelf. E-mail en telefoon werken alleen bij handelaren
  // — particulieren zetten die niet in hun advertentie, en juist die willen we niet
  // twee keer benaderen. Deze sleutel is het profiel op het platform, of anders naam
  // plus woonplaats.
  await sql`ALTER TABLE verkoper_contactlog ADD COLUMN IF NOT EXISTS ontvanger_sleutel3 TEXT DEFAULT ''`;
  await sql`ALTER TABLE verkoper_leads ADD COLUMN IF NOT EXISTS verkoper_profiel TEXT DEFAULT ''`;
  await sql`
    CREATE INDEX IF NOT EXISTS verkoper_contactlog_sleutel3_idx
    ON verkoper_contactlog (ontvanger_sleutel3) WHERE ontvanger_sleutel3 <> ''
  `.catch(() => null);
  await sql`
    CREATE INDEX IF NOT EXISTS verkoper_contactlog_sleutel_idx
    ON verkoper_contactlog (ontvanger_sleutel) WHERE ontvanger_sleutel <> ''
  `.catch(() => null);
  await sql`
    CREATE INDEX IF NOT EXISTS verkoper_contactlog_sleutel2_idx
    ON verkoper_contactlog (ontvanger_sleutel2) WHERE ontvanger_sleutel2 <> ''
  `.catch(() => null);
  // Bestaande regels alsnog van een sleutel voorzien, anders zou alles wat vóór
  // deze wijziging is verstuurd niet meetellen in de dubbelcheck.
  await sql`
    UPDATE verkoper_contactlog
    SET ontvanger_sleutel = lower(trim(ontvanger))
    WHERE ontvanger_sleutel = '' AND ontvanger LIKE '%@%'
  `.catch(() => null);
}

/** Telefoonnummers vergelijkbaar maken: alleen cijfers, 06… wordt 316…. */
export function normaliseerTelefoon(nummer: string): string {
  const cijfers = (nummer || "").replace(/\D/g, "");
  if (!cijfers) return "";
  if (cijfers.startsWith("00")) return cijfers.slice(2);
  if (cijfers.startsWith("0")) return `31${cijfers.slice(1)}`;
  // "+31 06 22 52 47 01" — landnummer én de nul die daarbij hoort te vervallen. Komt
  // zo van AutoScout24; zonder deze regel valt zo'n nummer af als ongeldig terwijl het
  // gewoon klopt.
  if (/^310\d{9}$/.test(cijfers)) return `31${cijfers.slice(3)}`;
  return cijfers;
}

export function normaliseerEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

/**
 * Eén sleutel die deze verkoper aanwijst, ook zonder mailadres of telefoonnummer.
 *
 * Bij voorkeur zijn profielpagina op het platform — die is uniek en verandert niet.
 * Staat die er niet, dan naam plus woonplaats. Dat is grover: twee keer een Jan uit
 * Rotterdam wordt als dezelfde persoon gezien. Bewust die kant op: iemand ten
 * onrechte overslaan kost je een lead, iemand twee keer benaderen kost je je goede
 * naam. Bij alleen een voornaam zonder plaats geven we niets terug — dan is de kans
 * op verwarring te groot om er iets aan op te hangen.
 */
export function verkoperSleutel(profielUrl: string, naam: string, plaats: string): string {
  const profiel = (profielUrl || "").trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
  if (profiel.startsWith("http")) return profiel;

  const n = (naam || "").trim().toLowerCase().replace(/\s+/g, " ");
  const p = (plaats || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!n || !p) return "";
  return `wie:${n}|${p}`;
}

/**
 * Is dit een geldig Nederlands telefoonnummer?
 *
 * Deze controle is er niet voor de netheid maar voor de veiligheid: als het model
 * bij het uitlezen van een advertentie één cijfer verkeerd overneemt, bel of app je
 * een wildvreemde over een auto die niet van hem is. Een genormaliseerd NL-nummer is
 * altijd 31 + 9 cijfers. Wat daar niet aan voldoet gooien we weg — liever geen nummer
 * dan het verkeerde.
 */
export function isGeldigNlTelefoon(nummer: string): boolean {
  return /^31[1-9]\d{8}$/.test(normaliseerTelefoon(nummer));
}

export function isGeldigEmail(email: string): boolean {
  const e = normaliseerEmail(email);
  // Bewust streng: één @, een punt in het domein, geen spaties.
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e) && e.length <= 254;
}

/**
 * Staat deze lead op de blokkadelijst? Controleert mail én telefoon.
 * Wordt aangeroepen vlak vóór elke verzending — nooit alleen bij het zoeken,
 * want tussen vinden en versturen kan iemand zich hebben afgemeld.
 */
export async function isGeblokkeerd(email: string, telefoon: string): Promise<boolean> {
  const waarden = [normaliseerEmail(email), normaliseerTelefoon(telefoon)].filter(Boolean);
  if (waarden.length === 0) return false;
  const rijen = await sql`SELECT waarde FROM verkoper_blokkade WHERE waarde = ANY(${waarden})`;
  return rijen.length > 0;
}

export async function blokkeer(waarde: string, soort: string, reden: string): Promise<void> {
  const genormaliseerd = soort === "telefoon" ? normaliseerTelefoon(waarde) : normaliseerEmail(waarde);
  if (!genormaliseerd) return;
  await sql`
    INSERT INTO verkoper_blokkade (waarde, soort, reden)
    VALUES (${genormaliseerd}, ${soort}, ${reden})
    ON CONFLICT (waarde) DO UPDATE SET reden = ${reden}
  `;
}

export async function getLeads(): Promise<VerkoperLead[]> {
  const rijen = await sql`
    SELECT * FROM verkoper_leads
    ORDER BY
      CASE status
        WHEN 'gereageerd' THEN 0
        WHEN 'goedgekeurd' THEN 1
        WHEN 'nieuw' THEN 2
        WHEN 'verstuurd' THEN 3
        WHEN 'cosignatie' THEN 4
        ELSE 5
      END,
      kans_score DESC,
      gevonden_op DESC
  `;
  return rijen as unknown as VerkoperLead[];
}

export async function getLead(id: string): Promise<VerkoperLead | null> {
  const rijen = await sql`SELECT * FROM verkoper_leads WHERE id = ${id}`;
  return (rijen[0] as unknown as VerkoperLead) ?? null;
}

/** Nieuwe lead. Bestaat de advertentie al, dan gebeurt er niets (geen dubbele benadering). */
export async function voegLeadToe(lead: Partial<VerkoperLead>): Promise<string | null> {
  const id = `vk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const rijen = await sql`
    INSERT INTO verkoper_leads (
      id, bron, advertentie_url, titel, merk, model, bouwjaar, km, brandstof,
      vraagprijs, plaats, naam, telefoon, email, verkoper_profiel,
      particulier_score, kans_score, motivatie, zoekopdracht, status
    ) VALUES (
      ${id}, ${lead.bron ?? ""}, ${lead.advertentie_url ?? ""}, ${lead.titel ?? ""},
      ${lead.merk ?? ""}, ${lead.model ?? ""}, ${lead.bouwjaar ?? ""}, ${lead.km ?? ""},
      ${lead.brandstof ?? ""}, ${lead.vraagprijs ?? 0}, ${lead.plaats ?? ""},
      ${lead.naam ?? ""}, ${lead.telefoon ?? ""}, ${lead.email ?? ""},
      ${lead.verkoper_profiel ?? ""},
      ${lead.particulier_score ?? 0}, ${lead.kans_score ?? 0}, ${lead.motivatie ?? ""},
      ${lead.zoekopdracht ?? ""}, 'nieuw'
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  return (rijen[0]?.id as string) ?? null;
}

/**
 * Is deze persoon al eens door ons benaderd — via welk kanaal dan ook?
 *
 * Kijkt naar het verzendlog en niet naar de leads, want dat log is het enige dat
 * compleet blijft: leads worden verwijderd, en dezelfde verkoper kan met een
 * tweede auto opnieuw in de lijst opduiken. Zonder deze controle krijgt iemand die
 * twee auto's te koop zet gewoon twee keer hetzelfde verhaal van ons.
 */
export async function isAlBenaderd(
  email: string,
  telefoon: string,
  negeerLeadId = "",
  /** De verkoper zelf — nodig bij particulieren, die geen mailadres of nummer in
   *  hun advertentie zetten. Zie {@link verkoperSleutel}. */
  wieSleutel = ""
): Promise<{ eerder: boolean; wanneer: string | null; kanaal: string }> {
  const sleutels = [normaliseerEmail(email), normaliseerTelefoon(telefoon), wieSleutel].filter(
    Boolean
  );
  if (sleutels.length === 0) return { eerder: false, wanneer: null, kanaal: "" };

  const rijen = await sql`
    SELECT kanaal, verstuurd_op FROM verkoper_contactlog
    WHERE (
        ontvanger_sleutel  = ANY(${sleutels})
     OR ontvanger_sleutel2 = ANY(${sleutels})
     OR ontvanger_sleutel3 = ANY(${sleutels})
      )
      AND (${negeerLeadId} = '' OR lead_id <> ${negeerLeadId})
    ORDER BY verstuurd_op DESC
    LIMIT 1
  `;
  if (rijen.length === 0) return { eerder: false, wanneer: null, kanaal: "" };
  return {
    eerder: true,
    wanneer: rijen[0].verstuurd_op as string,
    kanaal: (rijen[0].kanaal as string) ?? "",
  };
}

/**
 * Onthoudt dat je deze advertentie niet meer wilt zien.
 *
 * Wordt vastgelegd vóórdat de lead wordt verwijderd, want daarna is de URL weg. Ook de
 * verkopersleutel gaat mee: zet dezelfde persoon een andere auto te koop, dan weet je
 * dat je hem al eens hebt weggeklikt.
 */
export async function negeer(
  advertentieUrl: string,
  verkoperSleutelWaarde: string,
  reden = ""
): Promise<void> {
  if (!advertentieUrl) return;
  await sql`
    INSERT INTO verkoper_genegeerd (advertentie_url, verkoper_sleutel, reden)
    VALUES (${advertentieUrl}, ${verkoperSleutelWaarde}, ${reden})
    ON CONFLICT (advertentie_url) DO NOTHING
  `.catch(() => null);
}

/** Alle weggegooide advertentie-URL's, om ze bij het zoeken over te slaan. */
export async function genegeerdeUrls(): Promise<Set<string>> {
  try {
    const rijen = await sql`SELECT advertentie_url FROM verkoper_genegeerd`;
    return new Set(rijen.map((r) => String(r.advertentie_url)));
  } catch {
    return new Set();
  }
}

export async function logContact(data: {
  leadId: string;
  kanaal: string;
  ontvanger: string;
  onderwerp: string;
  inhoud: string;
  advertentieUrl: string;
  /** Mail én telefoon meegeven; beide worden vastgelegd als sleutel, zodat een
   *  tweede advertentie van dezelfde persoon later herkend wordt. */
  email?: string;
  telefoon?: string;
  /** De verkoper zelf, zie {@link verkoperSleutel}. Zonder dit blijft een particulier
   *  met twee advertenties twee losse mensen, en krijgt hij twee keer een bericht. */
  wieSleutel?: string;
}): Promise<void> {
  const email = normaliseerEmail(
    data.email ?? (data.ontvanger.includes("@") ? data.ontvanger : "")
  );
  const telefoon = normaliseerTelefoon(data.telefoon ?? "");

  const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await sql`
    INSERT INTO verkoper_contactlog (
      id, lead_id, kanaal, ontvanger, onderwerp, inhoud, advertentie_url,
      ontvanger_sleutel, ontvanger_sleutel2, ontvanger_sleutel3
    )
    VALUES (
      ${id}, ${data.leadId}, ${data.kanaal}, ${data.ontvanger}, ${data.onderwerp},
      ${data.inhoud}, ${data.advertentieUrl}, ${email || telefoon}, ${email ? telefoon : ""},
      ${data.wieSleutel ?? ""}
    )
  `;
}

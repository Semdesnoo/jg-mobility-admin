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

export type VerkoperStatus =
  | "nieuw"
  | "goedgekeurd"
  | "verstuurd"
  | "gereageerd"
  | "cosignatie"
  | "afgewezen";

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
  // Contactgegevens zoals openbaar op de advertentie
  naam: string;
  telefoon: string;
  email: string;
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
}

/** Telefoonnummers vergelijkbaar maken: alleen cijfers, 06… wordt 316…. */
export function normaliseerTelefoon(nummer: string): string {
  const cijfers = (nummer || "").replace(/\D/g, "");
  if (!cijfers) return "";
  if (cijfers.startsWith("00")) return cijfers.slice(2);
  if (cijfers.startsWith("0")) return `31${cijfers.slice(1)}`;
  return cijfers;
}

export function normaliseerEmail(email: string): string {
  return (email || "").trim().toLowerCase();
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
      vraagprijs, plaats, naam, telefoon, email,
      particulier_score, kans_score, motivatie, zoekopdracht, status
    ) VALUES (
      ${id}, ${lead.bron ?? ""}, ${lead.advertentie_url ?? ""}, ${lead.titel ?? ""},
      ${lead.merk ?? ""}, ${lead.model ?? ""}, ${lead.bouwjaar ?? ""}, ${lead.km ?? ""},
      ${lead.brandstof ?? ""}, ${lead.vraagprijs ?? 0}, ${lead.plaats ?? ""},
      ${lead.naam ?? ""}, ${lead.telefoon ?? ""}, ${lead.email ?? ""},
      ${lead.particulier_score ?? 0}, ${lead.kans_score ?? 0}, ${lead.motivatie ?? ""},
      ${lead.zoekopdracht ?? ""}, 'nieuw'
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  return (rijen[0]?.id as string) ?? null;
}

export async function logContact(data: {
  leadId: string;
  kanaal: string;
  ontvanger: string;
  onderwerp: string;
  inhoud: string;
  advertentieUrl: string;
}): Promise<void> {
  const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await sql`
    INSERT INTO verkoper_contactlog (id, lead_id, kanaal, ontvanger, onderwerp, inhoud, advertentie_url)
    VALUES (${id}, ${data.leadId}, ${data.kanaal}, ${data.ontvanger}, ${data.onderwerp}, ${data.inhoud}, ${data.advertentieUrl})
  `;
}

// Gedeelde datatypen voor de pagina "Inkoop & Taxatie".
// Deze komen 1-op-1 overeen met wat de API-routes onder /api/admin/inkoop teruggeven.

export type RdwData = {
  merk: string;
  model: string;
  bouwjaar: number;
  kleur: string;
  brandstof: string;
  bodytype: string;
  apk: string;
  vermogen: string;
  catalogusprijs?: number;
};

export type Vergelijkbaar = {
  titel: string;
  bouwjaar?: number;
  km?: number;
  prijs: number;
  platform?: string;
  url?: string;
};

/**
 * Wat er over de markt bekend is.
 *
 * Bewust klein. Hier stonden ook landelijk aanbod, prijstrend en een "vraagscore" in —
 * getallen die een model met een handvol zoekopdrachten niet kan weten, maar die wel als
 * feit op het scherm kwamen en meetelden in de score. Die zijn eruit: een gezaghebbend
 * ogende gok is schadelijker dan geen getal.
 */
export type MarktData = {
  gemiddelde_prijs: number;
  min_prijs: number;
  max_prijs: number;
  advies: string;
  /** Hoeveel advertenties er écht gevonden én bruikbaar waren — geteld, niet gemeld. */
  aantal_gevonden?: number;
  vergelijkbare?: Vergelijkbaar[];

  // ── Verouderd ──
  // Deze velden worden niet meer geproduceerd, maar staan nog in taxaties die eerder
  // zijn opgeslagen. Ze blijven hier zodat het archief die oude analyses kan tonen zoals
  // ze destijds waren. Gebruik ze nergens anders.
  /** @deprecated onbekenbaar; werd geraden */
  aantal_aanbod?: number;
  /** @deprecated onbekenbaar; werd geraden */
  prijs_trend?: string;
  /** @deprecated onbekenbaar; werd geraden */
  vraag_score?: number;
  /** @deprecated zelfgerapporteerd, niet geverifieerd */
  betrouwbaarheid?: "hoog" | "midden" | "laag";
  /** @deprecated onbekenbaar; werd geraden */
  marktplaats_gemiddeld?: number;
  /** @deprecated onbekenbaar; werd geraden */
  autoscout_gemiddeld?: number;
};

export type Berekening = {
  max_inkoop: number;
  verwachte_verkoop: number;
  /** Verkoopwaarde zonder btw. Bij een marge-auto gelijk aan de verkoopwaarde. */
  netto_verkoop?: number;
  btw_type?: "marge" | "btw";
  /** Wat er aan btw afgedragen moet worden — bij marge over de marge, bij btw over alles. */
  btw_afdracht?: number;
  /** Wat er ná btw en kosten overblijft. */
  netto_marge?: number;
  marge_percentage: number;
  geschatte_kosten: number;
  gewenste_marge: number;
  catalogusprijs?: number;
  koerslijst_waarde?: number;
  markt_waarde?: number;
  bron?: string;
  /** Kwamen de cijfers uit echt gezochte advertenties, of uit modelkennis? */
  live?: boolean;
  /** Gezet als de gevonden marktprijs zo ver van de koerslijst lag dat hij is genegeerd. */
  markt_afgekeurd?: string;
  /** Hoe ruim er gezocht moest worden om genoeg vergelijkbare auto's te vinden. */
  zoekbereik?: string;
  /** Is er op uitvoering gefilterd, en op welke? */
  op_uitvoering?: boolean;
  uitvoering?: string;
  /** Welke uitvoeringen er in dit aanbod voorkomen, met hoe vaak. */
  uitvoeringen?: { naam: string; aantal: number }[];
  /** Kengetallen uit de vergelijkbare auto's — dit is waar de klantuitleg op rust. */
  gem_km?: number;
  gem_prijs?: number;
  per_duizend_km?: number;
  spreiding?: number;
  /** Hoeveel van de vergelijking dealeraanbod is, en hoeveel particulier. */
  aantal_dealer?: number;
  aantal_particulier?: number;
  /** Wat particulieren gemiddeld vragen — wat de verkoper zelf zou kunnen krijgen. */
  particulier_gemiddeld?: number;

  // ── Verouderd, alleen nog voor het archief ──
  /** @deprecated was per definitie gelijk aan de ingestelde marge; zegt dus niets */
  geschatte_marge?: number;
  /** @deprecated leunde op geraden cijfers */
  aantrekkelijkheid?: number;
};

export type TaxatieResultaat = { markt: MarktData; berekening: Berekening };

export type InkoopDossier = {
  id: string;
  datum: string;
  merk: string;
  model: string;
  bouwjaar: string;
  km: string;
  kenteken: string;
  kleur: string;
  vin: string;
  aanbod_prijs: number;
  bod_prijs: number;
  aankoopprijs: number;
  naam: string;
  telefoon: string;
  email: string;
  status: string;
  notitie: string;
};

export const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  nieuw: { label: "Nieuw", color: "#b45309", bg: "#fef3c7" },
  in_onderhandeling: { label: "In onderhandeling", color: "#1d4ed8", bg: "#dbeafe" },
  akkoord: { label: "Akkoord", color: "#15803d", bg: "#dcfce7" },
  afgewezen: { label: "Afgewezen", color: "#b91c1c", bg: "#fee2e2" },
};

// ── Marktoverzicht ────────────────────────────────────────────────
export type HotModel = {
  rang: number;
  merk: string;
  model: string;
  segment: string;
  gem_prijs: number;
  aanbod_score: number;
  vraag_score: number;
  trend: string;
  advies: string;
};

export type TeVermijden = { merk: string; model: string; reden: string };
export type TrendSegment = { naam: string; trend: string; score: number; reden: string };

export type MarktOverzicht = {
  samenvatting: string;
  markt_temperatuur: number;
  hot_modellen: HotModel[];
  te_vermijden: TeVermijden[];
  trending_segmenten: TrendSegment[];
  inzichten: string[];
  gegenereerd_op: string;
  type: string;
  zoekterm?: string;
  live?: boolean;
};

// ── Prestaties ────────────────────────────────────────────────────
export type PrestatiesData = {
  kpis: {
    totaal_verkocht: number;
    actieve_voorraad: number;
    voorraad_waarde: number;
    gem_verkoop_prijs: number;
    gem_marge: number | null;
    totaal_dossiers: number;
  };
  merk_stats: {
    merk: string;
    verkocht: number;
    beschikbaar: number;
    totaal: number;
    verkoopPercentage: number;
    gemPrijs: number;
  }[];
  brandstof_stats: {
    brandstof: string;
    verkocht: number;
    beschikbaar: number;
    totaal: number;
    verkoopPercentage: number;
  }[];
  segment_stats: {
    label: string;
    totaal: number;
    verkocht: number;
    beschikbaar: number;
    verkoopPercentage: number;
  }[];
  verkopen_per_maand: Record<string, { count: number; omzet: number }>;
  marge_dossiers: {
    top: { id: number; auto_naam: string; inkoop: number; verkoopprijs: number; netto_marge: number; aangemaakt: string }[];
    slecht: { id: number; auto_naam: string; inkoop: number; verkoopprijs: number; netto_marge: number; aangemaakt: string }[];
    gem: number | null;
  };
};

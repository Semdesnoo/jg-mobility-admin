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
};

export type MarktData = {
  gemiddelde_prijs: number;
  min_prijs: number;
  max_prijs: number;
  aantal_aanbod: number;
  prijs_trend: string;
  marktplaats_gemiddeld?: number;
  autoscout_gemiddeld?: number;
  vraag_score: number;
  advies: string;
  betrouwbaarheid?: "hoog" | "midden" | "laag";
  aantal_gevonden?: number;
  vergelijkbare?: Vergelijkbaar[];
};

export type Berekening = {
  max_inkoop: number;
  verwachte_verkoop: number;
  geschatte_marge: number;
  marge_percentage: number;
  geschatte_kosten: number;
  gewenste_marge: number;
  aantrekkelijkheid: number;
  catalogusprijs?: number;
  koerslijst_waarde?: number;
  markt_waarde?: number;
  bron?: string;
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

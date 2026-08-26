import type { RdwData, TaxatieResultaat } from "../inkoop/types";

/**
 * Wat er naast de losse bedragen in het archief meegaat.
 *
 * Genoeg om een bewaarde inruil precies zo terug te zetten als hij was: het voertuig zoals
 * het RDW het gaf, de taxatie waar de verkoopwaarde op rustte, en de kostenposten die je
 * los had aangeklikt. Zonder dit zou "openen" een halve reconstructie zijn — dezelfde
 * bedragen, maar niet meer te zien waar ze vandaan kwamen.
 */
export type InruilGegevens = {
  rdw?: RdwData | null;
  taxatie?: TaxatieResultaat | null;
  uitvoering?: string;
  posten?: { id: number; label: string; bedrag: number }[];
};

/** Eén bewaarde inruil. Komt 1-op-1 uit /api/admin/inruil/archief. */
export type InruilArchiefRij = {
  id: string;
  klant: string;
  kenteken: string;
  merk: string;
  model: string;
  bouwjaar: number;
  km: number;
  auto_id: number | null;
  auto_naam: string;
  vraagprijs: number;
  korting: number;
  verkoopwaarde: number;
  bod: number;
  /** Positief: de klant betaalt bij. Negatief: wij betalen hem uit. */
  verschil: number;
  netto_marge: number;
  marge: number;
  kosten: number;
  btw_type: string;
  max_bijbetaling: number;
  bron: string;
  gegevens: InruilGegevens;
  jaar: number;
  kwartaal: number;
  aangemaakt: string;
  /** Laatste wijziging. Null als er na het bewaren niets meer aan veranderd is. */
  bijgewerkt: string | null;
};

/** De velden die vanaf de detailpagina aangepast kunnen worden. */
export type InruilPatch = Partial<
  Pick<
    InruilArchiefRij,
    | "klant"
    | "km"
    | "vraagprijs"
    | "korting"
    | "verkoopwaarde"
    | "bod"
    | "verschil"
    | "netto_marge"
    | "marge"
    | "kosten"
    | "btw_type"
    | "max_bijbetaling"
  >
>;

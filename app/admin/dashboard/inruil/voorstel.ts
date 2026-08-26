import { fmt, fmtKm } from "../inkoop/ui";

/**
 * Het voorstel in gewone regels, klaar om in WhatsApp of een mail te plakken.
 *
 * Staat hier los van het scherm omdat het op twee plekken gemaakt wordt: in de
 * rekenmachine en op de detailpagina in het archief. Twee kopieën van dezelfde tekst
 * lopen vanzelf uit elkaar, en dan krijgt dezelfde klant twee keer een ander briefje.
 */
export function maakVoorstel(v: {
  onzeAuto: string;
  vraagprijs: number;
  korting: number;
  klantAuto: string;
  km: number;
  bod: number;
  richting: "bij" | "uit" | "gelijk";
  bedrag: number;
}): string {
  return [
    "Inruilvoorstel — JG Mobility",
    "",
    `${v.onzeAuto || "Onze auto"}: ${fmt(v.vraagprijs)}`,
    v.korting > 0 ? `Korting: − ${fmt(v.korting)}` : null,
    `Inruil ${v.klantAuto || "uw auto"}${v.km > 0 ? `, ${fmtKm(v.km)}` : ""}: − ${fmt(v.bod)}`,
    "————————————————",
    v.richting === "uit"
      ? `Wij betalen u uit: ${fmt(v.bedrag)}`
      : v.richting === "gelijk"
        ? "Gelijke ruil — u betaalt niets bij"
        : `Bij te betalen: ${fmt(v.bedrag)}`,
  ]
    .filter((r) => r !== null)
    .join("\n");
}

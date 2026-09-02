/**
 * Personenauto of bedrijfswagen?
 *
 * De RDW levert voor een bestelbus geen carrosserienaam maar de *inrichting*:
 * "Gesloten opbouw", "Open laadvloer", "Bakwagen". Die termen kwamen ongefilterd in de
 * voorraad terecht en stonden zo op de website. Nieuwe opzoekingen zetten er "Bestelauto"
 * van (zie app/api/admin/rdw-lookup), maar bestaande auto's houden hun oude waarde tot ze
 * opnieuw worden opgeslagen — dus herkent dit allebei.
 *
 * Deze lijst bepaalt ook of de vraagprijs vanzelf op "excl. btw" springt, zie lib/prijs.ts
 * en components/AutoForm.tsx.
 */

const BEDRIJFSWAGEN_TYPES = [
  "bestelauto",
  "bestelwagen",
  "bedrijfswagen",
  "bedrijfsauto",
  "gesloten opbouw",
  "open laadvloer",
  "open laadbak",
  "bakwagen",
  "chassis cabine",
  "kipper",
  "koelwagen",
];

/** Kleinletters en zonder accenten, zodat "Coupé" en "Coupe" hetzelfde zijn. */
const normaliseer = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function isBedrijfswagen(bodytype: string | undefined): boolean {
  return BEDRIJFSWAGEN_TYPES.includes(normaliseer(bodytype ?? ""));
}

/**
 * Zet een carrosserie om naar de schrijfwijze die het formulier kent.
 *
 * Zonder dit toont het bewerkscherm bij een bus "Hatchback" (de eerste optie) terwijl er
 * "Gesloten opbouw" in de database staat — en dan bewaar je stilletjes het verkeerde.
 *
 * Kent het formulier de waarde niet en is het ook geen bedrijfswagen, dan blijft hij
 * onaangeroerd staan: dan zet het formulier hem als extra keuze in de lijst. Liever een
 * vreemde waarde die klopt dan een nette waarde die je er zelf van hebt gemaakt.
 */
export function normaliseerBodytype(bodytype: string | undefined, keuzes: string[]): string {
  const waarde = (bodytype ?? "").trim();
  if (!waarde) return keuzes[0];
  const match = keuzes.find((k) => normaliseer(k) === normaliseer(waarde));
  if (match) return match;
  if (isBedrijfswagen(waarde)) return "Bestelauto";
  return waarde;
}

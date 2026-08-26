/**
 * Een bedrag uit vrije tekst halen.
 *
 * WAAROM DIT NODIG IS
 * De vraagprijs van een consignatie is een tekstveld: die vult de klant zelf in op de
 * website, en dan staat er "16.000", "€ 16.000,-", "16000 euro" of iets daartussenin.
 * Dat werd gelezen met `parseInt`, en die stopt bij het eerste teken dat geen cijfer is.
 * Van "16.000" maakte hij dus 16. Op het scherm zag je "€ 16" staan bij een auto van
 * zestienduizend — en erger: in de statusmail aan de klant stond hetzelfde.
 *
 * HOE HET GELEZEN WORDT
 * Eerst gaat alles weg wat geen cijfer of scheidingsteken is. Daarna is de vraag alleen
 * nog: is het laatste punt of de laatste komma een decimaalteken of een duizendtalpunt?
 * Dat hangt af van wat erachter staat. Eén of twee cijfers erachter is een decimaalteken
 * ("16.000,50"); alles anders is een duizendtalscheiding ("16.000", "1,234,567").
 *
 * WAT ER BEWUST NIET GEBEURT
 * Er wordt niet geraden. Handelaars schrijven "17.5" als ze zeventienduizendvijfhonderd
 * bedoelen, maar letterlijk staat er zeventien-en-een-half. Dat maken we er niet zelf van:
 * levert het lezen een bedrag op dat voor een auto onmogelijk is, dan tonen we de tekst
 * van de klant zoals hij hem schreef. Zijn eigen woorden zijn altijd beter dan ons verkeerde
 * getal — zeker in een mail die naar hem toe gaat.
 */

export function bedragUit(ruw: string | number | null | undefined): number | null {
  if (typeof ruw === "number") return Number.isFinite(ruw) ? ruw : null;

  const tekst = String(ruw ?? "").trim();
  if (!tekst) return null;

  // "€ 16.000,-" en "16000 euro" moeten allebei werken.
  const schoon = tekst.replace(/[^\d.,]/g, "");
  if (!/\d/.test(schoon)) return null;

  const scheiding = Math.max(schoon.lastIndexOf("."), schoon.lastIndexOf(","));

  let getal: number;
  if (scheiding === -1) {
    getal = Number(schoon);
  } else {
    const cijfersErachter = schoon.length - scheiding - 1;
    if (cijfersErachter === 1 || cijfersErachter === 2) {
      // Decimaalteken: alles ervoor is groepering.
      const heel = schoon.slice(0, scheiding).replace(/[.,]/g, "");
      const deel = schoon.slice(scheiding + 1);
      getal = Number(`${heel || "0"}.${deel}`);
    } else {
      // Duizendtallen (of een los teken aan het eind, zoals bij "16.000,-").
      getal = Number(schoon.replace(/[.,]/g, ""));
    }
  }

  return Number.isFinite(getal) ? getal : null;
}

/**
 * Een bedrag om te tonen.
 *
 * `minimaal` is de ondergrens waaronder de uitkomst niet geloofwaardig is voor waar hij
 * gebruikt wordt — bij een autoprijs is € 17 dat niet. Valt het bedrag daaronder, of is er
 * niets te lezen, dan komt de oorspronkelijke tekst terug in plaats van een getal waarvan
 * je niet kunt zien dat het fout is.
 */
export function toonBedrag(
  ruw: string | number | null | undefined,
  opties: { minimaal?: number; leeg?: string } = {}
): string {
  const { minimaal = 0, leeg = "" } = opties;
  const tekst = String(ruw ?? "").trim();
  if (!tekst) return leeg;

  const getal = bedragUit(ruw);
  if (getal === null || getal < minimaal) return tekst;

  return `€ ${Math.round(getal).toLocaleString("nl-NL")}`;
}

/** Ondergrens voor autoprijzen: daaronder is het geen autoprijs maar een schrijfwijze die we niet snappen. */
export const AUTO_ONDERGRENS = 100;

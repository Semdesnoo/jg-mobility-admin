/**
 * De inruilsom.
 *
 * Losse rekenkunde, bewust buiten het scherm gehouden: dit is het enige stuk van de
 * inruilpagina waar geld uit komt, dus het hoort na te rekenen te zijn zonder dat je
 * eerst een kenteken hoeft in te tikken.
 *
 * Twee dingen worden hier uitgerekend, en ze staan los van elkaar:
 *
 *  1. WAT DE KLANT BETAALT — onze vraagprijs min de korting min wat wij voor zijn auto
 *     geven. Is zijn auto meer waard dan die van ons, dan draait het om en betalen wíj
 *     hem het verschil uit.
 *
 *  2. WAT WIJ ERAAN OVERHOUDEN — op de ingeruilde auto, ná btw en klaarmaakkosten.
 *
 * Dat tweede is de reden dat deze pagina bestaat. Een inruil voelt als één bedrag ("ik
 * geef je er achtduizend voor"), maar het is een tweede auto die je koopt. Elke euro die
 * je extra biedt om de deal rond te krijgen gaat rechtstreeks van je marge af, en dat is
 * op het moment zelf niet te zien. Hier wel.
 *
 * De btw-regels zijn letterlijk dezelfde als in app/api/admin/inkoop/taxeer/route.ts —
 * die twee horen gelijk te blijven. Bij een marge-auto draag je 21/121 van je brutomarge
 * af; bij een btw-auto gaat de btw er eerst helemaal af en reken je verder netto.
 */

export type InruilInvoer = {
  /** Vraagprijs van de auto die bij ons staat. */
  vraagprijs: number;
  /** Korting die we op onze auto geven. */
  korting: number;
  /** Wat wij voor de auto van de klant geven. */
  inruilbod: number;
  /** Wat de ingeruilde auto naar verwachting opbrengt — uit de taxatie. */
  verwachteVerkoop: number;
  /** Klaarmaakkosten van de ingeruilde auto: poetsen, banden, APK, herstel. */
  kosten: number;
  /**
   * Marge-auto (particulier, geen btw-factuur) of btw-auto (bedrijf). Ruil je in van een
   * particulier — verreweg het vaakst — dan is het altijd marge.
   */
  btwType: "marge" | "btw";
};

export type InruilSom = {
  /** Vraagprijs min korting: wat onze auto in deze deal kost. */
  onzePrijs: number;
  /**
   * Het verschil. Positief = de klant betaalt bij, negatief = wij betalen uit.
   * Eén getal met een teken, want het is één som — niet twee gevallen.
   */
  verschil: number;
  richting: "bij" | "uit" | "gelijk";
  /** Het bedrag zonder teken, voor op het scherm. */
  bedrag: number;

  // ── Wat de inruilauto ons oplevert ──
  /** Verwachte verkoop min wat we ervoor geven. Hier moet de btw nog af. */
  brutoMarge: number;
  btwAfdracht: number;
  /** Wat er ná btw en kosten overblijft. Kan negatief zijn: dan leg je erop toe. */
  nettoMarge: number;
  /** Die netto marge als percentage van de verkoopprijs. */
  margePct: number;
};

const rond = (n: number) => Math.round(Number.isFinite(n) ? n : 0);

export function berekenInruil(inv: InruilInvoer): InruilSom {
  const vraagprijs = Math.max(0, rond(inv.vraagprijs));
  const korting = Math.max(0, rond(inv.korting));
  const inruilbod = Math.max(0, rond(inv.inruilbod));
  const verwachteVerkoop = Math.max(0, rond(inv.verwachteVerkoop));
  const kosten = Math.max(0, rond(inv.kosten));

  const onzePrijs = Math.max(0, vraagprijs - korting);
  const verschil = onzePrijs - inruilbod;

  // De marge op de ingeruilde auto. Zolang er geen taxatie is weten we niet wat hij
  // opbrengt, en dan is elke marge een verzinsel — dus dan blijft alles nul.
  let brutoMarge = 0;
  let btwAfdracht = 0;
  let nettoMarge = 0;
  if (verwachteVerkoop > 0) {
    if (inv.btwType === "btw") {
      const nettoVerkoop = rond(verwachteVerkoop / 1.21);
      btwAfdracht = verwachteVerkoop - nettoVerkoop;
      brutoMarge = verwachteVerkoop - inruilbod;
      nettoMarge = nettoVerkoop - inruilbod - kosten;
    } else {
      brutoMarge = verwachteVerkoop - inruilbod;
      // Alleen over een positieve marge wordt btw afgedragen. Verkoop je met verlies,
      // dan krijg je die btw niet terug — de afdracht is dan nul, geen negatief bedrag.
      btwAfdracht = brutoMarge > 0 ? rond((brutoMarge * 21) / 121) : 0;
      nettoMarge = brutoMarge - btwAfdracht - kosten;
    }
  }

  return {
    onzePrijs,
    verschil,
    richting: verschil > 0 ? "bij" : verschil < 0 ? "uit" : "gelijk",
    bedrag: Math.abs(verschil),
    brutoMarge,
    btwAfdracht,
    nettoMarge,
    margePct: verwachteVerkoop > 0 ? Math.round((nettoMarge / verwachteVerkoop) * 100) : 0,
  };
}

/**
 * Het hoogste bod dat nog de gewenste marge overlaat — dezelfde som als in de taxatietool,
 * maar dan hier zodat het scherm meebeweegt zodra je aan de marge of de kosten draait
 * zonder opnieuw de markt op te moeten.
 */
export function maxBod(
  verwachteVerkoop: number,
  margePct: number,
  kosten: number,
  btwType: "marge" | "btw"
): number {
  const v = Math.max(0, rond(verwachteVerkoop));
  const k = Math.max(0, rond(kosten));
  const m = Math.min(90, Math.max(0, margePct)) / 100;
  if (v <= 0) return 0;
  if (btwType === "btw") {
    const netto = rond(v / 1.21);
    return Math.max(0, rond(netto * (1 - m) - k));
  }
  return Math.max(0, rond(v - 1.21 * (m * v + k)));
}

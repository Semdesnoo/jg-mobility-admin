/**
 * Prijzen met en zonder btw.
 *
 * WAAROM
 * `auto.prijs` is in het hele systeem het bedrag **inclusief btw**: de factuur rekent
 * terug met /1,21, het calculatordossier ook, en zo krijgt de leasecalculator op de
 * website hem aangeleverd. Dat is de enige waarheid en die verandert niet.
 *
 * Bedrijfswagens worden alleen anders gepresenteerd — daar noem je de prijs zonder btw,
 * want de koper trekt die af. `prijsExclBtw` op de auto bepaalt dus alleen hoe je hem
 * invoert en hoe hij getoond wordt, nooit wat er wordt opgeslagen. Zou je het bedrag
 * zelf zonder btw wegschrijven, dan zou elke berekening in dit dashboard er stilletjes
 * 21% naast zitten.
 */

export const BTW_TARIEF = 0.21;

/** Van inclusief naar exclusief, in hele euro's. */
export const zonderBtw = (inclusief: number) => Math.round(inclusief / (1 + BTW_TARIEF));

/** Van exclusief naar inclusief, in hele euro's. */
export const metBtw = (exclusief: number) => Math.round(exclusief * (1 + BTW_TARIEF));

/** Het bedrag zoals het getoond hoort te worden, met "excl. btw" erachter waar dat hoort. */
export function prijsTekst(prijs: number, exclBtw?: boolean): string {
  const bedrag = exclBtw ? zonderBtw(prijs) : prijs;
  return `\u20ac${bedrag.toLocaleString("nl-NL")}${exclBtw ? " excl." : ""}`;
}

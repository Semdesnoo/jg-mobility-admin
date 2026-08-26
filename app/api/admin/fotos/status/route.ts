import { getAutos } from "@/lib/autos-db";

export const dynamic = "force-dynamic";

/**
 * Werkt de foto-opslag nog?
 *
 * WAAROM DIT BESTAAT
 * De foto's staan bij een opslagdienst buiten dit dashboard. Gaat daar iets mis, dan zie
 * je alleen kapotte plaatjes — in het beheer én op de website — zonder dat iets vertelt
 * waarom. Dat is precies het soort storing waarbij je uren gaat zoeken in je eigen code
 * terwijl er niets mis is met je code.
 *
 * Deze controle haalt één echte foto op en geeft terug wat de opslag antwoordde. "Your
 * store is blocked" van Vercel betekent bijvoorbeeld dat de opslag zelf op slot zit —
 * meestal omdat de gratis limiet bereikt is — en dat is iets wat je in je Vercel-account
 * oplost en niet hier.
 */
export async function GET() {
  try {
    const autos = await getAutos();
    const extern = autos.flatMap((a) => (a.fotos ?? []).filter((f) => f.startsWith("http")));
    const aantalAutos = autos.filter((a) => (a.fotos ?? []).some((f) => f.startsWith("http"))).length;

    if (extern.length === 0) {
      return Response.json({ ok: true, extern: 0, aantalAutos: 0, reden: "" });
    }

    // Eén foto is genoeg: hapert de opslag, dan hapert hij voor alles.
    const voorbeeld = extern[0];
    let status = 0;
    let tekst = "";
    try {
      const res = await fetch(voorbeeld, {
        headers: { range: "bytes=0-0" },
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      });
      status = res.status;
      if (!res.ok) tekst = (await res.text().catch(() => "")).slice(0, 120);
    } catch (e) {
      tekst = e instanceof Error ? e.message : String(e);
    }

    const ok = status >= 200 && status < 400;
    // De uitleg in gewone taal. Alleen wat we echt weten — geen gok over de oorzaak als
    // de opslag iets anders antwoordt dan we kennen.
    const reden = ok
      ? ""
      : /blocked/i.test(tekst)
        ? "De opslag zelf is geblokkeerd door Vercel. Dat gebeurt als de limiet van het gratis pakket bereikt is of als er iets met de betaling niet klopt — niet door een fout in het dashboard."
        : status === 404
          ? "De bestanden zijn niet gevonden bij de opslag. Ze lijken verwijderd te zijn."
          : status > 0
            ? `De opslag antwoordde met foutcode ${status}${tekst ? `: ${tekst}` : ""}.`
            : `De opslag was niet bereikbaar${tekst ? `: ${tekst}` : ""}.`;

    return Response.json({
      ok,
      status,
      reden,
      extern: extern.length,
      aantalAutos,
      voorbeeld,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

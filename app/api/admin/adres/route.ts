export const dynamic = "force-dynamic";

/**
 * Postcode plus huisnummer omzetten naar straat, huisnummer en plaats.
 *
 * Via de Locatieserver van PDOK — de open adressendienst van de overheid. Die is gratis,
 * heeft geen sleutel nodig en kent elk Nederlands adres. Dezelfde bron die de
 * verkopersradar gebruikt om plaatsnamen op de kaart te zetten.
 *
 * Waarom dit de moeite is: een adres overtypen van een rijbewijs gaat vaak net mis — een
 * straatnaam met een spatie erin, "Barendrecht" met een d te weinig. Op een factuur is dat
 * geen schoonheidsfoutje: die moet kloppen voor de administratie van allebei de partijen.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const postcode = (u.searchParams.get("postcode") ?? "").replace(/\s+/g, "").toUpperCase();
  const nummer = (u.searchParams.get("nummer") ?? "").trim();

  if (!/^[1-9][0-9]{3}[A-Z]{2}$/.test(postcode)) {
    return Response.json({ error: "Geen geldige postcode" }, { status: 400 });
  }

  // Het veld `huisnummer` bij PDOK is een getal: zoeken op "10a" levert niets en valt dan
  // terug op de eerste de beste woning in die postcode. Daarom alleen de cijfers in de
  // vraag, en de toevoeging pas gebruiken om de juiste treffer eruit te kiezen.
  const cijfers = nummer.match(/\d+/)?.[0] ?? "";
  const vraag = cijfers ? `postcode:${postcode} AND huisnummer:${cijfers}` : `postcode:${postcode}`;

  try {
    const res = await fetch(
      `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(vraag)}&fq=type:adres&rows=15`,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) {
      return Response.json({ error: "De adressendienst reageerde niet" }, { status: 502 });
    }
    const d = await res.json();
    const treffers: Record<string, unknown>[] = d?.response?.docs ?? [];
    if (!treffers.length) return Response.json({ gevonden: false });

    // Met een toevoeging ("10a", "3 bis") is er meestal meer dan één woning op hetzelfde
    // nummer. Kies degene waarvan het volledige huisnummer overeenkomt; lukt dat niet, dan
    // de eerste — dan klopt in elk geval de straat en de plaats.
    const gezocht = nummer.replace(/\s+/g, "").toLowerCase();
    const treffer =
      (gezocht &&
        treffers.find(
          (t) => String(t.huis_nlt ?? "").replace(/\s+/g, "").toLowerCase() === gezocht
        )) ||
      treffers[0];

    return Response.json({
      gevonden: true,
      straat: String(treffer.straatnaam ?? ""),
      huisnummer: String(treffer.huis_nlt ?? treffer.huisnummer ?? ""),
      postcode: String(treffer.postcode ?? postcode).replace(/^(\d{4})([A-Z]{2})$/, "$1 $2"),
      stad: String(treffer.woonplaatsnaam ?? ""),
    });
  } catch {
    // Een trage of onbereikbare dienst mag het invullen niet blokkeren; je typt het dan
    // gewoon zelf.
    return Response.json({ error: "De adressendienst was niet bereikbaar" }, { status: 502 });
  }
}

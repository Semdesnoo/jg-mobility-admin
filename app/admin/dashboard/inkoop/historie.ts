// Historie-check bij inkoop: alles wat gratis te weten is (RDW + eigen archief),
// teruggebracht tot een lijstje rode/gele vlaggen. Pure functie zodat hij los te testen is.

export type KmMeting = { km: number; datum: string; bron: string };

/** De RDW-velden die rdw-lookup al teruggeeft. Allemaal optioneel: bij handmatige invoer
 *  (RDW plat) ontbreken ze, en dan vallen die controles stil weg. */
export type HistorieBron = {
  tellerLogisch?: boolean;
  tellerstandoordeel?: string;
  openstaandeTerugroepactie?: boolean;
  aantalGebreken?: number;
  taxiVerleden?: boolean;
  geexporteerd?: boolean;
  tenaamstellenMogelijk?: boolean;
  datumEersteToelatingNL?: string; // eerste toelating ooit (nl-NL notatie d-m-jjjj)
  eersteToelatingNederland?: string; // eerste tenaamstelling in NL
  datumTenaamstelling?: string;
};

export type Vlag = { ernst: "rood" | "geel"; tekst: string };

/** "3-2-2020" → Date. RDW-route levert nl-NL datums. */
function nlNaarDatum(s?: string): Date | null {
  const m = s?.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}

const fmtKm = (n: number) => n.toLocaleString("nl-NL");

export function historieVlaggen(r: HistorieBron, kmNu: number, metingen: KmMeting[], nu = new Date()): Vlag[] {
  const v: Vlag[] = [];

  if (r.tellerLogisch === false)
    v.push({ ernst: "rood", tekst: `NAP: ${r.tellerstandoordeel || "tellerstand onlogisch"}` });
  if (r.tenaamstellenMogelijk === false) v.push({ ernst: "rood", tekst: "Tenaamstellen geblokkeerd" });
  if (r.openstaandeTerugroepactie) v.push({ ernst: "rood", tekst: "Openstaande terugroepactie" });
  if (r.taxiVerleden) v.push({ ernst: "geel", tekst: "Taxiverleden" });
  if (r.geexporteerd) v.push({ ernst: "geel", tekst: "Staat als geëxporteerd geregistreerd" });
  if (r.aantalGebreken)
    v.push({ ernst: "geel", tekst: `${r.aantalGebreken} gebrek${r.aantalGebreken === 1 ? "" : "en"} bij eerdere APK-keuringen` });

  // Import: eerste toelating ligt vóór de eerste tenaamstelling in NL.
  const ooit = nlNaarDatum(r.datumEersteToelatingNL);
  const nl = nlNaarDatum(r.eersteToelatingNederland);
  if (ooit && nl && nl.getTime() - ooit.getTime() > 30 * 864e5)
    v.push({ ernst: "geel", tekst: `Import — in NL sinds ${r.eersteToelatingNederland}; vraag buitenlandse historie (Car-Pass / Serviceheft)` });

  const overgeschreven = nlNaarDatum(r.datumTenaamstelling);
  if (overgeschreven && nu.getTime() - overgeschreven.getTime() < 90 * 864e5)
    v.push({ ernst: "geel", tekst: `Kort geleden overgeschreven (${r.datumTenaamstelling}) — handelaar tussen?` });

  // Eigen archief: ooit een hogere stand genoteerd dan nu = teruggedraaid of tikfout.
  if (kmNu > 0) {
    const hoger = metingen.filter((m) => m.km > kmNu).sort((a, b) => b.km - a.km)[0];
    if (hoger)
      v.push({
        ernst: "rood",
        tekst: `Eerder ${fmtKm(hoger.km)} km genoteerd (${hoger.bron}, ${new Date(hoger.datum).toLocaleDateString("nl-NL")}) — nu ${fmtKm(kmNu)} km`,
      });
  }

  return v;
}

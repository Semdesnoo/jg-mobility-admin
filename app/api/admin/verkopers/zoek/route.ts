import {
  initVerkopersDB,
  voegLeadToe,
  normaliseerTelefoon,
  isGeldigNlTelefoon,
} from "@/lib/verkopers-db";
import { leesCriteria, volgendeMerken } from "@/lib/verkopers-criteria";
import {
  haalMarktplaats,
  haalAutoScout24,
  filterOpCriteria,
  initBronnenDB,
  type Vondst,
} from "@/lib/verkopers-bronnen";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fase 1: advertenties opsporen.
 *
 * WAT HIER VERANDERD IS
 * Deze stap vroeg eerst aan een AI om met een zoekmachine advertenties te zoeken. Dat
 * leverde gemeten nul advertenties op voor Marktplaats en AutoScout24 — zoekmachines
 * indexeren van die sites vooral de categoriepagina's, niet de losse advertenties, en
 * die verversen ook te snel om bij te houden. Dat verklaarde waarom de radar nooit een
 * lead opleverde.
 *
 * Nu halen we de overzichtspagina's van de sites zélf op. Dat levert dertig
 * advertenties per merk op in plaats van nul, en er komt geen AI meer aan te pas:
 * - geen kosten per zoekactie en geen tokens
 * - geen verzonnen advertenties, want een programma kan niets verzinnen
 * - de zoekgrenzen worden exact toegepast in plaats van als instructie meegegeven
 *
 * Het beoordelen blijft wél AI-werk: dat gebeurt per advertentie in
 * /api/admin/verkopers/[id]/verrijk, dat per aanroep ruim binnen de tijd blijft.
 *
 * WAT NIET KAN
 * AutoWereld zit achter de privacymuur van DPG Media — elke pagina geeft die muur
 * terug, ook met een toestemmingscookie. Facebook Marketplace sluit in zijn robots.txt
 * alle bezoekers uit (`Disallow: /`). Beide zijn niet op te halen, met geen enkel model.
 */

/** Hoeveel merken per aanroep. De teller schuift door, dus een volgende ronde pakt andere. */
const MERKEN_PER_RONDE = 4;

/** Hoeveel overzichtspagina's tegelijk. Twee bronnen × vier merken = acht pagina's. */
const TEGELIJK = 4;

export async function POST() {
  const gestart = Date.now();

  await initVerkopersDB();
  await initBronnenDB();
  const criteria = await leesCriteria();
  const merken = await volgendeMerken(MERKEN_PER_RONDE);

  // Beide bronnen voor elk merk. Marktplaats heeft de meeste particulieren; AutoScout24
  // heeft een eigen particulier-filter (custtype=P) dat alleen particulieren doorlaat.
  const taken: (() => Promise<Vondst[]>)[] = [];
  for (const merk of merken) {
    taken.push(() => haalMarktplaats(merk).catch(() => []));
    taken.push(() => haalAutoScout24(merk, criteria).catch(() => []));
  }

  const alles: Vondst[] = [];
  const wachtrij = [...taken];
  const werker = async () => {
    for (;;) {
      const taak = wachtrij.shift();
      if (!taak) return;
      // Ruim vóór de 60 seconden van Vercel stoppen: wat binnen is moet nog bewaard
      // en teruggegeven worden, en een half afgemaakte ronde is beter dan een time-out.
      if (Date.now() - gestart > 35_000) return;
      alles.push(...(await taak()));
    }
  };
  await Promise.all(Array.from({ length: TEGELIJK }, werker));

  if (alles.length === 0) {
    return Response.json(
      {
        error:
          "Geen enkele overzichtspagina gaf advertenties terug. Dat wijst op een storing bij Marktplaats of AutoScout24, of op een wijziging aan hun pagina's. Probeer het over een paar minuten nog eens.",
      },
      { status: 502 }
    );
  }

  const { goed, handelaren, buitenGrenzen } = await filterOpCriteria(alles, criteria);

  const nieuweIds: string[] = [];
  let alBekend = 0;

  for (const v of goed) {
    // De blokkadelijst wordt hier nog niet geraadpleegd: in deze fase kennen we nog
    // geen contactgegevens. De verrijkingsstap controleert het zodra die er zijn.
    const id = await voegLeadToe({
      bron: v.bron,
      advertentie_url: v.advertentie_url,
      titel: v.titel,
      merk: v.merk,
      model: "",
      bouwjaar: "",
      vraagprijs: v.vraagprijs,
      plaats: v.plaats,
      naam: v.verkoper_naam,
      // AutoScout24 levert het nummer van particuliere verkopers gewoon mee. Alleen
      // overnemen als het de controle haalt — een verkeerd nummer is erger dan geen.
      telefoon: v.telefoon && isGeldigNlTelefoon(normaliseerTelefoon(v.telefoon))
        ? normaliseerTelefoon(v.telefoon)
        : "",
      // Het verkopersprofiel meteen meenemen: daarmee herkennen we deze persoon
      // terug als hij nóg een auto te koop zet, en krijgt hij geen tweede bericht.
      verkoper_profiel: v.verkoper_profiel,
      // AutoScout24 bestempelt de verkoper zelf als particulier ("PrivateSeller"),
      // en dat is harder dan welke inschatting ook — daar hoeft geen AI meer naar te
      // kijken. Bij Marktplaats staat het er niet bij, dus daar blijft het 0 tot de
      // advertentie echt gelezen is.
      particulier_score: v.bron === "AutoScout24" ? 9 : 0,
      // De kansinschatting blijft open: die vraagt om de advertentie zelf.
      kans_score: 0,
      motivatie: "",
      zoekopdracht: `binnen ${criteria.straalKm} km van ${criteria.vertrekpunt.naam}`,
    });
    if (id) nieuweIds.push(id);
    else alBekend++; // kenden we al (unieke index op advertentie_url)
  }

  return Response.json({
    ok: true,
    gevonden: alles.length,
    toegevoegd: nieuweIds.length,
    overgeslagen: handelaren + buitenGrenzen + alBekend,
    nieuwe_ids: nieuweIds,
    merken,
    toelichting:
      `${alles.length} advertenties bekeken op Marktplaats en AutoScout24 (${merken.join(", ")}). ` +
      `${handelaren} handelaar, ${buitenGrenzen} buiten je zoekgrenzen, ${alBekend} kende je al.`,
  });
}

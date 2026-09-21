/**
 * De inkoopverklaring van JG Mobility.
 *
 * WAT DIT IS
 * Het bewijsstuk dat hoort bij een auto die je van een particulier koopt. Twee dingen
 * tegelijk: een koopovereenkomst tussen jou en de verkoper, en het document dat je
 * boekhouding nodig heeft om de margeregeling te mogen toepassen.
 *
 * WAAROM DIE TWEEDE ROL ZO ZWAAR WEEGT
 * Bij inkoop van een particulier krijg je geen factuur — die persoon is geen ondernemer en
 * kan er geen maken. Zonder inkoopstuk staat er straks een auto in je administratie waar
 * je niet mee kunt aantonen wat je ervoor betaald hebt en van wie. De inkoopverklaring is
 * dat stuk. Daarom staan de vier gegevens die de Belastingdienst bij de margeregeling
 * verlangt hier prominent en niet ergens onderin: datum, naam en adres van de verkoper,
 * een omschrijving van de auto, en het betaalde bedrag — met de handtekening van de
 * verkoper eronder.
 *
 * WAAROM HET BEDRAG OOK IN LETTERS STAAT
 * Bij contante betaling aan de keukentafel is een cijfer met een pen makkelijk aan te
 * vullen. Voluit geschreven kan dat niet, en dat is precies waarom bankcheques het al
 * honderd jaar zo doen.
 *
 * WAAROM HET ER ZO UITZIET
 * Dezelfde opmaak als de factuur en het consignatiecontract: 794 pixels breed is A4 op
 * 96 dpi, alle stijl inline omdat het document in een kaal iframe wordt geschreven, en de
 * navy balk wordt met print-color-adjust meegeprint. Wie eerst een inkoopverklaring krijgt
 * en later een factuur ziet twee documenten uit dezelfde koker.
 *
 * LET OP
 * De tekst is met zorg geschreven maar niet juridisch of fiscaal getoetst. Laat hem
 * nakijken door de boekhouder voordat er handtekeningen onder komen — zeker de
 * verklaringen over de margeregeling en over de staat van de auto.
 */

export type InkoopverklaringGegevens = {
  nummer: string;
  datum: string;

  /** De verkoper: de particulier van wie je koopt. */
  verkoper_naam: string;
  verkoper_adres?: string;
  verkoper_postcode?: string;
  verkoper_stad?: string;
  verkoper_email?: string;
  verkoper_telefoon?: string;
  verkoper_geboortedatum?: string;
  /** Soort legitimatie en nummer — hoort bij een inkoop van een onbekende. */
  legitimatie_soort?: string;
  legitimatie_nummer?: string;

  /** Het voertuig. */
  merk: string;
  model: string;
  type?: string;
  bouwjaar?: string;
  kenteken?: string;
  vin?: string;
  km?: string;
  kleur?: string;
  brandstof?: string;
  apk?: string;
  eerste_toelating?: string;

  /** De koop. */
  bedrag: number;
  betaalwijze?: string;
  datum_overdracht?: string;
  vrijwaringsnummer?: string;
  aantal_sleutels?: string;

  /**
   * Koop je van een particulier, dan valt de auto onder de margeregeling. Koop je van een
   * ondernemer met btw-factuur, dan hoort dit document er niet bij — dan is de factuur van
   * die ondernemer je bewijsstuk. Daarom staat het als keuze en niet als aanname.
   */
  particulier: boolean;

  /** Wat er is meegeleverd: papieren, sleutels, boekjes. */
  meegeleverd?: string[];
  bijzonderheden?: string;
};

const BEDRIJF = {
  naam: "JG MOBILITY",
  adres: "Arnhemseweg 10a",
  postcode: "2994 LA Barendrecht",
  email: "info@jgmobility.nl",
  website: "www.jgmobility.nl",
  telefoon: "+31 6 21331374",
  kvk: "42042275",
  btw: "NL005450398B70",
  iban: "NL94 ABNA 0154171638",
} as const;

const euro = (n: number) => `€ ${Math.round(n).toLocaleString("nl-NL")}`;
const veilig = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// ── Bedrag in letters ──────────────────────────────────────────────
const EENHEDEN = [
  "nul", "een", "twee", "drie", "vier", "vijf", "zes", "zeven", "acht", "negen", "tien",
  "elf", "twaalf", "dertien", "veertien", "vijftien", "zestien", "zeventien", "achttien", "negentien",
];
const TIENTALLEN = ["", "", "twintig", "dertig", "veertig", "vijftig", "zestig", "zeventig", "tachtig", "negentig"];

/** Onder de honderd. "eenentwintig", en met een trema waar twee klinkers botsen. */
function onderHonderd(n: number): string {
  if (n < 20) return EENHEDEN[n];
  const tien = Math.floor(n / 10);
  const rest = n % 10;
  if (rest === 0) return TIENTALLEN[tien];
  const eenheid = EENHEDEN[rest];
  // twee + en → tweeën, drie + en → drieën: anders staan er drie klinkers achter elkaar.
  const verbinding = /[eé]$/.test(eenheid) ? "ën" : "en";
  return `${eenheid}${verbinding}${TIENTALLEN[tien]}`;
}

function onderDuizend(n: number): string {
  if (n < 100) return onderHonderd(n);
  const honderd = Math.floor(n / 100);
  const rest = n % 100;
  const kop = honderd === 1 ? "honderd" : `${EENHEDEN[honderd]}honderd`;
  return rest === 0 ? kop : `${kop}${onderHonderd(rest)}`;
}

/**
 * Een heel bedrag in euro's voluit. Gemaakt voor autoprijzen, dus tot een miljoen; daarboven
 * komt het cijfer terug in plaats van een gok.
 */
export function inWoorden(bedrag: number): string {
  const n = Math.round(Math.abs(bedrag));
  if (!Number.isFinite(n) || n >= 1_000_000) return "";
  if (n === 0) return "nul euro";
  const duizend = Math.floor(n / 1000);
  const rest = n % 1000;
  const kop = duizend === 0 ? "" : duizend === 1 ? "duizend" : `${onderDuizend(duizend)}duizend`;
  const staart = rest === 0 ? "" : onderDuizend(rest);
  return `${kop}${staart} euro`;
}

/**
 * De verklaringen die de verkoper ondertekent.
 *
 * Nummering en gewone taal, net als in het consignatiecontract: dit wordt aan een
 * keukentafel gelezen. Wat er per verklaring staat is wat er in de praktijk mis kan gaan —
 * een auto met een openstaande financiering, een teruggedraaide teller, een verkoper die
 * niet de eigenaar blijkt te zijn.
 */
function verklaringen(v: InkoopverklaringGegevens): string[] {
  // "van de Volkswagen Polo" of "van het voertuig" — het lidwoord hoort bij wat erachter
  // staat. Met een vaste "van de" ervoor stond er bij een leeg formulier "van de het
  // voertuig", en dat is precies het soort slordigheid dat opvalt op een stuk waar een
  // handtekening onder komt.
  const auto = [v.merk, v.model].filter(Boolean).join(" ").trim();
  const hetVoertuig = auto ? `de ${auto}` : "het voertuig";
  const lijst = [
    `Ik ben eigenaar van ${hetVoertuig} en bevoegd deze te verkopen. De auto is vrij van pandrecht, beslag, lease, financiering of andere rechten van derden, en is niet van diefstal afkomstig.`,
    "De kilometerstand op de teller is naar mijn beste weten juist en is tijdens mijn bezit niet gewijzigd of teruggedraaid.",
    "Voor zover mij bekend heeft de auto geen schade- of calamiteitenverleden anders dan wat hierboven bij de bijzonderheden is vermeld.",
    "Ik lever het kentekenbewijs en de tenaamstellingscode, alle bij mij aanwezige sleutels en de overige hierboven vermelde documenten mee.",
    "De auto wordt verkocht in de staat waarin hij zich bevindt. JG Mobility heeft de auto kunnen bekijken en proefrijden.",
  ];
  if (v.particulier) {
    lijst.push(
      "Ik verkoop deze auto als particulier en niet als ondernemer. Ik heb bij de aanschaf geen btw in aftrek gebracht en breng bij deze verkoop geen btw in rekening. JG Mobility past hierop de margeregeling toe."
    );
  }
  lijst.push(
    "Na ondertekening en betaling gaat het eigendom over op JG Mobility. De vrijwaring wordt bij de RDW geregeld en het bewijs daarvan ontvang ik."
  );
  return lijst;
}

/**
 * WAAROM HET OP ÉÉN A4 MOET
 * Dit is een papieren stuk: het wordt uitgeprint, aan een keukentafel gelezen en
 * ondertekend. Loopt het over twee vellen, dan moet er onderaan blad één een paraaf en
 * raakt het tweede blad kwijt — precies het blad met de handtekeningen erop. Alle
 * gegevens die erop horen passen op één vel; het kost alleen ruimte die nergens voor
 * nodig was: de voertuiggegevens staan nu in twee kolommen, de koopdetails staan in de
 * balk bij het bedrag, en de verklaringen zijn strakker gezet zonder dat er een woord af
 * is gegaan.
 *
 * BIJ AFDRUKKEN: pagina 1 = origineel, pagina 2 = kopie met KOPIE-watermerk.
 */
export function genereerInkoopverklaringHTML(v: InkoopverklaringGegevens, logoSrc: string): string {
  const auto = [v.merk, v.model].filter(Boolean).join(" ").trim();

  const adresregels = [
    v.verkoper_adres,
    [v.verkoper_postcode, v.verkoper_stad].filter(Boolean).join(" "),
    [v.verkoper_telefoon, v.verkoper_email].filter(Boolean).join(" · "),
  ]
    .filter(Boolean)
    .map((r) => `<div>${veilig(r)}</div>`)
    .join("");

  const rij = (label: string, waarde: unknown) =>
    waarde
      ? `<tr>
           <td style="padding:3px 0;font-size:8.5pt;color:#64748b;width:110px;vertical-align:top;white-space:nowrap">${veilig(label as string)}</td>
           <td style="padding:3px 0;font-size:8.5pt;color:#001337;font-weight:600;vertical-align:top">${veilig(waarde as string)}</td>
         </tr>`
      : "";

  const voertuigLinks = [
    rij("Merk en model", auto),
    rij("Type", v.type),
    rij("Kenteken", v.kenteken ? String(v.kenteken).toUpperCase() : ""),
    rij("Chassisnr.", v.vin),
    rij("Bouwjaar", v.bouwjaar),
  ].join("");

  const voertuigRechts = [
    rij("1e toelating", v.eerste_toelating),
    rij("Km-stand", v.km ? `${Number(String(v.km).replace(/\D/g, "")).toLocaleString("nl-NL")} km` : ""),
    rij("Brandstof", v.brandstof),
    rij("Kleur", v.kleur),
    rij("APK tot", v.apk),
  ].join("");

  const koopDetails = [
    ["Datum", v.datum],
    ["Overdracht", v.datum_overdracht],
    ["Betaalwijze", v.betaalwijze],
    ["Vrijwaring", v.vrijwaringsnummer],
    ["Sleutels", v.aantal_sleutels],
  ]
    .filter(([, w]) => !!w)
    .map(
      ([l, w]) => `<tr>
        <td style="padding:3px 0;font-size:8pt;color:#64748b;width:80px;vertical-align:top;white-space:nowrap">${veilig(l as string)}</td>
        <td style="padding:3px 0;font-size:8.5pt;color:#001337;font-weight:600;vertical-align:top">${veilig(w as string)}</td>
      </tr>`
    )
    .join("");

  const woorden = inWoorden(v.bedrag);

  /** Sectiekop: uppercase label + volle lijn eronder, beide op dezelfde padding. */
  const kop = (tekst: string) =>
    `<div style="font-size:7pt;letter-spacing:1.5px;text-transform:uppercase;color:#001337;font-weight:700;padding-bottom:6px;border-bottom:1.5px solid #001337;margin-bottom:10px">${veilig(tekst)}</div>`;

  const legitimatie = [
    v.verkoper_geboortedatum ? `geb. ${veilig(v.verkoper_geboortedatum)}` : "",
    v.legitimatie_nummer ? [v.legitimatie_soort, v.legitimatie_nummer].filter(Boolean).map(veilig).join(" ") : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const meegeleverd =
    v.meegeleverd && v.meegeleverd.length > 0
      ? `<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px">
           <span style="font-size:7pt;letter-spacing:1.2px;text-transform:uppercase;color:#001337;font-weight:700;white-space:nowrap">Meegeleverd</span>
           ${v.meegeleverd.map((m) => `<span style="font-size:8pt;color:#334155;white-space:nowrap">✓ ${veilig(m)}</span>`).join("")}
         </div>`
      : "";

  const bijzonderheden = v.bijzonderheden
    ? `<div style="margin-bottom:10px;padding:8px 12px;background:#f8fafc;border-left:2.5px solid #001337">
         <div style="font-size:7pt;letter-spacing:1.2px;text-transform:uppercase;color:#001337;font-weight:700;margin-bottom:3px">Bijzonderheden</div>
         <div style="font-size:8.5pt;color:#334155;line-height:1.55">${veilig(v.bijzonderheden)}</div>
       </div>`
    : "";

  const margeRegel = v.particulier
    ? "Ingekocht van een particulier zonder btw — margeregeling van toepassing, geen btw in aftrek gebracht."
    : "Ingekocht van een ondernemer; voor de btw geldt de factuur van de verkoper.";

  const verklaringLijst = verklaringen(v)
    .map(
      (t, i) => `<div style="display:flex;margin-bottom:3px">
        <span style="font-size:8pt;color:#94a3b8;font-weight:700;margin-right:6px;flex-shrink:0;width:12px;text-align:right">${i + 1}</span>
        <span style="font-size:8pt;color:#334155;line-height:1.4">${veilig(t)}</span>
      </div>`
    )
    .join("");

  const PB = `<div style="page-break-before:always;break-before:page;height:0;overflow:hidden"></div>`;

  const kopieWatermerk = `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:120pt;font-weight:900;color:rgba(0,19,55,0.055);letter-spacing:0.5em;white-space:nowrap;pointer-events:none;z-index:0;font-family:'Helvetica Neue',Arial,sans-serif">KOPIE</div>`;

  // ── Pagina-inhoud (gedeeld tussen origineel en kopie) ──────────
  // Compact gehouden: het geheel moet op ÉÉN A4 (1123px bij 96dpi) passen,
  // anders rolt er een tweede, vrijwel leeg vel uit de printer.
  const navyHeader = `<div style="width:100%;background-color:#001337;text-align:center;padding:8px 0;-webkit-print-color-adjust:exact;print-color-adjust:exact">
    <img src="${logoSrc}" alt="JG Mobility" style="height:40px;object-fit:contain;display:inline-block">
  </div>`;

  const documentBody = `<div style="padding:18px 48px 10px">

    <!-- Koptabel: bedrijf links, titel rechts -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
      <tr>
        <td style="vertical-align:top;width:52%">
          <div style="font-size:10.5pt;font-weight:700;color:#001337;margin-bottom:3px">${BEDRIJF.naam}</div>
          <div style="font-size:8pt;color:#64748b;line-height:1.55">
            <div>${BEDRIJF.adres} · ${BEDRIJF.postcode}</div>
            <div>${BEDRIJF.email} · ${BEDRIJF.telefoon}</div>
            <div>KvK ${BEDRIJF.kvk} · BTW ${BEDRIJF.btw}</div>
            <div>IBAN ${BEDRIJF.iban}</div>
          </div>
        </td>
        <td style="vertical-align:top;text-align:right">
          <div style="font-size:18pt;font-weight:300;letter-spacing:4px;text-transform:uppercase;color:#001337;line-height:1.1">Inkoopverklaring</div>
          <div style="font-size:8.5pt;color:#94a3b8;margin-top:5px;letter-spacing:1px">${veilig(v.nummer)} · ${veilig(v.datum)}</div>
        </td>
      </tr>
    </table>

    <div style="border-top:2px solid #001337;margin-bottom:12px"></div>

    <!-- Verkoper + inleidende tekst -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
      <tr>
        <td style="vertical-align:top;width:52%;padding-right:24px">
          ${kop("De verkoper")}
          <div style="font-size:10.5pt;font-weight:700;color:#001337;margin-bottom:3px">${veilig(v.verkoper_naam)}</div>
          <div style="font-size:8.5pt;color:#64748b;line-height:1.6">${adresregels}</div>
          ${legitimatie ? `<div style="font-size:8pt;color:#64748b;margin-top:3px">${legitimatie}</div>` : ""}
        </td>
        <td style="vertical-align:top">
          <div style="font-size:8.5pt;color:#334155;line-height:1.55;padding-top:20px">
            Ondergetekende verkoopt en levert de hieronder omschreven auto aan ${BEDRIJF.naam},
            dat deze koopt voor het genoemde bedrag. Deze verklaring geldt als
            koopovereenkomst én als inkoopbewijs voor de administratie.
          </div>
        </td>
      </tr>
    </table>

    ${voertuigLinks || voertuigRechts ? `
    <!-- Voertuig in twee kolommen -->
    <div style="margin-bottom:10px">
      ${kop("Het voertuig")}
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="vertical-align:top;width:52%;padding-right:24px">
            <table style="width:100%;border-collapse:collapse">${voertuigLinks}</table>
          </td>
          <td style="vertical-align:top">
            <table style="width:100%;border-collapse:collapse">${voertuigRechts}</table>
          </td>
        </tr>
      </table>
    </div>` : ""}

    <!-- Inkoopbedrag + koopdetails in één balk -->
    <div style="margin-bottom:10px;background:#f8fafc;border-left:3px solid #001337">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="vertical-align:top;padding:9px 0 9px 16px;width:50%">
            <div style="font-size:7pt;letter-spacing:1.5px;text-transform:uppercase;color:#001337;font-weight:700;margin-bottom:4px">Inkoopbedrag</div>
            <div style="font-size:19pt;font-weight:700;color:#001337;line-height:1;margin-bottom:3px">${euro(v.bedrag)}</div>
            ${woorden ? `<div style="font-size:8pt;color:#475569;font-style:italic;margin-bottom:4px">zegge: ${veilig(woorden)}</div>` : ""}
            <div style="font-size:7.5pt;color:#64748b;line-height:1.45">${margeRegel}</div>
          </td>
          <td style="vertical-align:top;padding:9px 16px;border-left:1px solid #e2e8f0">
            <table style="border-collapse:collapse">${koopDetails}</table>
          </td>
        </tr>
      </table>
    </div>

    ${meegeleverd}
    ${bijzonderheden}

    <!-- Verklaringen -->
    <div style="margin-bottom:12px">
      ${kop("Verklaring van de verkoper")}
      ${verklaringLijst}
    </div>

    <!-- Handtekeningen -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      <tr>
        <td style="vertical-align:bottom;width:46%;padding-right:20px">
          <div style="font-size:8.5pt;color:#64748b;margin-bottom:4px">De verkoper</div>
          <div style="font-size:10pt;font-weight:700;color:#001337;margin-bottom:42px">${veilig(v.verkoper_naam)}</div>
          <div style="border-top:1px solid #94a3b8;padding-top:4px;font-size:7.5pt;color:#94a3b8;letter-spacing:0.5px">Handtekening · datum</div>
        </td>
        <td style="width:8%"></td>
        <td style="vertical-align:bottom;width:46%">
          <div style="font-size:8.5pt;color:#64748b;margin-bottom:4px">Namens ${BEDRIJF.naam}</div>
          <div style="font-size:10pt;font-weight:700;color:#001337;margin-bottom:42px">Jimi Gaillard</div>
          <div style="border-top:1px solid #94a3b8;padding-top:4px;font-size:7.5pt;color:#94a3b8;letter-spacing:0.5px">Handtekening · datum</div>
        </td>
      </tr>
    </table>

    <div style="font-size:7.5pt;color:#94a3b8;line-height:1.5">
      Door te ondertekenen verklaart de verkoper het bovenstaande naar waarheid te hebben opgegeven en het
      genoemde bedrag te hebben ontvangen. Beide partijen ontvangen een ondertekend exemplaar.
    </div>

  </div>`;

  const pageFooter = `<div style="text-align:center;padding:5px 48px 10px">
    <div style="font-size:7.5pt;letter-spacing:2.5px;text-transform:uppercase;color:rgba(0,19,55,0.35)">
      ${BEDRIJF.naam} &nbsp;·&nbsp; ${BEDRIJF.website}
    </div>
  </div>`;

  const origineel = `${navyHeader}${documentBody}${pageFooter}`;

  const kopie = `${PB}<div style="position:relative">
    ${kopieWatermerk}
    <div style="position:relative;z-index:1">${navyHeader}${documentBody}${pageFooter}</div>
  </div>`;

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>Inkoopverklaring ${veilig(v.nummer)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  body { font-family:'Helvetica Neue',Arial,sans-serif; color:#1e293b; background:#fff; width:794px; margin:0 auto; }
  @media print { @page { size:A4; margin:0; } body { width:100%; } }
  table { border-collapse:collapse; }
</style>
</head>
<body>
${origineel}
${kopie}
</body>
</html>`;
}

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
  const auto = [v.merk, v.model].filter(Boolean).join(" ").trim() || "het voertuig";
  const lijst = [
    `Ik ben eigenaar van de ${auto} en bevoegd deze te verkopen. De auto is vrij van pandrecht, beslag, lease, financiering of andere rechten van derden, en is niet van diefstal afkomstig.`,
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

  /** Eén regel in een gegevenskolom. Leeg blijft leeg: geen streepjes voor wat je niet weet. */
  const rij = (label: string, waarde: unknown) =>
    waarde
      ? `<tr>
           <td style="padding:2px 0;font-size:8pt;color:#64748b;width:96px;vertical-align:top">${veilig(label)}</td>
           <td style="padding:2px 0;font-size:8.5pt;color:#1e293b;font-weight:600;vertical-align:top">${veilig(waarde)}</td>
         </tr>`
      : "";

  // Twee kolommen naast elkaar in plaats van één lange lijst: dat scheelt de helft van de
  // hoogte en leest bovendien prettiger, want je oog hoeft niet zo ver naar beneden.
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

  // De koopdetails horen bij het bedrag, niet in een eigen kolom: samen vormen ze één
  // gedachte ("wat is er betaald, hoe en wanneer").
  const koopDetails = [
    ["Datum", v.datum],
    ["Overdracht", v.datum_overdracht],
    ["Betaalwijze", v.betaalwijze],
    ["Vrijwaring", v.vrijwaringsnummer],
    ["Sleutels", v.aantal_sleutels],
  ]
    .filter(([, w]) => !!w)
    .map(
      ([l, w]) => `<div style="margin-bottom:3px">
        <span style="font-size:7.5pt;color:#64748b">${veilig(l)}</span>
        <span style="font-size:8.5pt;color:#1e293b;font-weight:600;margin-left:5px">${veilig(w)}</span>
      </div>`
    )
    .join("");

  const woorden = inWoorden(v.bedrag);

  const legitimatie = [
    v.verkoper_geboortedatum ? `geb. ${veilig(v.verkoper_geboortedatum)}` : "",
    [v.legitimatie_soort, v.legitimatie_nummer].filter(Boolean).map(veilig).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");

  const meegeleverd =
    v.meegeleverd && v.meegeleverd.length > 0
      ? `<div style="margin-bottom:10px;font-size:8pt;color:#334155;line-height:1.5">
           <span style="font-size:7pt;letter-spacing:1.2px;text-transform:uppercase;color:#001337;font-weight:700;margin-right:8px">Meegeleverd</span>
           ${v.meegeleverd.map((m) => `<span style="margin-right:12px;white-space:nowrap">✓ ${veilig(m)}</span>`).join("")}
         </div>`
      : "";

  const bijzonderheden = v.bijzonderheden
    ? `<div style="margin-bottom:10px;padding:7px 10px;background:#f8fafc;border-left:2px solid #001337">
         <span style="font-size:7pt;letter-spacing:1.2px;text-transform:uppercase;color:#001337;font-weight:700;margin-right:8px">Bijzonderheden</span>
         <span style="font-size:8pt;color:#334155;line-height:1.5">${veilig(v.bijzonderheden)}</span>
       </div>`
    : "";

  const margeRegel = v.particulier
    ? "Ingekocht van een particulier zonder btw — margeregeling van toepassing, geen btw in aftrek gebracht."
    : "Ingekocht van een ondernemer; voor de btw geldt de factuur van de verkoper.";

  const verklaringLijst = verklaringen(v)
    .map(
      (t, i) => `<div style="margin-bottom:3px;font-size:7.8pt;color:#334155;line-height:1.42">
        <span style="color:#94a3b8;font-weight:700;margin-right:4px">${i + 1}</span>${veilig(t)}
      </div>`
    )
    .join("");

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
  .kop { font-size:7pt; letter-spacing:1.2px; text-transform:uppercase; color:#001337; font-weight:700; border-bottom:1px solid #001337; padding-bottom:3px; margin-bottom:5px; }
</style>
</head>
<body>

<div style="width:100%;background-color:#001337;text-align:center;line-height:0;padding:9px 0">
  <img src="${logoSrc}" alt="JG Mobility" style="height:46px;object-fit:contain;display:inline-block">
</div>

<div style="padding:22px 44px 14px">

  <table style="width:100%;margin-bottom:14px">
    <tr>
      <td style="vertical-align:top;width:52%">
        <div style="font-size:10pt;font-weight:700;color:#001337;margin-bottom:1px">${BEDRIJF.naam}</div>
        <div style="font-size:8pt;color:#64748b;line-height:1.5">
          <div>${BEDRIJF.adres} · ${BEDRIJF.postcode}</div>
          <div>${BEDRIJF.email} · ${BEDRIJF.telefoon}</div>
          <div>KvK ${BEDRIJF.kvk} · BTW ${BEDRIJF.btw}</div>
          <div>IBAN ${BEDRIJF.iban}</div>
        </div>
      </td>
      <td style="vertical-align:top;text-align:right">
        <div style="font-size:17pt;font-weight:300;letter-spacing:3px;text-transform:uppercase;color:#001337;line-height:1.15">Inkoopverklaring</div>
        <div style="font-size:9pt;color:#94a3b8;margin-top:2px">${veilig(v.nummer)} · ${veilig(v.datum)}</div>
      </td>
    </tr>
  </table>

  <div style="border-top:1.5px solid #001337;margin-bottom:12px"></div>

  <table style="width:100%;margin-bottom:12px">
    <tr>
      <td style="vertical-align:top;width:52%;padding-right:20px">
        <div class="kop">De verkoper</div>
        <div style="font-size:10pt;font-weight:700;color:#001337;margin-bottom:1px">${veilig(v.verkoper_naam)}</div>
        <div style="font-size:8.5pt;color:#64748b;line-height:1.5">${adresregels}</div>
        ${legitimatie ? `<div style="font-size:8pt;color:#64748b;margin-top:2px">${legitimatie}</div>` : ""}
      </td>
      <td style="vertical-align:top">
        <div style="font-size:8.5pt;color:#334155;line-height:1.5">
          Ondergetekende verkoopt en levert de hieronder omschreven auto aan ${BEDRIJF.naam}, dat deze
          koopt voor het genoemde bedrag. Deze verklaring geldt als koopovereenkomst én als inkoopbewijs
          voor de administratie.
        </div>
      </td>
    </tr>
  </table>

  <div class="kop">Het voertuig</div>
  <table style="width:100%;margin-bottom:12px">
    <tr>
      <td style="vertical-align:top;width:50%;padding-right:20px"><table style="width:100%">${voertuigLinks}</table></td>
      <td style="vertical-align:top"><table style="width:100%">${voertuigRechts}</table></td>
    </tr>
  </table>

  <table style="width:100%;margin-bottom:12px;background:#f8fafc;border-left:3px solid #001337">
    <tr>
      <td style="vertical-align:top;padding:10px 0 10px 14px;width:52%">
        <div style="font-size:7pt;letter-spacing:1.2px;text-transform:uppercase;color:#001337;font-weight:700;margin-bottom:3px">Inkoopbedrag</div>
        <div style="font-size:19pt;font-weight:700;color:#001337;line-height:1.05">${euro(v.bedrag)}</div>
        ${woorden ? `<div style="margin-top:2px;font-size:8.5pt;color:#334155;font-style:italic">zegge: ${veilig(woorden)}</div>` : ""}
        <div style="margin-top:5px;font-size:7.5pt;color:#64748b;line-height:1.45">${margeRegel}</div>
      </td>
      <td style="vertical-align:top;padding:10px 14px 10px 0">${koopDetails}</td>
    </tr>
  </table>

  ${meegeleverd}
  ${bijzonderheden}

  <div class="kop">Verklaring van de verkoper</div>
  ${verklaringLijst}

  <table style="width:100%;margin-top:14px">
    <tr>
      <td style="vertical-align:top;width:50%;padding-right:26px">
        <div style="font-size:8pt;color:#64748b;margin-bottom:30px">De verkoper · <span style="color:#1e293b;font-weight:600">${veilig(v.verkoper_naam)}</span></div>
        <div style="border-top:1px solid #94a3b8;padding-top:3px;font-size:7.5pt;color:#94a3b8">Handtekening · datum</div>
      </td>
      <td style="vertical-align:top;width:50%">
        <div style="font-size:8pt;color:#64748b;margin-bottom:30px">Namens ${BEDRIJF.naam} · <span style="color:#1e293b;font-weight:600">Jimi Gaillard</span></div>
        <div style="border-top:1px solid #94a3b8;padding-top:3px;font-size:7.5pt;color:#94a3b8">Handtekening · datum</div>
      </td>
    </tr>
  </table>

  <div style="margin-top:9px;font-size:7.5pt;color:#94a3b8;line-height:1.45">
    Door te ondertekenen verklaart de verkoper het bovenstaande naar waarheid te hebben opgegeven en het
    genoemde bedrag te hebben ontvangen. Beide partijen ontvangen een ondertekend exemplaar.
  </div>

</div>

<div style="text-align:center;padding:0 44px 14px">
  <div style="font-size:7.5pt;letter-spacing:2px;text-transform:uppercase;color:#001337">
    ${BEDRIJF.naam} · ${BEDRIJF.website}
  </div>
</div>

</body>
</html>`;
}

/**
 * Het consignatiecontract van JG Mobility.
 *
 * WAT DIT IS
 * De klant zet zijn auto bij JG Mobility neer, maar blijft eigenaar. JG verkoopt hem
 * namens hem en rekent pas een vergoeding als de auto daadwerkelijk verkocht is. Dat is
 * een andere afspraak dan inkoop, en juist daarom hoort er iets op papier te staan: bij
 * consignatie ligt er maandenlang een auto van iemand anders op het terrein, rijden er
 * vreemden proefritten in, en gaat er straks geld van een koper via JG naar de eigenaar.
 *
 * WAAROM HET ER ZO UITZIET
 * Dezelfde opmaak als de factuur (app/admin/dashboard/DashboardHub.tsx, genereerFactuurHTML):
 * 794 pixels breed is A4 op 96 dpi, alle stijl staat inline omdat de HTML in een kaal
 * iframe wordt geschreven, en de navy balk wordt met print-color-adjust geforceerd
 * meegeprint. Zo komt het contract uit dezelfde koker als de factuur die dezelfde klant
 * later krijgt.
 *
 * LET OP
 * De tekst hieronder is met zorg geschreven maar niet juridisch getoetst. Laat hem
 * nakijken voordat er handtekeningen onder komen, met name de artikelen over risico,
 * verzekering en beëindiging.
 */

export type ContractGegevens = {
  contract_nr: string;
  datum: string;

  /** De eigenaar van de auto. */
  klant_naam: string;
  klant_adres?: string;
  klant_postcode?: string;
  klant_stad?: string;
  klant_email?: string;
  klant_telefoon?: string;

  /** Het voertuig. */
  merk: string;
  model: string;
  bouwjaar?: string;
  kenteken?: string;
  vin?: string;
  km?: string;
  kleur?: string;
  brandstof?: string;

  /** De afspraken. Dit zijn de enige getallen die per contract verschillen. */
  vraagprijs: number;
  /** Onder dit bedrag verkoopt JG niet zonder overleg. 0 = niet afgesproken. */
  bodemprijs: number;
  /** Percentage van de verkoopprijs. Wordt pas verschuldigd bij verkoop. */
  fee_percentage: number;
  /** Vast bedrag in plaats van of naast een percentage. 0 = geen. */
  fee_vast: number;
  /** Looptijd in maanden. */
  looptijd_maanden: number;
  /** Hoeveel werkdagen na ontvangst van de koopsom JG doorbetaalt. */
  uitbetaling_dagen: number;
  /** Vrije aanvulling die onder de voorwaarden komt te staan. */
  bijzondere_afspraken?: string;
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

/**
 * De voorwaarden.
 *
 * Bewust genummerd en in gewone taal: dit wordt aan een keukentafel gelezen, niet door een
 * advocaat. Waar een bedrag of termijn per contract verschilt wordt het uit de gegevens
 * ingevuld, zodat er nooit een percentage in de tekst staat dat niet klopt met wat er
 * bovenaan is afgesproken.
 */
function artikelen(c: ContractGegevens): { kop: string; leden: string[] }[] {
  const auto = `${c.merk} ${c.model}`.trim();
  const vergoeding = [
    c.fee_percentage > 0 ? `${c.fee_percentage}% van de verkoopprijs` : "",
    c.fee_vast > 0 ? `een vast bedrag van ${euro(c.fee_vast)}` : "",
  ]
    .filter(Boolean)
    .join(" plus ");

  return [
    {
      kop: "1 · Wat consignatie inhoudt",
      leden: [
        `De eigenaar blijft eigenaar van de ${auto}. JG Mobility koopt de auto niet, maar biedt hem namens de eigenaar te koop aan en begeleidt de verkoop van begin tot eind.`,
        "De auto staat gedurende deze overeenkomst bij JG Mobility op het terrein aan de Arnhemseweg 10a in Barendrecht.",
        "De eigenaar biedt de auto in deze periode niet zelf en niet via anderen te koop aan. Twee verkopers op één auto leidt tot verschillende prijzen en verwarde kopers, en dat kost uiteindelijk opbrengst.",
      ],
    },
    {
      kop: "2 · Wat JG Mobility uit handen neemt",
      leden: [
        "Professionele foto's van de auto en het schrijven van de advertentieteksten.",
        "Plaatsing op meerdere verkoopkanalen tegelijk, waaronder Marktplaats, AutoScout24, AutoTrack, Gaspedaal en NederlandMobiel, en een filmpje en post op de eigen TikTok- en Instagramkanalen.",
        "Alle contact met geïnteresseerden: telefoon, e-mail en berichten via de platforms. De eigenaar wordt niet gebeld door kopers; zijn gegevens worden niet in de advertentie vermeld.",
        "Bezichtigingen en proefritten op afspraak, altijd onder begeleiding van een medewerker van JG Mobility en uitsluitend met een geldig rijbewijs en legitimatie van de bestuurder.",
        "De onderhandeling over de prijs, binnen de grenzen die hieronder zijn afgesproken.",
        "De volledige afhandeling: koopovereenkomst, vrijwaring, tenaamstelling en de betaling.",
        "Voor deze werkzaamheden worden vooraf geen kosten in rekening gebracht. Er zijn geen instapkosten en geen advertentiekosten.",
      ],
    },
    {
      kop: "3 · Prijs",
      leden: [
        `De vraagprijs bedraagt bij aanvang ${euro(c.vraagprijs)}.`,
        c.bodemprijs > 0
          ? `JG Mobility verkoopt de auto niet voor minder dan ${euro(c.bodemprijs)} zonder voorafgaande instemming van de eigenaar. Binnen die grens mag JG Mobility zelfstandig onderhandelen.`
          : "Over elk bod dat afwijkt van de vraagprijs wordt eerst met de eigenaar overlegd.",
        "De vraagprijs kan tussentijds in onderling overleg worden aangepast. JG Mobility doet daarvoor een voorstel op basis van de reacties en het vergelijkbare aanbod; de eigenaar beslist.",
      ],
    },
    {
      kop: "4 · Vergoeding",
      leden: [
        `De vergoeding voor JG Mobility bedraagt ${vergoeding || "het afgesproken bedrag"}.`,
        "De vergoeding is uitsluitend verschuldigd wanneer de auto daadwerkelijk verkocht is. Wordt de auto niet verkocht, dan is de eigenaar niets verschuldigd.",
        "De vergoeding wordt verrekend met de koopsom; de eigenaar ontvangt het restant. Hij hoeft dus niets over te maken.",
        "Kosten die JG Mobility op verzoek van de eigenaar maakt buiten het bovenstaande om — bijvoorbeeld reparaties, een onderhoudsbeurt of een APK-keuring — worden vooraf afgestemd en apart in rekening gebracht.",
      ],
    },
    {
      kop: "5 · Verkoop en uitbetaling",
      leden: [
        "De koper betaalt aan JG Mobility. JG Mobility draagt zorg voor de vrijwaring en de tenaamstelling op naam van de koper.",
        `De opbrengst minus de vergoeding wordt binnen ${c.uitbetaling_dagen} werkdagen na ontvangst van de volledige koopsom overgemaakt op het rekeningnummer van de eigenaar.`,
        "De eigenaar ontvangt een afrekening waarop de verkoopprijs, de vergoeding en het uit te betalen bedrag staan vermeld.",
      ],
    },
    {
      kop: "6 · Looptijd en wat er gebeurt als de auto langer staat",
      leden: [
        `Deze overeenkomst geldt voor ${c.looptijd_maanden} maanden vanaf de datum van ondertekening.`,
        "Na acht weken bespreken partijen de stand van zaken: hoeveel reacties er zijn geweest, wat vergelijkbare auto's doen, en of de vraagprijs nog past bij de markt. Dat gesprek is bedoeld om te sturen, niet om te verlengen zonder reden.",
        "Staat de auto na die evaluatie nog steeds, dan doet JG Mobility een onderbouwd voorstel: de prijs aanpassen, doorgaan zoals het gaat, of de auto ophalen. De eigenaar beslist welke van die drie het wordt.",
        `Loopt de termijn van ${c.looptijd_maanden} maanden af zonder dat de auto verkocht is, dan eindigt de overeenkomst vanzelf. Verlengen kan, maar alleen als beide partijen dat schriftelijk bevestigen.`,
        "Aan het aflopen van de termijn zijn voor de eigenaar geen kosten verbonden.",
      ],
    },
    {
      kop: "7 · Beëindigen",
      leden: [
        "Beide partijen kunnen de overeenkomst tussentijds beëindigen met een opzegtermijn van zeven dagen, schriftelijk of per e-mail aan info@jgmobility.nl.",
        "Is er op het moment van opzeggen al een koopovereenkomst met een koper gesloten, dan wordt die eerst afgewikkeld en is de vergoeding gewoon verschuldigd.",
        "Bij beëindiging haalt de eigenaar de auto binnen zeven dagen op, tijdens openingstijden en op afspraak. De sleutels en de papieren worden dan overhandigd.",
        "Er worden bij beëindiging geen kosten in rekening gebracht voor de foto's, de advertenties of de tijd die tot dan toe is besteed.",
      ],
    },
    {
      kop: "8 · Staat van de auto, risico en verzekering",
      leden: [
        "De eigenaar verklaart dat hij eigenaar is van de auto, dat er geen financiering, lease of beslag op rust, en dat de kilometerstand naar zijn beste weten juist is.",
        "De eigenaar meldt bekende gebreken en schadeverleden vooraf. Komt er tijdens de verkoop iets aan het licht dat niet gemeld is, dan mag JG Mobility de advertentie aanpassen of de overeenkomst beëindigen.",
        "De auto blijft verzekerd door de eigenaar zolang hij op zijn naam staat. JG Mobility is verzekerd voor het gebruik van de auto bij bezichtigingen en proefritten onder eigen begeleiding.",
        "JG Mobility gaat met de auto om als met de eigen voorraad. Schade die tijdens de bewaring bij JG Mobility ontstaat en aan JG Mobility is toe te rekenen, wordt door JG Mobility hersteld of vergoed.",
        "De auto wordt niet gebruikt voor andere doeleinden dan bezichtigingen, proefritten en het verplaatsen op of rond het terrein.",
      ],
    },
    {
      kop: "9 · Overig",
      leden: [
        "Afwijkingen van deze overeenkomst gelden alleen als beide partijen ze schriftelijk hebben bevestigd.",
        "Op deze overeenkomst is Nederlands recht van toepassing.",
        "De persoonsgegevens van de eigenaar worden uitsluitend gebruikt voor de uitvoering van deze overeenkomst en niet aan derden verstrekt, anders dan noodzakelijk voor de tenaamstelling en de vrijwaring.",
      ],
    },
  ];
}

export function genereerContractHTML(c: ContractGegevens, logoSrc: string): string {
  const auto = `${c.merk} ${c.model}`.trim();
  const adresregels = [
    c.klant_adres,
    [c.klant_postcode, c.klant_stad].filter(Boolean).join(" "),
    c.klant_email,
    c.klant_telefoon,
  ]
    .filter(Boolean)
    .map((r) => `<div>${veilig(r)}</div>`)
    .join("");

  const voertuigRijen = [
    ["Merk en model", auto],
    ["Bouwjaar", c.bouwjaar],
    ["Kenteken", c.kenteken],
    ["Chassisnummer", c.vin],
    ["Kilometerstand", c.km ? `${Number(String(c.km).replace(/\D/g, "")).toLocaleString("nl-NL")} km` : ""],
    ["Kleur", c.kleur],
    ["Brandstof", c.brandstof],
  ]
    .filter(([, w]) => !!w)
    .map(
      ([l, w]) => `<tr>
        <td style="padding:5px 0;font-size:9pt;color:#64748b;width:150px">${veilig(l)}</td>
        <td style="padding:5px 0;font-size:9.5pt;color:#1e293b;font-weight:600">${veilig(w)}</td>
      </tr>`
    )
    .join("");

  const kern = [
    ["Vraagprijs", euro(c.vraagprijs)],
    c.bodemprijs > 0 ? ["Niet verkopen onder", euro(c.bodemprijs)] : null,
    [
      "Vergoeding bij verkoop",
      [
        c.fee_percentage > 0 ? `${c.fee_percentage}%` : "",
        c.fee_vast > 0 ? euro(c.fee_vast) : "",
      ].filter(Boolean).join(" + ") || "—",
    ],
    ["Looptijd", `${c.looptijd_maanden} maanden`],
  ]
    .filter(Boolean)
    .map(
      (r) => `<tr>
        <td style="padding:7px 0;font-size:9pt;color:#64748b">${veilig((r as string[])[0])}</td>
        <td style="padding:7px 0;font-size:11pt;color:#001337;font-weight:700;text-align:right">${veilig((r as string[])[1])}</td>
      </tr>`
    )
    .join("");

  const voorwaarden = artikelen(c)
    .map(
      (a) => `
    <div style="margin-bottom:22px;page-break-inside:avoid">
      <div style="font-size:10pt;font-weight:700;color:#001337;margin-bottom:7px">${veilig(a.kop)}</div>
      ${a.leden
        .map(
          (l) => `<div style="display:flex;margin-bottom:5px">
            <span style="color:#94a3b8;font-size:9pt;line-height:1.65;padding-right:8px">—</span>
            <span style="font-size:9pt;color:#334155;line-height:1.65">${veilig(l)}</span>
          </div>`
        )
        .join("")}
    </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>Consignatieovereenkomst ${veilig(c.contract_nr)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  body { font-family:'Helvetica Neue',Arial,sans-serif; color:#1e293b; background:#fff; width:794px; margin:0 auto; }
  @media print { @page { size:A4; margin:0; } body { width:100%; } }
  table { border-collapse:collapse; }
</style>
</head>
<body>

<div style="width:100%;background-color:#001337;text-align:center;line-height:0;padding:14px 0">
  <img src="${logoSrc}" alt="JG Mobility" style="height:80px;object-fit:contain;display:inline-block">
</div>

<div style="padding:44px 48px 40px">

  <table style="width:100%;margin-bottom:30px">
    <tr>
      <td style="vertical-align:top;width:55%">
        <div style="font-size:10.5pt;font-weight:700;color:#001337;margin-bottom:2px">${BEDRIJF.naam}</div>
        <div style="font-size:9pt;color:#64748b;line-height:1.75">
          <div>${BEDRIJF.adres}</div>
          <div>${BEDRIJF.postcode}</div>
          <div>${BEDRIJF.email}</div>
          <div>${BEDRIJF.telefoon}</div>
        </div>
      </td>
      <td style="vertical-align:top;text-align:right">
        <div style="font-size:20pt;font-weight:300;letter-spacing:4px;text-transform:uppercase;color:#001337;line-height:1.2">Consignatie</div>
        <div style="font-size:20pt;font-weight:300;letter-spacing:4px;text-transform:uppercase;color:#001337;margin-bottom:6px">overeenkomst</div>
        <div style="font-size:10pt;color:#94a3b8">${veilig(c.contract_nr)}</div>
      </td>
    </tr>
  </table>

  <table style="width:100%;margin-bottom:8px">
    <tr>
      <td style="vertical-align:top;width:55%">
        <table>
          <tr><td style="padding:2px 0;font-size:9pt;color:#64748b;width:64px">KVK nr.</td><td style="padding:2px 0;font-size:9pt;color:#1e293b">${BEDRIJF.kvk}</td></tr>
          <tr><td style="padding:2px 0;font-size:9pt;color:#64748b">BTW nr.</td><td style="padding:2px 0;font-size:9pt;color:#1e293b">${BEDRIJF.btw}</td></tr>
          <tr><td style="padding:2px 0;font-size:9pt;color:#64748b">IBAN</td><td style="padding:2px 0;font-size:9pt;color:#1e293b">${BEDRIJF.iban}</td></tr>
        </table>
        <div style="margin-top:12px;font-size:8.5pt;letter-spacing:1px;text-transform:uppercase;color:#001337;font-weight:700">Datum: ${veilig(c.datum)}</div>
      </td>
      <td style="vertical-align:top">
        <div style="font-size:7.5pt;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:5px">De eigenaar</div>
        <div style="font-size:11pt;font-weight:700;text-transform:uppercase;color:#001337;margin-bottom:3px">${veilig(c.klant_naam)}</div>
        <div style="font-size:9.5pt;color:#64748b;line-height:1.7">${adresregels}</div>
      </td>
    </tr>
  </table>

  <div style="border-top:1.5px solid #001337;margin-top:26px;margin-bottom:24px"></div>

  <div style="font-size:9pt;color:#334155;line-height:1.7;margin-bottom:24px">
    De ondergetekenden komen overeen dat JG Mobility de hieronder omschreven auto namens de eigenaar
    te koop aanbiedt en de verkoop ervan volledig verzorgt. De eigenaar blijft eigenaar tot het moment
    van verkoop. De vergoeding is pas verschuldigd wanneer de auto daadwerkelijk verkocht is.
  </div>

  <table style="width:100%;margin-bottom:26px">
    <tr>
      <td style="vertical-align:top;width:55%;padding-right:24px">
        <div style="font-size:7.5pt;letter-spacing:1.5px;text-transform:uppercase;color:#001337;font-weight:700;border-bottom:1.5px solid #001337;padding-bottom:6px;margin-bottom:6px">Het voertuig</div>
        <table style="width:100%">${voertuigRijen}</table>
      </td>
      <td style="vertical-align:top">
        <div style="font-size:7.5pt;letter-spacing:1.5px;text-transform:uppercase;color:#001337;font-weight:700;border-bottom:1.5px solid #001337;padding-bottom:6px;margin-bottom:6px">De afspraken</div>
        <table style="width:100%">${kern}</table>
      </td>
    </tr>
  </table>

  <div style="font-size:7.5pt;letter-spacing:1.5px;text-transform:uppercase;color:#001337;font-weight:700;border-bottom:1.5px solid #001337;padding-bottom:6px;margin-bottom:16px">Voorwaarden</div>
  ${voorwaarden}

  ${
    c.bijzondere_afspraken
      ? `<div style="margin-top:4px;margin-bottom:22px;padding:12px 14px;background:#f8fafc;border-left:3px solid #001337;page-break-inside:avoid">
           <div style="font-size:8.5pt;letter-spacing:1px;text-transform:uppercase;color:#001337;font-weight:700;margin-bottom:5px">Bijzondere afspraken</div>
           <div style="font-size:9pt;color:#334155;line-height:1.7;white-space:pre-line">${veilig(c.bijzondere_afspraken)}</div>
         </div>`
      : ""
  }

  <div style="margin-top:30px;page-break-inside:avoid">
    <div style="font-size:7.5pt;letter-spacing:1.5px;text-transform:uppercase;color:#001337;font-weight:700;border-bottom:1.5px solid #001337;padding-bottom:6px;margin-bottom:22px">Ondertekening</div>
    <table style="width:100%">
      <tr>
        <td style="vertical-align:top;width:50%;padding-right:30px">
          <div style="font-size:9pt;color:#64748b;margin-bottom:44px">De eigenaar<br><span style="color:#1e293b;font-weight:600">${veilig(c.klant_naam)}</span></div>
          <div style="border-top:1px solid #94a3b8;padding-top:6px;font-size:8pt;color:#94a3b8">Handtekening · datum</div>
        </td>
        <td style="vertical-align:top;width:50%">
          <div style="font-size:9pt;color:#64748b;margin-bottom:44px">Namens JG Mobility<br><span style="color:#1e293b;font-weight:600">Jimi Gaillard</span></div>
          <div style="border-top:1px solid #94a3b8;padding-top:6px;font-size:8pt;color:#94a3b8">Handtekening · datum</div>
        </td>
      </tr>
    </table>
    <div style="margin-top:16px;font-size:8pt;color:#94a3b8;line-height:1.6">
      Beide partijen ontvangen een ondertekend exemplaar. Vragen over deze overeenkomst kunnen
      gesteld worden via ${BEDRIJF.email} of ${BEDRIJF.telefoon}.
    </div>
  </div>

</div>

<div style="text-align:center;padding:0 48px 34px">
  <div style="font-size:8pt;letter-spacing:2.5px;text-transform:uppercase;color:#001337">
    ${BEDRIJF.naam} · ${BEDRIJF.website}
  </div>
</div>

</body>
</html>`;
}

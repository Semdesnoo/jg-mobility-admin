/**
 * Het consignatiecontract van JG Mobility.
 *
 * STRUCTUUR (4 pagina's)
 *   1 — Cover: logo, bedrijf, eigenaar, voertuig, afspraken, rekenvoorbeeld
 *   2 — Voorwaarden artikelen 1-5
 *   3 — Voorwaarden artikelen 6-9 (+ bijzondere afspraken)
 *   4 — Ondertekening (apart, alleen handtekeningen)
 *
 * AFDRUKKEN
 *   Bij printen komen er automatisch 8 pagina's uit:
 *   pagina's 1-4 = origineel, pagina's 5-8 = kopie met groot KOPIE-watermerk.
 *
 * LET OP
 *   De tekst is met zorg geschreven maar niet juridisch getoetst. Laat hem
 *   nakijken voordat er handtekeningen onder komen.
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
  /** Werkdagen na ontvangst van de koopsom. 0 betekent: dezelfde dag nog. */
  uitbetaling_dagen: number;
  /** Wat de eigenaar betaalt als hij de auto tussentijds terugneemt. */
  terugname_kosten: number;
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
 * De voorwaarden — bewust in gewone taal, zodat dit aan de keukentafel gelezen
 * kan worden. Variabele bedragen en termijnen komen uit de ContractGegevens.
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
        c.terugname_kosten > 0
          ? "Voor deze werkzaamheden worden vooraf geen kosten in rekening gebracht: geen instapkosten en geen advertentiekosten. Alleen wanneer de eigenaar de auto tussentijds terugneemt geldt de regeling uit artikel 7."
          : "Voor deze werkzaamheden worden vooraf geen kosten in rekening gebracht. Er zijn geen instapkosten en geen advertentiekosten.",
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
        "JG Mobility spant zich in om de auto zo snel mogelijk en tegen een realistische marktprijs te verkopen.",
      ],
    },
    {
      kop: "4 · Vergoeding",
      leden: [
        `De vergoeding voor JG Mobility bedraagt ${vergoeding || "het afgesproken bedrag"}.`,
        "De vergoeding is uitsluitend verschuldigd wanneer de auto daadwerkelijk verkocht is. Wordt de auto niet verkocht, dan is de eigenaar niets verschuldigd.",
        "De vergoeding wordt verrekend met de koopsom; de eigenaar ontvangt het restant. Hij hoeft dus niets over te maken.",
        "In deze vergoeding is inbegrepen dat de koper bij JG Mobility één jaar garantie op de auto krijgt. Die garantie loopt via JG Mobility en niet via de eigenaar; de eigenaar wordt na de verkoop niet aangesproken op gebreken die onder die garantie vallen.",
        "Kosten die JG Mobility op verzoek van de eigenaar maakt buiten het bovenstaande om — bijvoorbeeld reparaties, een onderhoudsbeurt of een APK-keuring — worden vooraf afgestemd en apart in rekening gebracht.",
      ],
    },
    {
      kop: "5 · Verkoop en uitbetaling",
      leden: [
        "De koper betaalt aan JG Mobility. JG Mobility draagt zorg voor de vrijwaring en de tenaamstelling op naam van de koper.",
        c.uitbetaling_dagen <= 0
          ? "Zodra de auto verkocht is en JG Mobility de betaling heeft ontvangen, wordt de opbrengst minus de vergoeding diezelfde dag nog overgemaakt op het rekeningnummer van de eigenaar."
          : `De opbrengst minus de vergoeding wordt binnen ${c.uitbetaling_dagen} werkdagen na ontvangst van de volledige koopsom overgemaakt op het rekeningnummer van de eigenaar.`,
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
        "De eigenaar kan de overeenkomst altijd tussentijds beëindigen, schriftelijk of per e-mail aan info@jgmobility.nl. Ook JG Mobility kan de overeenkomst beëindigen.",
        "Is er op het moment van opzeggen al een koopovereenkomst met een koper gesloten, dan wordt die eerst afgewikkeld en is de vergoeding gewoon verschuldigd.",
        "Bij beëindiging haalt de eigenaar de auto binnen zeven dagen op, tijdens openingstijden en op afspraak. De sleutels en de papieren worden dan overhandigd.",
        c.terugname_kosten > 0
          ? `Neemt de eigenaar de auto tussentijds terug, dan wordt uitsluitend ${euro(c.terugname_kosten)} aan advertentiekosten in rekening gebracht. Voor de foto's, de advertentieteksten en de bestede tijd wordt niets berekend.`
          : "Er worden bij beëindiging geen kosten in rekening gebracht.",
      ],
    },
    {
      kop: "8 · Staat van de auto, risico en verzekering",
      leden: [
        "De eigenaar verklaart dat hij eigenaar is van de auto, dat er geen financiering, lease of beslag op rust, en dat de kilometerstand naar zijn beste weten juist is.",
        "De eigenaar meldt bekende gebreken en schadeverleden vooraf. Komt er tijdens de verkoop iets aan het licht dat niet gemeld is, dan mag JG Mobility de advertentie aanpassen of de overeenkomst beëindigen.",
        "Proefritten worden gereden met de groene handelaarskentekenplaten van JG Mobility. Die zijn allrisk verzekerd, zodat schade die tijdens een proefrit ontstaat via die verzekering is gedekt. De eigen verzekering van de eigenaar wordt daarvoor dus niet aangesproken.",
        "Buiten die proefritten blijft de auto verzekerd door de eigenaar zolang hij op zijn naam staat.",
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

  // ── Helpers ────────────────────────────────────────────────────

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
        <td style="padding:5px 0;font-size:9pt;color:#64748b;width:140px">${veilig(l as string)}</td>
        <td style="padding:5px 0;font-size:9.5pt;color:#001337;font-weight:600">${veilig(w as string)}</td>
      </tr>`
    )
    .join("");

  const kernRijen = [
    ["Vraagprijs", euro(c.vraagprijs)],
    c.bodemprijs > 0 ? ["Minimumprijs", euro(c.bodemprijs)] : null,
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
        <td style="padding:7px 0;font-size:9pt;color:#64748b;border-bottom:1px solid rgba(0,19,55,0.05)">${veilig((r as string[])[0])}</td>
        <td style="padding:7px 0;font-size:11pt;color:#001337;font-weight:700;text-align:right;border-bottom:1px solid rgba(0,19,55,0.05)">${veilig((r as string[])[1])}</td>
      </tr>`
    )
    .join("");

  const heeftVoorbeeld = c.vraagprijs > 0 && (c.fee_percentage > 0 || c.fee_vast > 0);
  const kosten = Math.round((c.vraagprijs * c.fee_percentage) / 100) + c.fee_vast;
  const netto = c.vraagprijs - kosten;

  const voorbeeldBox = heeftVoorbeeld
    ? `<div style="margin-top:18px;padding:15px 18px;background:#f8fafc;border-left:3px solid #001337">
        <div style="font-size:7.5pt;letter-spacing:1.5px;text-transform:uppercase;color:#001337;font-weight:700;margin-bottom:10px">Wat u overhoudt — rekenvoorbeeld</div>
        <table style="width:100%">
          <tr>
            <td style="padding:3px 0;font-size:9pt;color:#475569">Verkoopprijs</td>
            <td style="padding:3px 0;font-size:9pt;color:#001337;text-align:right;font-weight:600">${euro(c.vraagprijs)}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;font-size:9pt;color:#475569">Consignatiekosten${c.fee_percentage > 0 ? ` (${c.fee_percentage}%)` : ""}</td>
            <td style="padding:3px 0;font-size:9pt;color:#001337;text-align:right;font-weight:600">− ${euro(kosten)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0 0;font-size:10pt;color:#001337;font-weight:700;border-top:1px solid #cbd5e1">U ontvangt</td>
            <td style="padding:8px 0 0;font-size:11pt;color:#001337;text-align:right;font-weight:700;border-top:1px solid #cbd5e1">${euro(netto)}</td>
          </tr>
        </table>
        <div style="margin-top:9px;font-size:8pt;color:#64748b;line-height:1.6">
          Gerekend met de huidige vraagprijs. Wordt de auto voor een ander bedrag verkocht, dan verandert de opbrengst mee — het percentage blijft gelijk.
        </div>
      </div>`
    : "";

  // Artikel-blok builder
  const bouwArtikel = (a: { kop: string; leden: string[] }) =>
    `<div style="margin-bottom:18px;page-break-inside:avoid">
      <div style="font-size:8pt;font-weight:700;color:#001337;margin-bottom:7px;text-transform:uppercase;letter-spacing:0.8px">${veilig(a.kop)}</div>
      ${a.leden
        .map(
          (l) => `<div style="display:flex;margin-bottom:4px">
            <span style="color:#94a3b8;font-size:9pt;line-height:1.65;padding-right:9px;flex-shrink:0">—</span>
            <span style="font-size:9pt;color:#334155;line-height:1.65">${veilig(l)}</span>
          </div>`
        )
        .join("")}
    </div>`;

  const bijzondereAfspraken = c.bijzondere_afspraken
    ? `<div style="margin-top:4px;margin-bottom:18px;padding:13px 16px;background:#f8fafc;border-left:3px solid #001337;page-break-inside:avoid">
        <div style="font-size:7.5pt;letter-spacing:1.5px;text-transform:uppercase;color:#001337;font-weight:700;margin-bottom:5px">Bijzondere afspraken</div>
        <div style="font-size:9pt;color:#334155;line-height:1.7;white-space:pre-line">${veilig(c.bijzondere_afspraken)}</div>
       </div>`
    : "";

  // Artikelen split: 1-5 op pagina 2, 6-9 op pagina 3
  const artikelLijst = artikelen(c);
  const artikelen15 = artikelLijst.slice(0, 5);
  const artikelen69 = artikelLijst.slice(5);

  // Watermerk voor de kopiepagina's
  const kopieWatermerk = `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:130pt;font-weight:900;color:rgba(0,19,55,0.055);letter-spacing:0.5em;white-space:nowrap;pointer-events:none;z-index:0;font-family:'Helvetica Neue',Arial,sans-serif">KOPIE</div>`;

  // Paginabreuk
  const PB = `<div style="page-break-before:always;break-before:page;height:0;overflow:hidden"></div>`;

  // ── Bouwblokken die op zowel origineel als kopie worden hergebruikt ──

  const navyHeader = `<div style="width:100%;background-color:#001337;text-align:center;padding:20px 0;-webkit-print-color-adjust:exact;print-color-adjust:exact">
    <img src="${logoSrc}" alt="JG Mobility" style="height:76px;object-fit:contain;display:inline-block">
  </div>`;

  const coverBody = `<div style="padding:42px 52px 36px">
    <!-- Koptabel: bedrijf links, title rechts -->
    <table style="width:100%;margin-bottom:26px;border-collapse:collapse">
      <tr>
        <td style="vertical-align:top;width:52%">
          <div style="font-size:11pt;font-weight:700;color:#001337;margin-bottom:5px">${BEDRIJF.naam}</div>
          <div style="font-size:9pt;color:#64748b;line-height:1.85">
            <div>${BEDRIJF.adres}</div>
            <div>${BEDRIJF.postcode}</div>
            <div>${BEDRIJF.email}</div>
            <div>${BEDRIJF.telefoon}</div>
          </div>
          <div style="margin-top:13px;font-size:8.5pt;color:#94a3b8;line-height:1.75">
            <div>KVK&nbsp;&nbsp;${BEDRIJF.kvk}</div>
            <div>BTW&nbsp;&nbsp;${BEDRIJF.btw}</div>
          </div>
        </td>
        <td style="vertical-align:top;text-align:right">
          <div style="font-size:21pt;font-weight:300;letter-spacing:5px;text-transform:uppercase;color:#001337;line-height:1.15">Consignatie</div>
          <div style="font-size:21pt;font-weight:300;letter-spacing:5px;text-transform:uppercase;color:#001337;margin-bottom:10px">Overeenkomst</div>
          <div style="font-size:9pt;color:#94a3b8;letter-spacing:1.5px">${veilig(c.contract_nr)}</div>
        </td>
      </tr>
    </table>

    <!-- Eigenaar + datum -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:5px">
      <tr>
        <td style="vertical-align:top;width:52%">
          <div style="font-size:8pt;color:#94a3b8;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:2px">Datum</div>
          <div style="font-size:10pt;font-weight:600;color:#001337">${veilig(c.datum)}</div>
        </td>
        <td style="vertical-align:top">
          <div style="font-size:8pt;color:#94a3b8;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">De eigenaar</div>
          <div style="font-size:12pt;font-weight:700;color:#001337;margin-bottom:5px">${veilig(c.klant_naam)}</div>
          <div style="font-size:9pt;color:#64748b;line-height:1.75">${adresregels}</div>
        </td>
      </tr>
    </table>

    <div style="border-top:2px solid #001337;margin:22px 0 20px"></div>

    <div style="font-size:9pt;color:#334155;line-height:1.75;margin-bottom:24px">
      De ondergetekenden komen overeen dat JG Mobility de hieronder omschreven auto namens de eigenaar
      te koop aanbiedt en de verkoop volledig verzorgt. De eigenaar blijft eigenaar tot het moment van
      verkoop. De vergoeding is pas verschuldigd wanneer de auto daadwerkelijk verkocht is.
    </div>

    <!-- Voertuig + afspraken -->
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="vertical-align:top;width:52%;padding-right:24px">
          <div style="font-size:7.5pt;letter-spacing:1.5px;text-transform:uppercase;color:#001337;font-weight:700;border-bottom:1.5px solid #001337;padding-bottom:7px;margin-bottom:10px">Het voertuig</div>
          <table style="width:100%;border-collapse:collapse">${voertuigRijen}</table>
        </td>
        <td style="vertical-align:top">
          <div style="font-size:7.5pt;letter-spacing:1.5px;text-transform:uppercase;color:#001337;font-weight:700;border-bottom:1.5px solid #001337;padding-bottom:7px;margin-bottom:10px">De afspraken</div>
          <table style="width:100%;border-collapse:collapse">${kernRijen}</table>
          ${voorbeeldBox}
        </td>
      </tr>
    </table>
  </div>`;

  const pageFooter = `<div style="text-align:center;padding:18px 52px 28px">
    <div style="font-size:7.5pt;letter-spacing:2.5px;text-transform:uppercase;color:rgba(0,19,55,0.35)">
      ${BEDRIJF.naam} &nbsp;·&nbsp; ${BEDRIJF.website}
    </div>
  </div>`;

  const voorwaardenKop = `<div style="font-size:7.5pt;letter-spacing:2px;text-transform:uppercase;color:#001337;font-weight:700;border-bottom:2px solid #001337;padding-bottom:8px;margin-bottom:20px">Voorwaarden</div>`;

  const ondertekeningBody = `<div style="padding:64px 52px 44px">
    <div style="font-size:7.5pt;letter-spacing:2px;text-transform:uppercase;color:#001337;font-weight:700;border-bottom:2px solid #001337;padding-bottom:8px;margin-bottom:44px">Ondertekening</div>

    <div style="font-size:9.5pt;color:#334155;line-height:1.78;margin-bottom:64px;max-width:560px">
      Partijen verklaren kennis te hebben genomen van de inhoud van deze overeenkomst en gaan akkoord
      met de hierin opgenomen bepalingen. Dit document is opgesteld in tweevoud; elk van de partijen
      ontvangt een origineel exemplaar.
    </div>

    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="vertical-align:top;width:46%;padding-right:20px">
          <div style="font-size:9pt;color:#64748b;margin-bottom:8px">De eigenaar</div>
          <div style="font-size:12.5pt;font-weight:700;color:#001337;margin-bottom:88px">${veilig(c.klant_naam)}</div>
          <div style="border-top:1px solid #94a3b8;padding-top:8px;font-size:8pt;color:#94a3b8;letter-spacing:0.5px">Handtekening &nbsp;·&nbsp; datum</div>
        </td>
        <td style="width:8%"></td>
        <td style="vertical-align:top;width:46%">
          <div style="font-size:9pt;color:#64748b;margin-bottom:8px">Namens JG Mobility</div>
          <div style="font-size:12.5pt;font-weight:700;color:#001337;margin-bottom:88px">Jimi Gaillard</div>
          <div style="border-top:1px solid #94a3b8;padding-top:8px;font-size:8pt;color:#94a3b8;letter-spacing:0.5px">Handtekening &nbsp;·&nbsp; datum</div>
        </td>
      </tr>
    </table>

    <div style="margin-top:56px;padding:18px 22px;background:#f8fafc;border-left:3px solid rgba(0,19,55,0.12)">
      <div style="font-size:8.5pt;color:#64748b;line-height:1.75">
        Beide partijen ontvangen een ondertekend exemplaar van deze overeenkomst. Vragen kunnen gesteld
        worden via <strong style="color:#334155">${BEDRIJF.email}</strong> of
        <strong style="color:#334155">${BEDRIJF.telefoon}</strong>.
      </div>
    </div>
  </div>`;

  // ── Kopie-wrapper: zelfde inhoud + watermerk ──────────────────
  const kopiePagina = (inhoud: string) =>
    `<div style="position:relative">
      ${kopieWatermerk}
      <div style="position:relative;z-index:1">${inhoud}</div>
    </div>`;

  // ── Samenstellen ──────────────────────────────────────────────

  const origineel = `
    ${navyHeader}${coverBody}${pageFooter}

    ${PB}
    <div style="padding:44px 52px 36px">
      ${voorwaardenKop}
      ${artikelen15.map(bouwArtikel).join("")}
    </div>

    ${PB}
    <div style="padding:44px 52px 36px">
      ${artikelen69.map(bouwArtikel).join("")}
      ${bijzondereAfspraken}
    </div>
    ${pageFooter}

    ${PB}
    ${ondertekeningBody}
    ${pageFooter}
  `;

  const kopie = `
    ${PB}
    ${kopiePagina(`${navyHeader}${coverBody}${pageFooter}`)}

    ${PB}
    ${kopiePagina(`<div style="padding:44px 52px 36px">${voorwaardenKop}${artikelen15.map(bouwArtikel).join("")}</div>`)}

    ${PB}
    ${kopiePagina(`<div style="padding:44px 52px 36px">${artikelen69.map(bouwArtikel).join("")}${bijzondereAfspraken}</div>${pageFooter}`)}

    ${PB}
    ${kopiePagina(`${ondertekeningBody}${pageFooter}`)}
  `;

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
${origineel}
${kopie}
</body>
</html>`;
}

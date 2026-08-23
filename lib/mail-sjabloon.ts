/**
 * De mails die een klant van JG Mobility krijgt.
 *
 * WAAROM ÉÉN PLEK
 * De factuurmail en de bedankmail stonden allebei uitgeschreven in de route, elk met hun
 * eigen koptekst, kleuren en voettekst. Twee bijna-gelijke sjablonen naast elkaar lopen
 * altijd uit de pas: pas je het adres of de huisstijl aan, dan doe je er één en vergeet je
 * de andere. Ze delen nu dezelfde romp.
 *
 * WAAROM HET ER ZO UITZIET
 * Mail is geen webpagina. Outlook rendert met de opmaakmotor van Word: geen flexbox, geen
 * grid, geen achtergrondafbeeldingen, en stijlbladen worden weggegooid. Alles gaat daarom
 * via tabellen met inline stijl, met een vaste breedte van 600 pixels — de maat die elk
 * mailprogramma sinds jaar en dag aankan.
 *
 * De opmaak volgt de factuur en het consignatiecontract: navy balk bovenaan, hetzelfde
 * adresblok, dezelfde kleuren. Wat de klant per mail krijgt hoort eruit te zien als wat
 * er in de bijlage zit.
 */

const KLEUR = {
  navy: "#001337",
  tekst: "#1e293b",
  grijs: "#64748b",
  zacht: "#94a3b8",
  lijn: "#e2e8f0",
  vlak: "#f8fafc",
  groen: "#15803d",
  groenVlak: "#dcfce7",
} as const;

const BEDRIJF = {
  naam: "JG Mobility",
  adres: "Arnhemseweg 10a",
  postcode: "2994 LA Barendrecht",
  email: "info@jgmobility.nl",
  telefoon: "+31 6 21331374",
  website: "www.jgmobility.nl",
  iban: "NL94 ABNA 0154171638",
} as const;

const euro = (n: number) => `&euro; ${Math.round(n).toLocaleString("nl-NL")}`;
const veilig = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Eén regel in het gegevensblok. */
function regel(label: string, waarde: string, nadruk = false): string {
  return `<tr>
    <td style="padding:7px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${KLEUR.grijs};border-bottom:1px solid ${KLEUR.lijn}">${veilig(label)}</td>
    <td align="right" style="padding:7px 0;font-family:Arial,Helvetica,sans-serif;font-size:${nadruk ? 15 : 13}px;font-weight:${nadruk ? 700 : 600};color:${nadruk ? KLEUR.navy : KLEUR.tekst};border-bottom:1px solid ${KLEUR.lijn}">${waarde}</td>
  </tr>`;
}

function romp(opts: {
  voorvertoning: string;
  badge?: { tekst: string; kleur: string; vlak: string };
  titel: string;
  aanhef: string;
  alineas: string[];
  gegevens: string;
  blok?: string;
  afsluiting: string;
}): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${veilig(opts.titel)}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef0f4;">
<!-- Regel die in het postvak naast het onderwerp verschijnt, maar niet in de mail zelf. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${veilig(opts.voorvertoning)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef0f4;">
  <tr>
    <td align="center" style="padding:28px 12px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid ${KLEUR.lijn};">

        <tr>
          <td align="center" style="background-color:${KLEUR.navy};padding:26px 30px;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:bold;color:#ffffff;letter-spacing:1px;">${BEDRIJF.naam}</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,0.55);padding-top:5px;">${veilig(opts.titel)}</div>
          </td>
        </tr>

        ${
          opts.badge
            ? `<tr><td align="center" style="background-color:${opts.badge.vlak};padding:11px 30px;">
                 <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${opts.badge.kleur};">${veilig(opts.badge.tekst)}</span>
               </td></tr>`
            : ""
        }

        <tr>
          <td style="padding:32px 34px 8px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${KLEUR.tekst};padding-bottom:16px;">${veilig(opts.aanhef)}</div>
            ${opts.alineas
              .map(
                (a) =>
                  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:${KLEUR.tekst};padding-bottom:14px;">${a}</div>`
              )
              .join("")}
          </td>
        </tr>

        <tr>
          <td style="padding:6px 34px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${opts.gegevens}</table>
          </td>
        </tr>

        ${opts.blok ? `<tr><td style="padding:20px 34px 0;">${opts.blok}</td></tr>` : ""}

        <tr>
          <td style="padding:22px 34px 30px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:${KLEUR.tekst};">${opts.afsluiting}</div>
          </td>
        </tr>

        <tr>
          <td style="background-color:${KLEUR.vlak};border-top:1px solid ${KLEUR.lijn};padding:20px 34px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:${KLEUR.navy};padding-bottom:4px;">${BEDRIJF.naam}</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.8;color:${KLEUR.grijs};">
              ${BEDRIJF.adres} &middot; ${BEDRIJF.postcode}<br />
              <a href="mailto:${BEDRIJF.email}" style="color:${KLEUR.grijs};text-decoration:none;">${BEDRIJF.email}</a>
              &middot; ${BEDRIJF.telefoon}<br />
              <a href="https://${BEDRIJF.website}" style="color:${KLEUR.grijs};text-decoration:none;">${BEDRIJF.website}</a>
            </div>
          </td>
        </tr>

      </table>

      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:${KLEUR.zacht};padding-top:14px;">
        Deze mail is verstuurd omdat u een voertuig bij ons heeft gekocht.
      </div>

    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * De platte-tekstversie die naast de opgemaakte mail wordt meegestuurd.
 *
 * WAAROM DIT ERTOE DOET
 * Een mail met alleen HTML en geen tekstversie is voor spamfilters een signaal op zich —
 * echte post van bedrijven stuurt allebei mee, bulkmail vaak niet. Zeker Outlook en
 * Hotmail wegen dat mee. Het kost bijna niets en het is een van de weinige knoppen die je
 * zelf in de hand hebt.
 *
 * Het is bovendien wat iemand ziet die zijn mail zonder opmaak leest, of met een
 * schermlezer.
 */
function platteTekst(regels: (string | false)[]): string {
  return regels
    // Alleen de weggevallen regels eruit, NIET de lege. Met filter(Boolean) verdwijnen de
    // lege strings mee — en dat zijn juist de witregels tussen de alinea's. De tekst wordt
    // dan één blok waar niemand doorheen komt.
    .filter((r): r is string => r !== false)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type MailGegevens = {
  klant_naam: string;
  factuur_nr: string;
  voertuig: string;
  kenteken?: string;
  totaal: number;
  vervaldatum?: string;
  betaalwijze?: string;
};

/** De mail bij een openstaande factuur. */
export function factuurMail(g: MailGegevens): { onderwerp: string; html: string; tekst: string } {
  const perBank = (g.betaalwijze ?? "bank") === "bank";
  const voornaam = (g.klant_naam || "").trim().split(" ")[0] || "";
  const bedrag = `€ ${Math.round(g.totaal).toLocaleString("nl-NL")}`;

  return {
    onderwerp: `Factuur ${g.factuur_nr} — ${BEDRIJF.naam}`,
    tekst: platteTekst([
      voornaam ? `Beste ${voornaam},` : "Beste klant,",
      "",
      `Hierbij ontvangt u de factuur voor uw ${g.voertuig}. De volledige factuur zit als PDF bij deze mail.`,
      "",
      `Factuurnummer: ${g.factuur_nr}`,
      `Voertuig: ${g.voertuig}`,
      !!g.kenteken && `Kenteken: ${g.kenteken}`,
      !!g.vervaldatum && `Te voldoen voor: ${g.vervaldatum}`,
      `Totaalbedrag: ${bedrag}`,
      "",
      perBank && `Betaalgegevens
IBAN ${BEDRIJF.iban}
Ten name van ${BEDRIJF.naam}
Omschrijving ${g.factuur_nr}`,
      "",
      "Zolang het bedrag niet is bijgeschreven kunt u het voertuig helaas nog niet ophalen. Zodra de betaling binnen is nemen wij contact met u op om een moment af te spreken.",
      "",
      "Heeft u een vraag over deze factuur, dan mag u altijd bellen of mailen.",
      "",
      "Met vriendelijke groet,",
      "Jimi Gaillard",
      `${BEDRIJF.naam} · ${BEDRIJF.adres}, ${BEDRIJF.postcode}`,
      `${BEDRIJF.email} · ${BEDRIJF.telefoon}`,
    ]),
    html: romp({
      voorvertoning: `Uw factuur ${g.factuur_nr} van ${euro(g.totaal).replace("&euro;", "€")} zit als bijlage bij deze mail.`,
      titel: "Factuur",
      aanhef: voornaam ? `Beste ${voornaam},` : "Beste klant,",
      alineas: [
        `Hierbij ontvangt u de factuur voor uw ${veilig(g.voertuig)}. De volledige factuur zit als PDF bij deze mail.`,
      ],
      gegevens: [
        regel("Factuurnummer", veilig(g.factuur_nr)),
        regel("Voertuig", veilig(g.voertuig)),
        g.kenteken ? regel("Kenteken", veilig(g.kenteken)) : "",
        g.vervaldatum ? regel("Te voldoen voor", veilig(g.vervaldatum)) : "",
        regel("Totaalbedrag", euro(g.totaal), true),
      ].join(""),
      blok: perBank
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${KLEUR.vlak};border-left:3px solid ${KLEUR.navy};">
             <tr><td style="padding:16px 18px;">
               <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${KLEUR.navy};padding-bottom:8px;">Betaalgegevens</div>
               <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.9;color:${KLEUR.tekst};">
                 IBAN &nbsp;<strong>${BEDRIJF.iban}</strong><br />
                 Ten name van &nbsp;<strong>${BEDRIJF.naam}</strong><br />
                 Omschrijving &nbsp;<strong>${veilig(g.factuur_nr)}</strong>
               </div>
             </td></tr>
           </table>`
        : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${KLEUR.vlak};border-left:3px solid ${KLEUR.navy};">
             <tr><td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:${KLEUR.tekst};">
               De betaling verloopt zoals met u afgesproken.
             </td></tr>
           </table>`,
      afsluiting: `Zolang het bedrag niet is bijgeschreven kunt u het voertuig helaas nog niet ophalen. Zodra de betaling binnen is nemen wij contact met u op om een moment af te spreken.<br /><br />Heeft u een vraag over deze factuur, dan mag u altijd bellen of mailen.<br /><br />Met vriendelijke groet,<br /><strong>Jimi Gaillard</strong><br /><span style="color:${KLEUR.grijs};">${BEDRIJF.naam}</span>`,
    }),
  };
}

/** De mail nadat de betaling binnen is. */
export function bedankMail(g: MailGegevens): { onderwerp: string; html: string; tekst: string } {
  const voornaam = (g.klant_naam || "").trim().split(" ")[0] || "";
  const bedrag = `€ ${Math.round(g.totaal).toLocaleString("nl-NL")}`;

  return {
    onderwerp: `Bedankt voor uw aankoop — factuur ${g.factuur_nr} voldaan`,
    tekst: platteTekst([
      voornaam ? `Beste ${voornaam},` : "Beste klant,",
      "",
      `Uw betaling is bij ons binnengekomen. Hartelijk dank voor het vertrouwen in ${BEDRIJF.naam} en veel rijplezier met uw ${g.voertuig}.`,
      "",
      "In de bijlage vindt u de factuur, nu voorzien van de vermelding betaald. Bewaar hem goed: u heeft hem nodig bij een eventuele doorverkoop en voor uw eigen administratie.",
      "",
      `Factuurnummer: ${g.factuur_nr}`,
      `Voertuig: ${g.voertuig}`,
      !!g.kenteken && `Kenteken: ${g.kenteken}`,
      `Voldaan bedrag: ${bedrag}`,
      "",
      "Komt u er onverhoopt achter dat er iets niet klopt, laat het ons dan gerust weten — daar komen we samen uit.",
      "",
      "Met vriendelijke groet,",
      "Jimi Gaillard",
      `${BEDRIJF.naam} · ${BEDRIJF.adres}, ${BEDRIJF.postcode}`,
      `${BEDRIJF.email} · ${BEDRIJF.telefoon}`,
    ]),
    html: romp({
      voorvertoning: `Uw betaling is ontvangen. De factuur ${g.factuur_nr} is voldaan.`,
      titel: "Betaling ontvangen",
      badge: { tekst: "Voldaan", kleur: KLEUR.groen, vlak: KLEUR.groenVlak },
      aanhef: voornaam ? `Beste ${voornaam},` : "Beste klant,",
      alineas: [
        `Uw betaling is bij ons binnengekomen. Hartelijk dank voor het vertrouwen in ${BEDRIJF.naam} en veel rijplezier met uw ${veilig(g.voertuig)}.`,
        `In de bijlage vindt u de factuur, nu voorzien van de vermelding <strong>betaald</strong>. Bewaar hem goed: u heeft hem nodig bij een eventuele doorverkoop en voor uw eigen administratie.`,
      ],
      gegevens: [
        regel("Factuurnummer", veilig(g.factuur_nr)),
        regel("Voertuig", veilig(g.voertuig)),
        g.kenteken ? regel("Kenteken", veilig(g.kenteken)) : "",
        regel("Voldaan bedrag", euro(g.totaal), true),
      ].join(""),
      afsluiting: `Komt u er onverhoopt achter dat er iets niet klopt, laat het ons dan gerust weten — daar komen we samen uit.<br /><br />Met vriendelijke groet,<br /><strong>Jimi Gaillard</strong><br /><span style="color:${KLEUR.grijs};">${BEDRIJF.naam}</span>`,
    }),
  };
}

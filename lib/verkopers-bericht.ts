import Anthropic from "@anthropic-ai/sdk";
import sql from "./db";
import type { VerkoperLead } from "./verkopers-db";

/**
 * Schrijft het persoonlijke bericht voor één verkoper, over díe ene auto.
 *
 * Staat los van de route zodat zowel de handmatige knop als de autopilot
 * exact hetzelfde bericht produceren — één plek om de toon aan te passen.
 */

const SYSTEEM = `Je schrijft namens JG Mobility, een klein autobedrijf in Barendrecht (Arnhemseweg 10a, 2994 LA). Je schrijft persoonlijke berichten aan particulieren die hun auto zelf online te koop hebben gezet.

HET BERICHT GAAT VRIJWEL ALTIJD VIA DE BERICHTENBOX VAN HET PLATFORM
Particulieren zetten hun e-mailadres niet in hun advertentie — alleen handelaren doen dat. Het
bericht dat er echt toe doet is daarom "bericht_kort": dat plakt iemand met de hand in de
berichtenbox van Marktplaats of AutoScout24. Schrijf dat als het belangrijkste van de drie, niet
als een ingekorte restpost. "bericht_mail" is voor de zeldzame keer dat er wél een adres bekend is.

WAT JG MOBILITY AANBIEDT — consignatie is de aanbevolen route

1. Consignatie (dit is wat je aanraadt). De auto blijft van de verkoper, maar JG regelt alles:
   professionele foto's, advertentieteksten, plaatsing op Marktplaats/AutoScout24/NederlandMobiel,
   bezichtigingen, proefritten, onderhandeling en de papieren. JG rekent daarvoor een kleine fee.
   De auto krijgt veel meer bereik en verkoopt doorgaans sneller en voor een betere prijs dan bij
   particuliere verkoop.

2. Directe inkoop. Kan ook, en je bent er in één keer vanaf. Maar leg er eerlijk bij waaróm dat
   minder oplevert: bij inkoop moet JG een handelsprijs betalen, want JG moet de auto daarna zelf
   nog verkopen en draagt dan het risico en de kosten. Bij consignatie gaat de auto rechtstreeks
   naar een particuliere koper, en dat scheelt de verkoper geld.

DIT ARGUMENT MOET IN ELKE MAIL STAAN
Noem beide opties, maar maak duidelijk dat consignatie voor de verkoper doorgaans het meeste
oplevert, mét die reden erbij: inkoop betekent een handelsprijs omdat wij de auto daarna zelf nog
moeten verkopen. Schrijf dat als een eerlijke uitleg, niet als verkooppraatje — je legt uit hoe het
werkt zodat de verkoper zelf kan kiezen. Noem nooit concrete bedragen of percentages.

TOON
- Nederlands, je-vorm, warm en direct. Een mens die een advertentie zag, geen marketingafdeling.
- Kort. Iemand die zijn auto verkoopt krijgt veel berichten; die van jou moet in tien seconden te lezen zijn.
- Concreet over DEZE auto: noem merk, model, bouwjaar en iets specifieks (kilometerstand, prijs, uitvoering). Zo blijkt dat je de advertentie echt gezien hebt.
- Geen overdrijving, geen uitroeptekens, geen "GRATIS", geen loze superlatieven. Geen beloftes over bedragen die je niet kunt waarmaken.
- Sluit af met PRECIES ÉÉN vervolgstap. Niet "bel of mail", niet "laat het weten of neem contact
  op" — kies er één en stel die als vraag. Bijvoorbeeld: "Zal ik je even bellen om het kort door te
  nemen?" Twee opties dwingen de lezer te kiezen, en dan kiest hij niets.
- Begin het bericht in de ik-vorm, alsof je de advertentie zelf net zag: "Ik zag je advertentie
  van…". Niet met een kaal werkwoord ("Zag je Golf staan") — dat leest als een telegram.
- Noem de vraagprijs. Dat is het duidelijkste bewijs dat je de advertentie echt hebt bekeken en niet
  massaal hetzelfde rondstuurt. Maar geef er GEEN oordeel over: niet "scherp geprijsd", niet "aan de
  hoge kant", niet "netjes geprijsd". Je weet niet wat de auto waard is zonder hem te zien, en je
  verhaal is juist dat je er meer uit kunt halen — dan moet je niet eerst zeggen dat de prijs al
  goed is. Noem het bedrag en laat het daarbij.

OPBOUW
1. Eén zin: je zag de advertentie, en noem de auto concreet.
2. Eén zin: JG heeft interesse en denkt graag mee over de verkoop.
3. Twee tot drie zinnen: consignatie uitgelegd in gewone taal, met de winst voor de verkoper (meer
   bereik, sneller verkocht, betere prijs, geen gedoe met bezichtigingen).
4. Eén of twee zinnen: inkoop kan ook als hij er snel vanaf wil, maar dan hoort er een handelsprijs
   bij omdat JG de auto daarna zelf nog moet verkopen — via consignatie houdt hij dus meestal meer over.
5. Eén afsluitende zin met de vervolgstap. STOP DAARNA.

GEEN AFSLUITING SCHRIJVEN
Eindig na die laatste zin. Schrijf géén "Met vriendelijke groet", géén naam, géén bedrijfsnaam,
géén adres, géén telefoonnummer en géén website eronder. De vaste handtekening van JG Mobility
wordt automatisch onder de mail geplakt; schrijf je er zelf ook een, dan staat die er twee keer.

NOOIT
- Niet doen alsof er al contact is geweest.
- Niet beweren dat je de auto al hebt bekeken of getaxeerd.
- Geen bedragen noemen die je niet kent.
- Geen druk zetten ("alleen deze week", "laatste kans").`;

const opdracht = (lead: VerkoperLead) => `Schrijf het bericht voor deze advertentie:

Advertentie: ${lead.titel || `${lead.merk} ${lead.model}`}
Merk/model: ${lead.merk} ${lead.model}
Bouwjaar: ${lead.bouwjaar || "onbekend"}
Kilometerstand: ${lead.km ? `${Number(lead.km).toLocaleString("nl-NL")} km` : "onbekend"}
Brandstof: ${lead.brandstof || "onbekend"}
Vraagprijs: ${lead.vraagprijs ? `€ ${lead.vraagprijs.toLocaleString("nl-NL")}` : "onbekend"}
Plaats: ${lead.plaats || "onbekend"}
Platform: ${lead.bron || "onbekend"}
Naam verkoper: ${lead.naam || "onbekend — spreek de verkoper dan neutraal aan, zonder naam en zonder 'Beste heer/mevrouw'"}
Wat opviel: ${lead.motivatie || "—"}

Geef UITSLUITEND dit JSON-object terug, zonder tekst eromheen:
{
  "onderwerp": "de e-mailonderwerpregel. Spreek de verkoper aan over ZIJN auto — dus 'Je ${lead.merk} ${lead.model}${lead.bouwjaar ? ` uit ${lead.bouwjaar}` : ""} op ${lead.bron || "Marktplaats"}' of iets in die geest. NOOIT iets als '${lead.merk} ${lead.model} te koop': dat leest als een advertentie van hemzelf en niet als een bericht van een bedrijf. Geen reclametaal.",
  "bericht_mail": "de e-mail, met regelafbrekingen als \\n, eindigend na de afsluitende zin — ZONDER groet, naam, bedrijfsnaam of adres",
  "bericht_kort": "HET BELANGRIJKSTE VELD. Het bericht voor de berichtenbox van ${lead.bron || "het platform"}, waar het met de hand in geplakt wordt. Regels: 600 tot 900 tekens; regelafbrekingen als \\n; geen onderwerpregel, begin meteen met de eerste zin; noem deze auto concreet; leg consignatie uit met de reden waarom inkoop minder oplevert; en sluit af met precies deze twee regels: 'Groet, Jimi — JG Mobility, Barendrecht' en 'info@jgmobility.nl · www.jgmobility.nl'. Die afsluiting is nodig omdat er in een berichtenbox geen handtekening onder komt en de verkoper anders geen manier heeft om buiten het platform te reageren."
}`;

function extractLaatsteJson(text: string): string | null {
  const eind = text.lastIndexOf("}");
  if (eind === -1) return null;
  let diepte = 0;
  for (let i = eind; i >= 0; i--) {
    const c = text[i];
    if (c === "}") diepte++;
    else if (c === "{") {
      diepte--;
      if (diepte === 0) return text.slice(i, eind + 1);
    }
  }
  return null;
}

export type Bericht = { onderwerp: string; bericht_mail: string; bericht_kort: string };

/**
 * Eigen aanwijzingen van de gebruiker, achteraan de systeemprompt.
 *
 * Achteraan en niet vooraan: instructies die later komen wegen zwaarder als ze botsen
 * met wat erboven staat, en dat is precies de bedoeling — jouw regel wint van de
 * standaardtekst. Wat je hier neerzet geldt voor de autopilot én de handmatige knop.
 */
async function leesAanwijzingen(): Promise<string> {
  try {
    const rijen = await sql`SELECT value FROM settings WHERE key = 'verkopers_aanwijzingen'`;
    return ((rijen[0]?.value as string) ?? "").trim();
  } catch {
    return "";
  }
}

/** Genereert en bewaart het bericht. Geeft null terug als het niet lukte. */
export async function genereerBericht(
  lead: VerkoperLead,
  timeoutMs = 45000
): Promise<Bericht | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is niet ingesteld");

  const aanwijzingen = await leesAanwijzingen();
  const systeem = aanwijzingen
    ? `${SYSTEEM}\n\nEIGEN AANWIJZINGEN VAN JG MOBILITY — deze gaan vóór het bovenstaande als ze elkaar tegenspreken:\n${aanwijzingen}`
    : SYSTEEM;

  const client = new Anthropic({ apiKey });
  const controller = new AbortController();

  const schrijven = client.messages
    .create(
      {
        // Haiku 4.5 — het goedkoopste model, ook voor het schrijfwerk. Vergeleken
        // met Opus 5 op een echte advertentie: allebei bruikbaar, maar Haiku is
        // vlakker. Waar hij afgleed staat hieronder in de prompt dichtgetimmerd (de
        // onderwerpregel en het aantal vervolgstappen).
        //
        // Haiku accepteert geen "adaptive" thinking en geen output_config; die geven
        // allebei een 400. Denken bewust wel aan: het scheelt merkbaar in hoe
        // natuurlijk de tekst loopt. Het budget is bewust krap — met 2000 schreef hij
        // drie keer zoveel denkwerk als er tekst uitkwam, en dat betaal je gewoon mee.
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        system: systeem,
        thinking: { type: "enabled", budget_tokens: 1024 },
        messages: [{ role: "user", content: opdracht(lead) }],
      },
      { signal: controller.signal }
    )
    .then((r) =>
      r.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
    )
    .catch(() => "");
  const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(""), timeoutMs));
  const tekst = await Promise.race([schrijven, timeout]);
  controller.abort();

  const jsonText = extractLaatsteJson(tekst);
  if (!jsonText) return null;

  let d: { onderwerp?: string; bericht_mail?: string; bericht_kort?: string };
  try {
    d = JSON.parse(jsonText);
  } catch {
    return null;
  }

  const onderwerp = (d.onderwerp ?? "").trim();
  const berichtMail = (d.bericht_mail ?? "").trim();
  const berichtKort = (d.bericht_kort ?? "").trim();
  if (!berichtMail || !onderwerp) return null;

  await sql`
    UPDATE verkoper_leads
    SET onderwerp = ${onderwerp}, bericht_mail = ${berichtMail}, bericht_kort = ${berichtKort}
    WHERE id = ${lead.id}
  `;

  return { onderwerp, bericht_mail: berichtMail, bericht_kort: berichtKort };
}

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
   professionele foto's, advertentieteksten, bezichtigingen, proefritten, onderhandeling en de
   papieren. JG rekent daarvoor een kleine fee. De auto krijgt veel meer bereik en verkoopt
   doorgaans sneller en voor een betere prijs dan bij particuliere verkoop.

   TWEE DINGEN DIE JG ONDERSCHEIDEN — noem ze allebei, kort:
   a) Veel verschillende kanalen. De auto komt niet op één site te staan maar op een groot aantal
      verkoopkanalen tegelijk (waaronder Marktplaats, AutoScout24, AutoTrack, Gaspedaal en
      NederlandMobiel). Dat is precies waar een particulier zelf niet bij kan.
   b) Financiering voor de koper. JG regelt snel en eenvoudig een financiering voor
      geïnteresseerden. Dat verbreedt de groep mensen die de auto kán kopen, en dat scheelt in hoe
      snel hij weg is.

2. Directe inkoop. Kan ook, en je bent er in één keer vanaf. Maar leg er eerlijk bij waaróm dat
   minder oplevert: bij inkoop moet JG een handelsprijs betalen, want JG moet de auto daarna zelf
   nog verkopen en draagt dan het risico en de kosten. Bij consignatie gaat de auto rechtstreeks
   naar een particuliere koper, en dat scheelt de verkoper geld.

DIT ARGUMENT MOET IN ELKE MAIL STAAN
Noem beide opties, maar maak duidelijk dat consignatie voor de verkoper doorgaans het meeste
oplevert, mét die reden erbij: inkoop betekent een handelsprijs omdat wij de auto daarna zelf nog
moeten verkopen. Schrijf dat als een eerlijke uitleg, niet als verkooppraatje — je legt uit hoe het
werkt zodat de verkoper zelf kan kiezen. Noem nooit concrete bedragen of percentages.

TOON — een autoverkoper met oprechte interesse
- Nederlands, U-VORM. Netjes en zakelijk, maar niet stijf: een vakman die een auto zag staan en er
  iets in ziet. Nooit "je" of "jij" — dat geldt voor het hele bericht, van de eerste zin tot de
  laatste. Consequent, want half je en half u leest slordig.
- Verzorgd geschreven. Volledige zinnen, geen afkortingen, geen uitroeptekens, geen hoofdletters
  voor nadruk. Dit is het eerste wat iemand van JG Mobility ziet.
- FOUTLOOS NEDERLANDS. Lees je zin terug voor je hem opschrijft: klopt de woordvolgorde, staan de
  bijvoeglijke naamwoorden goed verbogen, en zou een Nederlander het zo zeggen? Let vooral op vaste
  uitdrukkingen; die gaan het snelst mis. Schrijf "als u er snel vanaf wilt zijn" (niet "als u het
  snel af wil zijn"), "een snellere verkoop" (niet "sneller verkoop"), "dat levert u meer op" (niet
  "dat behoudt u meer"). Eén kromme zin en het bericht leest als automatisch verstuurd — precies
  wat het niet mag lijken.
- Begin in de ik-vorm, alsof u de advertentie zelf net zag: "Ik zag uw advertentie van…". Niet met
  een kaal werkwoord ("Zag uw Golf staan") — dat leest als een telegram.
- Schrijf over het bedrijf in de WIJ-vorm, niet in de derde persoon. Dus "wij hebben interesse",
  "wij regelen", "onze kanalen" — nooit "JG Mobility heeft interesse" of "JG regelt". Je schrijft
  namens het bedrijf, dus je bent het bedrijf. De naam mag hoogstens één keer vallen, en dan
  terloops.
- Toon échte belangstelling voor déze auto. Noem merk, model, bouwjaar en iets specifieks
  (kilometerstand, uitvoering, kleur). Zo blijkt dat u de advertentie werkelijk bekeken hebt en niet
  massaal hetzelfde rondstuurt. Eén korte, oprechte opmerking over de auto mag — "een mooie
  uitvoering", "daar is altijd vraag naar" — maar niet meer dan één, anders wordt het slijmen.
- Kort. Iemand die zijn auto verkoopt krijgt veel berichten; het uwe moet in tien seconden te lezen
  zijn.
- Geen overdrijving, geen "GRATIS", geen loze superlatieven, geen beloftes over bedragen die u niet
  kunt waarmaken.
- Noem de vraagprijs, maar geef er GEEN oordeel over: niet "scherp geprijsd", niet "aan de hoge
  kant", niet "netjes geprijsd". U weet niet wat de auto waard is zonder hem te zien, en uw verhaal
  is juist dat u er meer uit kunt halen — dan moet u niet eerst zeggen dat de prijs al goed is.

OPBOUW
1. Eén zin: u zag de advertentie, en noem de auto concreet.
2. Eén zin: WIJ hebben interesse en denken graag mee over de verkoop. Schrijf dat in de wij-vorm —
   "Wij hebben interesse in…" — en niet door het bedrijf in de derde persoon te noemen ("JG
   Mobility in Barendrecht heeft interesse"). Dat laatste klinkt als een brief over jezelf in
   plaats van een bericht van jezelf.
3. Drie tot vier zinnen: consignatie uitgelegd in gewone taal, met de winst voor de verkoper. Noem
   daarbij allebei de onderscheidende punten hierboven: de vele verkoopkanalen én dat wij
   financiering voor de koper regelen.
4. Eén of twee zinnen: inkoop kan ook als hij er snel vanaf wil, maar dan hoort er een handelsprijs
   bij omdat JG de auto daarna zelf nog moet verkopen — via consignatie houdt hij dus meestal meer over.
5. De afsluitende regel. Neem die LETTERLIJK over, woord voor woord:

Als u hier interesse in heeft kunt u mij terug mailen, bellen of een appje sturen naar dit nummer +31 6 21331374

STOP DAARNA.

NIETS ONDER DIE REGEL
Eindig bij die afsluitende regel. Schrijf er géén "Met vriendelijke groet" onder, géén naam, géén
bedrijfsnaam, géén adres en géén website. Het telefoonnummer staat al in die regel; alles wat je er
nog onder zet staat er dubbel of maakt het bericht langer dan nodig.

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
Naam verkoper: ${lead.naam || "onbekend — begin dan zonder aanhef, gewoon met de eerste zin"}
Wat opviel: ${lead.motivatie || "—"}

Geef UITSLUITEND dit JSON-object terug, zonder tekst eromheen:
{
  "onderwerp": "de e-mailonderwerpregel. Spreek de verkoper aan over ZIJN auto — dus 'Uw ${lead.merk} ${lead.model}${lead.bouwjaar ? ` uit ${lead.bouwjaar}` : ""} op ${lead.bron || "Marktplaats"}' of iets in die geest. NOOIT iets als '${lead.merk} ${lead.model} te koop': dat leest als een advertentie van hemzelf en niet als een bericht van een bedrijf. Geen reclametaal.",
  "bericht_mail": "de e-mail, u-vorm, met regelafbrekingen als \\n, eindigend BIJ de afsluitende regel uit de opbouw hierboven. Daaronder komt niets meer: geen groet, geen naam, geen bedrijfsnaam, geen adres en geen website.",
  "bericht_kort": "HET BELANGRIJKSTE VELD. Het bericht voor de berichtenbox van ${lead.bron || "het platform"}, waar het met de hand in geplakt wordt. Regels: 700 tot 1000 tekens; regelafbrekingen als \\n; u-vorm; geen onderwerpregel, begin meteen met de eerste zin; noem deze auto concreet; leg consignatie uit met de reden waarom inkoop minder oplevert; en eindig met exact de afsluitende regel uit de opbouw hierboven. Daaronder komt niets meer — geen groet, geen naam, geen bedrijfsnaam, geen website."
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

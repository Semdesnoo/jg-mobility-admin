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

WAT JG MOBILITY AANBIEDT
1. Directe inkoop — JG koopt de auto zelf, verkoper is er in één keer vanaf.
2. Consignatie — de auto blijft van de verkoper, maar JG regelt alles: professionele foto's, advertentieteksten, plaatsing op Marktplaats/AutoScout24/NederlandMobiel, bezichtigingen, proefritten, onderhandeling en de papieren. JG rekent daarvoor een kleine fee. De auto krijgt zo veel meer bereik en verkoopt doorgaans sneller en voor een betere prijs dan bij particuliere verkoop.

TOON
- Nederlands, je-vorm, warm en direct. Een mens die een advertentie zag, geen marketingafdeling.
- Kort. Iemand die zijn auto verkoopt krijgt veel berichten; die van jou moet in tien seconden te lezen zijn.
- Concreet over DEZE auto: noem merk, model, bouwjaar en iets specifieks (kilometerstand, prijs, uitvoering). Zo blijkt dat je de advertentie echt gezien hebt.
- Geen overdrijving, geen uitroeptekens, geen "GRATIS", geen loze superlatieven. Geen beloftes over bedragen die je niet kunt waarmaken.
- Sluit af met één makkelijke vervolgstap (bellen of terugmailen), niet met drie opties.

OPBOUW
1. Eén zin: je zag de advertentie, en noem de auto concreet.
2. Eén zin: JG heeft interesse — je wilt een bod doen of over de verkoop meedenken.
3. Twee tot drie zinnen: consignatie uitgelegd in gewone taal, met de winst voor de verkoper (meer bereik, sneller verkocht, betere prijs, geen gedoe met bezichtigingen).
4. Afsluiting met de vervolgstap en de ondertekening.

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
  "onderwerp": "korte, concrete e-mailonderwerpregel over deze auto — geen reclametaal",
  "bericht_mail": "de volledige e-mail, met regelafbrekingen als \\n, ondertekend met JG Mobility",
  "bericht_kort": "dezelfde boodschap ingedikt tot maximaal 500 tekens, voor de berichtenbox van ${lead.bron || "het platform"} — geen ondertekening met adres, wel de naam JG Mobility"
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
        model: "claude-opus-5",
        max_tokens: 4000,
        system: systeem,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
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

import Anthropic from "@anthropic-ai/sdk";
import { eenAanvraag, wijzigAanvraag, type Aanvraag } from "@/lib/aanvragen-db";
import { netAlineas } from "@/lib/verkopers-bericht";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Schrijft het conceptantwoord op één aanvraag.
 *
 * WAT DIT WEL EN NIET IS
 * Dit is een concept. De eigenaar leest het na, past aan wat hij wil en verstuurt het zelf
 * vanuit Gmail. Daarom staat er geen handtekening onder en wordt er niets verstuurd: dit
 * schrijft alleen, en zet het klaar bij de aanvraag.
 *
 * Zit er een taxatie bij, dan gaat het antwoord over ons bod op zijn auto. Die bedragen zijn
 * al uitgerekend en gaan er als feit in — het model neemt ze letterlijk over en rekent zelf
 * niets. Zou het dat wel doen, dan staat er straks een ander bedrag in de mail dan wat de
 * klant op papier krijgt, en dan is het verhaal niet meer te volgen.
 */

const SYSTEEM = `Je schrijft namens JG Mobility in Barendrecht het antwoord op een vraag van een klant.

WAT DIT IS
De eigenaar van JG Mobility krijgt de hele dag vragen binnen: per mail, via WhatsApp, via
Instagram, telefonisch en aan de balie. Jij schrijft daar het antwoord op. Hij leest het na,
past aan wat hij wil en verstuurt het zelf. Schrijf dus een mail die zo de deur uit kan, en
geen aanzet waar hij nog omheen moet werken.

TOON
- Nederlands, u-vorm. Over onszelf schrijf je in de WIJ-vorm: "wij hebben", "wij kunnen",
  "onze werkplaats" — nooit "JG Mobility heeft" in de derde persoon. Je schrijft namens het
  bedrijf, dus je bent het bedrijf. De naam mag hoogstens één keer vallen, en dan terloops.
- Zakelijk en vriendelijk: een vakman die even rustig antwoord geeft. Geen verkooppraatje.
- Geen uitroeptekens, geen superlatieven ("fantastisch", "uniek", "de beste"), geen
  reclametaal en geen druk ("alleen deze week", "wees er snel bij").
- Kort. Voor de meeste vragen is vier tot zes zinnen genoeg. De klant wil antwoord, geen brief.
- Foutloos Nederlands. Lees elke zin terug voor je hem opschrijft: klopt de woordvolgorde, en
  zou een Nederlander het zo zeggen? Eén kromme zin en de mail leest als automatisch verstuurd.

WITREGELS TUSSEN DE ALINEA'S — DIT IS GEEN DETAIL
Scheid elke alinea met een lege regel: twee regelafbrekingen achter elkaar (\\n\\n), niet één.
De aanhef is een eigen alinea, elk onderdeel van je antwoord is een eigen alinea, en de
afsluitende zin ook.

De klant leest dit op zijn telefoon, tussen andere berichten door. Vijf zinnen die aan elkaar
geplakt staan zijn daar een muur tekst waar hij bij de tweede zin op afhaakt, hoe goed die
zinnen ook zijn. Aan een antwoord dat niet gelezen wordt heeft niemand iets.

OPBOUW
1. De aanhef. Ken je zijn naam, gebruik die dan ("Beste Jan,"). Ken je die niet, schrijf dan
   "Geachte heer/mevrouw," — verzin nooit een naam.
2. Eén zin waarin je zijn vraag terugpakt, zodat hij ziet dat je hem gelezen hebt.
3. Het antwoord zelf, zo concreet als de gegevens toelaten.
4. Eén afsluitende zin met de volgende stap: bellen, langskomen of een afspraak inplannen.

BEDRAGEN EN FEITEN
- Krijg je cijfers uit een taxatie mee, neem die dan LETTERLIJK over zoals ze er staan. Reken
  niets zelf uit en rond niets af. De klant krijgt dezelfde bedragen straks op papier; als jij
  gaat rekenen komt daar een ander getal uit en klopt het verhaal niet meer.
- Verzin nooit gegevens die je niet hebt: geen prijzen, geen kilometerstanden, geen
  levertijden, geen beschikbaarheid en geen afspraken. Weet je iets niet, schrijf dan dat we
  dat nakijken, of stel voor om even te bellen.
- Ga in op zijn vraag, niet op het kanaal waarlangs die binnenkwam. De eigenaar stuurt dit als
  mail; of de klant oorspronkelijk appte of belde doet er voor hem niet toe, en jij weet niet
  precies wat er in dat gesprek is gezegd.

BIJ EEN BOD OP ZIJN AUTO
- Noem het bod één keer, duidelijk, in een eigen alinea.
- Zeg er in één zin bij waar het op rust — het aantal vergelijkbare auto's dat op dit moment
  online staat — zodat het geen willekeurig bedrag lijkt.
- Zet er altijd het voorbehoud van bezichtiging bij: schade, onderhoudsgeschiedenis en staat
  kunnen het bedrag nog veranderen.
- Beweer NOOIT dat we de auto hebben gezien, bekeken, gereden of getaxeerd. Dat is niet
  gebeurd; er is naar vergelijkbare auto's gekeken.

GEEN HANDTEKENING ERONDER
Eindig bij je laatste zin. Zet er géén "Met vriendelijke groet", géén naam, géén bedrijfsnaam,
géén telefoonnummer, géén adres en géén website onder. Gmail zet de handtekening er zelf
onder; alles wat jij eronder zet staat er straks dubbel.`;

const euro = (n: number) => `€ ${n.toLocaleString("nl-NL")}`;

const alsObject = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** Eerste veld met een bruikbaar getal. Nul en niet-getallen tellen niet mee. */
function getal(bron: Record<string, unknown>, ...namen: string[]): number {
  for (const naam of namen) {
    const w = Number(bron[naam]);
    if (Number.isFinite(w) && w > 0) return w;
  }
  return 0;
}

function tekstVeld(bron: Record<string, unknown>, ...namen: string[]): string {
  for (const naam of namen) {
    const w = bron[naam];
    if (typeof w === "string" && w.trim()) return w.trim();
  }
  return "";
}

/**
 * Het laatste complete JSON-object uit de tekst, van achteren naar voren geteld.
 *
 * Van achteren, want als het model er toch een zin omheen zet staat het object er als
 * laatste; en tellend, zodat een accolade binnen de tekst het niet in tweeën knipt.
 */
function laatsteJson(tekst: string): string | null {
  const eind = tekst.lastIndexOf("}");
  if (eind === -1) return null;
  let diepte = 0;
  for (let i = eind; i >= 0; i--) {
    if (tekst[i] === "}") diepte++;
    else if (tekst[i] === "{" && --diepte === 0) return tekst.slice(i, eind + 1);
  }
  return null;
}

/**
 * De onderwerpregel als het model er zelf geen bruikbare gaf.
 *
 * Kwam de aanvraag uit een mail, dan is "Re: " op het bestaande onderwerp het enige juiste:
 * daarmee blijft het antwoord in dezelfde mailwisseling staan in plaats van als los bericht
 * ergens onderaan te belanden.
 */
function standaardOnderwerp(a: Aanvraag): string {
  const bestaand = a.onderwerp.trim();
  if (bestaand) return /^re:/i.test(bestaand) ? bestaand : `Re: ${bestaand}`;
  const waarover = a.interesse.trim() || a.kenteken.trim();
  return waarover ? `Uw vraag over ${waarover}` : "Uw vraag aan JG Mobility";
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "ANTHROPIC_API_KEY is niet ingesteld. Zet de sleutel in .env en in de omgevingsvariabelen van Vercel, en probeer het daarna opnieuw.",
      },
      { status: 500 }
    );
  }

  const aanvraag = await eenAanvraag(id);
  if (!aanvraag) {
    return Response.json(
      { error: "Deze aanvraag bestaat niet meer. Ververs het overzicht en probeer het opnieuw." },
      { status: 404 }
    );
  }

  const body = alsObject(await req.json().catch(() => ({})));

  // De taxatiepagina houdt haar uitkomst als { markt, berekening } bij. Wordt dat hele object
  // doorgestuurd, dan leggen we beide lagen plat; wordt alleen de uitkomst doorgestuurd, dan
  // staat alles al op het eerste niveau. Zo hoeft de aanroeper niet te weten wat wij verwachten.
  const ruw = alsObject(body.taxatie);
  const t = { ...alsObject(ruw.markt), ...alsObject(ruw.berekening), ...ruw };
  const taxatieMeegestuurd = Object.keys(ruw).length > 0;

  const bod = getal(t, "max_inkoop");
  const verwachteVerkoop = getal(t, "verwachte_verkoop");
  const aantal = getal(t, "aantal", "aantal_advertenties", "aantal_gevonden");
  const verkoopbaarheid = tekstVeld(t, "verkoopbaarheid_reden");

  // Een taxatie zonder bedrag is geen taxatie. Zonder deze grendel zou het model een mail
  // schrijven waarin "€ 0" als bod staat, of erger: zelf een bedrag verzinnen.
  if (taxatieMeegestuurd && bod <= 0) {
    return Response.json(
      {
        error:
          "In deze taxatie staat geen inkoopbedrag. Voer de taxatie opnieuw uit en laat het antwoord daarna nog eens schrijven.",
      },
      { status: 400 }
    );
  }

  const cijfers = [
    `Ons bod op zijn auto: ${euro(bod)}`,
    verwachteVerkoop ? `Wat de auto op de markt zou moeten opbrengen: ${euro(verwachteVerkoop)}` : "",
    aantal ? `Aantal vergelijkbare auto's dat nu online staat: ${aantal}` : "",
    verkoopbaarheid ? `Hoe deze auto in de markt ligt (achtergrond voor jou, niet letterlijk overnemen): ${verkoopbaarheid}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Zijn eigen woorden gaan mee. Een antwoord dat alleen op onze samenvatting rust mist
  // waar hij het echt over had, en dat merkt hij.
  const opdracht = `Schrijf het antwoord op deze aanvraag.

WAT WE VAN DEZE KLANT WETEN
Naam: ${aanvraag.naam || "onbekend — gebruik dan de aanhef zonder naam"}
Waar het over gaat: ${aanvraag.interesse || aanvraag.onderwerp || "—"}
Onderwerp van zijn bericht: ${aanvraag.onderwerp || "—"}
Zijn auto: ${aanvraag.advertentie_titel || "—"}
Wat hij zelf schreef: ${aanvraag.bericht ? `
"${aanvraag.bericht.slice(0, 900)}"
` : "—"}
Wat hij bood: ${aanvraag.bod || "—"}
Wat hij wil inruilen: ${aanvraag.inruil || "—"}
Kenteken: ${aanvraag.kenteken || "—"}
Budget dat hij noemde: ${aanvraag.budget || "—"}
Onze eigen notitie erbij: ${aanvraag.notitie || "—"}

${
  bod > 0
    ? `DIT ANTWOORD GAAT OVER ONS BOD OP ZIJN AUTO
Neem deze bedragen letterlijk over en reken zelf niets uit:
${cijfers}`
    : `DIT IS EEN GEWOON ANTWOORD OP ZIJN VRAAG
Er is geen taxatie gedaan. Noem dus geen bedragen en doe geen bod.`
}

Geef UITSLUITEND dit JSON-object terug, zonder tekst eromheen:
{
  "onderwerp": "de onderwerpregel van de mail. Staat er hierboven een onderwerp van zijn bericht, neem dat dan over met 'Re: ' ervoor (begint het al met 'Re:', laat het dan precies zoals het is) — zo blijft het antwoord in dezelfde mailwisseling staan. Staat er geen onderwerp, schrijf dan zelf een korte zakelijke onderwerpregel over zijn vraag. Geen reclametaal.",
  "bericht": "de antwoordmail, u-vorm, met de alinea's gescheiden door \\n\\n, eindigend bij je laatste zin — daaronder komt niets meer: geen groet, geen naam, geen bedrijfsnaam, geen telefoonnummer en geen website."
}`;

  const client = new Anthropic({ apiKey });

  // 45 seconden. De functie zelf mag er op Vercel 60; blijft het model daarboven hangen, dan
  // is het beter zelf af te breken met een leesbare melding dan de hele aanroep te laten
  // sneuvelen op een time-out die de gebruiker niets zegt.
  const controller = new AbortController();
  let teLang = false;
  const klok = setTimeout(() => {
    teLang = true;
    controller.abort();
  }, 45_000);

  let tekst = "";
  try {
    const antwoord = await client.messages.create(
      {
        // Sonnet 5, en bewust niet het goedkoopste model: dit is de enige tekst die de klant
        // onder ogen krijgt. Zie lib/verkopers-bericht.ts voor dezelfde afweging.
        model: "claude-sonnet-5",
        max_tokens: 3000,
        system: SYSTEEM,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        messages: [{ role: "user", content: opdracht }],
      },
      { signal: controller.signal }
    );
    tekst = antwoord.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  } catch {
    tekst = "";
  } finally {
    clearTimeout(klok);
  }

  if (teLang) {
    return Response.json(
      { error: "Het schrijven duurde langer dan 45 seconden. Probeer het zo nog een keer." },
      { status: 504 }
    );
  }

  const jsonTekst = tekst ? laatsteJson(tekst) : null;
  let d: { onderwerp?: string; bericht?: string } = {};
  if (jsonTekst) {
    try {
      d = JSON.parse(jsonTekst);
    } catch {
      d = {};
    }
  }

  // netAlineas komt uit lib/verkopers-bericht.ts en lost daar precies dit op: de witregels
  // tussen de alinea's afdwingen in plaats van erop hopen. Hetzelfde probleem, dezelfde
  // oplossing — dus niet overschrijven.
  const bericht = netAlineas(d.bericht ?? "");
  if (!bericht) {
    return Response.json(
      { error: "Het antwoord kon niet worden geschreven. Probeer het nog een keer." },
      { status: 502 }
    );
  }

  const onderwerp = (d.onderwerp ?? "").trim() || standaardOnderwerp(aanvraag);

  await wijzigAanvraag(id, { antwoord: bericht, onderwerp });

  return Response.json({ ok: true, onderwerp, bericht });
}

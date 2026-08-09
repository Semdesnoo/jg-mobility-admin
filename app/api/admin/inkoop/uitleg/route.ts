import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Schrijft de uitleg die je aan de verkoper geeft: waarom dít bod.
 *
 * WAT DIT WEL EN NIET IS
 * Het model verzint hier niets en rekent hier niets. Alle bedragen zijn al uitgerekend
 * uit echte, getelde advertenties; die gaan er als feit in en moeten er onveranderd
 * uitkomen. Wat het model doet is die feiten in gewone taal zetten — het verschil tussen
 * een tabel en een verhaal dat iemand aan zijn keukentafel begrijpt.
 *
 * Waarom dat ertoe doet: een bod zonder uitleg voelt als een truc, zeker als het lager
 * is dan wat iemand hoopte. Een bod mét de rekensom erbij is te controleren, en dat is
 * precies het verschil met de instant-bod-sites — die noemen een bedrag en laten pas bij
 * de inspectie zien hoe ze eraan komen.
 */

const SYSTEEM = `Je schrijft namens JG Mobility in Barendrecht de uitleg bij een inkoopbod op een auto.
De verkoper is een particulier die zijn auto aanbiedt. Hij leest dit aan de keukentafel, of
krijgt het gemaild.

WAT JE KRIJGT
Een rekensom die al klopt. Alle bedragen zijn uitgerekend uit echte advertenties die op dit
moment online staan. Jij vertaalt die rekensom naar gewone taal.

HARDE REGELS
- Neem elk bedrag LETTERLIJK over zoals het je gegeven is. Reken niets zelf uit, rond niets af,
  en verzin geen bedrag dat er niet bij staat. Als je gaat rekenen komt er een ander getal uit
  dan wat de verkoper straks op papier krijgt, en dan klopt het verhaal niet meer.
- Noem het aantal vergelijkbare auto's. Dat is de kern van de onderbouwing: dit is geen
  inschatting maar een telling.
- Leg uit waarom het bod lager is dan wat die auto's kosten. Eerlijk en zonder eromheen te
  draaien: er zitten kosten aan het verkoopklaar maken, en er moet marge op omdat het bedrijf
  ervan bestaat en het risico draagt tot de auto verkocht is. Noem btw ALLEEN als er hieronder
  een btw-bedrag staat; staat het er niet, dan zeg je er niets over.
- Als de kilometerstand afwijkt van het gemiddelde van die auto's, benoem dat met het bedrag
  dat het scheelt. Dat is het meest concrete stukje van de hele onderbouwing.
- Is er op uitvoering gefilterd, zeg dat dan. "We hebben alleen naar Comfortlines gekeken"
  is precies waarom het bod klopt.
- Staat er een gemiddelde vraagprijs van particulieren bij, noem die dan eerlijk, ook als die
  hoger is dan ons bod. Dat is wat de verkoper zelf zou kunnen vragen als hij de auto op
  Marktplaats zet, en hij komt daar toch achter. Leg er meteen naast wat hij daarvoor terugkrijgt:
  wij betalen direct, nemen de vrijwaring en het papierwerk over, en er komen geen kijkers,
  proefritten of onderhandelingen aan te pas. Doe dat in één of twee zinnen, zonder het weg te
  wuiven en zonder erover door te drammen.

TOON
- Nederlands, u-vorm. Rustig en zakelijk, zoals een vakman die uitlegt hoe hij eraan komt.
- Geen verkooppraatje, geen superlatieven, geen uitroeptekens. Dit is een verantwoording.
- Kort: vier tot zes zinnen, plus eventueel een korte opsomming.
- Niet defensief. Je verontschuldigt je niet voor het bod; je laat zien hoe het is opgebouwd.
- Foutloos Nederlands. Lees elke zin terug voor je hem opschrijft.

WAT JE NOOIT DOET
- Beweren dat de auto is bekeken of getaxeerd. Dat is niet gebeurd.
- Suggereren dat het bod definitief is. Het staat onder voorbehoud van bezichtiging — schade,
  onderhoudsgeschiedenis en staat kunnen het nog veranderen. Zeg dat aan het eind in één zin.
- Een percentage of bedrag noemen dat niet in de gegevens staat.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY niet ingesteld" }, { status: 500 });

  const b = await req.json().catch(() => ({}));
  const euro = (n: unknown) => `€ ${(Number(n) || 0).toLocaleString("nl-NL")}`;

  const auto = `${b.merk ?? ""} ${b.model ?? ""}`.trim();
  if (!auto || !b.max_inkoop) {
    return Response.json({ error: "Onvolledige gegevens voor de uitleg" }, { status: 400 });
  }

  const kmVerschil = Number(b.km) - Number(b.gem_km ?? 0);
  const kmEffect = Math.round((kmVerschil / 1000) * Number(b.per_duizend_km ?? 0));

  const feiten = [
    `Auto: ${auto}${b.bouwjaar ? `, bouwjaar ${b.bouwjaar}` : ""}${
      b.km ? `, ${Number(b.km).toLocaleString("nl-NL")} km` : ""
    }`,
    b.uitvoering ? `Uitvoering: ${b.uitvoering}` : "",
    ``,
    `Aantal vergelijkbare auto's dat nu online staat: ${b.aantal ?? 0}`,
    b.op_uitvoering ? `Daarvan is alleen naar de ${b.uitvoering} gekeken.` : "",
    b.zoekbereik ? `Zoekbereik: ${b.zoekbereik}` : "",
    b.gem_prijs ? `Die auto's staan gemiddeld te koop voor ${euro(b.gem_prijs)}` : "",
    b.bron ? `Waar die auto's vandaan komen: ${b.bron}` : "",
    b.aantal_dealer
      ? `Die ${b.aantal_dealer} staan allemaal bij een autobedrijf — dat is het aanbod waar deze auto straks tussen komt te staan, dus daar is op gerekend.`
      : "",
    b.gem_km
      ? `Gemiddelde kilometerstand van al die ${b.aantal ?? ""} vergelijkbare auto's samen: ${Number(
          b.gem_km
        ).toLocaleString("nl-NL")} km`
      : "",
    ``,
    b.particulier_gemiddeld
      ? `Daarnaast stonden er nog ${b.aantal_particulier ?? 0} van particulieren. Die zitten NIET in de berekening hierboven; ze vragen gemiddeld ${euro(
          b.particulier_gemiddeld
        )}. Dat is ongeveer wat de verkoper zelf zou kunnen vragen als hij de auto zelf te koop zet.`
      : "",
    ``,
    b.per_duizend_km
      ? `Wat kilometerstand doet in dit aanbod: ${euro(Math.abs(Number(b.per_duizend_km)))} per 1.000 km`
      : "",
    kmVerschil && b.per_duizend_km
      ? `Deze auto heeft ${Math.abs(Math.round(kmVerschil)).toLocaleString("nl-NL")} km ${
          kmVerschil > 0 ? "méér" : "mínder"
        } dan dat gemiddelde, wat ${euro(Math.abs(kmEffect))} ${kmVerschil > 0 ? "lager" : "hoger"} uitkomt`
      : "",
    ``,
    `Wat deze auto op de markt zou moeten opbrengen: ${euro(b.verwachte_verkoop)}`,
    b.btw_afdracht ? `Daar gaat btw vanaf: ${euro(b.btw_afdracht)}` : "",
    b.geschatte_kosten ? `Kosten om hem verkoopklaar te maken: ${euro(b.geschatte_kosten)}` : "",
    `Marge waar JG Mobility mee rekent: ${b.gewenste_marge ?? 0}%`,
    ``,
    `HET BOD: ${euro(b.max_inkoop)}`,
  ]
    .filter((r) => r !== "")
    .join("\n");

  const client = new Anthropic({ apiKey });
  const controller = new AbortController();

  const schrijven = client.messages
    .create(
      {
        // Sonnet 5: dit is het enige stuk tekst dat een klant onder ogen krijgt, en het
        // moet kloppen én goed lopen. Zie lib/verkopers-bericht.ts voor dezelfde afweging.
        model: "claude-sonnet-5",
        max_tokens: 1500,
        system: SYSTEEM,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        messages: [
          {
            role: "user",
            content: `Schrijf de uitleg bij dit bod. Gebruik uitsluitend onderstaande gegevens en neem elk bedrag letterlijk over.\n\n${feiten}\n\nGeef alleen de tekst, geen kop en geen opmaakmarkering.`,
          },
        ],
      },
      { signal: controller.signal }
    )
    .then((r) =>
      r.content
        .filter((x): x is Anthropic.TextBlock => x.type === "text")
        .map((x) => x.text)
        .join("\n")
        .trim()
    )
    .catch(() => "");

  const tekst = await Promise.race([
    schrijven,
    new Promise<string>((resolve) => setTimeout(() => resolve(""), 45_000)),
  ]);
  controller.abort();

  if (!tekst) {
    return Response.json({ error: "De uitleg kon niet worden geschreven. Probeer het nog eens." }, { status: 422 });
  }

  return Response.json({ ok: true, uitleg: tekst });
}

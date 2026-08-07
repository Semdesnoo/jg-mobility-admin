import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";
import {
  initVerkopersDB,
  getLead,
  isGeblokkeerd,
  isAlBenaderd,
  isGeldigNlTelefoon,
  isGeldigEmail,
} from "@/lib/verkopers-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fase 2 van de zoekagent: één advertentie openen en uitlezen.
 *
 * Precies één advertentie per aanroep, zodat elke aanroep ruim binnen de 60 seconden
 * van Vercel blijft. De UI loopt de nieuwe leads na elkaar langs.
 *
 * Contactgegevens worden alleen overgenomen als ze letterlijk en openbaar op de
 * advertentie staan. Wat er niet staat blijft leeg — nooit afleiden, nooit gokken.
 */

const PROMPT = (url: string, bekend: string) =>
  `Open deze advertentie met web_fetch en lees hem uit: ${url}

Wat we al denken te weten (mag je corrigeren): ${bekend}

Beoordeel voor autobedrijf JG Mobility in Barendrecht:
- particulier_score (1-10): hoe zeker is dit een PARTICULIER en geen handelaar? Aanwijzingen voor particulier: "particuliere verkoop", verkoper met één advertentie, omschrijving in de ik-vorm, geen bedrijfsnaam/logo/garantieblok/BOVAG. Aanwijzingen voor handelaar: bedrijfsnaam, meerdere advertenties, inruil/financiering aangeboden, "occasion dealer".
- kans_score (1-10): hoe kansrijk voor JG Mobility? Hoger bij een courant model, een vraagprijs die aan de hoge kant lijkt (dan heeft de verkoper hulp nodig), en een plaats binnen redelijke afstand van Barendrecht/Zuid-Holland.
- motivatie: één concrete zin met iets specifieks uit de advertentie.

CONTACTGEGEVENS — harde regels:
- Neem naam, telefoon en e-mail alleen over als ze LETTERLIJK en openbaar op de pagina staan.
- Verzin niets en leid niets af. Staat het er niet, laat het veld leeg ("").
- Een lege lead met een goede URL is bruikbaar; een verzonnen telefoonnummer is schadelijk.

Lukt het niet om de pagina te openen of te lezen, zet dan "bereikbaar" op false en laat de rest leeg.

Antwoord UITSLUITEND met dit JSON-object:
{
  "bereikbaar": true,
  "titel": "", "merk": "", "model": "", "bouwjaar": "", "km": "", "brandstof": "",
  "vraagprijs": 0, "plaats": "",
  "naam": "", "telefoon": "", "email": "",
  "particulier_score": 0, "kans_score": 0, "motivatie": ""
}

Regels: vraagprijs en km als geheel getal zonder punten of euroteken, scores 1-10.`;

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

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY niet ingesteld" }, { status: 500 });

  const { id } = await params;
  await initVerkopersDB();
  const lead = await getLead(id);
  if (!lead) return Response.json({ error: "Lead niet gevonden" }, { status: 404 });
  if (!lead.advertentie_url) return Response.json({ error: "Geen advertentie-URL" }, { status: 400 });

  const bekend = [
    lead.merk && `merk ${lead.merk}`,
    lead.model && `model ${lead.model}`,
    lead.bouwjaar && `bouwjaar ${lead.bouwjaar}`,
    lead.vraagprijs ? `vraagprijs ${lead.vraagprijs}` : "",
    lead.plaats && `plaats ${lead.plaats}`,
  ]
    .filter(Boolean)
    .join(", ");

  const client = new Anthropic({ apiKey });
  const controller = new AbortController();

  const lezen = (async () => {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: PROMPT(lead.advertentie_url, bekend || "niets") },
    ];
    let laatsteTekst = "";
    for (let i = 0; i < 4; i++) {
      const resp = await client.messages.create(
        {
          // Sonnet 5 in plaats van Opus 5: dit is uitlezen, geen denkwerk — een paar
          // velden overtikken uit een pagina die je hem aanreikt. Scheelt ruim de helft
          // per advertentie, en dit is met afstand de duurste stap omdat hij per
          // advertentie draait.
          model: "claude-sonnet-5",
          max_tokens: 3000,
          thinking: { type: "adaptive" },
          output_config: { effort: "low" },
          // Advertentiepagina's zijn enorm (een halve megabyte is normaal) en je betaalt
          // per stuk tekst die erin gaat. Alles wat je nodig hebt — prijs, kilometers,
          // verkoper — staat bovenin; de rest is menu's en aanbevelingen.
          tools: [
            { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3, max_content_tokens: 12000 },
          ],
          messages,
        },
        { signal: controller.signal }
      );
      const rondeTekst = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      if (rondeTekst) laatsteTekst = rondeTekst;
      if (resp.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: resp.content });
        continue;
      }
      break;
    }
    return laatsteTekst;
  })().catch(() => "");

  const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(""), 45000));
  const tekst = await Promise.race([lezen, timeout]);
  controller.abort();

  const jsonText = extractLaatsteJson(tekst);
  if (!jsonText) {
    return Response.json({ error: "Kon de advertentie niet uitlezen" }, { status: 422 });
  }

  const schoon = jsonText.replace(/<cite\b[^>]*>/gi, "").replace(/<\/cite>/gi, "");
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(schoon);
  } catch {
    return Response.json({ error: "Ongeldige data van AI" }, { status: 422 });
  }

  if (d.bereikbaar === false) {
    await sql`
      UPDATE verkoper_leads
      SET notitie = 'Advertentie kon niet worden geopend (mogelijk verwijderd of afgeschermd)'
      WHERE id = ${id}
    `;
    return Response.json({ ok: true, bereikbaar: false });
  }

  const tekstveld = (v: unknown, terugval = "") =>
    typeof v === "string" && v.trim() ? v.trim() : terugval;
  const getal = (v: unknown) => {
    const n = Number(String(v ?? "").replace(/\D/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const score = (v: unknown) => Math.max(0, Math.min(10, Number(v) || 0));

  // Contactgegevens die niet kloppen zijn gevaarlijker dan geen contactgegevens: met
  // één verkeerd cijfer benader je een wildvreemde. Wat de controle niet haalt gooien
  // we weg en melden we in de notitie, zodat je het zelf op de advertentie kunt nakijken.
  const ruweEmail = tekstveld(d.email);
  const ruwTelefoon = tekstveld(d.telefoon);
  const nieuwEmail = isGeldigEmail(ruweEmail) ? ruweEmail : "";
  const nieuwTelefoon = isGeldigNlTelefoon(ruwTelefoon) ? ruwTelefoon : "";

  // Terugvallen op wat er al stond mag alleen als díe waarde de controle haalt.
  // Anders blijft een eerder verkeerd overgenomen nummer gewoon staan en heeft de
  // hele controle geen effect — precies de fout die je pas merkt als je iemand belt.
  const email = nieuwEmail || (isGeldigEmail(lead.email) ? lead.email : "");
  const telefoon = nieuwTelefoon || (isGeldigNlTelefoon(lead.telefoon) ? lead.telefoon : "");

  const afgekeurd: string[] = [];
  const afgekeurdTelefoon = ruwTelefoon && !nieuwTelefoon ? ruwTelefoon : lead.telefoon && !telefoon ? lead.telefoon : "";
  const afgekeurdEmail = ruweEmail && !nieuwEmail ? ruweEmail : lead.email && !email ? lead.email : "";
  if (afgekeurdTelefoon) afgekeurd.push(`telefoonnummer "${afgekeurdTelefoon}" leek onjuist`);
  if (afgekeurdEmail) afgekeurd.push(`e-mailadres "${afgekeurdEmail}" leek onjuist`);
  let notitie = afgekeurd.length
    ? `Niet overgenomen uit de advertentie: ${afgekeurd.join(" en ")}. Controleer het zelf op de advertentie.`
    : lead.notitie;

  // Nu de contactgegevens bekend zijn kunnen we pas zien of deze PERSOON al eerder
  // is benaderd — bijvoorbeeld toen hij een andere auto te koop zette. Dat melden
  // we hier al, zodat je het in de lijst ziet en er geen tijd in steekt.
  const eerder = await isAlBenaderd(email, telefoon, id);
  if (eerder.eerder) {
    const datum = eerder.wanneer ? new Date(eerder.wanneer).toLocaleDateString("nl-NL") : "eerder";
    notitie = `Deze verkoper is al benaderd op ${datum}${eerder.kanaal ? ` via ${eerder.kanaal}` : ""}, waarschijnlijk voor een andere auto. Er gaat geen tweede bericht uit.`;
  }

  // Kwam er nu pas een e-mailadres of nummer boven water, dan moet de blokkadelijst
  // opnieuw langs — bij het zoeken viel er nog niets te controleren.
  if (await isGeblokkeerd(email, telefoon)) {
    await sql`DELETE FROM verkoper_leads WHERE id = ${id}`;
    return Response.json({ ok: true, geblokkeerd: true });
  }

  const particulierScore = score(d.particulier_score);

  await sql`
    UPDATE verkoper_leads SET
      titel = ${tekstveld(d.titel, lead.titel)},
      merk = ${tekstveld(d.merk, lead.merk)},
      model = ${tekstveld(d.model, lead.model)},
      bouwjaar = ${tekstveld(d.bouwjaar, lead.bouwjaar)},
      km = ${String(getal(d.km) || lead.km || "")},
      brandstof = ${tekstveld(d.brandstof, lead.brandstof)},
      vraagprijs = ${getal(d.vraagprijs) || lead.vraagprijs},
      plaats = ${tekstveld(d.plaats, lead.plaats)},
      naam = ${tekstveld(d.naam, lead.naam)},
      telefoon = ${telefoon},
      email = ${email},
      particulier_score = ${particulierScore},
      kans_score = ${score(d.kans_score)},
      motivatie = ${tekstveld(d.motivatie, lead.motivatie)},
      notitie = ${notitie}
    WHERE id = ${id}
  `;

  // Handelaren zijn voor deze radar niet interessant; die halen we meteen weg
  // zodat de wachtrij schoon blijft.
  if (particulierScore > 0 && particulierScore < 6) {
    await sql`DELETE FROM verkoper_leads WHERE id = ${id}`;
    return Response.json({ ok: true, handelaar: true });
  }

  return Response.json({ ok: true, bereikbaar: true, particulier_score: particulierScore });
}

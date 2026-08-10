import { alleAanvragen, voegAanvraagToe, KANALEN, STATUSSEN } from "@/lib/aanvragen-db";

export const dynamic = "force-dynamic";

/**
 * Het dagoverzicht van klantaanvragen: alles wat er binnenkwam via mail, WhatsApp,
 * Instagram, telefoon of aan de balie.
 *
 * De kanalen- en statuslijst gaan met de GET mee. Ze staan al vast in `aanvragen-db.ts`;
 * zou het scherm ze overtypen, dan lopen de keuzelijsten vroeg of laat uit de pas met wat
 * de database accepteert — en dat merk je pas als een aanvraag buiten elk filter valt.
 */

/** Losse spaties zijn geen ingevulde tekst. Zonder trim glipt " " langs elke controle. */
function tekst(waarde: unknown): string {
  if (typeof waarde === "string") return waarde.trim();
  // Een telefoonnummer dat als getal binnenkomt is geen reden om te doen alsof het veld
  // leeg is; dan krijgt de gebruiker "vul minstens een telefoonnummer in" terwijl hij dat
  // net deed.
  if (typeof waarde === "number" && Number.isFinite(waarde)) return String(waarde);
  return "";
}

export async function GET() {
  try {
    const aanvragen = await alleAanvragen();
    return Response.json({ aanvragen, kanalen: KANALEN, statussen: STATUSSEN });
  } catch {
    // Bewust geen lege lijst met status 200: een leeg dagoverzicht ziet eruit als "rustige
    // dag", terwijl de aanvragen er wel degelijk zijn. Dan mist de eigenaar ze stilletjes.
    return Response.json(
      {
        error:
          "De aanvragen konden niet worden opgehaald. Ververs de pagina; blijft dit misgaan, controleer dan de databaseverbinding.",
      },
      { status: 500 }
    );
  }
}

/**
 * Nieuwe aanvraag met de hand vastleggen — de "Nieuwe aanvraag"-knop, voor een Instagram-DM
 * of een WhatsApp-bericht dat nergens automatisch binnenkomt.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Het verzoek bevatte geen leesbare gegevens. Vul het formulier opnieuw in en verstuur het nog een keer." },
      { status: 400 }
    );
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return Response.json(
      { error: "Het verzoek bevatte geen ingevulde velden. Vul het formulier opnieuw in en verstuur het nog een keer." },
      { status: 400 }
    );
  }
  const b = body as Record<string, unknown>;

  const naam = tekst(b.naam);
  const telefoon = tekst(b.telefoon);
  const email = tekst(b.email);
  const onderwerp = tekst(b.onderwerp);

  // Er moet iets zijn om de aanvraag aan te herkennen. Een regel zonder naam, nummer,
  // adres én onderwerp is later niet meer thuis te brengen, en zo'n regel in het
  // dagoverzicht is erger dan helemaal geen regel.
  if (!naam && !telefoon && !email && !onderwerp) {
    return Response.json(
      {
        error:
          "Vul minstens een naam, telefoonnummer, e-mailadres of onderwerp in — anders is later niet meer terug te zien wie dit was.",
      },
      { status: 400 }
    );
  }

  // Niets ingevuld wordt "overig", net als in de database. Een kanaal dat wél is ingevuld
  // maar niet bestaat, is een echte fout: die aanvraag zou buiten elk filter vallen.
  // Hoofdletters mogen niet uitmaken: "WhatsApp" is hetzelfde kanaal als "whatsapp".
  const bron = tekst(b.bron).toLowerCase() || "overig";
  if (!(KANALEN as readonly string[]).includes(bron)) {
    return Response.json(
      { error: `Dat kanaal kennen we niet. Kies er een uit: ${KANALEN.join(", ")}.` },
      { status: 400 }
    );
  }

  try {
    const aanvraag = await voegAanvraagToe({
      naam,
      telefoon,
      email,
      bron,
      onderwerp,
      interesse: tekst(b.interesse),
      budget: tekst(b.budget),
      notitie: tekst(b.notitie),
      kenteken: tekst(b.kenteken),
      // Op één auto reageren meerdere mensen; zonder deze koppeling valt een handmatig
      // vastgelegde aanvraag in het tabblad "per auto" in een eigen groepje en zie je hem
      // niet staan bij de anderen die achter dezelfde auto aan zitten.
      autoId: Number.isFinite(Number(b.autoId)) && b.autoId !== null && b.autoId !== ""
        ? Number(b.autoId)
        : null,
      autoNaam: tekst(b.autoNaam),
      bod: tekst(b.bod),
      inruil: tekst(b.inruil),
      // De auto uit ZIJN advertentie plus de link erheen, en wat hij letterlijk zei.
      // Zonder deze drie moet je bij elk gesprek terugzoeken waar het over ging.
      advertentieTitel: tekst(b.advertentieTitel),
      advertentieUrl: tekst(b.advertentieUrl),
      bericht: tekst(b.bericht),
    });
    return Response.json({ aanvraag }, { status: 201 });
  } catch {
    return Response.json(
      {
        error:
          "De aanvraag kon niet worden opgeslagen. Probeer het nog een keer; blijft dit misgaan, controleer dan de databaseverbinding.",
      },
      { status: 500 }
    );
  }
}

import {
  STATUSSEN,
  eenAanvraag,
  wijzigAanvraag,
  zetAfgehandeld,
  verwijderAanvraag,
} from "@/lib/aanvragen-db";

export const dynamic = "force-dynamic";

/**
 * Eén aanvraag aanpassen of weggooien.
 *
 * Alles wat de database raakt loopt via `lib/aanvragen-db.ts`. Deze route doet dus maar
 * twee dingen: kijken of wat er binnenkomt klopt, en er een begrijpelijke melding van
 * maken als dat niet zo is.
 */

/**
 * De velden die het scherm mag aanpassen. Deze lijst staat hier bewust nog een keer:
 * wat er in de body zit komt van buiten, en alleen namen uit déze lijst gaan door naar
 * de database. Zet iemand er `id` of `aangemaakt` in, dan valt dat er hier vanzelf uit.
 */
const AANPASBAAR = [
  "naam",
  "telefoon",
  "email",
  "bron",
  "interesse",
  "budget",
  "notitie",
  "status",
  "onderwerp",
  "kenteken",
  "antwoord",
  // Wat iemand bood en wat hij wil inruilen. Zonder deze drie slaan die velden in het
  // detailpaneel stil niets op: je typt "17.500", klikt weg, en het is verdwenen.
  "bod",
  "ons_bod",
  "inruil",
  "auto_naam",
  "advertentie_titel",
  "advertentie_url",
  "bericht",
] as const;

type Veld = (typeof AANPASBAAR)[number];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Losse try om de body: een kapot of leeg verzoek is iets anders dan een database die
  // stukloopt, en verdient dus ook een ander antwoord dan een 500.
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { error: "Het verzoek bevatte geen geldige gegevens. Probeer het opnieuw." },
      { status: 400 }
    );
  }
  if (!body || typeof body !== "object") {
    return Response.json(
      { error: "Het verzoek bevatte geen geldige gegevens. Probeer het opnieuw." },
      { status: 400 }
    );
  }

  const velden: Partial<Record<Veld, string>> & { auto_id?: number | null } = {};

  // auto_id staat bewust NIET in AANPASBAAR: het is een getal en de rest is tekst. Wel
  // aanpasbaar moet het zijn — anders blijft de koppeling met de auto na het aanmaken
  // voorgoed staan en wordt de rij tegenstrijdig zodra iemand een andere auto kiest.
  // Een lege waarde betekent hier bewust "ontkoppelen".
  if (body.auto_id !== undefined) {
    const rauw = body.auto_id;
    if (rauw === null || rauw === "") velden.auto_id = null;
    else if (Number.isFinite(Number(rauw))) velden.auto_id = Number(rauw);
    else {
      return Response.json(
        { error: "De gekozen auto werd niet herkend. Kies hem opnieuw uit de lijst." },
        { status: 400 }
      );
    }
  }

  for (const veld of AANPASBAAR) {
    const waarde = body[veld];
    // `null` telt hier als "niet meegestuurd". Een veld leegmaken doe je met een lege
    // tekst; zo kan een half ingevuld formulier nooit per ongeluk iets wissen.
    if (waarde === undefined || waarde === null) continue;
    velden[veld] = String(waarde);
  }

  // De statuspijplijn is een vaste lijst. Een typefout hier zou een aanvraag onzichtbaar
  // maken in elke filter die op status werkt, dus die weigeren we meteen.
  if (velden.status !== undefined && !(STATUSSEN as readonly string[]).includes(velden.status)) {
    return Response.json(
      { error: `Onbekende status "${velden.status}". Kies uit: ${STATUSSEN.join(", ")}.` },
      { status: 400 }
    );
  }

  const afgehandeld = body.afgehandeld;
  if (afgehandeld !== undefined && typeof afgehandeld !== "boolean") {
    return Response.json(
      { error: "Afgehandeld moet ja of nee zijn. Vink het vakje aan of uit en probeer opnieuw." },
      { status: 400 }
    );
  }

  try {
    // Eerst de velden, daarna het afvinken. Andersom zou het afvinken van een aanvraag
    // waarvan tegelijk de status meekomt niet terugkomen in wat we teruggeven.
    let bijgewerkt =
      Object.keys(velden).length > 0 ? await wijzigAanvraag(id, velden) : await eenAanvraag(id);

    if (typeof afgehandeld === "boolean") {
      bijgewerkt = await zetAfgehandeld(id, afgehandeld);
    }

    if (!bijgewerkt) {
      return Response.json(
        { error: "Deze aanvraag bestaat niet meer. Ververs het overzicht." },
        { status: 404 }
      );
    }

    // Zelfde vorm als de POST hiernaast: { aanvraag }. Twee routes over hetzelfde ding
    // die verschillend antwoorden is een valkuil die je pas merkt als het scherm de
    // verkeerde helft uitleest.
    return Response.json({ aanvraag: bijgewerkt });
  } catch (e) {
    return Response.json(
      {
        error: "Opslaan is niet gelukt. Probeer het zo nog eens.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

/**
 * Weggooien is expres niet kieskeurig: is de aanvraag er al niet meer, dan is het doel
 * bereikt. Twee keer op de prullenbak drukken hoort geen foutmelding op te leveren.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await verwijderAanvraag(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      {
        error: "Verwijderen is niet gelukt. Probeer het zo nog eens.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

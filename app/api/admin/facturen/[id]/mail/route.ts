import { NextRequest } from "next/server";
import { Resend } from "resend";
import sql from "@/lib/db";
import { factuurMail, bedankMail, type MailGegevens } from "@/lib/mail-sjabloon";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Verstuurt de factuurmail of de bedankmail naar de klant.
 *
 * TWEE FOUTEN DIE HIER ZATEN
 *
 * 1. Het antwoord van Resend werd nooit gelezen. De SDK gooit geen fout bij een
 *    afgekeurde verzending — hij geeft `{ data, error }` terug. Ging er iets mis (een
 *    afzender die niet geverifieerd is, een ongeldig adres, een limiet), dan liep de code
 *    gewoon door naar "gelukt", schreef het verzendmoment weg en meldde aan het scherm dat
 *    de mail verstuurd was. De klant kreeg niets en jij zag een vinkje.
 *
 * 2. De grendel tegen twee keer versturen zat alleen in het scherm. Twee tabbladen, een
 *    dubbelklik of een verversing en de klant kreeg dezelfde factuur twee keer.
 *
 * HOE HET NU WERKT
 * Het verzendmoment wordt vastgelegd VÓÓR het versturen, met een UPDATE die alleen
 * aanslaat als het veld nog leeg is. Verandert die update niets, dan was iemand anders
 * eerder en weigeren we. Mislukt het versturen daarna alsnog, dan wordt het veld
 * teruggezet zodat je opnieuw kunt proberen. Zo kan er nooit meer dan één mail uitgaan, en
 * blijft een mislukte poging niet als "verstuurd" staan.
 */
/**
 * Tekens die je niet ziet maar die wel meekomen bij het plakken uit een browser of
 * een wachtwoordkluis: zero-width space, zero-width non-joiner, zero-width joiner, de
 * byte-order mark en de harde spatie. Hier is al eens een dag aan verloren toen de
 * mails van de website niet aankwamen door zo'n teken in de sleutel.
 *
 * Opgebouwd uit codepunten en niet als escape-reeks: zo staat er niets in dit bestand
 * dat er onschuldig uitziet maar onzichtbaar is.
 */
const ONZICHTBAAR = new RegExp(
  "[" + String.fromCharCode(0x200b, 0x200c, 0x200d, 0xfeff, 0x00a0) + "]",
  "g"
);

/**
 * Het adres waar de factuurmail vandaan komt als de instelling ontbreekt of niet klopt.
 *
 * Dit is geen noodgreep maar het normale zakelijke adres: het staat op de website, het is
 * het adres waar de klant op terugmailt (zie `replyTo` verderop) en het domein is
 * geverifieerd bij de mailserver — de andere mails van de zaak gaan al vanaf datzelfde
 * domein de deur uit.
 */
const STANDAARD_AFZENDER = "JG Mobility <info@jgmobility.nl>";

/**
 * Maakt van de instelling een afzender die de mailserver accepteert.
 *
 * Waarom dit nodig is: hier ging het drie keer mis. De code plakte er eerst blind
 * "JG Mobility <...>" omheen, dus stond er in de instelling al een naam ("JG Mobility
 * <info@jgmobility.nl>"), dan werd het "JG Mobility <JG Mobility <info@...>>" en weigerde
 * de mailserver het hele bericht. Daarna sloop er bij het plakken een onzichtbaar teken
 * mee — daar is bij de website al eens een dag aan verloren. En de derde keer stond er
 * simpelweg een typefout in de instelling in het Vercel-scherm ("info@jgmobility.n", de l
 * eraf), waardoor er geen enkele factuurmail meer uitging.
 *
 * Die derde is de reden dat deze functie geen fout meer teruggeeft. Eén verkeerd getikte
 * letter in een instellingenscherm hoort de facturatie niet plat te leggen: klopt de
 * waarde niet, dan gaat de mail gewoon vanaf het vaste adres van de zaak en blijft er een
 * regel in het logboek achter. De instelling is nog steeds bruikbaar — als hij klopt,
 * wint hij — maar hij is geen struikeldraad meer.
 */
function maakAfzender(waarde: string | undefined): { afzender: string; melding?: string } {
  // Zero-width tekens, harde spaties en aanhalingstekens die bij het plakken meekomen.
  const schoon = (waarde ?? "")
    .replace(ONZICHTBAAR, "")
    .replace(/^["']|["']$/g, "")
    .trim();

  if (!schoon) {
    return { afzender: STANDAARD_AFZENDER, melding: "RESEND_FROM_EMAIL is niet ingevuld" };
  }

  // Staat er al een naam voor het adres, dan is hij al compleet.
  const metNaam = schoon.match(/^(.+?)\s*<([^<>@\s]+@[^<>@\s]+\.[a-z]{2,})>$/i);
  if (metNaam) return { afzender: `${metNaam[1].trim()} <${metNaam[2].trim()}>` };

  // Anders hoort het een kaal adres te zijn.
  if (/^[^<>@\s]+@[^<>@\s]+\.[a-z]{2,}$/i.test(schoon)) {
    return { afzender: `JG Mobility <${schoon}>` };
  }

  return {
    afzender: STANDAARD_AFZENDER,
    melding: `RESEND_FROM_EMAIL is geen geldig afzenderadres ("${schoon}")`,
  };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { pdfBase64, type } = await req.json().catch(() => ({}));
  const isBedankt = type === "bedankt";
  const kolom = isBedankt ? "bedankmail_verstuurd_op" : "factuurmail_verstuurd_op";

  // Dezelfde schoonmaak als bij de afzender: ook in de sleutel sluipt bij het plakken
  // makkelijk een onzichtbaar teken of een spatie mee, en dan weigert de mailserver alles.
  const apiKey = (process.env.RESEND_API_KEY ?? "").replace(ONZICHTBAAR, "").trim();
  if (!apiKey) {
    return Response.json(
      { error: "RESEND_API_KEY ontbreekt in de instellingen. Zonder die sleutel kan er geen mail uit." },
      { status: 500 }
    );
  }

  const { afzender, melding } = maakAfzender(process.env.RESEND_FROM_EMAIL);
  if (melding) {
    // Geen blokkade, wel een spoor: zo is later terug te vinden waarom de mail vanaf het
    // vaste adres ging in plaats van vanaf de instelling.
    console.warn(`[factuurmail] ${melding}. Er wordt verstuurd vanaf ${STANDAARD_AFZENDER}.`);
  }
  if (!pdfBase64) {
    return Response.json({ error: "De PDF ontbreekt. Probeer het opnieuw." }, { status: 400 });
  }

  const rijen = await sql`SELECT * FROM facturen WHERE id = ${id}`;
  if (rijen.length === 0) return Response.json({ error: "Deze factuur bestaat niet (meer)." }, { status: 404 });

  const f = rijen[0];
  if (!f.klant_email) {
    return Response.json(
      { error: "Deze klant heeft geen e-mailadres. Vul dat eerst in bij de factuur." },
      { status: 400 }
    );
  }

  // Prijzen zijn incl. btw, dus het totaal is wat de klant betaalt. Moet gelijk zijn aan
  // het eindtotaal op de PDF.
  let totaal = Number(f.verkoopprijs) || 0;
  try {
    const regels = JSON.parse((f.regels as string) || "[]");
    totaal += regels.reduce((s: number, r: { prijs: string }) => s + (Number(r.prijs) || 0), 0);
  } catch {
    /* dan alleen de verkoopprijs */
  }

  const gegevens: MailGegevens = {
    klant_naam: (f.klant_naam as string) ?? "",
    factuur_nr: (f.factuur_nr as string) ?? "",
    voertuig: [f.auto_merk, f.auto_model, f.auto_bouwjaar ? `(${f.auto_bouwjaar})` : ""]
      .filter(Boolean)
      .join(" "),
    kenteken: (f.auto_kenteken as string) ?? "",
    totaal,
    vervaldatum: (f.vervaldatum as string) ?? "",
    betaalwijze: (f.betaalwijze as string) ?? "bank",
  };

  // ── De grendel. Claim het verzendmoment vóór we iets versturen. ──
  //
  // Alleen als het veld nog leeg is slaat deze UPDATE aan. Twee gelijktijdige verzoeken
  // kunnen dus niet allebei doorlopen: de tweede krijgt nul rijen terug en stopt hier.
  const nu = new Date().toISOString();
  let geclaimd;
  try {
    geclaimd = isBedankt
      ? await sql`
          UPDATE facturen SET bedankmail_verstuurd_op = ${nu}
          WHERE id = ${id} AND (bedankmail_verstuurd_op IS NULL OR bedankmail_verstuurd_op = '')
          RETURNING id`
      : await sql`
          UPDATE facturen SET factuurmail_verstuurd_op = ${nu}
          WHERE id = ${id} AND (factuurmail_verstuurd_op IS NULL OR factuurmail_verstuurd_op = '')
          RETURNING id`;
  } catch {
    return Response.json(
      { error: "Kon niet vastleggen dat de mail verstuurd wordt. Probeer het zo nog een keer." },
      { status: 500 }
    );
  }

  if (geclaimd.length === 0) {
    const al = (f[kolom] as string) ?? "";
    const wanneer = al ? new Date(al).toLocaleString("nl-NL") : "eerder";
    return Response.json(
      {
        error: `Deze mail is al verstuurd op ${wanneer}. Een klant twee keer dezelfde mail sturen komt onprofessioneel over; wil je hem toch opnieuw versturen, draai de verzending dan eerst terug.`,
        alVerstuurd: true,
        verstuurd_op: al,
      },
      { status: 409 }
    );
  }

  /** De claim terugdraaien als het versturen niet lukt — anders blijft hij op "verstuurd" staan. */
  const geefVrij = async () => {
    if (isBedankt) {
      await sql`UPDATE facturen SET bedankmail_verstuurd_op = NULL WHERE id = ${id}`.catch(() => null);
    } else {
      await sql`UPDATE facturen SET factuurmail_verstuurd_op = NULL WHERE id = ${id}`.catch(() => null);
    }
  };

  const { onderwerp, html, tekst } = isBedankt ? bedankMail(gegevens) : factuurMail(gegevens);

  try {
    const resend = new Resend(apiKey);
    // LET OP: de SDK gooit geen fout bij een afgekeurde verzending. Het antwoord MOET
    // gelezen worden, anders ziet een mislukte mail eruit als een geslaagde.
    const { data, error } = await resend.emails.send({
      from: afzender,
      to: f.klant_email as string,
      replyTo: "info@jgmobility.nl",
      subject: onderwerp,
      html,
      // De platte-tekstversie gaat mee. Een mail met alleen HTML is voor spamfilters een
      // signaal op zich: echte post van bedrijven stuurt allebei mee, bulkmail vaak niet.
      text: tekst,
      attachments: [
        {
          filename: isBedankt
            ? `Factuur-${gegevens.factuur_nr}-betaald.pdf`
            : `Factuur-${gegevens.factuur_nr}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    if (error || !data?.id) {
      await geefVrij();
      return Response.json(
        {
          error: `De mail is niet verstuurd: ${error?.message ?? "de mailserver gaf geen bevestiging terug"}. Er is niets naar de klant gegaan.`,
        },
        { status: 502 }
      );
    }

    return Response.json({ ok: true, verstuurd_op: nu, bericht_id: data.id });
  } catch (err) {
    await geefVrij();
    return Response.json(
      {
        error: `De mail kon niet worden verstuurd: ${
          err instanceof Error ? err.message : String(err)
        }. Er is niets naar de klant gegaan.`,
      },
      { status: 502 }
    );
  }
}

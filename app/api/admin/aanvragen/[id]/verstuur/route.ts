import { createHash } from "node:crypto";
import { Resend } from "resend";
import {
  claimAntwoordVersturen,
  maakAntwoordVrij,
} from "@/lib/aanvragen-db";
import { bouwTaxatieMail } from "@/lib/taxatie-aanvragen";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ONZICHTBAAR = new RegExp(
  "[" + String.fromCharCode(0x200b, 0x200c, 0x200d, 0xfeff, 0x00a0) + "]",
  "g"
);

const STANDAARD_AFZENDER = "JG Mobility <info@jgmobility.nl>";

function maakAfzender(waarde: string | undefined): string {
  const schoon = (waarde ?? "").replace(ONZICHTBAAR, "").replace(/^["']|["']$/g, "").trim();
  if (!schoon) return STANDAARD_AFZENDER;
  if (/^.+?\s*<[^<>@\s]+@[^<>@\s]+\.[a-z]{2,}>$/i.test(schoon)) return schoon;
  if (/^[^<>@\s]+@[^<>@\s]+\.[a-z]{2,}$/i.test(schoon)) return `JG Mobility <${schoon}>`;
  console.warn(`[taxatiemail] Ongeldige RESEND_FROM_EMAIL; fallback naar ${STANDAARD_AFZENDER}.`);
  return STANDAARD_AFZENDER;
}

function voertuigUit(aanvraag: { inruil: string; advertentie_titel: string; kenteken: string }): string {
  const uitInruil = aanvraag.inruil.split("·")[0]?.trim();
  return aanvraag.advertentie_titel || uitInruil || aanvraag.kenteken || "Uw auto";
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const goedgekeurdOnderwerp = typeof body?.onderwerp === "string" ? body.onderwerp.trim() : "";
  const goedgekeurdAntwoord = typeof body?.antwoord === "string" ? body.antwoord.trim() : "";
  if (body?.bevestigd !== true || !goedgekeurdOnderwerp || !goedgekeurdAntwoord) {
    return Response.json(
      { error: "Bevestig eerst expliciet de exacte onderwerpregel en e-mailtekst die naar de klant mogen." },
      { status: 400 }
    );
  }

  const apiKey = (process.env.RESEND_API_KEY ?? "").replace(ONZICHTBAAR, "").trim();
  if (!apiKey) return Response.json({ error: "RESEND_API_KEY ontbreekt." }, { status: 500 });

  let aanvraag;
  try {
    aanvraag = await claimAntwoordVersturen(id, goedgekeurdOnderwerp, goedgekeurdAntwoord);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "De verzendgrendel kon niet worden gezet." },
      { status: 500 }
    );
  }
  if (!aanvraag) {
    return Response.json(
      { error: "De e-mail is al verstuurd, of het opgeslagen concept wijkt af van de tekst die u zojuist hebt goedgekeurd." },
      { status: 409 }
    );
  }

  const ontvanger = aanvraag.email;
  const onderwerp = aanvraag.onderwerp || "Uw taxatie bij JG Mobility";
  const html = bouwTaxatieMail({
    naam: aanvraag.naam,
    kenteken: aanvraag.kenteken,
    voertuig: voertuigUit(aanvraag),
    bericht: aanvraag.antwoord,
  });

  const idempotencyKey = `taxatie-${id}-${createHash("sha256")
    .update(`${ontvanger}\n${onderwerp}\n${aanvraag.antwoord}`)
    .digest("hex")
    .slice(0, 32)}`;

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: maakAfzender(process.env.RESEND_FROM_EMAIL),
      to: ontvanger,
      replyTo: "info@jgmobility.nl",
      subject: onderwerp,
      html,
    }, { idempotencyKey });

    if (error) {
      await maakAntwoordVrij(id);
      return Response.json({ error: error.message || "De mailserver heeft de verzending geweigerd." }, { status: 502 });
    }

    return Response.json({ ok: true, id: data?.id ?? null, verstuurdOp: aanvraag.antwoord_verstuurd_op });
  } catch (error) {
    await maakAntwoordVrij(id);
    return Response.json(
      { error: error instanceof Error ? error.message : "Versturen is mislukt." },
      { status: 500 }
    );
  }
}

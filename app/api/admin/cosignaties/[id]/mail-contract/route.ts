import { NextRequest } from "next/server";
import { Resend } from "resend";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Onzichtbare tekens die bij het plakken van instellingen meekomen (zie factuurmail). */
const ONZICHTBAAR = new RegExp(
  "[" + String.fromCharCode(0x200b, 0x200c, 0x200d, 0xfeff, 0x00a0) + "]",
  "g"
);

const STANDAARD_AFZENDER = "JG Mobility <info@jgmobility.nl>";
const TEST_ONTVANGER = (process.env.FACTUUR_TEST_ONTVANGER ?? "").trim();

function maakAfzender(waarde: string | undefined): string {
  const schoon = (waarde ?? "").replace(ONZICHTBAAR, "").replace(/^["']|["']$/g, "").trim();
  if (!schoon) return STANDAARD_AFZENDER;
  const metNaam = schoon.match(/^(.+?)\s*<([^<>@\s]+@[^<>@\s]+\.[a-z]{2,})>$/i);
  if (metNaam) return `${metNaam[1].trim()} <${metNaam[2].trim()}>`;
  if (/^[^<>@\s]+@[^<>@\s]+\.[a-z]{2,}$/i.test(schoon)) return `JG Mobility <${schoon}>`;
  return STANDAARD_AFZENDER;
}

/**
 * Mailt het consignatiecontract als PDF-bijlage naar de eigenaar.
 *
 * De PDF wordt in de browser gemaakt (dezelfde html2pdf-aanpak als bij de facturen,
 * zodat de opmaak exact klopt) en als base64 meegestuurd — het is de KOPIE-versie
 * met watermerk: het origineel blijft bij JG voor de administratie. Deze route hangt
 * de mail eromheen, verstuurt hem, en legt vast dat het contract gemaild is — vanaf
 * dat moment loopt de verkoopperiode en gaan de tweewekelijkse updates lopen.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { pdfBase64 } = await req.json().catch(() => ({}));

  if (!pdfBase64) return Response.json({ error: "De PDF ontbreekt. Probeer het opnieuw." }, { status: 400 });

  const apiKey = (process.env.RESEND_API_KEY ?? "").replace(ONZICHTBAAR, "").trim();
  if (!apiKey) return Response.json({ error: "RESEND_API_KEY ontbreekt in de instellingen." }, { status: 500 });

  const rows = await sql`SELECT * FROM cosignaties WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: "Deze consignatie bestaat niet (meer)." }, { status: 404 });

  const c = rows[0];
  if (!c.email) {
    return Response.json({ error: "Deze klant heeft geen e-mailadres. Vul dat eerst in." }, { status: 400 });
  }

  const naam = (c.naam as string)?.split(" ")[0] || "u";
  const auto = `${c.merk} ${c.model}${c.bouwjaar ? ` (${c.bouwjaar})` : ""}`.trim();
  const contractNr = (c.contract_nr as string) || "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#001337;padding:28px 32px;text-align:center;">
        <h1 style="color:#ffffff;font-family:Georgia,serif;margin:0;font-size:24px;">JG Mobility</h1>
        <p style="color:rgba(255,255,255,0.55);font-size:12px;margin:8px 0 0;letter-spacing:1px;text-transform:uppercase;">Consignatieovereenkomst</p>
      </div>
      <div style="padding:36px 32px;background:#f8f9fc;">
        <p style="font-size:15px;color:#001337;margin:0 0 20px;">Beste ${naam},</p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px;">
          Fijn dat u uw ${auto} bij ons in consignatie brengt. In de bijlage vindt u de
          consignatieovereenkomst${contractNr ? ` met nummer <strong style="color:#001337;">${contractNr}</strong>` : ""}.
        </p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px;">
          Wilt u de overeenkomst doorlezen, ondertekenen en aan ons terugsturen? Zodra hij
          getekend binnen is, zetten wij uw auto actief in de verkoop en houden wij u
          regelmatig op de hoogte van de voortgang.
        </p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 28px;">
          Heeft u vragen over de overeenkomst? Neem gerust contact met ons op.
        </p>
        <p style="font-size:13px;color:#94a3b8;margin:0;">
          Met vriendelijke groet,<br>
          <strong style="color:#001337;">JG Mobility</strong><br>
          <a href="mailto:info@jgmobility.nl" style="color:#001337;">info@jgmobility.nl</a>
        </p>
      </div>
    </div>
  `;

  try {
    const resend = new Resend(apiKey);
    const ontvanger = TEST_ONTVANGER || (c.email as string);
    const onderwerp = `Consignatieovereenkomst${contractNr ? ` ${contractNr}` : ""} — uw ${auto}`;
    const { data, error } = await resend.emails.send({
      from: maakAfzender(process.env.RESEND_FROM_EMAIL),
      to: ontvanger,
      replyTo: "info@jgmobility.nl",
      subject: TEST_ONTVANGER ? `[TEST → ${c.email}] ${onderwerp}` : onderwerp,
      html,
      attachments: [
        {
          filename: `Consignatieovereenkomst${contractNr ? `-${contractNr}` : ""}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    if (error || !data?.id) {
      return Response.json(
        { error: `De mail is niet verstuurd: ${error?.message ?? "de mailserver gaf geen bevestiging"}.` },
        { status: 502 }
      );
    }

    // Contract gemaild: dit is de start van de verkoopperiode. Status naar 'lopend',
    // en de teller voor de tweewekelijkse updates begint te lopen.
    const vandaag = new Date().toISOString().slice(0, 10);
    await sql`
      UPDATE cosignaties SET
        status = 'lopend',
        contract_gemaild_op = ${vandaag}::date
      WHERE id = ${id}
    `.catch(() => null);

    return Response.json({ ok: true, contract_gemaild_op: vandaag });
  } catch (err) {
    return Response.json(
      { error: `De mail kon niet worden verstuurd: ${err instanceof Error ? err.message : String(err)}.` },
      { status: 502 }
    );
  }
}

/** Verzending terugdraaien: wist de registratie zodat het contract opnieuw gemaild kan worden. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await sql`UPDATE cosignaties SET contract_gemaild_op = NULL WHERE id = ${id}`.catch(() => null);
  return Response.json({ ok: true });
}

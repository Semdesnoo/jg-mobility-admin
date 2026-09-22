import { NextRequest } from "next/server";
import { Resend } from "resend";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Het JG Mobility logo als data-URL, klaar om in mail-HTML te bakken.
 * Server-side lezen we het PNG-bestand en stoppen het als base64 in de HTML
 * zodat Gmail/Outlook de image niet als externe blokkeren.
 */
let _logoCache: string | null = null;
function logoDataUrl(): string {
  if (_logoCache) return _logoCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path") as typeof import("path");
    const p = path.join(process.cwd(), "public", "JG Mobility Mail Header.png");
    const buf = fs.readFileSync(p);
    _logoCache = `data:image/png;base64,${buf.toString("base64")}`;
    return _logoCache;
  } catch {
    return "";
  }
}

/**
 * Mailt de inkoopverklaring (kopie-versie) als PDF-bijlage naar de verkoper.
 *
 * De PDF wordt in de browser gemaakt — dezelfde html2pdf-aanpak als bij de facturen en
 * het consignatiecontract, zodat de opmaak exact klopt — en als base64 meegestuurd.
 * De bijlage is bewust de KOPIE met watermerk: het origineel is voor onze eigen
 * administratie, de verkoper krijgt zijn eigen exemplaar.
 *
 * Zelfde dubbel-verstuur-grendel als de factuurmail: het verzendmoment wordt geclaimd
 * vóór het versturen, met een UPDATE die alleen aanslaat als het veld nog leeg is.
 * Mislukt het versturen, dan wordt de claim teruggedraaid.
 */

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { pdfBase64 } = await req.json().catch(() => ({}));

  if (!pdfBase64) return Response.json({ error: "De PDF ontbreekt. Probeer het opnieuw." }, { status: 400 });

  const apiKey = (process.env.RESEND_API_KEY ?? "").replace(ONZICHTBAAR, "").trim();
  if (!apiKey) return Response.json({ error: "RESEND_API_KEY ontbreekt in de instellingen." }, { status: 500 });

  const rows = await sql`SELECT * FROM inkoopverklaringen WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: "Deze inkoopverklaring bestaat niet (meer)." }, { status: 404 });

  const v = rows[0];
  if (!v.verkoper_email) {
    return Response.json(
      { error: "Deze verkoper heeft geen e-mailadres. Vul dat eerst in via Bewerken." },
      { status: 400 }
    );
  }

  // ── De grendel: claim het verzendmoment vóór het versturen. ──
  const nu = new Date().toISOString();
  const geclaimd = await sql`
    UPDATE inkoopverklaringen SET gemaild_op = ${nu}
    WHERE id = ${id} AND (gemaild_op IS NULL OR gemaild_op = '')
    RETURNING id
  `.catch(() => []);

  if (geclaimd.length === 0) {
    const al = (v.gemaild_op as string) ?? "";
    const wanneer = al ? new Date(al).toLocaleString("nl-NL") : "eerder";
    return Response.json(
      {
        error: `Deze mail is al verstuurd op ${wanneer}. Wil je hem toch opnieuw versturen, draai de verzending dan eerst terug.`,
        alVerstuurd: true,
        verstuurd_op: al,
      },
      { status: 409 }
    );
  }

  const geefVrij = async () => {
    await sql`UPDATE inkoopverklaringen SET gemaild_op = '' WHERE id = ${id}`.catch(() => null);
  };

  const voornaam = (v.verkoper_naam as string)?.trim().split(" ")[0] || "";
  const auto = [v.merk, v.model, v.bouwjaar ? `(${v.bouwjaar})` : ""].filter(Boolean).join(" ");
  const nummer = (v.nummer as string) || "";
  const bedrag = Number(v.bedrag) || 0;
  const bedragTekst = bedrag > 0 ? `€ ${Math.round(bedrag).toLocaleString("nl-NL")}` : "";

  // Zelfde huisstijl als de factuurmail: navy kop, gegevensregels, adresblok.
  const regel = (label: string, waarde: string) => `<tr>
    <td style="padding:7px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0">${label}</td>
    <td align="right" style="padding:7px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#1e293b;border-bottom:1px solid #e2e8f0">${waarde}</td>
  </tr>`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;">
      <div style="padding:0;line-height:0;font-size:0;text-align:center;">
        ${(() => {
          const src = logoDataUrl();
          // Volledige-breedte header-banner (2000×423 → bij 600px breed ~127px hoog).
          return src
            ? `<img src="${src}" alt="JG Mobility" width="600" height="127" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;mso-line-height-rule:exactly" />`
            : "";
        })()}
      </div>
      <div style="background:#001337;padding:18px 30px 22px;text-align:center;">
        <div style="color:rgba(255,255,255,0.55);font-size:10px;margin:0;letter-spacing:2.5px;text-transform:uppercase;">Inkoopverklaring</div>
      </div>
      <div style="padding:32px 34px;">
        <p style="font-size:15px;color:#1e293b;margin:0 0 16px;">Beste ${voornaam || "verkoper"},</p>
        <p style="font-size:14px;color:#1e293b;line-height:1.65;margin:0 0 14px;">
          Bedankt voor de verkoop van uw ${auto} aan JG Mobility. In de bijlage vindt u uw
          exemplaar van de inkoopverklaring${nummer ? ` met nummer <strong>${nummer}</strong>` : ""} —
          het document dat wij samen hebben ondertekend bij de overdracht.
        </p>
        <p style="font-size:14px;color:#1e293b;line-height:1.65;margin:0 0 20px;">
          Bewaar dit document goed voor uw eigen administratie: het is uw bewijs van de
          verkoop en van het afgesproken bedrag.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
          ${nummer ? regel("Documentnummer", nummer) : ""}
          ${auto ? regel("Voertuig", auto) : ""}
          ${v.kenteken ? regel("Kenteken", String(v.kenteken)) : ""}
          ${bedragTekst ? regel("Inkoopbedrag", `<span style=\"font-size:15px;font-weight:700;color:#001337\">${bedragTekst}</span>`) : ""}
        </table>
        <p style="font-size:14px;color:#1e293b;line-height:1.65;margin:0;">
          Heeft u nog vragen over de verkoop of de overdracht, dan mag u altijd bellen of mailen.<br /><br />
          Met vriendelijke groet,<br /><strong>Jimi Gaillard</strong><br />
          <span style="color:#64748b;">JG Mobility</span>
        </p>
      </div>
      <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 34px;">
        <div style="font-size:12px;font-weight:bold;color:#001337;padding-bottom:4px;">JG Mobility</div>
        <div style="font-size:11px;line-height:1.8;color:#64748b;">
          Arnhemseweg 10a &middot; 2994 LA Barendrecht<br />
          <a href="mailto:info@jgmobility.nl" style="color:#64748b;text-decoration:none;">info@jgmobility.nl</a> &middot; +31 6 21331374<br />
          <a href="https://www.jgmobility.nl" style="color:#64748b;text-decoration:none;">www.jgmobility.nl</a>
        </div>
      </div>
    </div>
  `;

  const tekst = [
    `Beste ${voornaam || "verkoper"},`,
    "",
    `Bedankt voor de verkoop van uw ${auto} aan JG Mobility. In de bijlage vindt u uw exemplaar van de inkoopverklaring${nummer ? ` met nummer ${nummer}` : ""} — het document dat wij samen hebben ondertekend bij de overdracht.`,
    "",
    "Bewaar dit document goed voor uw eigen administratie: het is uw bewijs van de verkoop en van het afgesproken bedrag.",
    "",
    nummer ? `Documentnummer: ${nummer}` : "",
    auto ? `Voertuig: ${auto}` : "",
    v.kenteken ? `Kenteken: ${v.kenteken}` : "",
    bedragTekst ? `Inkoopbedrag: ${bedragTekst}` : "",
    "",
    "Heeft u nog vragen over de verkoop of de overdracht, dan mag u altijd bellen of mailen.",
    "",
    "Met vriendelijke groet,",
    "Jimi Gaillard",
    "JG Mobility · Arnhemseweg 10a, 2994 LA Barendrecht",
    "info@jgmobility.nl · +31 6 21331374",
  ].filter((r) => r !== "").join("\n").replace(/\n{3,}/g, "\n\n");

  try {
    const resend = new Resend(apiKey);
    const ontvanger = TEST_ONTVANGER || (v.verkoper_email as string);
    const onderwerp = `Uw inkoopverklaring${nummer ? ` ${nummer}` : ""} — JG Mobility`;
    const { data, error } = await resend.emails.send({
      from: maakAfzender(process.env.RESEND_FROM_EMAIL),
      to: ontvanger,
      replyTo: "info@jgmobility.nl",
      subject: TEST_ONTVANGER ? `[TEST → ${v.verkoper_email}] ${onderwerp}` : onderwerp,
      html,
      text: tekst,
      attachments: [
        {
          filename: `Inkoopverklaring${nummer ? `-${nummer}` : ""}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    if (error || !data?.id) {
      await geefVrij();
      return Response.json(
        { error: `De mail is niet verstuurd: ${error?.message ?? "de mailserver gaf geen bevestiging terug"}. Er is niets naar de verkoper gegaan.` },
        { status: 502 }
      );
    }

    return Response.json({ ok: true, verstuurd_op: nu, bericht_id: data.id });
  } catch (err) {
    await geefVrij();
    return Response.json(
      { error: `De mail kon niet worden verstuurd: ${err instanceof Error ? err.message : String(err)}. Er is niets naar de verkoper gegaan.` },
      { status: 502 }
    );
  }
}

/** Verzending terugdraaien: wist de registratie zodat de mail opnieuw verstuurd kan worden. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await sql`UPDATE inkoopverklaringen SET gemaild_op = '' WHERE id = ${id}`.catch(() => null);
  return Response.json({ ok: true });
}

import { NextRequest } from "next/server";
import { Resend } from "resend";
import sql from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { pdfBase64 } = await req.json();

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey) return Response.json({ error: "RESEND_API_KEY niet ingesteld" }, { status: 500 });
  if (!fromEmail) return Response.json({ error: "RESEND_FROM_EMAIL niet ingesteld" }, { status: 500 });
  if (!pdfBase64) return Response.json({ error: "PDF ontbreekt" }, { status: 400 });

  const rows = await sql`SELECT * FROM facturen WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: "Factuur niet gevonden" }, { status: 404 });

  const f = rows[0];
  if (!f.klant_email) return Response.json({ error: "Klant heeft geen e-mailadres" }, { status: 400 });

  let totaal = Number(f.verkoopprijs) || 0;
  try {
    const regels = JSON.parse(f.regels || "[]");
    totaal += regels.reduce((s: number, r: { prijs: string }) => s + (Number(r.prijs) || 0), 0);
    if (f.btw_type === "21") totaal = Math.round(totaal * 1.21);
  } catch { /* gebruik verkoopprijs */ }

  const voertuig = [f.auto_merk, f.auto_model, f.auto_bouwjaar ? `(${f.auto_bouwjaar})` : ""].filter(Boolean).join(" ");

  const htmlBody = `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
  <div style="border-bottom:3px solid #001337;padding-bottom:16px;margin-bottom:24px">
    <span style="font-size:22px;font-weight:700;color:#001337;letter-spacing:2px">JG MOBILITY</span>
  </div>
  <p style="font-size:15px">Geachte ${f.klant_naam || "klant"},</p>
  <p style="font-size:15px;line-height:1.6">Hartelijk dank voor uw aankoop bij JG Mobility! Wij hopen dat u veel plezier zult beleven aan uw voertuig.</p>
  <p style="font-size:15px;line-height:1.6">In de bijlage vindt u de factuur voor uw aankoop. Wij verzoeken u vriendelijk het openstaande bedrag te voldoen vóór de vervaldatum.</p>
  <div style="background:#f8fafc;border-left:4px solid #001337;padding:16px 20px;margin:24px 0;line-height:2">
    <div><span style="color:#64748b;font-size:13px">FACTUURNUMMER</span><br><strong>${f.factuur_nr}</strong></div>
    ${voertuig ? `<div><span style="color:#64748b;font-size:13px">VOERTUIG</span><br><strong>${voertuig}</strong></div>` : ""}
    <div><span style="color:#64748b;font-size:13px">TOTAALBEDRAG</span><br><strong style="font-size:18px;color:#001337">€${totaal.toLocaleString("nl-NL")}</strong></div>
    <div><span style="color:#64748b;font-size:13px">${f.vervaldatum ? "UITERLIJK BETALEN VOOR" : "BETAALTERMIJN"}</span><br><strong>${f.vervaldatum || "30 dagen na ontvangst"}</strong></div>
  </div>
  ${f.betaalwijze === "bank" ? `
  <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:16px 20px;margin:0 0 24px;border-radius:4px;line-height:2">
    <strong style="color:#001337;display:block;margin-bottom:4px">Betaalgegevens</strong>
    <span style="color:#475569">IBAN</span> &nbsp; NL94 ABNA 0154171638<br>
    <span style="color:#475569">T.n.v.</span> &nbsp; JG Mobility<br>
    <span style="color:#475569">Omschrijving</span> &nbsp; ${f.factuur_nr}
  </div>` : `<p style="font-size:15px">Betaling geschiedt contant bij afhaling.</p>`}
  <p style="font-size:15px;line-height:1.6">Heeft u vragen over uw factuur? Neem dan gerust contact met ons op via <a href="mailto:info@jgmobility.nl" style="color:#001337">info@jgmobility.nl</a>.</p>
  <div style="border-top:1px solid #e2e8f0;padding-top:20px;margin-top:30px;font-size:13px;color:#64748b;line-height:1.8">
    Met vriendelijke groet,<br><br>
    <strong style="color:#001337;font-size:14px">JG Mobility</strong><br>
    <a href="mailto:info@jgmobility.nl" style="color:#475569">info@jgmobility.nl</a><br>
    <a href="https://www.jgmobility.nl" style="color:#475569">www.jgmobility.nl</a>
  </div>
</body>
</html>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `JG Mobility <${fromEmail}>`,
      to: f.klant_email,
      subject: `Factuur ${f.factuur_nr} - JG Mobility`,
      html: htmlBody,
      attachments: [{
        filename: `Factuur-${f.factuur_nr}.pdf`,
        content: pdfBase64,
      }],
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

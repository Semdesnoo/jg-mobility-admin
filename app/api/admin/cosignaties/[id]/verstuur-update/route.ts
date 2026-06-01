import { NextRequest } from "next/server";
import { Resend } from "resend";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const resend = new Resend(process.env.RESEND_API_KEY);

  const rows = await sql`SELECT * FROM cosignaties WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: "Niet gevonden" }, { status: 404 });

  const c = rows[0];
  if (!c.email) return Response.json({ error: "Geen e-mailadres bekend" }, { status: 400 });

  const geaccepteerdOp = c.geaccepteerd_op ? new Date(c.geaccepteerd_op as string) : null;
  const dagenInConsignatie = geaccepteerdOp
    ? Math.floor((Date.now() - geaccepteerdOp.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let platformPrijzen: Record<string, string> = {};
  try { platformPrijzen = JSON.parse(typeof c.platform_prijzen === "string" ? c.platform_prijzen : JSON.stringify(c.platform_prijzen ?? {})); } catch { /* */ }

  const prijzenRijen = Object.entries(platformPrijzen).map(([platform, prijs]) => {
    const label = platform === "marktplaats" ? "Marktplaats.nl" : platform === "nederlandmobiel" ? "NederlandMobiel.nl" : platform === "autoscout24" ? "AutoScout24.nl" : platform;
    return `<tr>
      <td style="padding:6px 0;font-size:13px;color:#666;width:160px;">${label}</td>
      <td style="padding:6px 0;font-size:13px;color:#001337;font-weight:bold;">€ ${parseInt(prijs).toLocaleString("nl-NL")}</td>
    </tr>`;
  }).join("");

  const vraagprijs = c.vraagprijs ? `€ ${parseInt(c.vraagprijs as string).toLocaleString("nl-NL")}` : "Nader te bepalen";
  const naam = (c.naam as string)?.split(" ")[0] || "u";
  const auto = `${c.merk} ${c.model} (${c.bouwjaar})`;
  const kmStand = c.km ? `${parseInt(c.km as string).toLocaleString("nl-NL")} km` : "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#001337;padding:28px 32px;text-align:center;">
        <h1 style="color:#ffffff;font-family:Georgia,serif;margin:0;font-size:24px;">JG Mobility</h1>
        <p style="color:rgba(255,255,255,0.55);font-size:12px;margin:8px 0 0;letter-spacing:1px;text-transform:uppercase;">Wekelijkse update cosignatie</p>
      </div>

      <div style="padding:36px 32px;background:#f8f9fc;">
        <p style="font-size:15px;color:#001337;margin:0 0 20px;">Beste ${naam},</p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 28px;">
          Hierbij een update over uw ${auto} die momenteel bij ons in consignatie staat.
          ${dagenInConsignatie !== null ? `De auto staat al <strong style="color:#001337;">${dagenInConsignatie} dag${dagenInConsignatie !== 1 ? "en" : ""}</strong> bij ons.` : ""}
        </p>

        <div style="background:#ffffff;border:1px solid #e2e8f0;padding:20px 24px;margin-bottom:24px;">
          <h2 style="font-family:Georgia,serif;font-size:16px;color:#001337;margin:0 0 16px;">Uw voertuig</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:5px 0;font-size:13px;color:#666;width:130px;">Auto</td><td style="padding:5px 0;font-size:13px;color:#001337;font-weight:bold;">${auto}</td></tr>
            ${kmStand ? `<tr><td style="padding:5px 0;font-size:13px;color:#666;">Kilometerstand</td><td style="padding:5px 0;font-size:13px;color:#001337;">${kmStand}</td></tr>` : ""}
            <tr><td style="padding:5px 0;font-size:13px;color:#666;">Vraagprijs</td><td style="padding:5px 0;font-size:13px;color:#001337;font-weight:bold;">${vraagprijs}</td></tr>
          </table>
        </div>

        ${prijzenRijen ? `
        <div style="background:#ffffff;border:1px solid #e2e8f0;padding:20px 24px;margin-bottom:24px;">
          <h2 style="font-family:Georgia,serif;font-size:16px;color:#001337;margin:0 0 8px;">Marktprijzen vergelijkbare auto's</h2>
          <p style="font-size:12px;color:#94a3b8;margin:0 0 16px;">Actuele vraagprijzen online</p>
          <table style="width:100%;border-collapse:collapse;">${prijzenRijen}</table>
        </div>` : ""}

        <div style="background:#001337;padding:20px 24px;margin-bottom:28px;">
          <p style="font-size:13px;color:rgba(255,255,255,0.8);margin:0;line-height:1.7;">
            Wij zijn actief bezig met de verkoop van uw auto. Heeft u vragen of wilt u de vraagprijs aanpassen? Neem dan contact met ons op.
          </p>
        </div>

        <p style="font-size:13px;color:#94a3b8;margin:0;">
          Met vriendelijke groet,<br>
          <strong style="color:#001337;">JG Mobility</strong><br>
          <a href="mailto:info@jgmobility.nl" style="color:#001337;">info@jgmobility.nl</a>
        </p>
      </div>
    </div>
  `;

  const result = await resend.emails.send({
    from: "JG Mobility <noreply@jgmobility.nl>",
    to: c.email as string,
    subject: `Update uw ${auto} in consignatie${dagenInConsignatie ? ` — dag ${dagenInConsignatie}` : ""}`,
    html,
  });

  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });

  // Sla datum van laatste update op in notitie
  const datumUpdate = new Date().toLocaleDateString("nl-NL");
  await sql`
    UPDATE cosignaties
    SET notitie = COALESCE(notitie, '') || ${`\nUpdate verstuurd op ${datumUpdate}`}
    WHERE id = ${id}
  `.catch(() => null);

  return Response.json({ ok: true });
}

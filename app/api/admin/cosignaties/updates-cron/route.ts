import { Resend } from "resend";
import sql from "@/lib/db";
import { bouwUpdateMail } from "@/lib/cosignatie-mail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Tweewekelijkse automatische update-mail voor lopende consignaties.
 *
 * Bedoeld voor Vercel Cron. Draait wekelijks (zie vercel.json) maar stuurt per auto
 * pas een mail als de vorige ten minste 14 dagen geleden is — zo krijgt elke klant
 * om de week een update, ongeacht op welke dag zijn contract inging.
 *
 * Selecteert alleen consignaties die:
 *  - status 'lopend' hebben (contract gemaild, auto in de verkoop),
 *  - automatische updates aan hebben staan (auto_updates),
 *  - een e-mailadres hebben,
 *  - waarvan de laatste update minstens 14 dagen geleden is (of er nog nooit een was).
 */
export async function GET(req: Request) {
  const geheim = process.env.CRON_SECRET;
  if (!geheim) return Response.json({ error: "CRON_SECRET is niet ingesteld" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${geheim}`) {
    return Response.json({ error: "Niet toegestaan" }, { status: 401 });
  }

  const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) return Response.json({ error: "RESEND_API_KEY ontbreekt" }, { status: 500 });
  const resend = new Resend(apiKey);

  let kandidaten: Record<string, unknown>[] = [];
  try {
    kandidaten = (await sql`
      SELECT * FROM cosignaties
      WHERE status = 'lopend'
        AND COALESCE(auto_updates, true) = true
        AND email <> ''
        AND (laatste_update_op IS NULL OR laatste_update_op <= CURRENT_DATE - INTERVAL '14 days')
      ORDER BY laatste_update_op ASC NULLS FIRST
    `) as Record<string, unknown>[];
  } catch (e) {
    return Response.json({ error: `Ophalen mislukt: ${String(e)}` }, { status: 500 });
  }

  const gestart = Date.now();
  const DEADLINE = gestart + 50_000;
  let verstuurd = 0;
  const fouten: string[] = [];

  for (const c of kandidaten) {
    if (Date.now() > DEADLINE) break;
    try {
      const { onderwerp, html } = bouwUpdateMail(c);
      const { error } = await resend.emails.send({
        from: "JG Mobility <noreply@jgmobility.nl>",
        to: c.email as string,
        subject: onderwerp,
        html,
      });
      if (error) {
        fouten.push(`${c.id}: ${error.message}`);
        continue;
      }
      const vandaag = new Date().toISOString().slice(0, 10);
      await sql`UPDATE cosignaties SET laatste_update_op = ${vandaag}::date WHERE id = ${c.id as string}`.catch(() => null);
      verstuurd++;
    } catch (e) {
      fouten.push(`${c.id}: ${String(e)}`);
    }
  }

  return Response.json({
    ok: true,
    kandidaten: kandidaten.length,
    verstuurd,
    resterend: Math.max(0, kandidaten.length - verstuurd - fouten.length),
    fouten,
  });
}

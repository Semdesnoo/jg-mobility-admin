import { NextRequest } from "next/server";
import { Resend } from "resend";
import sql from "@/lib/db";
import { bouwUpdateMail } from "@/lib/cosignatie-mail";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Verstuurt handmatig een update-mail naar de consignatieklant.
 * Dezelfde mail die de cron om de week automatisch stuurt (lib/cosignatie-mail.ts).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resend = new Resend(process.env.RESEND_API_KEY);

  const rows = await sql`SELECT * FROM cosignaties WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: "Niet gevonden" }, { status: 404 });

  const c = rows[0];
  if (!c.email) return Response.json({ error: "Geen e-mailadres bekend" }, { status: 400 });

  const { onderwerp, html } = bouwUpdateMail(c);

  const result = await resend.emails.send({
    from: "JG Mobility <noreply@jgmobility.nl>",
    to: c.email as string,
    subject: onderwerp,
    html,
  });

  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });

  // Leg vast wanneer de laatste update de deur uit ging — daar rekent de tweewekelijkse
  // cron mee (die stuurt pas weer als het ten minste 14 dagen geleden is).
  const vandaag = new Date().toISOString().slice(0, 10);
  await sql`UPDATE cosignaties SET laatste_update_op = ${vandaag}::date WHERE id = ${id}`.catch(() => null);

  return Response.json({ ok: true, laatste_update_op: vandaag });
}

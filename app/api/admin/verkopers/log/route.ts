import sql from "@/lib/db";
import { initVerkopersDB } from "@/lib/verkopers-db";

export const dynamic = "force-dynamic";

/**
 * Het verzendlog: precies wat er verstuurd is, aan wie, wanneer en via welk kanaal.
 *
 * Dit is twee dingen tegelijk. Het is de AVG-verantwoording — je moet kunnen laten
 * zien wat je naar wie hebt gestuurd. En het is de plek waar je de autopilot nakijkt:
 * de berichten staan hier woordelijk in, inclusief de afmeldregel die eronder ging.
 *
 * De regels blijven staan als de bijbehorende lead wordt verwijderd; daarom staat de
 * inhoud hier volledig in plaats van dat we naar de lead verwijzen.
 */
export async function GET(req: Request) {
  try {
    await initVerkopersDB();
    const limiet = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("limiet")) || 50));
    const rijen = await sql`
      SELECT
        l.id, l.lead_id, l.kanaal, l.ontvanger, l.onderwerp, l.inhoud,
        l.advertentie_url, l.verstuurd_op,
        v.merk, v.model, v.bouwjaar, v.status AS lead_status
      FROM verkoper_contactlog l
      LEFT JOIN verkoper_leads v ON v.id = l.lead_id
      ORDER BY l.verstuurd_op DESC
      LIMIT ${limiet}
    `;
    return Response.json(rijen);
  } catch {
    return Response.json([], { status: 200 });
  }
}

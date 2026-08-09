import sql from "@/lib/db";
import { initVerkopersDB, TOEGESTANE_STATUS, type VerkoperStatus } from "@/lib/verkopers-db";

export const dynamic = "force-dynamic";

/**
 * Meerdere verkopers in één keer van status veranderen.
 *
 * WAAROM DIT BESTAAT
 * Het scherm stuurde een apart verzoek per verkoper. Bij vijftig aangevinkte kaarten
 * waren dat vijftig keer heen en weer over het internet, en dan sta je tien seconden te
 * wachten op iets wat de database in één opdracht afhandelt. Nu is het één verzoek en
 * één UPDATE, ongeacht of je er drie of driehonderd aanvinkt.
 */
export async function PATCH(req: Request) {
  try {
    await initVerkopersDB();
    const body = await req.json();

    const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
    const status = String(body?.status ?? "");

    if (ids.length === 0) return Response.json({ error: "Geen verkopers meegegeven" }, { status: 400 });
    if (!TOEGESTANE_STATUS.includes(status as VerkoperStatus)) {
      return Response.json({ error: `Onbekende status "${status}"` }, { status: 400 });
    }
    // Een bovengrens, puur als noodrem tegen een verzoek dat per ongeluk de hele
    // database probeert om te zetten.
    if (ids.length > 1000) return Response.json({ error: "Te veel in één keer" }, { status: 400 });

    const rijen = await sql`
      UPDATE verkoper_leads
      SET status = ${status}
      WHERE id = ANY(${ids})
        -- Al verstuurde verkopers laten we met rust: die terugzetten naar de wachtrij
        -- zou betekenen dat er een tweede bericht uit kan gaan.
        AND verstuurd_op IS NULL
      RETURNING id
    `;

    return Response.json({ ok: true, bijgewerkt: rijen.length, gevraagd: ids.length });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

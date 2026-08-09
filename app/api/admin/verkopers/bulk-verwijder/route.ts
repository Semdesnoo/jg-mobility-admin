import sql from "@/lib/db";
import { initVerkopersDB, verkoperSleutel, type VerkoperLead } from "@/lib/verkopers-db";

export const dynamic = "force-dynamic";

/**
 * Meerdere verkopers in één keer weggooien.
 *
 * Ze worden eerst op de negeerlijst gezet en dan pas verwijderd. Die volgorde is het
 * hele punt: verwijder je alleen de rij, dan verdwijnt ook de unieke sleutel op de
 * advertentie-URL en komt dezelfde advertentie bij de volgende zoekronde gewoon weer
 * binnen — elke keer opnieuw tijd en tokens.
 */
export async function POST(req: Request) {
  try {
    await initVerkopersDB();
    const body = await req.json();
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];

    if (ids.length === 0) return Response.json({ error: "Geen verkopers meegegeven" }, { status: 400 });
    if (ids.length > 1000) return Response.json({ error: "Te veel in één keer" }, { status: 400 });

    const leads = (await sql`
      SELECT id, advertentie_url, verkoper_profiel, naam, plaats
      FROM verkoper_leads WHERE id = ANY(${ids})
    `) as unknown as Pick<
      VerkoperLead,
      "id" | "advertentie_url" | "verkoper_profiel" | "naam" | "plaats"
    >[];

    // In één keer op de negeerlijst; per stuk zou bij tweehonderd kaarten weer een
    // reeks losse verzoeken naar de database zijn.
    const urls = leads.map((l) => l.advertentie_url).filter(Boolean);
    const sleutels = leads.map((l) =>
      verkoperSleutel(l.verkoper_profiel ?? "", l.naam, l.plaats)
    );
    if (urls.length > 0) {
      await sql`
        INSERT INTO verkoper_genegeerd (advertentie_url, verkoper_sleutel, reden)
        SELECT u, s, 'Weggegooid'
        FROM UNNEST(${urls}::text[], ${sleutels}::text[]) AS t(u, s)
        ON CONFLICT (advertentie_url) DO NOTHING
      `;
    }

    const weg = await sql`DELETE FROM verkoper_leads WHERE id = ANY(${ids}) RETURNING id`;
    return Response.json({ ok: true, verwijderd: weg.length, genegeerd: urls.length });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import sql from "@/lib/db";
import { initVerkopersDB, getLead } from "@/lib/verkopers-db";

export const dynamic = "force-dynamic";

/**
 * Verkoper zegt ja — de lead wordt een consignatiedossier.
 * Vanaf hier loopt het traject via het bestaande Cosignatie-tabblad
 * (wekelijkse update-mails, marktprijzen, status).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await initVerkopersDB();

    const lead = await getLead(id);
    if (!lead) return Response.json({ error: "Lead niet gevonden" }, { status: 404 });
    if (lead.status === "cosignatie") {
      return Response.json({ error: "Deze lead is al omgezet" }, { status: 409 });
    }

    // Kolommen die in latere versies aan cosignaties zijn toegevoegd.
    try {
      await sql`ALTER TABLE cosignaties ADD COLUMN IF NOT EXISTS geaccepteerd_op DATE`;
      await sql`ALTER TABLE cosignaties ADD COLUMN IF NOT EXISTS brandstof TEXT DEFAULT ''`;
    } catch {
      /* tabel bestaat nog niet — initDB maakt hem bij het opstarten aan */
    }

    const now = new Date();
    const cosId = `cos_${Date.now()}`;
    await sql`
      INSERT INTO cosignaties (
        id, datum, tijd, naam, email, telefoon, merk, model, bouwjaar, km,
        vraagprijs, opmerking, aantal_fotos, status, notitie, geaccepteerd_op, brandstof
      ) VALUES (
        ${cosId},
        ${now.toLocaleDateString("nl-NL")},
        ${now.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })},
        ${lead.naam ?? ""}, ${lead.email ?? ""}, ${lead.telefoon ?? ""},
        ${lead.merk ?? ""}, ${lead.model ?? ""}, ${lead.bouwjaar ?? ""}, ${lead.km ?? ""},
        ${lead.vraagprijs ? String(lead.vraagprijs) : ""},
        ${`Via verkopersradar — ${lead.bron || "advertentie"}: ${lead.advertentie_url}`},
        0, 'geaccepteerd', ${lead.notitie ?? ""},
        ${now.toISOString().slice(0, 10)}::date, ${lead.brandstof ?? ""}
      )
    `;

    await sql`UPDATE verkoper_leads SET status = 'cosignatie' WHERE id = ${id}`;

    return Response.json({ ok: true, cosignatie_id: cosId });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

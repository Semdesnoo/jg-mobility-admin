import { NextRequest } from "next/server";
import sql from "@/lib/db";
import { initVerkopersDB, getLead, blokkeer, logContact } from "@/lib/verkopers-db";

export const dynamic = "force-dynamic";

const TOEGESTANE_STATUS = [
  "nieuw",
  "goedgekeurd",
  "verstuurd",
  "gereageerd",
  "cosignatie",
  "afgewezen",
];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await initVerkopersDB();
    const b = await req.json();

    if (b.status !== undefined) {
      if (!TOEGESTANE_STATUS.includes(b.status)) {
        return Response.json({ error: "Onbekende status" }, { status: 400 });
      }
      await sql`UPDATE verkoper_leads SET status = ${b.status} WHERE id = ${id}`;
    }
    if (b.notitie !== undefined) {
      await sql`UPDATE verkoper_leads SET notitie = ${b.notitie} WHERE id = ${id}`;
    }
    if (b.onderwerp !== undefined) {
      await sql`UPDATE verkoper_leads SET onderwerp = ${b.onderwerp} WHERE id = ${id}`;
    }
    if (b.bericht_mail !== undefined) {
      await sql`UPDATE verkoper_leads SET bericht_mail = ${b.bericht_mail} WHERE id = ${id}`;
    }
    if (b.bericht_kort !== undefined) {
      await sql`UPDATE verkoper_leads SET bericht_kort = ${b.bericht_kort} WHERE id = ${id}`;
    }
    if (b.email !== undefined) {
      await sql`UPDATE verkoper_leads SET email = ${b.email} WHERE id = ${id}`;
    }
    if (b.telefoon !== undefined) {
      await sql`UPDATE verkoper_leads SET telefoon = ${b.telefoon} WHERE id = ${id}`;
    }

    // Zelf verstuurd buiten de mail om (berichtenbox van het platform, of gebeld).
    // We loggen dat net zo goed: het verzendlog moet compleet zijn, ongeacht kanaal.
    if (b.handmatig_verstuurd_via) {
      const kanaal = String(b.handmatig_verstuurd_via);
      const lead = await getLead(id);
      await sql`
        UPDATE verkoper_leads
        SET status = 'verstuurd', verstuurd_op = NOW(), verstuurd_via = ${kanaal}
        WHERE id = ${id}
      `;
      if (lead) {
        await logContact({
          leadId: id,
          kanaal,
          ontvanger: kanaal === "telefoon" ? lead.telefoon : lead.advertentie_url,
          onderwerp: lead.onderwerp ?? "",
          inhoud: lead.bericht_kort || lead.bericht_mail || "",
          advertentieUrl: lead.advertentie_url,
        }).catch(() => null);
      }
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * Verwijderen. Bij "afmelden" komt de verkoper eerst op de blokkadelijst — anders
 * duikt dezelfde persoon bij de volgende zoekronde gewoon weer op.
 * Het verzendlog blijft staan (AVG-verantwoording van wat er al verstuurd is).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await initVerkopersDB();
    const blokkeren = new URL(req.url).searchParams.get("blokkeer") === "1";

    if (blokkeren) {
      const lead = await getLead(id);
      if (lead) {
        if (lead.email) await blokkeer(lead.email, "email", "Afgemeld / geen interesse");
        if (lead.telefoon) await blokkeer(lead.telefoon, "telefoon", "Afgemeld / geen interesse");
      }
    }

    await sql`DELETE FROM verkoper_leads WHERE id = ${id}`;
    return Response.json({ ok: true, geblokkeerd: blokkeren });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import sql from "@/lib/db";
import {
  initVerkopersDB,
  getLead,
  blokkeer,
  logContact,
  isAlBenaderd,
  verkoperSleutel,
  TOEGESTANE_STATUS,
  negeer,
} from "@/lib/verkopers-db";

export const dynamic = "force-dynamic";

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
    let waarschuwing = "";
    if (b.handmatig_verstuurd_via) {
      const kanaal = String(b.handmatig_verstuurd_via);
      const lead = await getLead(id);
      if (!lead) return Response.json({ error: "Lead niet gevonden" }, { status: 404 });

      // Hier stond een grendel die het afvinken botweg weigerde als deze verkoper al
      // eens benaderd leek. Dat was verkeerd om: afvinken verstuurt niets, het legt
      // vast wat jij zelf al via de berichtenbox hebt gedaan. Weigeren maakt dat
      // bericht niet ongedaan — het laat de lead alleen voorgoed in de wachtrij staan
      // én houdt het verzendlog onvolledig, waardoor de dubbelcontrole de volgende
      // ronde nog steeds niets weet. De grendel werkte zichzelf dus tegen.
      //
      // Dat wil niet zeggen dat de waarschuwing waardeloos is: is dezelfde persoon
      // eerder benaderd, dan is het goed om te weten. Hij gaat mee als melding terug,
      // en het afvinken gaat gewoon door.
      const wie = verkoperSleutel(lead.verkoper_profiel ?? "", lead.naam, lead.plaats);
      const eerder = await isAlBenaderd(lead.email, lead.telefoon, id, wie);
      if (eerder.eerder) {
        const datum = eerder.wanneer ? new Date(eerder.wanneer).toLocaleDateString("nl-NL") : "eerder";
        waarschuwing = `Let op: deze verkoper was op ${datum} ook al benaderd${
          eerder.kanaal ? ` via ${eerder.kanaal}` : ""
        } — mogelijk voor een andere auto.`;
      }

      await sql`
        UPDATE verkoper_leads
        SET status = 'verstuurd', verstuurd_op = NOW(), verstuurd_via = ${kanaal}
        WHERE id = ${id}
      `;
      await logContact({
        leadId: id,
        kanaal,
        ontvanger: kanaal === "telefoon" ? lead.telefoon : lead.advertentie_url,
        onderwerp: lead.onderwerp ?? "",
        inhoud: lead.bericht_kort || lead.bericht_mail || "",
        advertentieUrl: lead.advertentie_url,
        email: lead.email,
        telefoon: lead.telefoon,
        wieSleutel: wie,
      }).catch(() => null);
    }

    return Response.json({ ok: true, waarschuwing });
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

    // Altijd eerst onthouden dát je hem weggooit, ook zonder blokkeren. Verwijder je
    // alleen de rij, dan verdwijnt de unieke sleutel op de advertentie-URL en komt
    // dezelfde advertentie bij de volgende zoekronde gewoon weer binnen — en dat kost
    // je elke keer opnieuw tijd en tokens.
    const lead = await getLead(id);
    if (lead) {
      await negeer(
        lead.advertentie_url,
        verkoperSleutel(lead.verkoper_profiel ?? "", lead.naam, lead.plaats),
        blokkeren ? "Geen interesse" : "Weggegooid"
      );
      if (blokkeren) {
        // De blokkadelijst werkt op contactgegevens. Particulieren zetten die niet in
        // hun advertentie, dus vaak valt hier niets te blokkeren — daarom is de
        // negeerlijst hierboven wat het werk doet.
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

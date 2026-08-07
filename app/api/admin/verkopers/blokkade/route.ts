import sql from "@/lib/db";
import { initVerkopersDB, blokkeer, normaliseerEmail, normaliseerTelefoon } from "@/lib/verkopers-db";

export const dynamic = "force-dynamic";

/**
 * Blokkadelijst: wie hier op staat wordt nooit (meer) benaderd.
 * Dit is de opt-out-administratie — de plek waar een "geen interesse" definitief
 * wordt vastgelegd, zodat dezelfde persoon niet bij de volgende zoekronde terugkomt.
 */

export async function GET() {
  try {
    await initVerkopersDB();
    const rijen = await sql`SELECT * FROM verkoper_blokkade ORDER BY aangemaakt DESC`;
    return Response.json(rijen);
  } catch {
    return Response.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    await initVerkopersDB();
    const { waarde, reden } = await req.json();
    if (!waarde || typeof waarde !== "string") {
      return Response.json({ error: "Geef een e-mailadres of telefoonnummer op" }, { status: 400 });
    }
    const soort = waarde.includes("@") ? "email" : "telefoon";
    await blokkeer(waarde, soort, reden || "Handmatig geblokkeerd");

    // Meteen opruimen: openstaande leads van deze persoon horen niet in de wachtrij.
    const genormaliseerd = soort === "email" ? normaliseerEmail(waarde) : normaliseerTelefoon(waarde);
    if (soort === "email") {
      await sql`DELETE FROM verkoper_leads WHERE lower(email) = ${genormaliseerd} AND status IN ('nieuw','goedgekeurd')`;
    } else {
      await sql`
        DELETE FROM verkoper_leads
        WHERE regexp_replace(telefoon, '\\D', '', 'g') <> ''
          AND right(regexp_replace(telefoon, '\\D', '', 'g'), 9) = right(${genormaliseerd}, 9)
          AND status IN ('nieuw','goedgekeurd')
      `;
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await initVerkopersDB();
    const waarde = new URL(req.url).searchParams.get("waarde");
    if (!waarde) return Response.json({ error: "Geen waarde opgegeven" }, { status: 400 });
    await sql`DELETE FROM verkoper_blokkade WHERE waarde = ${waarde}`;
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

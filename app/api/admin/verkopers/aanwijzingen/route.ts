import sql from "@/lib/db";
import { initVerkopersDB } from "@/lib/verkopers-db";

export const dynamic = "force-dynamic";

/**
 * Eigen aanwijzingen voor de berichtenschrijver.
 *
 * Hier leer je de AI je eigen manier van werken aan: wat hij altijd moet noemen, wat
 * hij nooit moet zeggen, hoe kort of hoe formeel. De tekst gaat mee in elke opdracht,
 * bij de autopilot net zo goed als bij de handmatige knop.
 *
 * Bewust één vrij tekstveld en geen formulier met vinkjes: je weet pas wát je wilt
 * bijsturen als je een paar verstuurde berichten hebt teruggelezen, en dat laat zich
 * niet vooraf in keuzevakjes vangen.
 */

const KEY = "verkopers_aanwijzingen";
const MAX = 4000;

export async function GET() {
  try {
    await initVerkopersDB();
    const rijen = await sql`SELECT value FROM settings WHERE key = ${KEY}`;
    return Response.json({ aanwijzingen: (rijen[0]?.value as string) ?? "" });
  } catch {
    return Response.json({ aanwijzingen: "" });
  }
}

export async function PUT(req: Request) {
  try {
    await initVerkopersDB();
    const { aanwijzingen } = await req.json();
    const tekst = String(aanwijzingen ?? "").slice(0, MAX);
    await sql`
      INSERT INTO settings (key, value) VALUES (${KEY}, ${tekst})
      ON CONFLICT (key) DO UPDATE SET value = ${tekst}
    `;
    return Response.json({ ok: true, aanwijzingen: tekst });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

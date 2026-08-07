import { initVerkopersDB } from "@/lib/verkopers-db";
import { leesCriteria, schrijfCriteria, BRANDSTOFFEN, LANDEN } from "@/lib/verkopers-criteria";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initVerkopersDB();
    return Response.json({
      criteria: await leesCriteria(),
      keuzes: { brandstoffen: BRANDSTOFFEN, landen: LANDEN },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await initVerkopersDB();
    return Response.json({ ok: true, criteria: await schrijfCriteria(await req.json()) });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

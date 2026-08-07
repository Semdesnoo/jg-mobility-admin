import { NextRequest } from "next/server";
import { initVerkopersDB } from "@/lib/verkopers-db";
import { verstuurBericht } from "@/lib/verkopers-verzend";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Verstuurt één bericht na een klik in het dashboard.
 *
 * Het echte werk en alle veiligheidscontroles staan in lib/verkopers-verzend.ts,
 * zodat de autopilot precies dezelfde poortwachters passeert als deze knop.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await initVerkopersDB();

  // De gebruiker kan het bericht in de UI hebben bijgeschaafd; dan telt die versie.
  let body: { onderwerp?: string; bericht?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* lege body is prima — dan gebruiken we wat er in de database staat */
  }

  const res = await verstuurBericht(id, body.onderwerp, body.bericht);
  if (!res.ok) return Response.json({ error: res.reden }, { status: res.status });
  return Response.json({ ok: true });
}

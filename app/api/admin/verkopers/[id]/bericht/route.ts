import { NextRequest } from "next/server";
import { initVerkopersDB, getLead } from "@/lib/verkopers-db";
import { genereerBericht } from "@/lib/verkopers-bericht";
import { magUitgeven, BUDGET_OP } from "@/lib/verkopers-budget";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Schrijft een persoonlijk bericht voor één verkoper.
 * De prompt en toon staan in lib/verkopers-bericht.ts, gedeeld met de autopilot.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY niet ingesteld" }, { status: 500 });
  }

  // Zelfde uitgavenrem als bij het uitlezen; zie lib/verkopers-budget.ts.
  const { mag } = await magUitgeven();
  if (!mag) return Response.json({ error: BUDGET_OP, budgetOp: true }, { status: 429 });

  const { id } = await params;
  await initVerkopersDB();
  const lead = await getLead(id);
  if (!lead) return Response.json({ error: "Lead niet gevonden" }, { status: 404 });

  const bericht = await genereerBericht(lead);
  if (!bericht) {
    return Response.json({ error: "Kon geen bericht genereren. Probeer het opnieuw." }, { status: 422 });
  }
  return Response.json({ ok: true, ...bericht });
}

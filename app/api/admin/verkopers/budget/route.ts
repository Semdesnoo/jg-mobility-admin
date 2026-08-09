import { leesBudget, geefVrij, POTJE_CENTEN } from "@/lib/verkopers-budget";

export const dynamic = "force-dynamic";

/**
 * De uitgavenrem uitlezen en vrijgeven.
 *
 * Waarom dit een aparte route is: de rem zelf zit achter elke betaalde stap in de
 * server (zie lib/verkopers-budget.ts), zodat hij ook geldt voor een scherm dat er
 * niets van weet. Dit is alleen het knopje ervoor.
 */
export async function GET() {
  const budget = await leesBudget();
  return Response.json({ ...budget, potjeStap: POTJE_CENTEN });
}

export async function POST() {
  const budget = await geefVrij();
  return Response.json({ ...budget, potjeStap: POTJE_CENTEN });
}

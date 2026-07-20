import { NextRequest } from "next/server";
import { getDossiers, createDossier, syncDossierMetAuto } from "@/lib/dossiers-db";
import { getAutos } from "@/lib/autos-db";

export const dynamic = "force-dynamic";

export async function GET() {
  // Auto's die nog geen dossier hebben krijgen er bij het openen van de
  // calculator alsnog één. Zo hoeft bestaande voorraad niet handmatig te worden
  // nagelopen, en klopt de lijst ook na het importeren van auto's.
  try {
    const autos = await getAutos();
    await Promise.all(autos.map((a) => syncDossierMetAuto(a)));
  } catch {
    /* koppeling is een extraatje — de lijst moet hoe dan ook laden */
  }
  const dossiers = await getDossiers();
  return Response.json(dossiers);
}

export async function POST(req: NextRequest) {
  const { auto_naam, verkoopprijs } = await req.json();
  const dossier = await createDossier(auto_naam || "Naamloos", Number(verkoopprijs) || 0);
  return Response.json(dossier);
}

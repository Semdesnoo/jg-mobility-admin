import { NextRequest } from "next/server";
import { getDossiers, createDossier } from "@/lib/dossiers-db";

export async function GET() {
  const dossiers = await getDossiers();
  return Response.json(dossiers);
}

export async function POST(req: NextRequest) {
  const { auto_naam, verkoopprijs } = await req.json();
  const dossier = await createDossier(auto_naam || "Naamloos", Number(verkoopprijs) || 0);
  return Response.json(dossier);
}

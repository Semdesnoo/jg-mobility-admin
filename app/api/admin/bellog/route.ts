import { NextRequest } from "next/server";
import { getOproepen, addOproep } from "@/lib/bellog-db";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getOproepen());
}

export async function POST(req: NextRequest) {
  const { datum, tijd, nummer, naam, notitie, terugbellen } = await req.json();

  if (!datum || !tijd) {
    return Response.json({ error: "Datum en tijd zijn verplicht" }, { status: 400 });
  }

  const oproep = await addOproep({
    datum,
    tijd,
    nummer: nummer || "",
    naam: naam || "",
    notitie: notitie || "",
    terugbellen: !!terugbellen,
    afgehandeld: false,
  });

  return Response.json(oproep, { status: 201 });
}

import { getAutos } from "@/lib/autos-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const autos = await getAutos();
  return Response.json(autos);
}

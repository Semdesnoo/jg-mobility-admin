import { NextRequest } from "next/server";
import { getInkoopverklaringen, maakInkoopverklaring } from "@/lib/inkoopverklaringen-db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getInkoopverklaringen());
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return Response.json(await maakInkoopverklaring(body), { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

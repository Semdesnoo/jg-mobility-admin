import { NextRequest } from "next/server";
import { saveAuto, getNextId, generateSlug } from "@/lib/autos-db";
import { revalidateWebsite } from "@/lib/revalidate";
import type { Auto } from "@/lib/autos";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const auto: Auto = {
      ...body,
      id: body.id || await getNextId(),
      slug: body.slug || generateSlug(body.merk, body.model),
      prijs: Number(body.prijs),
      km: Number(body.km),
      bouwjaar: Number(body.bouwjaar),
    };

    await saveAuto(auto);
    await revalidateWebsite();
    return Response.json({ ok: true, auto });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

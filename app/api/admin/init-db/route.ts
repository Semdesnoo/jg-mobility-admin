import { initDB } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initDB();
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

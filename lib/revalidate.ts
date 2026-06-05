// Roept de publieke website aan om de auto-cache direct te verversen na een wijziging
// (nieuwe auto, prijs, status). Zonder dit verschijnt een wijziging pas na de ISR-TTL.
export async function revalidateWebsite(): Promise<void> {
  // WEBSITE_URL is optioneel: de publieke site staat op een vaste URL, dus we vallen
  // daarop terug als de env-var ontbreekt. Trailing slash strippen.
  const base = (process.env.WEBSITE_URL || "https://www.jgmobility.nl").replace(/\/+$/, "");
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    console.warn("[revalidate] REVALIDATE_SECRET ontbreekt — website wordt niet direct ververst (pas na cache-TTL).");
    return;
  }
  try {
    const res = await fetch(`${base}/api/revalidate?secret=${encodeURIComponent(secret)}`, {
      method: "POST",
    });
    if (!res.ok) {
      // Meestal 401: REVALIDATE_SECRET in admin (dasboard) en website verschillen.
      console.warn(`[revalidate] website antwoordde ${res.status} — controleer of REVALIDATE_SECRET in beide projecten gelijk is.`);
    }
  } catch (err) {
    console.warn("[revalidate] aanroep mislukt:", err instanceof Error ? err.message : err);
  }
}

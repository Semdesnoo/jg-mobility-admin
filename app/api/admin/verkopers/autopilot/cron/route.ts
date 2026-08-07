export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Onbewaakte autopilot-ronde, bedoeld voor Vercel Cron.
 *
 * Vercel roept een cron aan met GET en een `Authorization: Bearer $CRON_SECRET`-header;
 * eigen headers kun je niet meegeven. Daarom deze aparte ingang die de sleutel op de
 * Vercel-manier controleert en daarna dezelfde autopilot-partij draait als de knop.
 *
 * Let op de reikwijdte: één aanroep past binnen 60 seconden en verstuurt dus hooguit
 * een handvol berichten. Op het Hobby-plan mag een cron één keer per dag draaien, dus
 * dit is een aanvulling op het werken vanuit het dashboard, geen vervanging.
 */
export async function GET(req: Request) {
  const geheim = process.env.CRON_SECRET;
  if (!geheim) {
    return Response.json({ error: "CRON_SECRET is niet ingesteld" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${geheim}`) {
    return Response.json({ error: "Niet toegestaan" }, { status: 401 });
  }

  // Hergebruikt de POST-afhandeling van de autopilot, inclusief alle grendels.
  // De aanroep is hierboven al geauthenticeerd, dus er hoeft geen tweede sleutel mee.
  const { POST } = await import("../route");
  return POST();
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * De wekelijkse mailscan, bedoeld voor Vercel Cron (maandagochtend).
 *
 * WAAROM EEN APARTE INGANG
 * Vercel roept een cron aan met een GET en een `Authorization: Bearer $CRON_SECRET`;
 * eigen headers kun je niet meegeven. Deze ingang controleert die sleutel en draait
 * daarna precies dezelfde scan als de knop in het dashboard.
 *
 * WAAROM EEN LUS
 * Eén scanronde verwerkt vier facturen — meer past niet binnen de 60 seconden die
 * Vercel een functie geeft, want één PDF uitlezen kost al seconden. In het dashboard
 * rijgt het scherm die rondes aaneen; hier moet dat vanzelf gaan, anders zou de
 * weekscan bij vier facturen stoppen en de rest tot volgende week laten liggen.
 *
 * De lus stopt bij drie dingen: alles verwerkt, geen tijd meer, of een ronde die niets
 * meer oplevert. Dat laatste is de belangrijkste: zonder die controle zou een factuur
 * die telkens mislukt de lus laten doordraaien tot Vercel de stekker eruit trekt.
 */
export async function GET(req: Request) {
  const geheim = process.env.CRON_SECRET;
  if (!geheim) {
    return Response.json({ error: "CRON_SECRET is niet ingesteld" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${geheim}`) {
    return Response.json({ error: "Niet toegestaan" }, { status: 401 });
  }

  const gestart = Date.now();
  // Ruim binnen de zestig seconden stoppen: wat verwerkt is moet nog geantwoord
  // worden, en een halve ronde is beter dan een afgekapte functie.
  const DEADLINE = gestart + 45_000;

  const { POST } = await import("../route");

  let rondes = 0;
  let verwerkt = 0;
  let resterend = 0;
  let fout = "";

  for (rondes = 1; rondes <= 10; rondes++) {
    const res = await POST();
    const d = (await res.json().catch(() => ({}))) as {
      verwerkt?: number;
      resterend?: number;
      error?: string;
    };

    if (d.error) {
      fout = d.error;
      break;
    }

    const dezeRonde = d.verwerkt ?? 0;
    verwerkt += dezeRonde;
    resterend = d.resterend ?? 0;

    if (resterend === 0) break;
    // Een ronde die niets oplevert terwijl er nog wat wacht: dan blijft hij op
    // dezelfde factuur hangen en heeft doorgaan geen zin.
    if (dezeRonde === 0) break;
    if (Date.now() > DEADLINE) break;
  }

  return Response.json({
    ok: !fout,
    rondes,
    verwerkt,
    resterend,
    seconden: Math.round((Date.now() - gestart) / 1000),
    ...(fout ? { error: fout } : {}),
  });
}

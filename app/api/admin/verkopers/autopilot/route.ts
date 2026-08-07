import sql from "@/lib/db";
import {
  initVerkopersDB,
  isGeblokkeerd,
  isGeldigEmail,
  type VerkoperLead,
} from "@/lib/verkopers-db";
import { genereerBericht } from "@/lib/verkopers-bericht";
import { verstuurBericht, aantalVandaagVerstuurd } from "@/lib/verkopers-verzend";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Autopilot: schrijft en verstuurt zelf, zonder dat er iemand op een knop drukt.
 *
 * De veiligheid zit niet in een mens die meekijkt maar in harde grendels in code,
 * en die zijn strenger dan een mens die door een wachtrij klikt:
 *
 *  - alleen leads waarvan de advertentie ECHT is uitgelezen (particulier_score > 0);
 *    een lead die alleen uit de zoekstap komt gaat er nooit doorheen;
 *  - alleen een e-mailadres dat de formaatcontrole haalt;
 *  - drempels voor particulier_score en kans_score die de gebruiker zelf zet;
 *  - de blokkadelijst wordt vlak vóór verzending nog een keer geraadpleegd;
 *  - nooit twee keer naar dezelfde verkoper (status + verstuurd_op + verzendlog);
 *  - een dagmaximum, geteld uit het verzendlog zodat handmatige verzendingen meetellen.
 *
 * Staat de schakelaar uit, dan doet deze route niets. Dat is de stand na installatie.
 */

const KEYS = {
  aan: "verkopers_autopilot_aan",
  maxPerDag: "verkopers_autopilot_max_per_dag",
  minKans: "verkopers_autopilot_min_kans",
  minParticulier: "verkopers_autopilot_min_particulier",
} as const;

// Standaard voorzichtig: vijf per dag is genoeg om na een week te zien of de toon klopt,
// en weinig genoeg om een misser niet uit te vergroten. Zelf op te hogen in het scherm.
const STANDAARD = { aan: false, maxPerDag: 5, minKans: 6, minParticulier: 7 };

type Instellingen = { aan: boolean; maxPerDag: number; minKans: number; minParticulier: number };

async function leesInstellingen(): Promise<Instellingen> {
  const rijen = await sql`SELECT key, value FROM settings WHERE key = ANY(${Object.values(KEYS)})`;
  const kv = new Map(rijen.map((r) => [r.key as string, r.value as string]));
  const getal = (k: string, standaard: number) => {
    const n = parseInt(kv.get(k) ?? "", 10);
    return Number.isFinite(n) ? n : standaard;
  };
  return {
    aan: kv.get(KEYS.aan) === "1",
    maxPerDag: Math.max(1, Math.min(50, getal(KEYS.maxPerDag, STANDAARD.maxPerDag))),
    minKans: Math.max(0, Math.min(10, getal(KEYS.minKans, STANDAARD.minKans))),
    minParticulier: Math.max(1, Math.min(10, getal(KEYS.minParticulier, STANDAARD.minParticulier))),
  };
}

async function schrijfInstelling(key: string, waarde: string) {
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${waarde})
    ON CONFLICT (key) DO UPDATE SET value = ${waarde}
  `;
}

/**
 * Leads die door alle grendels komen. particulier_score > 0 is de belangrijkste:
 * die is pas ingevuld nadat de advertentie daadwerkelijk is geopend en gelezen.
 */
async function kandidaten(inst: Instellingen, limiet: number): Promise<VerkoperLead[]> {
  const rijen = await sql`
    SELECT l.* FROM verkoper_leads l
    WHERE l.status IN ('nieuw', 'goedgekeurd')
      AND l.verstuurd_op IS NULL
      AND l.email <> ''
      AND l.particulier_score >= ${inst.minParticulier}
      AND l.kans_score >= ${inst.minKans}
      -- Al eens benaderd, al was het voor een andere auto? Dan valt hij hier al af
      -- in plaats van bij het versturen. Scheelt een mislukte poging per ronde.
      AND NOT EXISTS (
        SELECT 1 FROM verkoper_contactlog c
        WHERE c.lead_id <> l.id
          AND (
            (c.ontvanger_sleutel  <> '' AND c.ontvanger_sleutel  = lower(trim(l.email)))
            OR (c.ontvanger_sleutel2 <> '' AND c.ontvanger_sleutel2 = lower(trim(l.email)))
          )
      )
    ORDER BY l.kans_score DESC, l.gevonden_op ASC
    LIMIT ${limiet}
  `;
  return rijen as unknown as VerkoperLead[];
}

export async function GET() {
  try {
    await initVerkopersDB();
    const inst = await leesInstellingen();
    const vandaag = await aantalVandaagVerstuurd();
    const klaar = await kandidaten(inst, 100);
    return Response.json({
      ...inst,
      vandaagVerstuurd: vandaag,
      resterendVandaag: Math.max(0, inst.maxPerDag - vandaag),
      klaarVoorVerzending: klaar.length,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await initVerkopersDB();
    const b = await req.json();
    if (b.aan !== undefined) await schrijfInstelling(KEYS.aan, b.aan ? "1" : "0");
    if (b.maxPerDag !== undefined)
      await schrijfInstelling(
        KEYS.maxPerDag,
        String(Math.max(1, Math.min(50, Number(b.maxPerDag) || STANDAARD.maxPerDag)))
      );
    if (b.minKans !== undefined)
      await schrijfInstelling(KEYS.minKans, String(Math.max(0, Math.min(10, Number(b.minKans) || 0))));
    if (b.minParticulier !== undefined)
      await schrijfInstelling(
        KEYS.minParticulier,
        String(Math.max(1, Math.min(10, Number(b.minParticulier) || 7)))
      );
    return Response.json({ ok: true, ...(await leesInstellingen()) });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * Verwerkt één partij. Bewust klein: schrijven kost ~12s en versturen ~2s, dus meer
 * dan een handvol past niet in de 60 seconden van Vercel. De UI en de cron roepen
 * deze route herhaald aan tot er niets meer te doen is.
 */
export async function POST() {
  const start = Date.now();
  try {
    await initVerkopersDB();

    const inst = await leesInstellingen();
    if (!inst.aan) {
      return Response.json({ ok: true, uit: true, verstuurd: 0, meldingen: ["Autopilot staat uit"] });
    }

    const alVerstuurd = await aantalVandaagVerstuurd();
    let ruimte = inst.maxPerDag - alVerstuurd;
    if (ruimte <= 0) {
      return Response.json({
        ok: true,
        verstuurd: 0,
        klaar: true,
        meldingen: [`Dagmaximum van ${inst.maxPerDag} is bereikt`],
      });
    }

    const lijst = await kandidaten(inst, Math.min(ruimte, 4));
    const meldingen: string[] = [];
    let verstuurd = 0;

    for (const lead of lijst) {
      // Tijdsbudget bewaken: liever een partij afronden dan halverwege afgekapt worden.
      if (Date.now() - start > 42000) {
        meldingen.push("Tijd op — draai nog een ronde voor de rest");
        break;
      }
      if (ruimte <= 0) break;

      const naam = `${lead.merk} ${lead.model}`.trim() || lead.advertentie_url;

      // Grendel: adres moet de formaatcontrole halen.
      if (!isGeldigEmail(lead.email)) {
        await sql`UPDATE verkoper_leads SET notitie = 'Autopilot: e-mailadres ongeldig, overgeslagen' WHERE id = ${lead.id}`;
        meldingen.push(`${naam}: ongeldig e-mailadres, overgeslagen`);
        continue;
      }
      // Grendel: blokkadelijst, vlak voor verzending.
      if (await isGeblokkeerd(lead.email, lead.telefoon)) {
        await sql`UPDATE verkoper_leads SET status = 'afgewezen', notitie = 'Staat op blokkadelijst' WHERE id = ${lead.id}`;
        meldingen.push(`${naam}: staat op blokkadelijst, overgeslagen`);
        continue;
      }

      // Nog geen bericht? Dan eerst schrijven.
      let onderwerp = lead.onderwerp;
      let bericht = lead.bericht_mail;
      if (!bericht || !onderwerp) {
        const nieuw = await genereerBericht(lead, 30000);
        if (!nieuw) {
          meldingen.push(`${naam}: bericht schrijven mislukt, volgende ronde opnieuw`);
          continue;
        }
        onderwerp = nieuw.onderwerp;
        bericht = nieuw.bericht_mail;
      }

      const res = await verstuurBericht(lead.id, onderwerp, bericht);
      if (res.ok) {
        verstuurd++;
        ruimte--;
        meldingen.push(`${naam}: verstuurd naar ${lead.email}`);
      } else {
        meldingen.push(`${naam}: ${res.reden}`);
      }
    }

    const restant = await kandidaten(inst, 1);
    return Response.json({
      ok: true,
      verstuurd,
      meldingen,
      klaar: restant.length === 0 || ruimte <= 0,
      resterendVandaag: Math.max(0, inst.maxPerDag - (alVerstuurd + verstuurd)),
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

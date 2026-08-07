import { NextRequest } from "next/server";
import { google } from "googleapis";
import { getInkoopFacturen, type InkoopFactuur } from "@/lib/inkoopfacturen-db";
import { getAuthedClient } from "@/lib/gmail-client";
import { verzamelBijlagen, pdfEerst, type Bijlage } from "@/lib/gmail-bijlagen";
import { boekDatum, kwartaalVan, kwartaalGrenzen, lokaleDatum } from "@/lib/factuur-periode";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Alles wat je nodig hebt om één kwartaal aan de boekhouder te geven.
 *
 * Deze route zet het pakket klaar maar bouwt de zip NIET zelf. Dat is bewust:
 * een kwartaal aan facturen is al snel tientallen megabytes en Vercel kapt zowel
 * de responsgrootte als de looptijd af. Het scherm haalt daarom de bijlagen één
 * voor één op via de bestaande /gmail/attachment-route en pakt ze in de browser
 * in. Daar geldt geen limiet, en je ziet ondertussen hoe ver hij is.
 *
 * Wat hier wél gebeurt is het dure opzoekwerk: per factuur uitzoeken wélke
 * bijlagen er in de bron-e-mail zitten.
 */

const rond = (n: number) => Math.round(n * 100) / 100;

export type FactuurMetBijlagen = InkoopFactuur & {
  bijlagen: Bijlage[];
  /** Waarom er geen document is — leeg als er wel bijlagen zijn. */
  geenDocumentReden: string;
};

/** Meerdere Gmail-aanroepen tegelijk, maar niet honderden: anders loop je tegen
 *  de snelheidslimiet van de API aan. */
async function inGroepjes<T, R>(
  items: T[],
  grootte: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const uit: R[] = [];
  for (let i = 0; i < items.length; i += grootte) {
    uit.push(...(await Promise.all(items.slice(i, i + grootte).map(fn))));
  }
  return uit;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const jaar = Number(sp.get("jaar"));
  const kwartaal = Number(sp.get("kwartaal"));
  if (!Number.isInteger(jaar) || jaar < 2000 || jaar > 2100) {
    return Response.json({ error: "Ongeldig jaar" }, { status: 400 });
  }
  if (!Number.isInteger(kwartaal) || kwartaal < 1 || kwartaal > 4) {
    return Response.json({ error: "Ongeldig kwartaal" }, { status: 400 });
  }

  const alle = await getInkoopFacturen();
  const { van, tot } = kwartaalGrenzen(jaar, kwartaal);

  const inKwartaal = alle.filter((f) => {
    const d = boekDatum(f);
    return d !== null && d >= van && d <= tot;
  });

  // Zonder Gmail kunnen we geen documenten meeleveren. Dat is geen reden om de
  // hele route te laten falen: de cijfers en de specificatie zijn ook zonder
  // bijlagen bruikbaar voor de boekhouder.
  let gmail: ReturnType<typeof google.gmail> | null = null;
  let gmailFout = "";
  try {
    gmail = google.gmail({ version: "v1", auth: await getAuthedClient() });
  } catch (err) {
    gmailFout = String(err).includes("niet gekoppeld")
      ? "Gmail is niet gekoppeld, dus de factuurbestanden kunnen niet worden meegeleverd."
      : "De Gmail-koppeling werkt niet, dus de factuurbestanden kunnen niet worden meegeleverd.";
  }

  const start = Date.now();
  let afgekapt = false;

  const metBijlagen: FactuurMetBijlagen[] = await inGroepjes(inKwartaal, 6, async (f) => {
    if (!f.gmail_message_id) {
      return {
        ...f,
        bijlagen: [],
        geenDocumentReden: "Handmatig ingevoerd — er is geen bron-e-mail met een bestand.",
      };
    }
    if (!gmail) return { ...f, bijlagen: [], geenDocumentReden: gmailFout };
    // Tijdsbudget bewaken: liever een compleet antwoord met een eerlijke melding
    // dan halverwege afgekapt worden door Vercel.
    if (Date.now() - start > 40000) {
      afgekapt = true;
      return { ...f, bijlagen: [], geenDocumentReden: "Niet opgehaald — te veel facturen in één keer." };
    }
    try {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: f.gmail_message_id,
        format: "full",
      });
      const bijlagen = pdfEerst(verzamelBijlagen(msg.data.payload ?? undefined));
      return {
        ...f,
        bijlagen,
        geenDocumentReden: bijlagen.length ? "" : "De bron-e-mail had geen bijlage.",
      };
    } catch {
      return { ...f, bijlagen: [], geenDocumentReden: "De bron-e-mail kon niet worden geopend." };
    }
  });

  const incl = rond(metBijlagen.reduce((s, f) => s + f.bedrag_incl, 0));
  const btw = rond(metBijlagen.reduce((s, f) => s + f.btw_bedrag, 0));

  // Per categorie, want dat is de indeling waar de boekhouder mee werkt.
  const perCategorie = Object.entries(
    metBijlagen.reduce<Record<string, { aantal: number; incl: number; btw: number }>>((acc, f) => {
      const k = f.categorie || "Overig";
      acc[k] ??= { aantal: 0, incl: 0, btw: 0 };
      acc[k].aantal++;
      acc[k].incl += f.bedrag_incl;
      acc[k].btw += f.btw_bedrag;
      return acc;
    }, {})
  )
    .map(([categorie, v]) => ({ categorie, aantal: v.aantal, incl: rond(v.incl), btw: rond(v.btw) }))
    .sort((a, b) => b.incl - a.incl);

  return Response.json({
    jaar,
    kwartaal,
    periode: `${lokaleDatum(van)} t/m ${lokaleDatum(tot)}`,
    facturen: metBijlagen,
    totalen: { aantal: metBijlagen.length, incl, btw, excl: rond(incl - btw) },
    perCategorie,
    metDocument: metBijlagen.filter((f) => f.bijlagen.length > 0).length,
    zonderDocument: metBijlagen.filter((f) => f.bijlagen.length === 0).length,
    gmailFout,
    afgekapt,
  });
}

/** Welke jaren en kwartalen bestaan er überhaupt? Zo hoeft het scherm geen lege
 *  periodes aan te bieden. */
export async function POST() {
  const alle = await getInkoopFacturen();
  const gezien = new Map<string, { jaar: number; kwartaal: number; aantal: number }>();
  for (const f of alle) {
    const d = boekDatum(f);
    if (!d) continue;
    const jaar = d.getFullYear();
    const kwartaal = kwartaalVan(d);
    const sleutel = `${jaar}-${kwartaal}`;
    const bestaand = gezien.get(sleutel);
    if (bestaand) bestaand.aantal++;
    else gezien.set(sleutel, { jaar, kwartaal, aantal: 1 });
  }
  const periodes = [...gezien.values()].sort(
    (a, b) => b.jaar - a.jaar || b.kwartaal - a.kwartaal
  );
  const zonderDatum = alle.filter((f) => boekDatum(f) === null).length;
  return Response.json({ periodes, zonderDatum });
}

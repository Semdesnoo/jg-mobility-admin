import { initVerkopersDB, getLeads, voegLeadToe, isGeblokkeerd } from "@/lib/verkopers-db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initVerkopersDB();
    return Response.json(await getLeads());
  } catch {
    return Response.json([], { status: 200 });
  }
}

/** Handmatig een lead toevoegen — voor advertenties die je zelf tegenkomt. */
export async function POST(req: Request) {
  try {
    await initVerkopersDB();
    const b = await req.json();
    if (!b.advertentie_url || !/^https?:\/\//i.test(b.advertentie_url)) {
      return Response.json({ error: "Geef de link naar de advertentie op" }, { status: 400 });
    }
    if (await isGeblokkeerd(b.email ?? "", b.telefoon ?? "")) {
      return Response.json({ error: "Deze verkoper staat op de blokkadelijst" }, { status: 403 });
    }
    const id = await voegLeadToe({
      bron: b.bron ?? "Handmatig",
      advertentie_url: b.advertentie_url,
      titel: b.titel ?? "",
      merk: b.merk ?? "",
      model: b.model ?? "",
      bouwjaar: String(b.bouwjaar ?? ""),
      km: String(b.km ?? ""),
      brandstof: b.brandstof ?? "",
      vraagprijs: Number(b.vraagprijs) || 0,
      plaats: b.plaats ?? "",
      naam: b.naam ?? "",
      telefoon: b.telefoon ?? "",
      email: b.email ?? "",
      particulier_score: 10,
      kans_score: Number(b.kans_score) || 5,
      motivatie: b.motivatie ?? "Handmatig toegevoegd",
      zoekopdracht: "handmatig",
    });
    if (!id) return Response.json({ error: "Deze advertentie staat al in de lijst" }, { status: 409 });
    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

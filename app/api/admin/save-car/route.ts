import { NextRequest } from "next/server";
import { saveAuto, getNextId, generateSlug, ensureUniqueSlug, getAutoById } from "@/lib/autos-db";
import { revalidateWebsite } from "@/lib/revalidate";
import type { Auto } from "@/lib/autos";

type Optie = { categorie: string; items: string[] };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Validatie: voorkom corrupte/NaN-records in de gedeelde database ──
    const merk = String(body.merk ?? "").trim();
    const model = String(body.model ?? "").trim();
    if (!merk || !model) {
      return Response.json({ error: "Merk en model zijn verplicht." }, { status: 400 });
    }

    const prijs = Number(body.prijs);
    if (!Number.isFinite(prijs) || prijs < 0) {
      return Response.json({ error: "Vul een geldige vraagprijs in." }, { status: 400 });
    }

    const km = Number(body.km);
    if (!Number.isFinite(km) || km < 0) {
      return Response.json({ error: "Vul een geldige kilometerstand in." }, { status: 400 });
    }

    const bouwjaarNum = Number(body.bouwjaar);
    const bouwjaar = Number.isFinite(bouwjaarNum) && bouwjaarNum > 0 ? bouwjaarNum : 0;

    // ── Id + unieke slug ──
    const isBestaand = Number(body.id) > 0;
    const id = isBestaand ? Number(body.id) : await getNextId();
    const baseSlug = String(body.slug || "").trim() || generateSlug(merk, model);
    const slug = await ensureUniqueSlug(baseSlug, id);

    // toegevoegd_op (voor standtijd): behoud bij bewerken, anders nu
    const bestaand = isBestaand ? await getAutoById(id) : null;
    const toegevoegd_op = String(body.toegevoegd_op || bestaand?.toegevoegd_op || new Date().toISOString());

    // ── Whitelist: alleen bekende Auto-velden naar de DB (geen ongewenste rommel) ──
    // Alleen vertrouwde foto-bronnen toestaan (eigen /public-paden, Vercel Blob, AutoScout-import).
    // Voorkomt dat willekeurige externe URL's in de OG-image/JSON-LD van de website belanden.
    const fotoToegestaan = (f: string) =>
      f.startsWith("/") ||
      (f.startsWith("https://") &&
        (f.includes(".public.blob.vercel-storage.com") ||
          f.includes("prod.pictures.autoscout24.net")));
    const fotos = Array.isArray(body.fotos)
      ? body.fotos.filter((f: unknown): f is string => typeof f === "string" && fotoToegestaan(f))
      : [];
    const opties: Optie[] = Array.isArray(body.opties)
      ? body.opties
          .filter((o: unknown): o is Optie =>
            !!o && typeof o === "object" && Array.isArray((o as Optie).items))
          .map((o: Optie) => ({ categorie: String(o.categorie ?? ""), items: o.items.map(String) }))
      : [];

    const auto: Auto = {
      id,
      slug,
      merk,
      model,
      versie: String(body.versie ?? ""),
      bouwjaar,
      bodytype: String(body.bodytype ?? ""),
      prijs,
      km,
      brandstof: String(body.brandstof ?? ""),
      transmissie: String(body.transmissie ?? ""),
      vermogen: String(body.vermogen ?? ""),
      kleur: String(body.kleur ?? ""),
      apk: String(body.apk ?? ""),
      btw: String(body.btw ?? ""),
      bekleding: String(body.bekleding ?? ""),
      kleurExterieur: String(body.kleurExterieur ?? ""),
      fotos,
      verkocht: Boolean(body.verkocht),
      gereserveerd: Boolean(body.gereserveerd),
      omschrijving: String(body.omschrijving ?? ""),
      opties,
      toegevoegd_op,
      ...(body.verkocht_op ? { verkocht_op: String(body.verkocht_op) } : {}),
      ...(body.kenteken ? { kenteken: String(body.kenteken) } : {}),
      ...(body.cilinderinhoud ? { cilinderinhoud: String(body.cilinderinhoud) } : {}),
      ...(body.aantalDeuren ? { aantalDeuren: String(body.aantalDeuren) } : {}),
      ...(body.aantalCilinders ? { aantalCilinders: String(body.aantalCilinders) } : {}),
    };

    await saveAuto(auto);
    await revalidateWebsite();
    return Response.json({ ok: true, auto });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

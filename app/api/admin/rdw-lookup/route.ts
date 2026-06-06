import { NextRequest } from "next/server";

const CARROSSERIE_MAP: Record<string, string> = {
  Personenauto: "Hatchback",
  Stationwagen: "Stationwagen",
  MPV: "MPV",
  SUV: "SUV",
  Cabriolet: "Cabriolet",
  Coupé: "Coupe",
  Sedan: "Sedan",
  Hatchback: "Hatchback",
  Terreinwagen: "SUV",
  Bestelauto: "Bestelauto",
};

function capitalize(s: string) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("kenteken") ?? "";
  const kenteken = raw.replace(/-/g, "").toUpperCase();

  if (!kenteken) {
    return Response.json({ error: "Kenteken is verplicht" }, { status: 400 });
  }

  try {
    const [voertuigRes, brandstofRes, apkRes] = await Promise.all([
      fetch(`https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${kenteken}`, { cache: "no-store" }),
      fetch(`https://opendata.rdw.nl/resource/8ys7-d773.json?kenteken=${kenteken}`, { cache: "no-store" }),
      fetch(`https://opendata.rdw.nl/resource/vkijpjd8.json?kenteken=${kenteken}`, { cache: "no-store" }),
    ]);

    const [voertuig, brandstof, apkData] = await Promise.all([
      voertuigRes.json(),
      brandstofRes.json(),
      apkRes.json(),
    ]);

    if (!voertuig || voertuig.length === 0) {
      return Response.json({ error: "Kenteken niet gevonden in RDW" }, { status: 404 });
    }

    const v = voertuig[0];
    const b = brandstof?.[0];
    const a = apkData?.[0];

    const bouwjaar = v.datum_eerste_toelating
      ? parseInt(String(v.datum_eerste_toelating).slice(0, 4))
      : null;

    let apk = "Onbekend";
    if (a?.vervaldatum_apk_dt) {
      const d = new Date(a.vervaldatum_apk_dt);
      apk = `${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    }

    const inrichting = v.inrichting ? capitalize(v.inrichting) : "";
    const bodytype = CARROSSERIE_MAP[inrichting] ?? inrichting ?? "Hatchback";

    const merk = v.merk ? capitalize(v.merk) : "";
    const model = v.handelsbenaming ?? "";
    const kleur = v.eerste_kleur ? capitalize(v.eerste_kleur) : "";
    const brandstofOmschrijving = b?.brandstof_omschrijving
      ? capitalize(b.brandstof_omschrijving)
      : "";

    // Vermogen: RDW geeft kW, wij tonen pk (1 kW = 1.3596 pk)
    let vermogen = "";
    if (b?.nettomaximumvermogen) {
      const kw = parseFloat(b.nettomaximumvermogen);
      if (!isNaN(kw) && kw > 0) {
        vermogen = `${Math.round(kw * 1.3596)} pk`;
      }
    }

    // Cilinderinhoud voor versie-hint (bijv. "1.4", "2.0")
    let cilinderinhoud = "";
    if (v.cilinderinhoud) {
      const cc = parseInt(v.cilinderinhoud);
      if (!isNaN(cc) && cc > 0) {
        cilinderinhoud = (cc / 1000).toFixed(1);
      }
    }

    const aantalDeuren = v.aantal_deuren ?? "";
    const aantalCilinders = v.aantal_cilinders ?? "";

    // Catalogusprijs = originele nieuwprijs incl. BTW/BPM. Ankerwaarde voor de koerslijst-
    // berekening (afschrijving). Niet elk voertuig heeft het (import/ouder) → dan 0.
    const catalogusprijs = v.catalogusprijs ? parseInt(v.catalogusprijs) : 0;
    const datumEersteToelating = v.datum_eerste_toelating ? String(v.datum_eerste_toelating) : "";

    return Response.json({
      kenteken,
      merk,
      model,
      bouwjaar,
      kleur,
      brandstof: brandstofOmschrijving,
      bodytype,
      apk,
      vermogen,
      cilinderinhoud,
      aantalDeuren,
      aantalCilinders,
      catalogusprijs,
      datumEersteToelating,
    });
  } catch {
    return Response.json({ error: "RDW opzoeking mislukt" }, { status: 500 });
  }
}

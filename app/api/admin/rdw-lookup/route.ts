import { NextRequest } from "next/server";

// RDW levert alles als string; per dataset verschillen de velden.
type RdwRij = Record<string, string | undefined>;

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
    // Alle RDW-datasets die samen het volledige voertuigbeeld geven.
    // Een falende dataset mag de opzoeking niet slopen → per stuk afgevangen.
    const haal = async (resource: string): Promise<RdwRij[]> => {
      try {
        const res = await fetch(
          `https://opendata.rdw.nl/resource/${resource}.json?kenteken=${kenteken}`,
          { cache: "no-store" }
        );
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    };

    const [voertuig, brandstof, carrosserie, terugroep, gebreken] = await Promise.all([
      haal("m9d7-ebf2"), // gekentekende voertuigen (hoofdset)
      haal("8ys7-d773"), // brandstof & emissies
      haal("vezc-m2t6"), // carrosserie
      haal("t49b-isb7"), // openstaande terugroepacties
      haal("a34c-vvps"), // geconstateerde gebreken bij keuring
    ]);

    if (voertuig.length === 0) {
      return Response.json({ error: "Kenteken niet gevonden in RDW" }, { status: 404 });
    }

    const v = voertuig[0];
    const b = brandstof?.[0];

    const bouwjaar = v.datum_eerste_toelating
      ? parseInt(String(v.datum_eerste_toelating).slice(0, 4))
      : null;

    // APK-vervaldatum zit in de hoofddataset (vervaldatum_apk_dt).
    let apk = "Onbekend";
    if (v.vervaldatum_apk_dt) {
      const d = new Date(String(v.vervaldatum_apk_dt));
      if (!isNaN(d.getTime())) {
        apk = `${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
      }
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

    // ── Extra's: dit is wat een kentekencheck-site ook toont ──
    const nlDatum = (s: string | undefined): string => {
      if (!s) return "";
      // RDW geeft of "20240101" of een ISO-datum.
      const d = s.includes("T") || s.includes("-") ? new Date(s) : new Date(
        `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
      );
      return isNaN(d.getTime()) ? "" : d.toLocaleDateString("nl-NL");
    };

    const getal = (s: string | undefined): number | null => {
      if (!s) return null;
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };

    // Tellerstandoordeel: "Logisch" = NAP in orde, alles anders is een waarschuwing.
    const tellerstandoordeel = v.tellerstandoordeel ?? "";
    const tellerLogisch = tellerstandoordeel.toLowerCase().startsWith("logisch");

    const openstaandeTerugroepactie =
      (v.openstaande_terugroepactie_indicator ?? "").toLowerCase() === "ja";

    return Response.json({
      // ── Bestaande velden (auto-toevoegen leest deze) ──
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

      // ── Uitgebreide gegevens ──
      voertuigsoort: v.voertuigsoort ?? "",
      handelsbenaming: v.handelsbenaming ?? "",
      variant: v.variant ?? "",
      uitvoering: v.uitvoering ?? "",
      typegoedkeuring: v.typegoedkeuringsnummer ?? "",
      inrichting,
      tweedeKleur: v.tweede_kleur && v.tweede_kleur !== "Niet geregistreerd" ? capitalize(v.tweede_kleur) : "",
      aantalZitplaatsen: v.aantal_zitplaatsen ?? "",
      aantalWielen: v.aantal_wielen ?? "",

      // Status & historie
      apkVervaldatum: nlDatum(v.vervaldatum_apk_dt ?? v.vervaldatum_apk),
      datumEersteToelatingNL: nlDatum(v.datum_eerste_toelating),
      datumTenaamstelling: nlDatum(v.datum_tenaamstelling),
      eersteToelatingNederland: nlDatum(v.datum_eerste_tenaamstelling_in_nederland),
      wamVerzekerd: (v.wam_verzekerd ?? "").toLowerCase() === "ja",
      tenaamstellenMogelijk: (v.tenaamstellen_mogelijk ?? "").toLowerCase() === "ja",
      geexporteerd: (v.export_indicator ?? "").toLowerCase() === "ja",
      taxiVerleden: (v.taxi_indicator ?? "").toLowerCase() === "ja",
      wachtOpKeuren: v.wacht_op_keuren ?? "",

      // Tellerstand (NAP)
      tellerstandoordeel,
      tellerLogisch,
      jaarLaatsteTellerstand: v.jaar_laatste_registratie_tellerstand ?? "",

      // Terugroepacties & gebreken
      openstaandeTerugroepactie,
      aantalTerugroepacties: terugroep.length,
      aantalGebreken: gebreken.length,

      // Financieel
      brutoBpm: getal(v.bruto_bpm),
      zuinigheidsclassificatie: v.zuinigheidsclassificatie ?? "",

      // Techniek & maten
      massaLedig: getal(v.massa_ledig_voertuig),
      massaRijklaar: getal(v.massa_rijklaar),
      maxMassa: getal(v.toegestane_maximum_massa_voertuig),
      trekgewichtGeremd: getal(v.maximum_trekken_massa_geremd),
      trekgewichtOngeremd: getal(v.maximum_massa_trekken_ongeremd),
      lengte: getal(v.lengte),
      breedte: getal(v.breedte),
      hoogte: getal(v.hoogte_voertuig),
      wielbasis: getal(v.wielbasis),
      topsnelheid: getal(v.maximale_constructiesnelheid),
      europeseCategorie: v.europese_voertuigcategorie ?? "",
      carrosserie: carrosserie?.[0]?.type_carrosserie_europese_omschrijving ?? "",

      // Emissies
      co2Uitstoot: getal(b?.co2_uitstoot_gecombineerd),
      emissiecode: b?.emissiecode_omschrijving ?? "",
      milieuklasse: b?.uitstoot_deeltjes_licht ? "" : (b?.milieuklasse_eg_goedkeuring_licht ?? ""),
    });
  } catch {
    return Response.json({ error: "RDW opzoeking mislukt" }, { status: 500 });
  }
}

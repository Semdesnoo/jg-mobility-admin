import sql from "@/lib/db";

export const dynamic = "force-dynamic";

type Auto = {
  id: number; merk: string; model: string; bouwjaar: number;
  prijs: number; km: number; brandstof: string; bodytype: string;
  verkocht?: boolean; gereserveerd?: boolean; verkocht_op?: string;
};

type Dossier = {
  id: number; auto_naam: string; inkoop: number; btw_type: string;
  verkoopprijs: number; kosten: { label: string; bedrag: string }[];
  aangemaakt: string;
};

function bereken_netto_marge(d: Dossier): number | null {
  if (d.verkoopprijs <= 0) return null;
  const totaalKosten = d.kosten.reduce((s, k) => s + (parseFloat(k.bedrag) || 0), 0);
  const kostprijs = d.inkoop + totaalKosten;
  if (d.btw_type === "marge") {
    const m = d.verkoopprijs - kostprijs;
    return m > 0 ? Math.round((m - (m * 21) / 121) * 100) / 100 : m;
  }
  const ex = Math.round((d.verkoopprijs / 1.21) * 100) / 100;
  return Math.round((ex - kostprijs) * 100) / 100;
}

export async function GET() {
  try {
    const [autoRows, dossierRows] = await Promise.all([
      sql`SELECT data FROM autos ORDER BY id DESC`,
      sql`SELECT * FROM marge_dossiers ORDER BY aangemaakt DESC`.catch(() => []),
    ]);

    const autos: Auto[] = autoRows.map((r) => {
      const d = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
      return d as Auto;
    });

    const dossiers: Dossier[] = dossierRows.map((r) => ({
      id: r.id as number,
      auto_naam: r.auto_naam as string,
      inkoop: Number(r.inkoop),
      btw_type: r.btw_type as string,
      verkoopprijs: Number(r.verkoopprijs),
      kosten: Array.isArray(r.kosten) ? r.kosten : (typeof r.kosten === "string" ? JSON.parse(r.kosten) : []),
      aangemaakt: r.aangemaakt as string,
    }));

    const verkocht = autos.filter((a) => a.verkocht);
    const beschikbaar = autos.filter((a) => !a.verkocht);

    // ── Per merk stats ─────────────────────────────────────────
    const merkMap: Record<string, { verkocht: number; beschikbaar: number; totaalPrijs: number; prijzen: number[] }> = {};
    for (const a of autos) {
      if (!merkMap[a.merk]) merkMap[a.merk] = { verkocht: 0, beschikbaar: 0, totaalPrijs: 0, prijzen: [] };
      if (a.verkocht) merkMap[a.merk].verkocht++;
      else merkMap[a.merk].beschikbaar++;
      merkMap[a.merk].totaalPrijs += a.prijs;
      merkMap[a.merk].prijzen.push(a.prijs);
    }

    const merkStats = Object.entries(merkMap).map(([merk, s]) => ({
      merk,
      verkocht: s.verkocht,
      beschikbaar: s.beschikbaar,
      totaal: s.verkocht + s.beschikbaar,
      verkoopPercentage: s.verkocht + s.beschikbaar > 0
        ? Math.round((s.verkocht / (s.verkocht + s.beschikbaar)) * 100)
        : 0,
      gemPrijs: s.prijzen.length > 0 ? Math.round(s.totaalPrijs / s.prijzen.length) : 0,
    })).sort((a, b) => b.verkocht - a.verkocht);

    // ── Brandstof stats ────────────────────────────────────────
    const brandstofMap: Record<string, { verkocht: number; beschikbaar: number }> = {};
    for (const a of autos) {
      const b = a.brandstof || "Onbekend";
      if (!brandstofMap[b]) brandstofMap[b] = { verkocht: 0, beschikbaar: 0 };
      if (a.verkocht) brandstofMap[b].verkocht++;
      else brandstofMap[b].beschikbaar++;
    }
    const brandstofStats = Object.entries(brandstofMap).map(([brandstof, s]) => ({
      brandstof,
      ...s,
      totaal: s.verkocht + s.beschikbaar,
      verkoopPercentage: s.verkocht + s.beschikbaar > 0
        ? Math.round((s.verkocht / (s.verkocht + s.beschikbaar)) * 100)
        : 0,
    })).sort((a, b) => b.verkocht - a.verkocht);

    // ── Prijssegment stats ─────────────────────────────────────
    const segmenten = [
      { label: "< €10.000",       min: 0,     max: 10000  },
      { label: "€10.000–€20.000", min: 10000, max: 20000  },
      { label: "€20.000–€30.000", min: 20000, max: 30000  },
      { label: "> €30.000",       min: 30000, max: Infinity },
    ];
    const segmentStats = segmenten.map((seg) => {
      const inSeg = autos.filter((a) => a.prijs >= seg.min && a.prijs < seg.max);
      const verkochtInSeg = inSeg.filter((a) => a.verkocht);
      return {
        label: seg.label,
        totaal: inSeg.length,
        verkocht: verkochtInSeg.length,
        beschikbaar: inSeg.length - verkochtInSeg.length,
        verkoopPercentage: inSeg.length > 0
          ? Math.round((verkochtInSeg.length / inSeg.length) * 100)
          : 0,
      };
    });

    // ── Verkopen per maand (uit verkocht_op) ────────────────────
    const maandMap: Record<string, { count: number; omzet: number }> = {};
    for (const a of verkocht) {
      if (!a.verkocht_op) continue;
      const d = new Date(a.verkocht_op);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!maandMap[key]) maandMap[key] = { count: 0, omzet: 0 };
      maandMap[key].count++;
      maandMap[key].omzet += a.prijs;
    }

    // ── Marge dossiers analyse ─────────────────────────────────
    const dossiersMetMarge = dossiers
      .map((d) => ({ ...d, netto_marge: bereken_netto_marge(d) }))
      .filter((d) => d.netto_marge !== null && d.inkoop > 0);

    const gemMarge = dossiersMetMarge.length > 0
      ? Math.round(dossiersMetMarge.reduce((s, d) => s + (d.netto_marge ?? 0), 0) / dossiersMetMarge.length)
      : null;

    const topDossiers = [...dossiersMetMarge]
      .sort((a, b) => (b.netto_marge ?? 0) - (a.netto_marge ?? 0))
      .slice(0, 5);

    const slechteDossiers = [...dossiersMetMarge]
      .sort((a, b) => (a.netto_marge ?? 0) - (b.netto_marge ?? 0))
      .slice(0, 3);

    // ── Voorraadwaarde ─────────────────────────────────────────
    const voorraadWaarde = beschikbaar.reduce((s, a) => s + a.prijs, 0);
    const gemVerkoopPrijs = verkocht.length > 0
      ? Math.round(verkocht.reduce((s, a) => s + a.prijs, 0) / verkocht.length)
      : 0;

    return Response.json({
      kpis: {
        totaal_verkocht: verkocht.length,
        actieve_voorraad: beschikbaar.length,
        voorraad_waarde: voorraadWaarde,
        gem_verkoop_prijs: gemVerkoopPrijs,
        gem_marge: gemMarge,
        totaal_dossiers: dossiersMetMarge.length,
      },
      merk_stats: merkStats,
      brandstof_stats: brandstofStats,
      segment_stats: segmentStats,
      verkopen_per_maand: maandMap,
      marge_dossiers: {
        top: topDossiers,
        slecht: slechteDossiers,
        gem: gemMarge,
      },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [facturen, autos, dossiers, leads] = await Promise.all([
      sql`SELECT datum, verkoopprijs, btw_type, status FROM facturen`,
      sql`SELECT data FROM autos`,
      sql`SELECT inkoop, verkoopprijs, btw_type, kosten, aangemaakt FROM dossiers`,
      sql`SELECT status, aangemaakt FROM leads`.catch(() => []),
    ]);

    const autoData = autos.map((a) => {
      const d = typeof a.data === "string" ? JSON.parse(a.data) : a.data;
      return d;
    });

    const verkochtAutos = autoData.filter((a) => a.verkocht);

    // Omzet per maand (laatste 12 maanden, uit betaalde facturen)
    const omzetPerMaand: Record<string, number> = {};
    const verkochteFacturen = facturen.filter((f) => f.status === "betaald");
    for (const f of verkochteFacturen) {
      const parts = (f.datum as string).split("-").map(Number);
      if (parts.length < 3) continue;
      const key = `${parts[2]}-${String(parts[1]).padStart(2, "0")}`;
      omzetPerMaand[key] = (omzetPerMaand[key] ?? 0) + Number(f.verkoopprijs);
    }

    // Verkopen per maand (uit autos verkocht_op)
    const verkopenPerMaand: Record<string, number> = {};
    for (const a of verkochtAutos) {
      if (!a.verkocht_op) continue;
      const d = new Date(a.verkocht_op);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      verkopenPerMaand[key] = (verkopenPerMaand[key] ?? 0) + 1;
    }

    // Marge stats uit dossiers
    const marges: number[] = [];
    for (const d of dossiers) {
      if (!d.verkoopprijs || Number(d.verkoopprijs) <= 0) continue;
      let kosten = 0;
      try { kosten = (JSON.parse(d.kosten as string) as { bedrag: string }[]).reduce((s, k) => s + (parseFloat(k.bedrag) || 0), 0); } catch { /* */ }
      const kostprijs = Number(d.inkoop) + kosten;
      const verkoop = Number(d.verkoopprijs);
      let winst = 0;
      if (d.btw_type === "marge") {
        const m = verkoop - kostprijs;
        winst = m > 0 ? Math.round((m - (m * 21) / 121) * 100) / 100 : m;
      } else {
        const ex = Math.round((verkoop / 1.21) * 100) / 100;
        winst = Math.round((ex - kostprijs) * 100) / 100;
      }
      marges.push(winst);
    }
    const gemiddeldeMarge = marges.length > 0 ? Math.round(marges.reduce((s, v) => s + v, 0) / marges.length) : 0;

    // Merken frequentie
    const merkenCount: Record<string, number> = {};
    for (const a of verkochtAutos) {
      if (a.merk) merkenCount[a.merk] = (merkenCount[a.merk] ?? 0) + 1;
    }
    const topMerken = Object.entries(merkenCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([merk, count]) => ({ merk, count }));

    // Leads per status
    const leadsPerStatus: Record<string, number> = {};
    for (const l of leads) {
      leadsPerStatus[l.status as string] = (leadsPerStatus[l.status as string] ?? 0) + 1;
    }

    return Response.json({
      omzetPerMaand,
      verkopenPerMaand,
      gemiddeldeMarge,
      topMerken,
      leadsPerStatus,
      totaalVerkocht: verkochtAutos.length,
      totaalFacturen: verkochteFacturen.length,
      totaalOmzet: verkochteFacturen.reduce((s, f) => s + Number(f.verkoopprijs), 0),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

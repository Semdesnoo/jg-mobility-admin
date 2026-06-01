"use client";

import { useState, useEffect } from "react";
import { Award, TrendingUp, AlertCircle } from "lucide-react";

type PrestatiesData = {
  kpis: {
    totaal_verkocht: number; actieve_voorraad: number; voorraad_waarde: number;
    gem_verkoop_prijs: number; gem_marge: number | null; totaal_dossiers: number;
  };
  merk_stats: { merk: string; verkocht: number; beschikbaar: number; totaal: number; verkoopPercentage: number; gemPrijs: number }[];
  brandstof_stats: { brandstof: string; verkocht: number; beschikbaar: number; totaal: number; verkoopPercentage: number }[];
  segment_stats: { label: string; totaal: number; verkocht: number; beschikbaar: number; verkoopPercentage: number }[];
  verkopen_per_maand: Record<string, { count: number; omzet: number }>;
  marge_dossiers: {
    top: { id: number; auto_naam: string; inkoop: number; verkoopprijs: number; netto_marge: number; aangemaakt: string }[];
    slecht: { id: number; auto_naam: string; inkoop: number; verkoopprijs: number; netto_marge: number; aangemaakt: string }[];
    gem: number | null;
  };
};

const S = {
  label: { color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" } as React.CSSProperties,
};

const MAANDEN = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded" style={{ backgroundColor: "rgba(0,19,55,0.07)" }}>
        <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-semibold w-5 text-right" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>{value}</span>
    </div>
  );
}

export default function PrestatiesTab() {
  const [data, setData] = useState<PrestatiesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/inkoop/prestaties")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />
    </div>
  );

  if (error || !data) return (
    <div className="p-8">
      <div className="flex items-start gap-3 px-4 py-3" style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca" }}>
        <AlertCircle size={16} style={{ color: "#b91c1c", flexShrink: 0, marginTop: 1 }} />
        <p className="text-sm" style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>{error ?? "Laden mislukt"}</p>
      </div>
    </div>
  );

  const { kpis, merk_stats, brandstof_stats, segment_stats, verkopen_per_maand, marge_dossiers } = data;

  // Maandgrafiek
  const nu = new Date();
  const maanden12: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
    maanden12.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const maxMaand = Math.max(...maanden12.map((m) => verkopen_per_maand[m]?.count ?? 0), 1);
  const maxVerkocht = Math.max(...merk_stats.map((m) => m.verkocht), 1);
  const maxBrandstof = Math.max(...brandstof_stats.map((b) => b.verkocht), 1);
  const beste3 = [...merk_stats]
    .sort((a, b) => (b.verkocht * 2 + b.verkoopPercentage) - (a.verkocht * 2 + a.verkoopPercentage))
    .slice(0, 3);

  return (
    <div className="p-4 md:p-8">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Verkochte auto's",  value: String(kpis.totaal_verkocht),                                                            sub: "totaal ooit" },
          { label: "In voorraad",       value: String(kpis.actieve_voorraad),                                                            sub: `€ ${kpis.voorraad_waarde.toLocaleString("nl-NL")} waarde` },
          { label: "Gem. verkoopprijs", value: kpis.gem_verkoop_prijs > 0 ? `€ ${kpis.gem_verkoop_prijs.toLocaleString("nl-NL")}` : "—", sub: "verkochte auto's" },
          { label: "Gem. nettomarge",   value: kpis.gem_marge !== null ? `€ ${kpis.gem_marge.toLocaleString("nl-NL")}` : "—",           sub: `${kpis.totaal_dossiers} dossiers` },
        ].map(({ label, value, sub }) => (
          <div key={label} className="p-5" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <p className="text-2xl font-bold mb-0.5" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={S.label}>{label}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(0,19,55,0.3)", fontFamily: "var(--font-inter)" }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Rij 1: merk + maand */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Merk ranking */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
            <Award size={15} style={{ color: "#001337" }} />
            <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Merk prestaties</p>
          </div>
          <div className="p-5">
            {merk_stats.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Nog geen verkoopdata</p>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={S.label}>Top 3 beste merken</p>
                {beste3.map((m, i) => (
                  <div key={m.merk}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold w-5 text-center" style={{
                          color: i === 0 ? "#b45309" : i === 1 ? "#64748b" : "#94a3b8",
                          fontFamily: "var(--font-inter)",
                        }}>#{i + 1}</span>
                        <span className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>{m.merk}</span>
                        <span className="text-[10px]" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>{m.totaal} auto&apos;s</span>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5" style={{
                        backgroundColor: m.verkoopPercentage >= 70 ? "#dcfce7" : m.verkoopPercentage >= 40 ? "#fef3c7" : "#fee2e2",
                        color: m.verkoopPercentage >= 70 ? "#15803d" : m.verkoopPercentage >= 40 ? "#b45309" : "#b91c1c",
                        fontFamily: "var(--font-inter)",
                      }}>{m.verkoopPercentage}% verkocht</span>
                    </div>
                    <MiniBar value={m.verkocht} max={maxVerkocht} color={i === 0 ? "#001337" : i === 1 ? "#374151" : "#94a3b8"} />
                  </div>
                ))}

                {merk_stats.length > 3 && (
                  <div className="pt-3" style={{ borderTop: "1px solid rgba(0,19,55,0.07)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={S.label}>Alle merken</p>
                    {merk_stats.map((m) => (
                      <div key={m.merk} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid rgba(0,19,55,0.04)" }}>
                        <span className="text-xs" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>{m.merk}</span>
                        <div className="flex items-center gap-3 text-[10px]" style={{ fontFamily: "var(--font-inter)" }}>
                          <span style={{ color: "rgba(0,19,55,0.4)" }}>{m.verkocht}v · {m.beschikbaar}b</span>
                          <span className="font-semibold" style={{ color: m.verkoopPercentage >= 50 ? "#15803d" : "#b91c1c" }}>
                            {m.verkoopPercentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Maandgrafiek */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
            <TrendingUp size={15} style={{ color: "#001337" }} />
            <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Verkopen per maand</p>
            <span className="text-xs ml-auto" style={S.label}>laatste 12 maanden · hover voor aantal</span>
          </div>
          <div className="p-5">
            {maanden12.every((m) => !verkopen_per_maand[m]) ? (
              <div className="flex flex-col items-center justify-center h-32">
                <p className="text-sm" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Nog geen verkoopdata met datum</p>
                <p className="text-xs mt-1" style={{ color: "rgba(0,19,55,0.25)", fontFamily: "var(--font-inter)" }}>Zet auto&apos;s op &apos;Verkocht&apos; in de voorraad</p>
              </div>
            ) : (
              <div className="flex items-end gap-0.5 h-32 pt-5">
                {maanden12.map((m) => {
                  const count = verkopen_per_maand[m]?.count ?? 0;
                  const hoogte = count > 0 ? Math.max((count / maxMaand) * 100, 5) : 0;
                  const maandNr = parseInt(m.split("-")[1]);
                  const isHuidig = m === `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}`;
                  return (
                    <div key={m} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                      {count > 0 && (
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity px-1"
                          style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
                          {count}
                        </div>
                      )}
                      <div className="w-full flex items-end" style={{ height: 90 }}>
                        <div className="w-full" style={{
                          height: `${hoogte}%`,
                          backgroundColor: isHuidig ? "#001337" : "rgba(0,19,55,0.18)",
                          minHeight: count > 0 ? 2 : 0,
                        }} />
                      </div>
                      <p className="text-[8px]" style={{ color: "rgba(0,19,55,0.3)", fontFamily: "var(--font-inter)" }}>
                        {MAANDEN[maandNr - 1]}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rij 2: brandstof + segment + marge */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Brandstof */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
            <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Per brandstof</p>
            <p className="text-xs mt-0.5" style={S.label}>verkooppercentage</p>
          </div>
          <div className="p-5 flex flex-col gap-3">
            {brandstof_stats.length === 0 ? (
              <p className="text-xs text-center py-4" style={S.label}>Geen data</p>
            ) : brandstof_stats.map((b) => (
              <div key={b.brandstof}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>{b.brandstof}</span>
                  <span className="text-[10px] font-semibold" style={{
                    color: b.verkoopPercentage >= 60 ? "#15803d" : b.verkoopPercentage >= 30 ? "#b45309" : "#b91c1c",
                    fontFamily: "var(--font-inter)",
                  }}>{b.verkocht}× · {b.verkoopPercentage}%</span>
                </div>
                <MiniBar value={b.verkocht} max={maxBrandstof}
                  color={b.verkoopPercentage >= 60 ? "#15803d" : b.verkoopPercentage >= 30 ? "#b45309" : "#94a3b8"} />
              </div>
            ))}
          </div>
        </div>

        {/* Prijssegment */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
            <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Per prijssegment</p>
            <p className="text-xs mt-0.5" style={S.label}>welk segment verkoopt het best</p>
          </div>
          <div className="p-5 flex flex-col gap-3">
            {segment_stats.map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>{s.label}</span>
                  <div className="flex items-center gap-2 text-[10px]" style={{ fontFamily: "var(--font-inter)" }}>
                    <span style={S.label}>{s.totaal}×</span>
                    <span className="font-semibold" style={{
                      color: s.verkoopPercentage >= 60 ? "#15803d" : s.verkoopPercentage >= 30 ? "#b45309" : "rgba(0,19,55,0.35)",
                    }}>{s.verkoopPercentage}%</span>
                  </div>
                </div>
                <div className="h-1.5 rounded" style={{ backgroundColor: "rgba(0,19,55,0.07)" }}>
                  <div className="h-full rounded" style={{
                    width: `${s.verkoopPercentage}%`,
                    backgroundColor: s.verkoopPercentage >= 60 ? "#15803d" : s.verkoopPercentage >= 30 ? "#b45309" : "#94a3b8",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Marge dossiers */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
            <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Marge per dossier</p>
            {marge_dossiers.gem !== null && (
              <p className="text-xs mt-0.5" style={S.label}>
                Gem. nettomarge: <strong style={{ color: "#001337" }}>€ {marge_dossiers.gem.toLocaleString("nl-NL")}</strong>
              </p>
            )}
          </div>
          <div className="p-5">
            {marge_dossiers.top.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6">
                <p className="text-xs text-center" style={S.label}>Vul inkoop- en verkoopprijzen in</p>
                <p className="text-xs mt-1 text-center" style={{ color: "rgba(0,19,55,0.25)", fontFamily: "var(--font-inter)" }}>via de Calculator tab</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={S.label}>Beste marges</p>
                {marge_dossiers.top.map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid rgba(0,19,55,0.05)" }}>
                    <span className="text-xs truncate mr-2" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>{d.auto_naam}</span>
                    <span className="text-xs font-bold flex-shrink-0" style={{
                      color: d.netto_marge > 0 ? "#15803d" : "#b91c1c",
                      fontFamily: "var(--font-inter)",
                    }}>
                      {d.netto_marge > 0 ? "+" : ""}€ {Math.abs(d.netto_marge).toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
                {marge_dossiers.slecht.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-3 mb-1" style={S.label}>Laagste marges</p>
                    {marge_dossiers.slecht.map((d) => (
                      <div key={d.id} className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid rgba(0,19,55,0.05)" }}>
                        <span className="text-xs truncate mr-2" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>{d.auto_naam}</span>
                        <span className="text-xs font-bold flex-shrink-0" style={{
                          color: d.netto_marge > 0 ? "#b45309" : "#b91c1c",
                          fontFamily: "var(--font-inter)",
                        }}>
                          {d.netto_marge > 0 ? "+" : ""}€ {Math.abs(d.netto_marge).toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

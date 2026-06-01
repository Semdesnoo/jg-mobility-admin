"use client";

import { useState, useEffect } from "react";
import { BarChart2 } from "lucide-react";

type Stats = {
  omzetPerMaand: Record<string, number>;
  verkopenPerMaand: Record<string, number>;
  gemiddeldeMarge: number;
  topMerken: { merk: string; count: number }[];
  leadsPerStatus: Record<string, number>;
  totaalVerkocht: number;
  totaalFacturen: number;
  totaalOmzet: number;
};

const MAAND_NAMEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function BarChart({ data, formatter }: { data: Record<string, number>; formatter: (v: number) => string }) {
  const nu = new Date();
  const maanden: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
    maanden.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const waarden = maanden.map((m) => data[m] ?? 0);
  const max = Math.max(...waarden, 1);

  return (
    <div className="flex items-end gap-1 h-32">
      {maanden.map((m, i) => {
        const v = waarden[i];
        const hoogte = Math.max((v / max) * 100, v > 0 ? 4 : 0);
        const [jaar, maandNr] = m.split("-");
        const isHuidig = m === `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}`;
        return (
          <div key={m} className="flex-1 flex flex-col items-center gap-1 group relative">
            {v > 0 && (
              <div
                className="absolute bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"
                style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
              >
                {formatter(v)}
              </div>
            )}
            <div className="w-full flex items-end" style={{ height: 100 }}>
              <div
                className="w-full transition-all"
                style={{
                  height: `${hoogte}%`,
                  backgroundColor: isHuidig ? "#001337" : "rgba(0,19,55,0.15)",
                  minHeight: v > 0 ? 2 : 0,
                }}
              />
            </div>
            <p className="text-[9px]" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
              {MAAND_NAMEN[parseInt(maandNr) - 1]}
            </p>
            {i === 11 && <p className="text-[9px]" style={{ color: "rgba(0,19,55,0.25)", fontFamily: "var(--font-inter)" }}>{jaar}</p>}
          </div>
        );
      })}
    </div>
  );
}

export default function StatistiekenContent() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/statistieken")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setStats)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (v: number) => `€${v.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;

  return (
    <div>
      <div className="px-4 md:px-8 py-4 md:py-5 sticky top-0 z-10" style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}>
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Statistieken & Omzet</h2>
        <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Overzicht van je bedrijfsprestaties</p>
      </div>

      <div className="p-4 md:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm" style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>Fout bij laden: {error}</p>
          </div>
        ) : !stats ? null : (
          <div className="flex flex-col gap-6">
            {/* KPI kaarten */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Totaal omzet (facturen)", value: fmt(stats.totaalOmzet) },
                { label: "Betaalde facturen", value: stats.totaalFacturen },
                { label: "Verkochte auto's", value: stats.totaalVerkocht },
                { label: "Gem. nettomarge", value: stats.gemiddeldeMarge > 0 ? fmt(stats.gemiddeldeMarge) : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="p-6" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                  <p className="text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{value}</p>
                  <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Omzet grafiek */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                <BarChart2 size={15} style={{ color: "#001337" }} />
                <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Omzet per maand</h3>
                <span className="text-xs ml-auto" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>laatste 12 maanden · hover voor bedrag</span>
              </div>
              <div className="p-5">
                {Object.values(stats.omzetPerMaand).some(v => v > 0) ? (
                  <BarChart data={stats.omzetPerMaand} formatter={fmt} />
                ) : (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-sm" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Nog geen betaalde facturen</p>
                  </div>
                )}
              </div>
            </div>

            {/* Verkopen grafiek */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                <BarChart2 size={15} style={{ color: "#001337" }} />
                <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Verkopen per maand</h3>
              </div>
              <div className="p-5">
                {Object.values(stats.verkopenPerMaand).some(v => v > 0) ? (
                  <BarChart data={stats.verkopenPerMaand} formatter={(v) => `${v} auto${v !== 1 ? "'s" : ""}`} />
                ) : (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-sm" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Nog geen verkopen geregistreerd</p>
                  </div>
                )}
              </div>
            </div>

            {/* Twee kolommen: top merken + leads pipeline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top merken */}
              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                  <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Meest verkochte merken</h3>
                </div>
                <div className="p-5">
                  {stats.topMerken.length === 0 ? (
                    <p className="text-sm py-4 text-center" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Nog geen data</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {stats.topMerken.map(({ merk, count }, i) => {
                        const pct = Math.round((count / stats.totaalVerkocht) * 100);
                        return (
                          <div key={merk}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-semibold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                                {i + 1}. {merk}
                              </p>
                              <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>{count}× · {pct}%</p>
                            </div>
                            <div className="h-1.5 w-full" style={{ backgroundColor: "rgba(0,19,55,0.06)" }}>
                              <div className="h-full" style={{ width: `${pct}%`, backgroundColor: "#001337" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Leads pipeline */}
              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                  <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Leads pipeline</h3>
                </div>
                <div className="p-5">
                  {Object.keys(stats.leadsPerStatus).length === 0 ? (
                    <p className="text-sm py-4 text-center" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Nog geen leads</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {[
                        { key: "nieuw", label: "Nieuw", color: "#b45309", bg: "#fef3c7" },
                        { key: "contact_gehad", label: "Contact gehad", color: "#1d4ed8", bg: "#dbeafe" },
                        { key: "afspraak", label: "Afspraak", color: "#7c3aed", bg: "#ede9fe" },
                        { key: "deal", label: "Deal gesloten", color: "#15803d", bg: "#dcfce7" },
                        { key: "verloren", label: "Verloren", color: "#b91c1c", bg: "#fee2e2" },
                      ].map(({ key, label, color, bg }) => {
                        const count = stats.leadsPerStatus[key] ?? 0;
                        if (count === 0) return null;
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <span className="text-[10px] px-2 py-0.5 font-semibold flex-shrink-0" style={{ backgroundColor: bg, color, fontFamily: "var(--font-inter)", minWidth: 110, textAlign: "center" }}>{label}</span>
                            <div className="flex-1 h-1.5" style={{ backgroundColor: "rgba(0,19,55,0.06)" }}>
                              <div className="h-full" style={{ width: `${Math.round((count / Object.values(stats.leadsPerStatus).reduce((s, v) => s + v, 0)) * 100)}%`, backgroundColor: color }} />
                            </div>
                            <p className="text-sm font-bold flex-shrink-0" style={{ color: "#001337", fontFamily: "var(--font-inter)", minWidth: 24 }}>{count}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

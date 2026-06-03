"use client";

import { useState, useEffect } from "react";
import { BarChart2, Car, Package, TrendingUp, Clock, Tag, Banknote, CalendarClock } from "lucide-react";

type Stats = {
  totaalVerkocht: number;
  verkochtDitJaar: number;
  verkochtDezeMaand: number;
  inVoorraad: number;
  gereserveerd: number;
  voorraadwaarde: number;
  gemVraagprijs: number;
  totaalOmzet: number;
  omzetDitJaar: number;
  omzetDezeMaand: number;
  gemVerkoopprijs: number;
  betaaldeFacturen: number;
  omzetPerMaand: Record<string, number>;
  verkopenPerMaand: Record<string, number>;
  gemStandtijdVerkocht: number | null;
  gemStandtijdVoorraad: number | null;
  standtijdDataCount: number;
  langstInVoorraad: { merk: string; model: string; dagen: number }[];
  perMerk: { merk: string; voorraad: number; verkocht: number; gemStandtijd: number | null }[];
  leadsPerStatus: Record<string, number>;
  openAfspraken: number;
};

const MAAND_NAMEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

const fmtEur = (v: number) => `€${v.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;
const fmtDagen = (n: number | null) => (n == null ? "—" : `${n} ${n === 1 ? "dag" : "dagen"}`);

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

function KpiCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string; value: string | number; sub?: string }) {
  return (
    <div className="p-5" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color: "rgba(0,19,55,0.35)" }} />
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>{label}</p>
      </div>
      <p className="text-2xl md:text-3xl font-bold leading-none" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{value}</p>
      {sub && <p className="text-xs mt-1.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{sub}</p>}
    </div>
  );
}

function Kaart({ titel, rechts, children }: { titel: string; rechts?: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
      <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
        <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{titel}</h3>
        {rechts && <span className="text-xs ml-auto" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{rechts}</span>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

const LEEG = <p className="text-sm py-6 text-center" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Nog geen data</p>;

export default function StatistiekenContent() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/statistieken")
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `Fout ${r.status}`);
        return data;
      })
      .then(setStats)
      .catch((e) => setError(String(e instanceof Error ? e.message : e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="px-4 md:px-8 py-4 md:py-5 sticky top-0 z-10" style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}>
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Statistieken &amp; Omzet</h2>
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

            {/* ── KPI rij 1: voorraad & verkoop ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={Car} label="Verkocht totaal" value={stats.totaalVerkocht} sub={`${stats.verkochtDitJaar} dit jaar · ${stats.verkochtDezeMaand} deze maand`} />
              <KpiCard icon={Package} label="In voorraad" value={stats.inVoorraad} sub={stats.gereserveerd > 0 ? `+ ${stats.gereserveerd} gereserveerd` : "beschikbaar"} />
              <KpiCard icon={Tag} label="Voorraadwaarde" value={fmtEur(stats.voorraadwaarde)} sub={`gem. ${fmtEur(stats.gemVraagprijs)} per auto`} />
              <KpiCard icon={TrendingUp} label="Omzet totaal" value={fmtEur(stats.totaalOmzet)} sub={`${stats.betaaldeFacturen} betaalde facturen`} />
            </div>

            {/* ── KPI rij 2: omzet & standtijd ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={Banknote} label="Omzet dit jaar" value={fmtEur(stats.omzetDitJaar)} sub={`${fmtEur(stats.omzetDezeMaand)} deze maand`} />
              <KpiCard icon={Tag} label="Gem. verkoopprijs" value={stats.gemVerkoopprijs > 0 ? fmtEur(stats.gemVerkoopprijs) : "—"} sub="per verkochte auto" />
              <KpiCard icon={Clock} label="Gem. standtijd voorraad" value={fmtDagen(stats.gemStandtijdVoorraad)} sub="hoe lang de huidige auto's er staan" />
              <KpiCard icon={CalendarClock} label="Open afspraken" value={stats.openAfspraken} sub="gepland / nog te doen" />
            </div>

            {/* ── Grafieken ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Kaart titel="Verkopen per maand" rechts="laatste 12 maanden">
                {Object.values(stats.verkopenPerMaand).some((v) => v > 0)
                  ? <BarChart data={stats.verkopenPerMaand} formatter={(v) => `${v} auto${v !== 1 ? "'s" : ""}`} />
                  : <div className="flex items-center justify-center h-32"><p className="text-sm" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Nog geen verkopen geregistreerd</p></div>}
              </Kaart>
              <Kaart titel="Omzet per maand" rechts="hover voor bedrag">
                {Object.values(stats.omzetPerMaand).some((v) => v > 0)
                  ? <BarChart data={stats.omzetPerMaand} formatter={fmtEur} />
                  : <div className="flex items-center justify-center h-32"><p className="text-sm" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Nog geen betaalde facturen</p></div>}
              </Kaart>
            </div>

            {/* ── Standtijd ── */}
            <Kaart titel="Standtijd in de showroom" rechts={stats.gemStandtijdVerkocht != null ? `gem. verkochte auto: ${fmtDagen(stats.gemStandtijdVerkocht)}` : undefined}>
              {stats.langstInVoorraad.length === 0 ? (
                <p className="text-sm py-2" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                  Standtijd wordt bijgehouden vanaf registratie in dit systeem. Zodra auto&apos;s een tijdje in de voorraad staan (of verkocht worden) verschijnen hier de gemiddelden en de langst staande auto&apos;s.
                </p>
              ) : (
                <>
                  <p className="text-xs mb-3" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>Auto&apos;s die het langst in de showroom staan:</p>
                  <div className="flex flex-col gap-2">
                    {stats.langstInVoorraad.map((a, i) => {
                      const max = stats.langstInVoorraad[0].dagen || 1;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-sm font-semibold flex-shrink-0" style={{ color: "#001337", fontFamily: "var(--font-inter)", minWidth: 160 }}>
                            {a.merk} {a.model}
                          </span>
                          <div className="flex-1 h-1.5" style={{ backgroundColor: "rgba(0,19,55,0.06)" }}>
                            <div className="h-full" style={{ width: `${Math.round((a.dagen / max) * 100)}%`, backgroundColor: a.dagen >= 90 ? "#b45309" : "#001337" }} />
                          </div>
                          <span className="text-sm font-bold flex-shrink-0" style={{ color: a.dagen >= 90 ? "#b45309" : "#001337", fontFamily: "var(--font-inter)", minWidth: 70, textAlign: "right" }}>{fmtDagen(a.dagen)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </Kaart>

            {/* ── Per merk ── */}
            <Kaart titel="Per merk" rechts="voorraad · verkocht · gem. standtijd">
              {stats.perMerk.length === 0 ? LEEG : (
                <div style={{ overflowX: "auto" }}>
                  <table className="w-full" style={{ fontFamily: "var(--font-inter)", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1.5px solid rgba(0,19,55,0.12)" }}>
                        {["Merk", "In voorraad", "Verkocht", "Gem. standtijd"].map((h, i) => (
                          <th key={h} className="px-3 py-2.5" style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "rgba(0,19,55,0.45)", textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.perMerk.map((m, i) => (
                        <tr key={m.merk} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                          <td className="px-3 py-2.5 text-sm font-semibold" style={{ color: "#001337" }}>{m.merk}</td>
                          <td className="px-3 py-2.5 text-sm text-right" style={{ color: "#475569" }}>{m.voorraad}</td>
                          <td className="px-3 py-2.5 text-sm text-right" style={{ color: "#475569" }}>{m.verkocht}</td>
                          <td className="px-3 py-2.5 text-sm text-right font-semibold" style={{ color: "#001337" }}>{fmtDagen(m.gemStandtijd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Kaart>

            {/* ── Leads pipeline ── */}
            <Kaart titel="Leads pipeline">
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
                    const totaal = Object.values(stats.leadsPerStatus).reduce((s, v) => s + v, 0) || 1;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-[10px] px-2 py-0.5 font-semibold flex-shrink-0" style={{ backgroundColor: bg, color, fontFamily: "var(--font-inter)", minWidth: 110, textAlign: "center" }}>{label}</span>
                        <div className="flex-1 h-1.5" style={{ backgroundColor: "rgba(0,19,55,0.06)" }}>
                          <div className="h-full" style={{ width: `${Math.round((count / totaal) * 100)}%`, backgroundColor: color }} />
                        </div>
                        <p className="text-sm font-bold flex-shrink-0" style={{ color: "#001337", fontFamily: "var(--font-inter)", minWidth: 24 }}>{count}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Kaart>
          </div>
        )}
      </div>
    </div>
  );
}

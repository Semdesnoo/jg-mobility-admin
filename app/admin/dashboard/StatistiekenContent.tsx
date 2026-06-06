"use client";

import { useState, useEffect } from "react";
import { BarChart2, Car, Package, TrendingUp, Clock, Tag, Banknote, CalendarClock, Users } from "lucide-react";

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

type IconType = React.ComponentType<{ size?: number; style?: React.CSSProperties }>;

const MAAND_NAMEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
// Palet voor de merken-stippen
const MERK_KLEUREN = ["#2563eb", "#15803d", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#ea580c", "#0d9488"];

const fmtEur = (v: number) => `€${v.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;
const fmtDagen = (n: number | null) => (n == null ? "—" : `${n} ${n === 1 ? "dag" : "dagen"}`);
// Kleurschaal voor standtijd: vers (groen) → te lang (rood). Felle variant voor
// decoratieve balken/stippen; donkere variant voor het getal als tekst (leesbaar op wit).
const standtijdKleur = (d: number) => (d >= 90 ? "#dc2626" : d >= 60 ? "#ea580c" : d >= 30 ? "#ca8a04" : "#16a34a");
const standtijdTekstKleur = (d: number) => (d >= 90 ? "#b91c1c" : d >= 60 ? "#c2410c" : d >= 30 ? "#b45309" : "#15803d");

function BarChart({ data, formatter, color = "#001337" }: { data: Record<string, number>; formatter: (v: number) => string; color?: string }) {
  const nu = new Date();
  const maanden: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
    maanden.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const waarden = maanden.map((m) => data[m] ?? 0);
  const max = Math.max(...waarden, 1);
  const huidig = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="flex items-end gap-1.5 h-32">
      {maanden.map((m, i) => {
        const v = waarden[i];
        const hoogte = Math.max((v / max) * 100, v > 0 ? 4 : 0);
        const maandNr = m.split("-")[1];
        const isHuidig = m === huidig;
        return (
          <div key={m} className="flex-1 flex flex-col items-center gap-1 group relative">
            {v > 0 && (
              <div
                className="absolute bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"
                style={{ backgroundColor: color, color: "#ffffff", fontFamily: "var(--font-inter)", borderRadius: 4 }}
              >
                {formatter(v)}
              </div>
            )}
            <div className="w-full flex items-end" style={{ height: 100 }}>
              <div
                className="w-full transition-all"
                style={{
                  height: `${hoogte}%`,
                  background: v > 0 ? (isHuidig ? `linear-gradient(180deg, ${color}, ${color}cc)` : `${color}40`) : "transparent",
                  borderTopLeftRadius: 3,
                  borderTopRightRadius: 3,
                  minHeight: v > 0 ? 3 : 0,
                }}
              />
            </div>
            <p className="text-[9px]" style={{ color: isHuidig ? color : "rgba(0,19,55,0.35)", fontWeight: isHuidig ? 700 : 400, fontFamily: "var(--font-inter)" }}>
              {MAAND_NAMEN[parseInt(maandNr) - 1]}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, accent = "#001337" }: { icon: IconType; label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div
      className="relative p-5 overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accent }} />
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>{label}</p>
        <div className="flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, backgroundColor: `${accent}14`, borderRadius: 8 }}>
          <Icon size={15} style={{ color: accent }} />
        </div>
      </div>
      <p className="text-2xl md:text-[28px] font-bold leading-none" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{value}</p>
      {sub && <p className="text-xs mt-1.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{sub}</p>}
    </div>
  );
}

function Kaart({ titel, rechts, icon: Icon, accent = "#001337", children }: { titel: string; rechts?: string; icon?: IconType; accent?: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
      <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
        {Icon && (
          <div className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, backgroundColor: `${accent}14`, borderRadius: 7 }}>
            <Icon size={14} style={{ color: accent }} />
          </div>
        )}
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
              <KpiCard icon={Car} accent="#15803d" label="Verkocht totaal" value={stats.totaalVerkocht} sub={`${stats.verkochtDitJaar} dit jaar · ${stats.verkochtDezeMaand} deze maand`} />
              <KpiCard icon={Package} accent="#2563eb" label="In voorraad" value={stats.inVoorraad} sub={stats.gereserveerd > 0 ? `+ ${stats.gereserveerd} gereserveerd` : "beschikbaar"} />
              <KpiCard icon={Tag} accent="#d97706" label="Voorraadwaarde" value={fmtEur(stats.voorraadwaarde)} sub={`gem. ${fmtEur(stats.gemVraagprijs)} per auto`} />
              <KpiCard icon={TrendingUp} accent="#0d9488" label="Omzet totaal" value={fmtEur(stats.totaalOmzet)} sub={`${stats.betaaldeFacturen} betaalde facturen`} />
            </div>

            {/* ── KPI rij 2: omzet & operatie ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={Banknote} accent="#7c3aed" label="Omzet dit jaar" value={fmtEur(stats.omzetDitJaar)} sub={`${fmtEur(stats.omzetDezeMaand)} deze maand`} />
              <KpiCard icon={Tag} accent="#0891b2" label="Gem. verkoopprijs" value={stats.gemVerkoopprijs > 0 ? fmtEur(stats.gemVerkoopprijs) : "—"} sub="per verkochte auto" />
              <KpiCard icon={Clock} accent="#ea580c" label="Gem. standtijd voorraad" value={fmtDagen(stats.gemStandtijdVoorraad)} sub="hoe lang de huidige auto's er staan" />
              <KpiCard icon={CalendarClock} accent="#db2777" label="Open afspraken" value={stats.openAfspraken} sub="gepland / nog te doen" />
            </div>

            {/* ── Grafieken ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Kaart titel="Verkopen per maand" rechts="laatste 12 maanden" icon={BarChart2} accent="#15803d">
                {Object.values(stats.verkopenPerMaand).some((v) => v > 0)
                  ? <BarChart data={stats.verkopenPerMaand} color="#15803d" formatter={(v) => `${v} auto${v !== 1 ? "'s" : ""}`} />
                  : <div className="flex items-center justify-center h-32"><p className="text-sm" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Nog geen verkopen geregistreerd</p></div>}
              </Kaart>
              <Kaart titel="Omzet per maand" rechts="hover voor bedrag" icon={TrendingUp} accent="#0d9488">
                {Object.values(stats.omzetPerMaand).some((v) => v > 0)
                  ? <BarChart data={stats.omzetPerMaand} color="#0d9488" formatter={fmtEur} />
                  : <div className="flex items-center justify-center h-32"><p className="text-sm" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Nog geen betaalde facturen</p></div>}
              </Kaart>
            </div>

            {/* ── Standtijd ── */}
            <Kaart titel="Standtijd in de showroom" icon={Clock} accent="#ea580c" rechts={stats.gemStandtijdVerkocht != null ? `gem. verkochte auto: ${fmtDagen(stats.gemStandtijdVerkocht)}` : undefined}>
              {stats.langstInVoorraad.length === 0 ? (
                <p className="text-sm py-2" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                  Standtijd wordt bijgehouden vanaf registratie in dit systeem. Zodra auto&apos;s een tijdje in de voorraad staan (of verkocht worden) verschijnen hier de gemiddelden en de langst staande auto&apos;s.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-4 flex-wrap">
                    <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>Langst in de showroom:</p>
                    {[["< 30 dgn", "#16a34a"], ["30-90", "#ca8a04"], ["90+ dgn", "#dc2626"]].map(([t, c]) => (
                      <span key={t} className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>
                        <span style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: c, display: "inline-block" }} /> {t}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {stats.langstInVoorraad.map((a, i) => {
                      const max = stats.langstInVoorraad[0].dagen || 1;
                      const kleur = standtijdKleur(a.dagen);
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-sm font-semibold flex-shrink-0 truncate" style={{ color: "#001337", fontFamily: "var(--font-inter)", minWidth: 160, maxWidth: 200 }}>
                            {a.merk} {a.model}
                          </span>
                          <div className="flex-1 h-2 overflow-hidden" style={{ backgroundColor: "rgba(0,19,55,0.06)", borderRadius: 99 }}>
                            <div className="h-full" style={{ width: `${Math.max(Math.round((a.dagen / max) * 100), 6)}%`, backgroundColor: kleur, borderRadius: 99 }} />
                          </div>
                          <span className="text-sm font-bold flex-shrink-0" style={{ color: standtijdTekstKleur(a.dagen), fontFamily: "var(--font-inter)", minWidth: 70, textAlign: "right" }}>{fmtDagen(a.dagen)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </Kaart>

            {/* ── Per merk ── */}
            <Kaart titel="Per merk" icon={Car} accent="#2563eb" rechts="voorraad · verkocht · gem. standtijd">
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
                          <td className="px-3 py-2.5 text-sm font-semibold" style={{ color: "#001337" }}>
                            <span className="inline-flex items-center gap-2">
                              <span style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: MERK_KLEUREN[i % MERK_KLEUREN.length], display: "inline-block", flexShrink: 0 }} />
                              {m.merk}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-sm text-right font-semibold" style={{ color: "#2563eb" }}>{m.voorraad}</td>
                          <td className="px-3 py-2.5 text-sm text-right font-semibold" style={{ color: "#15803d" }}>{m.verkocht}</td>
                          <td className="px-3 py-2.5 text-sm text-right font-semibold" style={{ color: m.gemStandtijd != null ? standtijdTekstKleur(m.gemStandtijd) : "rgba(0,19,55,0.4)" }}>{fmtDagen(m.gemStandtijd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Kaart>

            {/* ── Leads pipeline ── */}
            <Kaart titel="Leads pipeline" icon={Users} accent="#7c3aed">
              {Object.keys(stats.leadsPerStatus).length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Nog geen leads</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {[
                    { key: "nieuw", label: "Nieuw", color: "#d97706", bg: "#fef3c7" },
                    { key: "contact_gehad", label: "Contact gehad", color: "#2563eb", bg: "#dbeafe" },
                    { key: "afspraak", label: "Afspraak", color: "#7c3aed", bg: "#ede9fe" },
                    { key: "deal", label: "Deal gesloten", color: "#15803d", bg: "#dcfce7" },
                    { key: "verloren", label: "Verloren", color: "#dc2626", bg: "#fee2e2" },
                  ].map(({ key, label, color, bg }) => {
                    const count = stats.leadsPerStatus[key] ?? 0;
                    if (count === 0) return null;
                    const totaal = Object.values(stats.leadsPerStatus).reduce((s, v) => s + v, 0) || 1;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-[10px] px-2 py-0.5 font-semibold flex-shrink-0" style={{ backgroundColor: bg, color, fontFamily: "var(--font-inter)", minWidth: 110, textAlign: "center", borderRadius: 5 }}>{label}</span>
                        <div className="flex-1 h-2 overflow-hidden" style={{ backgroundColor: "rgba(0,19,55,0.06)", borderRadius: 99 }}>
                          <div className="h-full" style={{ width: `${Math.round((count / totaal) * 100)}%`, backgroundColor: color, borderRadius: 99 }} />
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

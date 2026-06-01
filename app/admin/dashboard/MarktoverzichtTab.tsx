"use client";

import { useState } from "react";
import { Globe, Flame, TrendingUp, TrendingDown, AlertCircle, RefreshCw, Search, Minus } from "lucide-react";

type HotModel = {
  rang: number; merk: string; model: string; segment: string;
  gem_prijs: number; aanbod_score: number; vraag_score: number;
  trend: string; advies: string;
};

type TeVermijden = { merk: string; model: string; reden: string };
type TrendSegment = { naam: string; trend: string; score: number; reden: string };

type MarktData = {
  samenvatting: string;
  markt_temperatuur: number;
  hot_modellen: HotModel[];
  te_vermijden: TeVermijden[];
  trending_segmenten: TrendSegment[];
  inzichten: string[];
  gegenereerd_op: string;
  type: string;
  zoekterm?: string;
};

const S = {
  label: { color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" } as React.CSSProperties,
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "stijgend") return <TrendingUp size={12} style={{ color: "#15803d" }} />;
  if (trend === "dalend")   return <TrendingDown size={12} style={{ color: "#b91c1c" }} />;
  return <Minus size={12} style={{ color: "#1d4ed8" }} />;
}

function TrendBadge({ trend }: { trend: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    stijgend: { color: "#15803d", bg: "#dcfce7" },
    stabiel:  { color: "#1d4ed8", bg: "#dbeafe" },
    dalend:   { color: "#b91c1c", bg: "#fee2e2" },
  };
  const t = map[trend] ?? map.stabiel;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: t.bg, color: t.color, fontFamily: "var(--font-inter)" }}>
      <TrendIcon trend={trend} /> {trend}
    </span>
  );
}

function Thermometer({ score }: { score: number }) {
  const color = score >= 7 ? "#15803d" : score >= 5 ? "#b45309" : "#b91c1c";
  const label = score >= 8 ? "Hete markt" : score >= 6 ? "Warme markt" : score >= 4 ? "Neutrale markt" : "Koude markt";
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-32 h-2.5 rounded-full" style={{ backgroundColor: "rgba(0,19,55,0.1)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score * 10}%`, backgroundColor: color }} />
      </div>
      <div>
        <span className="text-2xl font-bold" style={{ color, fontFamily: "var(--font-playfair)" }}>{score}</span>
        <span className="text-xs ml-1.5" style={{ color, fontFamily: "var(--font-inter)" }}>/10 · {label}</span>
      </div>
    </div>
  );
}

export default function MarktoverzichtTab() {
  const [data, setData]     = useState<MarktData | null>(null);
  const [laden, setLaden]   = useState(false);
  const [fout, setFout]     = useState<string | null>(null);
  const [zoekterm, setZoekterm] = useState("");

  const analyseer = async (type: "puls" | "zoek") => {
    if (type === "zoek" && !zoekterm.trim()) return;
    setLaden(true); setFout(null);
    const res = await fetch("/api/admin/inkoop/markt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, zoekterm: zoekterm.trim() }),
    });
    if (res.ok) setData(await res.json());
    else { const d = await res.json().catch(() => ({})); setFout(d.error ?? "Analyse mislukt"); }
    setLaden(false);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl">

        {/* Actieknoppen */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Marktpuls */}
          <div style={{ backgroundColor: "#001337", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Globe size={18} style={{ color: "rgba(255,255,255,0.7)" }} />
                <p className="text-base font-bold text-white" style={{ fontFamily: "var(--font-playfair)" }}>Marktpuls</p>
              </div>
              <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
                Claude zoekt live op Marktplaats & AutoScout24: welke auto&apos;s zijn nu hot, welke zijn te vermijden, en waar liggen de inkoopkansen?
              </p>
              <button type="button" onClick={() => analyseer("puls")} disabled={laden}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#ffffff", fontFamily: "var(--font-inter)", border: "1px solid rgba(255,255,255,0.15)" }}>
                {laden ? (
                  <><div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#ffffff" }} /> Analyseren (~25 sec)</>
                ) : (
                  <><Flame size={15} /> Analyseer markt nu</>
                )}
              </button>
            </div>
          </div>

          {/* Specifieke zoekopdracht */}
          <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Search size={16} style={{ color: "#001337" }} />
                <p className="text-base font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Specifieke analyse</p>
              </div>
              <p className="text-xs mb-3" style={S.label}>
                Analyseer een specifiek merk, model of segment
              </p>
              <input type="text" value={zoekterm}
                onChange={(e) => setZoekterm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && analyseer("zoek")}
                placeholder="bijv. Toyota SUV onder €20.000, of BMW benzine 2018-2020"
                className="w-full px-3 py-2 text-sm mb-3 outline-none"
                style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", backgroundColor: "#fafafa" }}
              />
              <button type="button" onClick={() => analyseer("zoek")} disabled={laden || !zoekterm.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
                <Search size={14} /> Analyseer
              </button>
            </div>
          </div>
        </div>

        {/* Fout */}
        {fout && (
          <div className="mb-5 flex items-start gap-3 px-4 py-3"
            style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca" }}>
            <AlertCircle size={16} style={{ color: "#b91c1c", flexShrink: 0, marginTop: 1 }} />
            <p className="text-sm" style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>{fout}</p>
          </div>
        )}

        {/* Lege state */}
        {!laden && !data && !fout && (
          <div className="flex flex-col items-center justify-center py-20"
            style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <Globe size={40} style={{ color: "rgba(0,19,55,0.1)" }} />
            <p className="text-lg font-bold mt-5 mb-2" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
              Live marktanalyse
            </p>
            <p className="text-sm text-center max-w-sm" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)", lineHeight: 1.7 }}>
              Klik op &quot;Analyseer markt nu&quot; voor een real-time overzicht van de Nederlandse tweedehands automarkt. Claude zoekt live op Marktplaats, AutoScout24 en AutoWeek.
            </p>
          </div>
        )}

        {/* Resultaten */}
        {data && (
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-lg font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                    {data.type === "zoek" ? `Analyse: ${data.zoekterm}` : "Marktpuls Nederland"}
                  </p>
                  <Thermometer score={data.markt_temperatuur} />
                </div>
                <p className="text-sm max-w-2xl" style={{ color: "rgba(0,19,55,0.65)", fontFamily: "var(--font-inter)", lineHeight: 1.7 }}>
                  {data.samenvatting}
                </p>
                <p className="text-[10px] mt-1.5" style={S.label}>
                  Gegenereerd op {new Date(data.gegenereerd_op).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              <button type="button" onClick={() => analyseer(data.type === "zoek" ? "zoek" : "puls")} disabled={laden}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all hover:opacity-70 disabled:opacity-40 flex-shrink-0"
                style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}>
                <RefreshCw size={11} className={laden ? "animate-spin" : ""} /> Ververs
              </button>
            </div>

            {/* Hot modellen */}
            {data.hot_modellen?.length > 0 && (
              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                  <Flame size={15} style={{ color: "#b45309" }} />
                  <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Hot inkoopkansen</p>
                  <span className="text-xs px-2 py-0.5 ml-1" style={{ backgroundColor: "#fef3c7", color: "#b45309", fontFamily: "var(--font-inter)" }}>
                    {data.hot_modellen.length} modellen
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: "rgba(0,19,55,0.05)" }}>
                  {data.hot_modellen.map((m) => {
                    const opportuniteit = Math.round((m.vraag_score - m.aanbod_score + 10) / 2);
                    const oppColor = opportuniteit >= 7 ? "#15803d" : opportuniteit >= 5 ? "#b45309" : "#b91c1c";
                    return (
                      <div key={`${m.merk}-${m.model}`} className="px-5 py-4 flex items-start gap-4">
                        {/* Rang */}
                        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 text-sm font-bold"
                          style={{
                            backgroundColor: m.rang <= 3 ? "#001337" : "rgba(0,19,55,0.07)",
                            color: m.rang <= 3 ? "#ffffff" : "#001337",
                            fontFamily: "var(--font-playfair)",
                          }}>
                          {m.rang}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                              {m.merk} {m.model}
                            </p>
                            <span className="text-[10px] px-1.5 py-0.5" style={{ backgroundColor: "rgba(0,19,55,0.06)", color: "#001337", fontFamily: "var(--font-inter)" }}>
                              {m.segment}
                            </span>
                            <TrendBadge trend={m.trend} />
                          </div>
                          <p className="text-xs" style={{ color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)" }}>
                            {m.advies}
                          </p>
                        </div>

                        {/* Scores */}
                        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                          <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                            € {m.gem_prijs.toLocaleString("nl-NL")}
                          </p>
                          <div className="flex items-center gap-2 text-[10px]" style={{ fontFamily: "var(--font-inter)" }}>
                            <span title="Aanbod (laag = beter)" style={{ color: "rgba(0,19,55,0.4)" }}>
                              Aanbod {m.aanbod_score}/10
                            </span>
                            <span style={{ color: "rgba(0,19,55,0.2)" }}>·</span>
                            <span title="Vraag (hoog = beter)" style={{ color: "rgba(0,19,55,0.4)" }}>
                              Vraag {m.vraag_score}/10
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5" style={{ backgroundColor: `${oppColor}18`, color: oppColor, fontFamily: "var(--font-inter)" }}>
                            Kans {opportuniteit}/10
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Twee kolommen: te vermijden + trending segmenten */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Te vermijden */}
              {data.te_vermijden?.length > 0 && (
                <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                  <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                    <TrendingDown size={15} style={{ color: "#b91c1c" }} />
                    <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Te vermijden</p>
                    <span className="text-xs px-2 py-0.5 ml-1" style={{ backgroundColor: "#fee2e2", color: "#b91c1c", fontFamily: "var(--font-inter)" }}>
                      {data.te_vermijden.length}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    {data.te_vermijden.map((t, i) => (
                      <div key={i} className="px-5 py-3.5 flex items-start gap-3"
                        style={{ borderBottom: "1px solid rgba(0,19,55,0.05)" }}>
                        <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5" style={{ backgroundColor: "#b91c1c" }} />
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                            {t.merk} {t.model}
                          </p>
                          <p className="text-xs" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>{t.reden}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending segmenten */}
              {data.trending_segmenten?.length > 0 && (
                <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                  <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                    <TrendingUp size={15} style={{ color: "#15803d" }} />
                    <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Trending segmenten</p>
                  </div>
                  <div className="p-5 flex flex-col gap-3">
                    {data.trending_segmenten.map((s, i) => {
                      const scoreColor = s.score >= 7 ? "#15803d" : s.score >= 5 ? "#b45309" : "#b91c1c";
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>{s.naam}</span>
                              <TrendBadge trend={s.trend} />
                            </div>
                            <span className="text-sm font-bold" style={{ color: scoreColor, fontFamily: "var(--font-playfair)" }}>{s.score}/10</span>
                          </div>
                          <div className="h-1.5 rounded mb-1" style={{ backgroundColor: "rgba(0,19,55,0.07)" }}>
                            <div className="h-full rounded" style={{ width: `${s.score * 10}%`, backgroundColor: scoreColor }} />
                          </div>
                          {s.reden && (
                            <p className="text-[10px]" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{s.reden}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Marktinzichten */}
            {data.inzichten?.length > 0 && (
              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                  <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Marktinzichten</p>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.inzichten.map((inzicht, i) => (
                    <div key={i} className="flex items-start gap-3 p-3"
                      style={{ backgroundColor: "rgba(0,19,55,0.02)", border: "1px solid rgba(0,19,55,0.06)" }}>
                      <span className="flex-shrink-0 text-[10px] font-bold mt-0.5 w-5 h-5 flex items-center justify-center"
                        style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
                        {i + 1}
                      </span>
                      <p className="text-xs leading-relaxed" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>{inzicht}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

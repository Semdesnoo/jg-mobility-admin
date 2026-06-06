"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, TrendingDown, ChevronDown, ChevronUp, Trash2, Search, BarChart2, AlertCircle, Award, Globe } from "lucide-react";
import PrestatiesTab from "./PrestatiesTab";
import MarktoverzichtTab from "./MarktoverzichtTab";

// ── Types ─────────────────────────────────────────────────────────
type RdwData = {
  merk: string; model: string; bouwjaar: number; kleur: string;
  brandstof: string; bodytype: string; apk: string; vermogen: string;
  catalogusprijs?: number;
};

type Vergelijkbaar = { titel: string; bouwjaar?: number; km?: number; prijs: number; platform?: string };

type MarktData = {
  gemiddelde_prijs: number; min_prijs: number; max_prijs: number;
  aantal_aanbod: number; prijs_trend: string;
  marktplaats_gemiddeld?: number; autoscout_gemiddeld?: number;
  vraag_score: number; advies: string;
  betrouwbaarheid?: "hoog" | "midden" | "laag";
  aantal_gevonden?: number;
  vergelijkbare?: Vergelijkbaar[];
};

type Berekening = {
  max_inkoop: number; verwachte_verkoop: number;
  geschatte_marge: number; marge_percentage: number;
  geschatte_kosten: number; gewenste_marge: number;
  aantrekkelijkheid: number;
  catalogusprijs?: number; koerslijst_waarde?: number; markt_waarde?: number;
  bron?: string;
};

type InkoopDossier = {
  id: string; datum: string; merk: string; model: string; bouwjaar: string;
  km: string; kenteken: string; kleur: string; vin: string;
  aanbod_prijs: number; bod_prijs: number; aankoopprijs: number;
  naam: string; telefoon: string; email: string; status: string; notitie: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  nieuw:             { label: "Nieuw",             color: "#b45309", bg: "#fef3c7" },
  in_onderhandeling: { label: "In onderhandeling", color: "#1d4ed8", bg: "#dbeafe" },
  akkoord:           { label: "Akkoord",           color: "#15803d", bg: "#dcfce7" },
  afgewezen:         { label: "Afgewezen",         color: "#b91c1c", bg: "#fee2e2" },
};

const S = {
  label: { color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" } as React.CSSProperties,
  veld:  { border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", backgroundColor: "#fafafa", outline: "none" } as React.CSSProperties,
};

const fmt = (n: number) => `€ ${n.toLocaleString("nl-NL")}`;

// ── Score ring ────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const color = score >= 7 ? "#15803d" : score >= 5 ? "#b45309" : "#b91c1c";
  const label = score >= 7 ? "Aantrekkelijk" : score >= 5 ? "Gemiddeld" : "Risicovol";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold"
        style={{ border: `3px solid ${color}`, color, fontFamily: "var(--font-playfair)" }}>
        {score}
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color, fontFamily: "var(--font-inter)" }}>{label}</p>
    </div>
  );
}

// ── Trend badge ───────────────────────────────────────────────────
function TrendBadge({ trend }: { trend: string }) {
  const map: Record<string, { icon: string; color: string; bg: string }> = {
    stijgend: { icon: "↑", color: "#15803d", bg: "#dcfce7" },
    stabiel:  { icon: "→", color: "#1d4ed8", bg: "#dbeafe" },
    dalend:   { icon: "↓", color: "#b91c1c", bg: "#fee2e2" },
  };
  const t = map[trend] ?? map.stabiel;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: t.bg, color: t.color, fontFamily: "var(--font-inter)" }}>
      {t.icon} {trend}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function InkoopContent() {
  const [tab, setTab] = useState<"taxatie" | "markt" | "prestaties" | "dossiers">("taxatie");

  return (
    <div>
      <div className="px-4 md:px-8 py-4 md:py-5 sticky top-0 z-10"
        style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}>
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
          Inkoop & Taxatie
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
          Taxatietool · Live Marktoverzicht · Eigen Prestaties · Dossiers
        </p>
      </div>

      <div className="flex px-4 md:px-8" style={{ borderBottom: "1px solid rgba(0,19,55,0.08)", backgroundColor: "#ffffff" }}>
        {([
          { id: "taxatie" as const,    label: "Taxatietool",     Icon: Search },
          { id: "markt" as const,      label: "Marktoverzicht",  Icon: Globe },
          { id: "prestaties" as const, label: "Prestaties",      Icon: Award },
          { id: "dossiers" as const,   label: "Dossiers",        Icon: TrendingDown },
        ]).map(({ id, label, Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className="flex items-center gap-2 px-4 py-3.5 text-sm font-semibold transition-all"
            style={{
              color: tab === id ? "#001337" : "rgba(0,19,55,0.38)",
              fontFamily: "var(--font-inter)",
              borderBottom: tab === id ? "2px solid #001337" : "2px solid transparent",
              marginBottom: "-1px",
            }}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {tab === "taxatie"    && <TaxatieTab />}
      {tab === "markt"      && <MarktoverzichtTab />}
      {tab === "prestaties" && <PrestatiesTab />}
      {tab === "dossiers"   && <DossiersTab />}
    </div>
  );
}

// ── Taxatietool ───────────────────────────────────────────────────
function TaxatieTab() {
  const [kenteken, setKenteken]           = useState("");
  const [rdw, setRdw]                     = useState<RdwData | null>(null);
  const [rdwLaden, setRdwLaden]           = useState(false);
  const [rdwFout, setRdwFout]             = useState<string | null>(null);
  const [km, setKm]                       = useState("");
  const [gewensteMarge, setGewensteMarge] = useState(10);
  const [geschatteKosten, setGeschatteKosten] = useState(0);
  const [laden, setLaden]                 = useState(false);
  const [resultaat, setResultaat]         = useState<{ markt: MarktData; berekening: Berekening } | null>(null);
  const [fout, setFout]                   = useState<string | null>(null);
  const [opgeslagen, setOpgeslagen]       = useState(false);

  const rdwOpzoeken = async (raw: string) => {
    const k = raw.trim();
    if (!k) return;
    setRdwLaden(true); setRdwFout(null); setRdw(null); setResultaat(null);
    const res = await fetch(`/api/admin/rdw-lookup?kenteken=${encodeURIComponent(k)}`);
    if (res.ok) {
      const d = await res.json();
      if (d.merk) setRdw(d);
      else setRdwFout("Kenteken niet gevonden in RDW");
    } else {
      setRdwFout("RDW opzoeking mislukt");
    }
    setRdwLaden(false);
  };

  const analyseer = async () => {
    if (!rdw) return;
    setLaden(true); setFout(null); setResultaat(null);
    const res = await fetch("/api/admin/inkoop/taxeer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merk: rdw.merk, model: rdw.model, bouwjaar: rdw.bouwjaar,
        km, brandstof: rdw.brandstof, vermogen: rdw.vermogen, bodytype: rdw.bodytype,
        catalogusprijs: rdw.catalogusprijs,
        gewenste_marge: gewensteMarge,
        geschatte_kosten: geschatteKosten,
      }),
    });
    if (res.ok) setResultaat(await res.json());
    else { const d = await res.json().catch(() => ({})); setFout(d.error ?? "Analyse mislukt"); }
    setLaden(false);
  };

  const slaOp = async () => {
    if (!rdw || !resultaat) return;
    await fetch("/api/admin/inkoop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kenteken, merk: rdw.merk, model: rdw.model, bouwjaar: String(rdw.bouwjaar),
        km, kleur: rdw.kleur, brandstof: rdw.brandstof,
        aanbod_prijs: resultaat.markt.gemiddelde_prijs,
        bod_prijs: resultaat.berekening.max_inkoop,
        status: "nieuw",
        notitie: `Markt: gem. ${fmt(resultaat.markt.gemiddelde_prijs)}, aanbod ${resultaat.markt.aantal_aanbod} stuks. Max inkoop: ${fmt(resultaat.berekening.max_inkoop)}`,
      }),
    });
    setOpgeslagen(true);
    setTimeout(() => setOpgeslagen(false), 3000);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl">

        {/* Invoer */}
        <div className="mb-6" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
          <div className="px-5 py-3 flex items-center gap-2"
            style={{ borderBottom: "1px solid rgba(0,19,55,0.07)", backgroundColor: "rgba(0,19,55,0.02)" }}>
            <span className="flex items-center justify-center w-5 h-5 text-[10px] font-bold"
              style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>1</span>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={S.label}>Voertuig & instellingen</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Kenteken */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Kenteken</label>
                <div className="flex gap-2 items-center">
                  <input type="text" value={kenteken} placeholder="bijv. AB-123-C"
                    onChange={(e) => setKenteken(e.target.value.toUpperCase())}
                    onBlur={(e) => rdwOpzoeken(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && rdwOpzoeken(kenteken)}
                    className="flex-1 px-3 py-2 text-sm" style={S.veld} />
                  {rdwLaden && <div className="w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0"
                    style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />}
                </div>
                {rdwFout && <p className="text-xs mt-1" style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>{rdwFout}</p>}
              </div>

              {/* Km */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>
                  Kilometerstand <span style={{ color: "#b45309" }}>★ zelf invullen</span>
                </label>
                <input type="text" value={km} placeholder="bijv. 85000"
                  onChange={(e) => setKm(e.target.value)}
                  className="w-full px-3 py-2 text-sm" style={S.veld} />
              </div>

              {/* Marge & kosten */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Marge %</label>
                  <input type="number" value={gewensteMarge} min={5} max={40}
                    onChange={(e) => setGewensteMarge(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm" style={S.veld} />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Kosten €</label>
                  <input type="number" value={geschatteKosten} step={100}
                    onChange={(e) => setGeschatteKosten(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm" style={S.veld} />
                </div>
              </div>
            </div>

            {/* RDW data */}
            {rdw && (
              <div className="mt-4 p-3 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5"
                style={{ backgroundColor: "#f0fdf4", border: "1px solid rgba(21,128,61,0.25)" }}>
                <div className="col-span-2 sm:col-span-4 flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold" style={{ color: "#15803d", fontFamily: "var(--font-inter)" }}>✓ RDW DATA OPGEHAALD</span>
                </div>
                {([
                  ["Merk",        rdw.merk],
                  ["Model",       rdw.model],
                  ["Bouwjaar",    String(rdw.bouwjaar)],
                  ["Kleur",       rdw.kleur],
                  ["Brandstof",   rdw.brandstof],
                  ["Carrosserie", rdw.bodytype],
                  ["Vermogen",    rdw.vermogen],
                  ["APK",         rdw.apk],
                ] as [string, string][]).filter(([, v]) => v).map(([l, v]) => (
                  <div key={l} className="flex items-baseline gap-1.5">
                    <span className="text-[9px] flex-shrink-0" style={{ color: "rgba(21,128,61,0.65)", fontFamily: "var(--font-inter)", minWidth: 60 }}>{l}</span>
                    <span className="text-xs font-semibold truncate" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Analyseer knop */}
        <div className="mb-6 flex items-center gap-4 flex-wrap">
          <button type="button" onClick={analyseer} disabled={!rdw || laden}
            className="flex items-center gap-3 px-8 py-3.5 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
            {laden ? (
              <><div className="w-4 h-4 rounded-full border-2 animate-spin"
                style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#ffffff" }} />
                Markt analyseren...</>
            ) : (
              <><BarChart2 size={16} /> Analyseer markt</>
            )}
          </button>
          {laden && (
            <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
              Claude zoekt live op Marktplaats, AutoScout24, Gaspedaal & meer... (~20-45 sec)
            </p>
          )}
          {resultaat && (
            <button type="button" onClick={() => { setResultaat(null); setRdw(null); setKenteken(""); setKm(""); }}
              className="text-xs px-3 py-2" style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}>
              Nieuwe taxatie
            </button>
          )}
        </div>

        {/* Fout */}
        {fout && (
          <div className="mb-5 flex items-start gap-3 px-4 py-3"
            style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca" }}>
            <AlertCircle size={16} style={{ color: "#b91c1c", flexShrink: 0, marginTop: 1 }} />
            <p className="text-sm" style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>{fout}</p>
          </div>
        )}

        {/* Resultaten */}
        {resultaat && (
          <div className="flex flex-col gap-5">

            {/* Aanbeveling */}
            <div style={{ backgroundColor: "#001337" }}>
              <div className="px-5 py-3 flex items-center justify-between"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-inter)" }}>
                    Prijsadvies — {rdw?.merk} {rdw?.model} {rdw?.bouwjaar}
                  </p>
                  {resultaat.markt.betrouwbaarheid && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 self-start" style={{
                      backgroundColor: resultaat.markt.betrouwbaarheid === "hoog" ? "rgba(74,222,128,0.15)" : resultaat.markt.betrouwbaarheid === "midden" ? "rgba(251,191,36,0.15)" : "rgba(248,113,113,0.15)",
                      color: resultaat.markt.betrouwbaarheid === "hoog" ? "#4ade80" : resultaat.markt.betrouwbaarheid === "midden" ? "#fbbf24" : "#f87171",
                      fontFamily: "var(--font-inter)", borderRadius: 4,
                    }}>
                      ● Betrouwbaarheid: {resultaat.markt.betrouwbaarheid}{resultaat.markt.aantal_gevonden ? ` · ${resultaat.markt.aantal_gevonden} advertenties` : ""}
                    </span>
                  )}
                </div>
                <ScoreRing score={resultaat.berekening.aantrekkelijkheid} />
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Max inkoopprijs",       value: fmt(resultaat.berekening.max_inkoop),       sub: `bij ${resultaat.berekening.gewenste_marge}% gewenste marge`, highlight: false },
                  { label: "Verwachte verkoopprijs", value: fmt(resultaat.berekening.verwachte_verkoop), sub: "iets onder marktgemiddelde",                                 highlight: false },
                  { label: "Geschatte marge",
                    value: `${resultaat.berekening.geschatte_marge > 0 ? "+" : ""}${fmt(resultaat.berekening.geschatte_marge)}`,
                    sub: `${resultaat.berekening.marge_percentage}% · na ${fmt(resultaat.berekening.geschatte_kosten)} kosten`,
                    highlight: true },
                ].map(({ label, value, sub, highlight }) => (
                  <div key={label} className="p-4 text-center"
                    style={{ backgroundColor: highlight ? "rgba(21,128,61,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${highlight ? "rgba(21,128,61,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                    <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-inter)" }}>{label}</p>
                    <p className="text-2xl font-bold" style={{ color: highlight ? (resultaat.berekening.geschatte_marge > 0 ? "#4ade80" : "#f87171") : "#ffffff", fontFamily: "var(--font-playfair)" }}>
                      {value}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-inter)" }}>{sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Koerslijst-opbouw — hoe de waarde is bepaald (nieuwprijs → afschrijving → live markt) */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
              <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Koerslijst-opbouw</p>
                {resultaat.berekening.bron && (
                  <span className="text-[10px] font-semibold px-2 py-0.5" style={{ backgroundColor: "rgba(0,19,55,0.05)", color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)", borderRadius: 4 }}>
                    bron: {resultaat.berekening.bron}
                  </span>
                )}
              </div>
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Nieuwprijs (RDW)",     value: resultaat.berekening.catalogusprijs ? fmt(resultaat.berekening.catalogusprijs) : "—", sub: "catalogusprijs",        accent: "#64748b" },
                  { label: "Koerslijst-waarde",    value: resultaat.berekening.koerslijst_waarde ? fmt(resultaat.berekening.koerslijst_waarde) : "—", sub: "na afschrijving + km", accent: "#7c3aed" },
                  { label: "Live marktwaarde",     value: resultaat.berekening.markt_waarde ? fmt(resultaat.berekening.markt_waarde) : "—",      sub: "uit advertenties",     accent: "#0d9488" },
                  { label: "Geadviseerde verkoop", value: fmt(resultaat.berekening.verwachte_verkoop),                                          sub: "blend van beide",      accent: "#15803d" },
                ].map((s) => (
                  <div key={s.label} className="relative p-3 overflow-hidden" style={{ backgroundColor: "rgba(0,19,55,0.02)", border: "1px solid rgba(0,19,55,0.06)" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: s.accent }} />
                    <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{s.label}</p>
                    <p className="text-lg font-bold leading-none" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{s.value}</p>
                    <p className="text-[9px] mt-1" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>{s.sub}</p>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(0,19,55,0.07)", backgroundColor: "rgba(0,19,55,0.02)" }}>
                <p className="text-[11px] leading-relaxed" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                  De koerslijst-waarde komt uit de RDW-nieuwprijs met een afschrijvings- en kilometercorrectie; de live marktwaarde uit de gevonden advertenties. De geadviseerde verkoopprijs is een gewogen combinatie — bij weinig advertenties weegt de koerslijst zwaarder.
                </p>
              </div>
            </div>

            {/* Marktdata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Prijsoverzicht */}
              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                  <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Marktprijzen</p>
                  <TrendBadge trend={resultaat.markt.prijs_trend} />
                </div>
                <div className="p-5">
                  <div className="mb-4">
                    <p className="text-2xl font-bold mb-0.5" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                      {fmt(resultaat.markt.gemiddelde_prijs)}
                    </p>
                    <p className="text-xs" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>gemiddelde vraagprijs</p>
                  </div>

                  {/* Prijsbalk */}
                  <div className="mb-4 pt-5">
                    <div className="flex justify-between text-[10px] mb-1" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                      <span>Min {fmt(resultaat.markt.min_prijs)}</span>
                      <span>Max {fmt(resultaat.markt.max_prijs)}</span>
                    </div>
                    <div className="h-2 rounded relative" style={{ backgroundColor: "rgba(0,19,55,0.08)" }}>
                      {(() => {
                        const range = resultaat.markt.max_prijs - resultaat.markt.min_prijs || 1;
                        const gemPct = ((resultaat.markt.gemiddelde_prijs - resultaat.markt.min_prijs) / range) * 100;
                        const inkPct = Math.min(100, Math.max(0, ((resultaat.berekening.max_inkoop - resultaat.markt.min_prijs) / range) * 100));
                        return (
                          <>
                            <div className="h-full rounded" style={{ width: `${gemPct}%`, backgroundColor: "rgba(0,19,55,0.2)" }} />
                            <div className="absolute top-0 h-full w-0.5" style={{ left: `${inkPct}%`, backgroundColor: "#001337" }}>
                              <div className="absolute -top-5 -translate-x-1/2 text-[8px] whitespace-nowrap font-semibold"
                                style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>▲ max inkoop</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Per platform */}
                  <div className="flex flex-col gap-2">
                    {([
                      ["Marktplaats.nl",  resultaat.markt.marktplaats_gemiddeld],
                      ["AutoScout24.nl",  resultaat.markt.autoscout_gemiddeld],
                    ] as [string, number | undefined][]).filter(([, v]) => v).map(([platform, prijs]) => (
                      <div key={platform} className="flex items-center justify-between px-3 py-2"
                        style={{ backgroundColor: "rgba(0,19,55,0.03)", border: "1px solid rgba(0,19,55,0.07)" }}>
                        <span className="text-xs" style={{ color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)" }}>{platform}</span>
                        <span className="text-xs font-bold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>{fmt(Number(prijs))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Marktanalyse */}
              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                  <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Marktanalyse</p>
                </div>
                <div className="p-5 flex flex-col gap-4">

                  {/* Aanbod */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Aanbod online</p>
                    <p className="text-3xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                      {resultaat.markt.aantal_aanbod}
                      <span className="text-sm font-normal ml-1.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>stuks</span>
                    </p>
                    <div className="mt-2 h-1.5 rounded" style={{ backgroundColor: "rgba(0,19,55,0.07)" }}>
                      <div className="h-full rounded" style={{
                        width: `${Math.min(100, (resultaat.markt.aantal_aanbod / 100) * 100)}%`,
                        backgroundColor: resultaat.markt.aantal_aanbod > 60 ? "#b91c1c" : resultaat.markt.aantal_aanbod > 30 ? "#b45309" : "#15803d",
                      }} />
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                      {resultaat.markt.aantal_aanbod > 60 ? "Groot aanbod — sterk concurrerend" : resultaat.markt.aantal_aanbod > 30 ? "Gemiddeld aanbod" : "Beperkt aanbod — gunstig voor verkoop"}
                    </p>
                  </div>

                  {/* Populariteit */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={S.label}>Populariteit</p>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 10 }, (_, i) => (
                        <div key={i} className="flex-1 h-2 rounded-sm" style={{
                          backgroundColor: i < resultaat.markt.vraag_score
                            ? (resultaat.markt.vraag_score >= 7 ? "#15803d" : resultaat.markt.vraag_score >= 5 ? "#b45309" : "#b91c1c")
                            : "rgba(0,19,55,0.08)",
                        }} />
                      ))}
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                      {resultaat.markt.vraag_score}/10
                    </p>
                  </div>

                  {/* Advies */}
                  <div className="p-3" style={{ backgroundColor: "rgba(0,19,55,0.03)", border: "1px solid rgba(0,19,55,0.07)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>AI Marktadvies</p>
                    <p className="text-xs leading-relaxed" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                      {resultaat.markt.advies}
                    </p>
                  </div>

                  {/* Berekening */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={S.label}>Berekening</p>
                    <table className="w-full text-xs" style={{ fontFamily: "var(--font-inter)" }}>
                      <tbody>
                        {[
                          ["Geadviseerde verkoop",  fmt(resultaat.berekening.verwachte_verkoop), false],
                          ["Gewenste marge",        `${resultaat.berekening.gewenste_marge}%`, false],
                          ["Geschatte kosten",      `− ${fmt(resultaat.berekening.geschatte_kosten)}`, false],
                          ["= Max inkoopprijs",     fmt(resultaat.berekening.max_inkoop), true],
                        ].map(([l, v, bold]) => (
                          <tr key={l as string} style={{ borderTop: bold ? "1px solid rgba(0,19,55,0.1)" : undefined }}>
                            <td className="py-1" style={{ color: bold ? "#001337" : "rgba(0,19,55,0.5)", fontWeight: bold ? 700 : 400 }}>{l}</td>
                            <td className="py-1 text-right font-semibold" style={{ color: bold ? "#001337" : "rgba(0,19,55,0.7)" }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Gevonden vergelijkbare advertenties — de basis van de taxatie */}
            {resultaat.markt.vergelijkbare && resultaat.markt.vergelijkbare.length > 0 && (
              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                  <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                    Gevonden vergelijkbare auto&apos;s
                  </p>
                  <span className="text-xs" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                    {resultaat.markt.aantal_gevonden ?? resultaat.markt.vergelijkbare.length} advertenties · basis van deze taxatie
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="w-full" style={{ fontFamily: "var(--font-inter)", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1.5px solid rgba(0,19,55,0.1)" }}>
                        {["Advertentie", "Bouwjaar", "Km", "Platform", "Vraagprijs"].map((h, i) => (
                          <th key={h} className="px-5 py-2.5" style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "rgba(0,19,55,0.45)", textAlign: i === 4 ? "right" : i >= 1 ? "center" : "left", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultaat.markt.vergelijkbare.map((v, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                          <td className="px-5 py-2.5 text-xs font-semibold" style={{ color: "#001337" }}>{v.titel}</td>
                          <td className="px-5 py-2.5 text-xs text-center" style={{ color: "#475569" }}>{v.bouwjaar ?? "—"}</td>
                          <td className="px-5 py-2.5 text-xs text-center" style={{ color: "#475569" }}>{v.km != null ? `${v.km.toLocaleString("nl-NL")} km` : "—"}</td>
                          <td className="px-5 py-2.5 text-xs text-center" style={{ color: "#475569" }}>{v.platform ?? "—"}</td>
                          <td className="px-5 py-2.5 text-sm text-right font-bold" style={{ color: "#001337" }}>{fmt(v.prijs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(0,19,55,0.07)", backgroundColor: "rgba(0,19,55,0.02)" }}>
                  <p className="text-[11px] leading-relaxed" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                    Dit zijn de daadwerkelijk online gevonden advertenties waarop de taxatie is gebaseerd. Controleer ze zelf voor 100% zekerheid — staat, opties, historie en regio kunnen de prijs beïnvloeden.
                  </p>
                </div>
              </div>
            )}

            {/* Opslaan */}
            <div className="flex items-center gap-3">
              <button type="button" onClick={slaOp}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: opgeslagen ? "#15803d" : "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
                <Plus size={14} />
                {opgeslagen ? "✓ Opgeslagen!" : "Sla op als inkoopdossier"}
              </button>
              <p className="text-xs" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                Bewaar voor opvolging in de Dossiers tab
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dossiers ──────────────────────────────────────────────────────
function DossiersTab() {
  const [dossiers, setDossiers] = useState<InkoopDossier[]>([]);
  const [loading, setLoading]   = useState(true);
  const [openId, setOpenId]     = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("alle");

  const laad = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/inkoop");
    if (res.ok) setDossiers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { laad(); }, [laad]);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/inkoop/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setDossiers((p) => p.map((d) => (d.id === id ? { ...d, status } : d)));
  };

  const verwijder = async (id: string) => {
    if (!confirm("Dossier verwijderen?")) return;
    await fetch(`/api/admin/inkoop/${id}`, { method: "DELETE" });
    setDossiers((p) => p.filter((d) => d.id !== id));
    if (openId === id) setOpenId(null);
  };

  const gefilterd = filterStatus === "alle" ? dossiers : dossiers.filter((d) => d.status === filterStatus);

  return (
    <div className="p-4 md:p-8">
      {dossiers.length > 0 && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {(["alle", ...Object.keys(STATUS_LABELS)]).map((s) => {
            const count = s === "alle" ? dossiers.length : dossiers.filter((d) => d.status === s).length;
            return (
              <button type="button" key={s} onClick={() => setFilterStatus(s)}
                className="px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  backgroundColor: filterStatus === s ? "#001337" : "transparent",
                  color: filterStatus === s ? "#ffffff" : "rgba(0,19,55,0.4)",
                  border: `1px solid ${filterStatus === s ? "#001337" : "rgba(0,19,55,0.12)"}`,
                  fontFamily: "var(--font-inter)",
                }}>
                {s === "alle" ? "Alle" : STATUS_LABELS[s].label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />
        </div>
      ) : dossiers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28"
          style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
          <TrendingDown size={40} style={{ color: "rgba(0,19,55,0.1)" }} />
          <p className="text-lg font-bold mt-5 mb-2" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Geen dossiers</p>
          <p className="text-sm" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
            Gebruik de Taxatietool om een analyse op te slaan als dossier.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {gefilterd.map((d) => {
            const sl = STATUS_LABELS[d.status] ?? STATUS_LABELS.nieuw;
            const isOpen = openId === d.id;
            return (
              <div key={d.id} style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                <button type="button" onClick={() => setOpenId(isOpen ? null : d.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                        {d.merk} {d.model} <span style={{ fontWeight: 400, color: "rgba(0,19,55,0.5)" }}>{d.bouwjaar}</span>
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 font-semibold"
                        style={{ backgroundColor: sl.bg, color: sl.color, fontFamily: "var(--font-inter)" }}>
                        {sl.label}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                      {d.naam}{d.kenteken ? ` · ${d.kenteken}` : ""}{d.km ? ` · ${parseInt(d.km).toLocaleString("nl-NL")} km` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {d.aanbod_prijs > 0 && <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>€{d.aanbod_prijs.toLocaleString("nl-NL")}</p>}
                    <p className="text-[10px]" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>{d.datum}</p>
                  </div>
                  {isOpen ? <ChevronUp size={14} style={{ color: "rgba(0,19,55,0.3)", flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: "rgba(0,19,55,0.3)", flexShrink: 0 }} />}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5" style={{ borderTop: "1px solid rgba(0,19,55,0.06)" }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                      <div>
                        <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Details</p>
                        <table className="text-xs w-full" style={{ fontFamily: "var(--font-inter)" }}>
                          <tbody>
                            {[
                              ["Auto",       `${d.merk} ${d.model} ${d.bouwjaar}`.trim()],
                              ["Kenteken",   d.kenteken],
                              ["Km-stand",   d.km ? `${parseInt(d.km).toLocaleString("nl-NL")} km` : ""],
                              ["Marktprijs", d.aanbod_prijs > 0 ? `€${d.aanbod_prijs.toLocaleString("nl-NL")}` : ""],
                              ["Max bod",    d.bod_prijs > 0 ? `€${d.bod_prijs.toLocaleString("nl-NL")}` : ""],
                              ["Naam",       d.naam],
                              ["Telefoon",   d.telefoon],
                            ].filter(([, v]) => v).map(([l, v]) => (
                              <tr key={l}><td className="py-0.5 pr-3" style={{ color: "rgba(0,19,55,0.45)", width: 80 }}>{l}</td><td className="py-0.5 font-semibold" style={{ color: "#001337" }}>{v}</td></tr>
                            ))}
                          </tbody>
                        </table>
                        {d.notitie && (
                          <div className="mt-3 p-3 text-xs" style={{ backgroundColor: "rgba(0,19,55,0.03)", border: "1px solid rgba(0,19,55,0.07)", color: "rgba(0,19,55,0.65)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
                            {d.notitie}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Status</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {Object.entries(STATUS_LABELS).map(([key, val]) => (
                            <button type="button" key={key} onClick={() => updateStatus(d.id, key)}
                              className="px-3 py-1 text-xs font-semibold transition-all"
                              style={{
                                backgroundColor: d.status === key ? val.bg : "transparent",
                                color: d.status === key ? val.color : "rgba(0,19,55,0.4)",
                                border: `1px solid ${d.status === key ? val.color : "rgba(0,19,55,0.15)"}`,
                                fontFamily: "var(--font-inter)",
                              }}>
                              {val.label}
                            </button>
                          ))}
                        </div>
                        <button type="button" onClick={() => verwijder(d.id)}
                          className="flex items-center gap-1.5 text-xs transition-all hover:opacity-70"
                          style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>
                          <Trash2 size={12} /> Verwijder
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

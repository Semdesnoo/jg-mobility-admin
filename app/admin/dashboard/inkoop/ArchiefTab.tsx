"use client";

import { useState, useEffect } from "react";
import { History, Trash2, ChevronDown, ChevronRight, Car, Archive } from "lucide-react";
import { T, num, micro, body, fmt, fmtKm } from "./ui";
import type { TaxatieResultaat } from "./types";

type ArchiefRij = {
  id: string;
  kenteken: string;
  merk: string;
  model: string;
  bouwjaar: number;
  km: number;
  marge: number;
  kosten: number;
  max_inkoop: number;
  verwachte_verkoop: number;
  betrouwbaarheid: string;
  resultaat: TaxatieResultaat;
  jaar: number;
  kwartaal: number;
  aangemaakt: string;
};

const BETROUWBAAR: Record<string, { label: string; kleur: string; bg: string }> = {
  hoog: { label: "Hoog", kleur: T.groen, bg: T.tintGroen },
  midden: { label: "Midden", kleur: T.amber, bg: T.tintAmber },
  laag: { label: "Laag", kleur: T.rood, bg: T.tintRood },
};

function datumTijd(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

export default function ArchiefTab() {
  const [rijen, setRijen] = useState<ArchiefRij[] | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const laad = async () => {
    try {
      const r = await fetch("/api/admin/inkoop/archief");
      setRijen(r.ok ? await r.json() : []);
    } catch {
      setRijen([]);
    }
  };
  useEffect(() => { laad(); }, []);

  const verwijder = async (id: string) => {
    if (!confirm("Deze analyse uit het archief verwijderen?")) return;
    await fetch(`/api/admin/inkoop/archief/${id}`, { method: "DELETE" });
    setRijen((p) => (p ? p.filter((x) => x.id !== id) : p));
  };

  const toggle = (id: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Per kwartaal groeperen — nieuwste kwartaal bovenaan.
  const groepen = (() => {
    const map = new Map<string, { jaar: number; kwartaal: number; label: string; rijen: ArchiefRij[] }>();
    for (const r of rijen ?? []) {
      const key = `${r.jaar}-Q${r.kwartaal}`;
      if (!map.has(key)) map.set(key, { jaar: r.jaar, kwartaal: r.kwartaal, label: `${r.jaar} · Q${r.kwartaal}`, rijen: [] });
      map.get(key)!.rijen.push(r);
    }
    return [...map.values()].sort((a, b) => b.jaar - a.jaar || b.kwartaal - a.kwartaal);
  })();

  if (rijen === null) {
    return (
      <div className="flex flex-col gap-2 py-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse" style={{ height: 56, backgroundColor: "rgba(0,19,55,0.05)" }} />
        ))}
      </div>
    );
  }

  if (rijen.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20" style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}>
        <Archive size={30} style={{ color: T.ink(0.15) }} />
        <p className="mt-3" style={{ fontFamily: T.play, fontWeight: 700, fontSize: 16, color: T.navy }}>Nog geen analyses bewaard</p>
        <p className="mt-1.5 max-w-sm" style={body(12, T.ink(0.45))}>
          Elke keer dat je in de Taxatietool op &ldquo;Analyseer markt&rdquo; klikt, wordt de uitslag hier automatisch bewaard — geordend per kwartaal.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Kop */}
      <div className="flex items-center gap-2.5">
        <History size={16} style={{ color: T.ink(0.4) }} />
        <div>
          <h3 style={{ fontFamily: T.play, fontWeight: 700, fontSize: 17, color: T.navy }}>Analyse-archief</h3>
          <p style={body(11.5, T.ink(0.45))}>
            {rijen.length} bewaarde analyse{rijen.length === 1 ? "" : "s"} — automatisch opgeslagen per kwartaal
          </p>
        </div>
      </div>

      {groepen.map((g) => {
        const somMax = g.rijen.reduce((s, r) => s + r.max_inkoop, 0);
        return (
          <div key={g.label} style={{ backgroundColor: T.paper, border: `1px solid ${T.line}`, boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
            {/* Kwartaalkop */}
            <div className="px-4 md:px-5 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: `1px solid ${T.line}`, backgroundColor: "rgba(0,19,55,0.02)" }}>
              <div className="flex items-baseline gap-2.5">
                <span style={{ fontFamily: T.play, fontWeight: 700, fontSize: 15, color: T.navy }}>{g.label}</span>
                <span style={micro(T.ink(0.4))}>{g.rijen.length} analyse{g.rijen.length === 1 ? "" : "s"}</span>
              </div>
              <span style={{ fontFamily: T.inter, fontSize: 11, color: T.ink(0.45) }}>
                samen max. inkoop {fmt(somMax)}
              </span>
            </div>

            {/* Analyses */}
            {g.rijen.map((r) => {
              const isOpen = open.has(r.id);
              const bet = BETROUWBAAR[r.betrouwbaarheid] ?? null;
              const markt = r.resultaat?.markt;
              const ber = r.resultaat?.berekening;
              return (
                <div key={r.id} style={{ borderTop: `1px solid ${T.line}` }}>
                  {/* Regel */}
                  <div className="px-4 md:px-5 py-3 flex items-center gap-4 flex-wrap">
                    <button
                      type="button"
                      onClick={() => toggle(r.id)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left transition-all hover:opacity-70"
                    >
                      {isOpen ? <ChevronDown size={15} style={{ color: T.ink(0.4), flexShrink: 0 }} /> : <ChevronRight size={15} style={{ color: T.ink(0.4), flexShrink: 0 }} />}
                      <span className="min-w-0">
                        <span className="block truncate" style={{ fontFamily: T.inter, fontWeight: 700, fontSize: 13.5, color: T.navy }}>
                          {[r.merk, r.model].filter(Boolean).join(" ") || "Onbekend voertuig"}
                        </span>
                        <span className="block truncate" style={{ fontFamily: T.inter, fontSize: 11, color: T.ink(0.42) }}>
                          {[r.kenteken && r.kenteken.toUpperCase(), r.bouwjaar || null, r.km ? fmtKm(r.km) : null, datumTijd(r.aangemaakt)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>

                    {bet && (
                      <span className="px-2 py-1 flex-shrink-0" style={{ fontFamily: T.inter, fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: bet.kleur, backgroundColor: bet.bg }}>
                        {bet.label}
                      </span>
                    )}

                    <span className="text-right flex-shrink-0" style={{ minWidth: 120 }}>
                      <span className="block" style={num(18)}>{fmt(r.max_inkoop)}</span>
                      <span className="block" style={{ fontFamily: T.inter, fontSize: 9.5, color: T.ink(0.4) }}>max. inkoop</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => verwijder(r.id)}
                      aria-label="Verwijderen"
                      className="px-2 py-1 transition-all hover:opacity-70 flex-shrink-0"
                      style={{ border: `1px solid rgba(185,28,28,0.25)`, color: T.rood }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>

                  {/* Detail — wat de analyse toen gaf */}
                  {isOpen && (
                    <div className="px-4 md:px-5 pb-4" style={{ backgroundColor: "rgba(0,19,55,0.015)" }}>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-3">
                        {[
                          { l: "Max. inkoop", v: fmt(r.max_inkoop) },
                          { l: "Verwachte verkoop", v: fmt(r.verwachte_verkoop) },
                          { l: "Geschatte marge", v: ber ? fmt(ber.geschatte_marge) : "—" },
                          { l: "Gewenste marge", v: `${r.marge}%` },
                          { l: "Geschatte kosten", v: fmt(r.kosten) },
                          { l: "Koerslijstwaarde", v: ber?.koerslijst_waarde ? fmt(ber.koerslijst_waarde) : "—" },
                          { l: "Marktwaarde", v: ber?.markt_waarde ? fmt(ber.markt_waarde) : "—" },
                          { l: "Aantrekkelijkheid", v: ber?.aantrekkelijkheid != null ? `${ber.aantrekkelijkheid}/10` : "—" },
                          { l: "Markt gemiddeld", v: markt?.gemiddelde_prijs ? fmt(markt.gemiddelde_prijs) : "—" },
                          { l: "Markt min · max", v: markt?.min_prijs ? `${fmt(markt.min_prijs)} – ${fmt(markt.max_prijs)}` : "—" },
                          { l: "Aanbod gevonden", v: markt?.aantal_aanbod != null ? String(markt.aantal_aanbod) : "—" },
                          { l: "Prijstrend", v: markt?.prijs_trend || "—" },
                        ].map((c) => (
                          <div key={c.l} className="px-3 py-2" style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}>
                            <p style={{ ...micro(T.ink(0.4)), fontSize: 8.5 }}>{c.l}</p>
                            <p className="mt-1" style={{ fontFamily: T.inter, fontWeight: 700, fontSize: 12.5, color: T.navy }}>{c.v}</p>
                          </div>
                        ))}
                      </div>

                      {markt?.advies && (
                        <div className="mt-3 px-3.5 py-2.5" style={{ backgroundColor: T.tintBlauw, border: `1px solid rgba(29,78,216,0.2)` }}>
                          <p style={{ ...micro(T.blauw), fontSize: 8.5 }}>Advies van de analyse</p>
                          <p className="mt-1" style={body(12, T.ink(0.7))}>{markt.advies}</p>
                        </div>
                      )}

                      {Array.isArray(markt?.vergelijkbare) && markt!.vergelijkbare!.length > 0 && (
                        <div className="mt-3">
                          <p style={{ ...micro(T.ink(0.4)), fontSize: 8.5 }} className="mb-1.5">Vergelijkbaar aanbod dat toen gevonden werd</p>
                          <div className="flex flex-col gap-1">
                            {markt!.vergelijkbare!.slice(0, 6).map((v, i) => (
                              <div key={i} className="flex items-center justify-between gap-3 px-3 py-1.5" style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}>
                                <span className="min-w-0 truncate" style={{ fontFamily: T.inter, fontSize: 11, color: T.ink(0.6) }}>
                                  {[v.titel, v.bouwjaar || null, v.km ? fmtKm(v.km) : null, v.platform || null].filter(Boolean).join(" · ")}
                                </span>
                                <span className="flex-shrink-0" style={num(12)}>{fmt(v.prijs)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

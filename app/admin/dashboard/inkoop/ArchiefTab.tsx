"use client";

import { useState, useEffect } from "react";
import { History, Trash2, ChevronDown, ChevronRight, Archive, Search, Globe, Flame } from "lucide-react";
import { T, num, micro, body, fmt, fmtKm } from "./ui";
import type { TaxatieResultaat, MarktOverzicht } from "./types";

type TaxatieRij = {
  id: string; kenteken: string; merk: string; model: string; bouwjaar: number;
  km: number; marge: number; kosten: number; max_inkoop: number; verwachte_verkoop: number;
  betrouwbaarheid: string; resultaat: TaxatieResultaat; jaar: number; kwartaal: number; aangemaakt: string;
};
type MarktRij = {
  id: string; type: string; zoekterm: string; samenvatting: string; markt_temperatuur: number;
  resultaat: MarktOverzicht; jaar: number; kwartaal: number; aangemaakt: string;
};

type Item =
  | ({ soort: "taxatie" } & TaxatieRij)
  | ({ soort: "markt" } & MarktRij);

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

function tempKleur(t: number): string {
  return t >= 8 ? T.rood : t >= 6 ? T.amber : t >= 4 ? T.blauw : T.ink(0.4);
}

export default function ArchiefTab() {
  const [taxaties, setTaxaties] = useState<TaxatieRij[] | null>(null);
  const [markten, setMarkten] = useState<MarktRij[] | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const laad = async () => {
    const [t, m] = await Promise.all([
      fetch("/api/admin/inkoop/archief").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/admin/inkoop/markt-archief").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]);
    setTaxaties(Array.isArray(t) ? t : []);
    setMarkten(Array.isArray(m) ? m : []);
  };
  useEffect(() => { laad(); }, []);

  const verwijder = async (it: Item) => {
    if (!confirm("Deze analyse uit het archief verwijderen?")) return;
    const pad = it.soort === "taxatie" ? "archief" : "markt-archief";
    await fetch(`/api/admin/inkoop/${pad}/${it.id}`, { method: "DELETE" });
    if (it.soort === "taxatie") setTaxaties((p) => (p ? p.filter((x) => x.id !== it.id) : p));
    else setMarkten((p) => (p ? p.filter((x) => x.id !== it.id) : p));
  };

  const toggle = (id: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const laden = taxaties === null || markten === null;
  const items: Item[] = [
    ...(taxaties ?? []).map((t) => ({ soort: "taxatie" as const, ...t })),
    ...(markten ?? []).map((m) => ({ soort: "markt" as const, ...m })),
  ];

  // Per kwartaal groeperen, nieuwste kwartaal bovenaan, binnen een kwartaal het
  // meest recente moment eerst.
  const groepen = (() => {
    const map = new Map<string, { jaar: number; kwartaal: number; label: string; items: Item[] }>();
    for (const it of items) {
      const key = `${it.jaar}-Q${it.kwartaal}`;
      if (!map.has(key)) map.set(key, { jaar: it.jaar, kwartaal: it.kwartaal, label: `${it.jaar} · Q${it.kwartaal}`, items: [] });
      map.get(key)!.items.push(it);
    }
    for (const g of map.values()) g.items.sort((a, b) => (a.aangemaakt < b.aangemaakt ? 1 : -1));
    return [...map.values()].sort((a, b) => b.jaar - a.jaar || b.kwartaal - a.kwartaal);
  })();

  if (laden) {
    return (
      <div className="flex flex-col gap-2 py-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse" style={{ height: 56, backgroundColor: "rgba(0,19,55,0.05)" }} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20" style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}>
        <Archive size={30} style={{ color: T.ink(0.15) }} />
        <p className="mt-3" style={{ fontFamily: T.play, fontWeight: 700, fontSize: 16, color: T.navy }}>Nog geen analyses bewaard</p>
        <p className="mt-1.5 max-w-md" style={body(12, T.ink(0.45))}>
          Zowel een taxatie (&ldquo;Analyseer markt&rdquo;) als een marktanalyse (&ldquo;Analyseer markt nu&rdquo;) wordt hier automatisch bewaard — geordend per kwartaal.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2.5">
        <History size={16} style={{ color: T.ink(0.4) }} />
        <div>
          <h3 style={{ fontFamily: T.play, fontWeight: 700, fontSize: 17, color: T.navy }}>Analyse-archief</h3>
          <p style={body(11.5, T.ink(0.45))}>
            {items.length} bewaarde analyse{items.length === 1 ? "" : "s"} — taxaties én marktanalyses, automatisch per kwartaal
          </p>
        </div>
      </div>

      {groepen.map((g) => {
        const aantalTax = g.items.filter((i) => i.soort === "taxatie").length;
        const aantalMarkt = g.items.filter((i) => i.soort === "markt").length;
        return (
          <div key={g.label} style={{ backgroundColor: T.paper, border: `1px solid ${T.line}`, boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
            {/* Kwartaalkop */}
            <div className="px-4 md:px-5 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: `1px solid ${T.line}`, backgroundColor: "rgba(0,19,55,0.02)" }}>
              <span style={{ fontFamily: T.play, fontWeight: 700, fontSize: 15, color: T.navy }}>{g.label}</span>
              <span style={{ fontFamily: T.inter, fontSize: 11, color: T.ink(0.45) }}>
                {[aantalTax ? `${aantalTax} taxatie${aantalTax === 1 ? "" : "s"}` : null, aantalMarkt ? `${aantalMarkt} marktanalyse${aantalMarkt === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}
              </span>
            </div>

            {g.items.map((it) => {
              const isOpen = open.has(it.id);
              return (
                <div key={it.id} style={{ borderTop: `1px solid ${T.line}` }}>
                  {/* ── Regel ── */}
                  <div className="px-4 md:px-5 py-3 flex items-center gap-3 sm:gap-4 flex-wrap">
                    <button type="button" onClick={() => toggle(it.id)} className="flex items-center gap-3 min-w-0 flex-1 text-left transition-all hover:opacity-70">
                      {isOpen ? <ChevronDown size={15} style={{ color: T.ink(0.4), flexShrink: 0 }} /> : <ChevronRight size={15} style={{ color: T.ink(0.4), flexShrink: 0 }} />}
                      <span className="flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, backgroundColor: it.soort === "taxatie" ? "rgba(0,19,55,0.06)" : T.tintBlauw }}>
                        {it.soort === "taxatie" ? <Search size={13} style={{ color: T.navy }} /> : <Globe size={13} style={{ color: T.blauw }} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate" style={{ fontFamily: T.inter, fontWeight: 700, fontSize: 13.5, color: T.navy }}>
                          {it.soort === "taxatie"
                            ? [it.merk, it.model].filter(Boolean).join(" ") || "Onbekend voertuig"
                            : it.type === "zoek" ? `Marktanalyse: ${it.zoekterm || "zoekopdracht"}` : "Marktpuls Nederland"}
                        </span>
                        <span className="block truncate" style={{ fontFamily: T.inter, fontSize: 11, color: T.ink(0.42) }}>
                          {it.soort === "taxatie"
                            ? [it.kenteken && it.kenteken.toUpperCase(), it.bouwjaar || null, it.km ? fmtKm(it.km) : null, datumTijd(it.aangemaakt)].filter(Boolean).join(" · ")
                            : ["Marktoverzicht", datumTijd(it.aangemaakt)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>

                    {it.soort === "taxatie" ? (
                      <>
                        {BETROUWBAAR[it.betrouwbaarheid] && (
                          <span className="px-2 py-1 flex-shrink-0" style={{ fontFamily: T.inter, fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: BETROUWBAAR[it.betrouwbaarheid].kleur, backgroundColor: BETROUWBAAR[it.betrouwbaarheid].bg }}>
                            {BETROUWBAAR[it.betrouwbaarheid].label}
                          </span>
                        )}
                        <span className="text-right flex-shrink-0" style={{ minWidth: 110 }}>
                          <span className="block" style={num(18)}>{fmt(it.max_inkoop)}</span>
                          <span className="block" style={{ fontFamily: T.inter, fontSize: 9.5, color: T.ink(0.4) }}>max. inkoop</span>
                        </span>
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 flex-shrink-0" style={{ backgroundColor: "rgba(0,19,55,0.03)", border: `1px solid ${T.line}` }}>
                        <Flame size={12} style={{ color: tempKleur(it.markt_temperatuur) }} />
                        <span style={{ fontFamily: T.play, fontWeight: 700, fontSize: 14, color: tempKleur(it.markt_temperatuur), fontVariantNumeric: "tabular-nums" }}>{it.markt_temperatuur}</span>
                        <span style={{ fontFamily: T.inter, fontSize: 9.5, color: T.ink(0.4) }}>/10 temp.</span>
                      </span>
                    )}

                    <button type="button" onClick={() => verwijder(it)} aria-label="Verwijderen" className="px-2 py-1 transition-all hover:opacity-70 flex-shrink-0" style={{ border: `1px solid rgba(185,28,28,0.25)`, color: T.rood }}>
                      <Trash2 size={11} />
                    </button>
                  </div>

                  {/* ── Detail ── */}
                  {isOpen && (
                    <div className="px-4 md:px-5 pb-4" style={{ backgroundColor: "rgba(0,19,55,0.015)" }}>
                      {it.soort === "taxatie"
                        ? <TaxatieDetail r={it} />
                        : <MarktDetail r={it} />}
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

function TaxatieDetail({ r }: { r: TaxatieRij }) {
  const markt = r.resultaat?.markt;
  const ber = r.resultaat?.berekening;
  return (
    <>
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
    </>
  );
}

function MarktDetail({ r }: { r: MarktRij }) {
  const o = r.resultaat;
  const samenvatting = o?.samenvatting || r.samenvatting;
  return (
    <div className="pt-3 flex flex-col gap-3">
      {samenvatting && (
        <div className="px-3.5 py-2.5" style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}>
          <p style={{ ...micro(T.ink(0.4)), fontSize: 8.5 }}>Samenvatting · markttemperatuur {r.markt_temperatuur}/10</p>
          <p className="mt-1" style={body(12, T.ink(0.7))}>{samenvatting}</p>
        </div>
      )}

      {Array.isArray(o?.hot_modellen) && o!.hot_modellen.length > 0 && (
        <div>
          <p style={{ ...micro(T.groen), fontSize: 8.5 }} className="mb-1.5">Hot modellen — inkoopkansen</p>
          <div className="flex flex-col gap-1">
            {o!.hot_modellen.slice(0, 6).map((h, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-1.5" style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}>
                <span className="min-w-0">
                  <span className="block truncate" style={{ fontFamily: T.inter, fontWeight: 700, fontSize: 11.5, color: T.navy }}>{[h.merk, h.model].filter(Boolean).join(" ")}</span>
                  <span className="block truncate" style={{ fontFamily: T.inter, fontSize: 10, color: T.ink(0.42) }}>{[h.segment, h.advies].filter(Boolean).join(" · ")}</span>
                </span>
                {h.gem_prijs > 0 && <span className="flex-shrink-0" style={num(12)}>{fmt(h.gem_prijs)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(o?.te_vermijden) && o!.te_vermijden.length > 0 && (
        <div>
          <p style={{ ...micro(T.rood), fontSize: 8.5 }} className="mb-1.5">Te vermijden</p>
          <div className="flex flex-col gap-1">
            {o!.te_vermijden.slice(0, 6).map((v, i) => (
              <div key={i} className="px-3 py-1.5" style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}>
                <span style={{ fontFamily: T.inter, fontSize: 11, color: T.ink(0.65) }}>
                  <strong style={{ color: T.navy }}>{[v.merk, v.model].filter(Boolean).join(" ")}</strong>{v.reden ? ` — ${v.reden}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(o?.inzichten) && o!.inzichten.length > 0 && (
        <div>
          <p style={{ ...micro(T.ink(0.4)), fontSize: 8.5 }} className="mb-1.5">Marktinzichten</p>
          <ul className="flex flex-col gap-1">
            {o!.inzichten.slice(0, 8).map((z, i) => (
              <li key={i} className="flex gap-2" style={body(11.5, T.ink(0.6))}>
                <span style={{ color: T.ink(0.3) }}>•</span>
                <span className="min-w-0">{z}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

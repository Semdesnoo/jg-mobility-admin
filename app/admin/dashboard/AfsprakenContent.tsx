"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Calendar, ChevronDown, ChevronUp, Trash2 } from "lucide-react";

type Afspraak = {
  id: string;
  datum: string;
  tijd: string;
  type: string;
  klant_naam: string;
  klant_telefoon: string;
  klant_email: string;
  auto_naam: string;
  notitie: string;
  status: string;
  aangemaakt: string;
};

const TYPES: Record<string, string> = {
  proefrit: "Proefrit",
  bezichtiging: "Bezichtiging",
  levering: "Levering",
  overige: "Overige",
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  gepland:    { label: "Gepland",    color: "#1d4ed8", bg: "#dbeafe" },
  afgerond:   { label: "Afgerond",   color: "#15803d", bg: "#dcfce7" },
  geannuleerd:{ label: "Geannuleerd",color: "#b91c1c", bg: "#fee2e2" },
};

const S = {
  label: { color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" } as React.CSSProperties,
  veld: { border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", backgroundColor: "#fafafa" } as React.CSSProperties,
};

type LeegForm = {
  datum: string; tijd: string; type: string;
  klant_naam: string; klant_telefoon: string; klant_email: string;
  auto_naam: string; notitie: string;
};

function maakLeegForm(): LeegForm {
  const nu = new Date();
  return {
    datum: nu.toISOString().slice(0, 10),
    tijd: "10:00",
    type: "proefrit",
    klant_naam: "", klant_telefoon: "", klant_email: "",
    auto_naam: "", notitie: "",
  };
}

export default function AfsprakenContent() {
  const [afspraken, setAfspraken] = useState<Afspraak[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toonNieuw, setToonNieuw] = useState(false);
  const [form, setForm] = useState<LeegForm>(maakLeegForm);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"alle" | "gepland" | "afgerond" | "geannuleerd">("gepland");

  const laad = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/afspraken");
    if (res.ok) setAfspraken(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { laad(); }, [laad]);

  const maakAan = async () => {
    if (!form.datum || !form.klant_naam.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/afspraken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const a: Afspraak = await res.json();
      setAfspraken((p) => [a, ...p]);
      setForm(maakLeegForm());
      setToonNieuw(false);
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/afspraken/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setAfspraken((p) => p.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  const updateNotitie = async (id: string, notitie: string) => {
    await fetch(`/api/admin/afspraken/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notitie }),
    });
    setAfspraken((p) => p.map((a) => (a.id === id ? { ...a, notitie } : a)));
  };

  const verwijder = async (id: string) => {
    if (!confirm("Afspraak verwijderen?")) return;
    await fetch(`/api/admin/afspraken/${id}`, { method: "DELETE" });
    setAfspraken((p) => p.filter((a) => a.id !== id));
    if (openId === id) setOpenId(null);
  };

  const gefilterd = filterStatus === "alle" ? afspraken : afspraken.filter((a) => a.status === filterStatus);
  const geplandVandaag = afspraken.filter((a) => a.status === "gepland" && a.datum === new Date().toISOString().slice(0, 10)).length;

  return (
    <div>
      <div
        className="px-4 md:px-8 py-4 md:py-5 flex items-center justify-between sticky top-0 z-10"
        style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}
      >
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Afspraken</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
            {afspraken.filter(a => a.status === "gepland").length} gepland{geplandVandaag > 0 ? ` · ${geplandVandaag} vandaag` : ""}
          </p>
        </div>
        <button
          onClick={() => setToonNieuw((v) => !v)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
        >
          <Plus size={14} /> Nieuwe afspraak
        </button>
      </div>

      <div className="p-4 md:p-8">
        {toonNieuw && (
          <div className="mb-6" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={S.label}>Nieuwe afspraak</p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Datum *</label>
                <input type="date" value={form.datum} onChange={(e) => setForm((p) => ({ ...p, datum: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={S.veld} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Tijd</label>
                <input type="time" value={form.tijd} onChange={(e) => setForm((p) => ({ ...p, tijd: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={S.veld} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Type</label>
                <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={S.veld}>
                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Naam klant *</label>
                <input type="text" value={form.klant_naam} onChange={(e) => setForm((p) => ({ ...p, klant_naam: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={S.veld} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Telefoon</label>
                <input type="text" value={form.klant_telefoon} onChange={(e) => setForm((p) => ({ ...p, klant_telefoon: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={S.veld} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>E-mail</label>
                <input type="text" value={form.klant_email} onChange={(e) => setForm((p) => ({ ...p, klant_email: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={S.veld} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Auto</label>
                <input type="text" value={form.auto_naam} placeholder="bijv. BMW 3-serie 2021" onChange={(e) => setForm((p) => ({ ...p, auto_naam: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={S.veld} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Notitie</label>
                <textarea value={form.notitie} onChange={(e) => setForm((p) => ({ ...p, notitie: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm outline-none resize-none" style={{ ...S.veld, lineHeight: 1.6 }} />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={maakAan} disabled={saving || !form.klant_naam.trim()} className="px-6 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
                {saving ? "Opslaan..." : "Afspraak inplannen"}
              </button>
              <button onClick={() => setToonNieuw(false)} className="px-4 py-2.5 text-sm" style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}>Annuleer</button>
            </div>
          </div>
        )}

        {/* Status filter */}
        {afspraken.length > 0 && (
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {(["gepland", "afgerond", "geannuleerd", "alle"] as const).map((s) => {
              const count = s === "alle" ? afspraken.length : afspraken.filter(a => a.status === s).length;
              return (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className="px-3 py-1.5 text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: filterStatus === s ? "#001337" : "transparent",
                    color: filterStatus === s ? "#ffffff" : "rgba(0,19,55,0.4)",
                    border: `1px solid ${filterStatus === s ? "#001337" : "rgba(0,19,55,0.12)"}`,
                    fontFamily: "var(--font-inter)",
                  }}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)} ({count})
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />
          </div>
        ) : afspraken.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <Calendar size={40} style={{ color: "rgba(0,19,55,0.1)" }} />
            <p className="text-lg font-bold mt-5 mb-2" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Geen afspraken</p>
            <p className="text-sm" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Plan de eerste afspraak in via de knop rechtsboven.</p>
          </div>
        ) : gefilterd.length === 0 ? (
          <div className="flex items-center justify-center py-16" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <p className="text-sm" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Geen afspraken met status &quot;{filterStatus}&quot;</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {gefilterd.map((a) => {
              const sl = STATUS_LABELS[a.status] ?? STATUS_LABELS.gepland;
              const isOpen = openId === a.id;
              const datumFormatted = a.datum ? new Date(a.datum + "T00:00:00").toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }) : a.datum;
              return (
                <div key={a.id} style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                  <button onClick={() => setOpenId(isOpen ? null : a.id)} className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all hover:bg-gray-50">
                    <div className="flex-shrink-0 text-center" style={{ minWidth: 52 }}>
                      <p className="text-base font-bold leading-none" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>{datumFormatted.split(" ")[1]}</p>
                      <p className="text-[10px] uppercase" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{datumFormatted.split(" ")[0]}</p>
                    </div>
                    <div className="w-px self-stretch mx-1" style={{ backgroundColor: "rgba(0,19,55,0.07)" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>{a.klant_naam}</p>
                        <span className="text-[10px] px-1.5 py-0.5 font-semibold" style={{ backgroundColor: "rgba(0,19,55,0.06)", color: "#001337", fontFamily: "var(--font-inter)" }}>{TYPES[a.type] ?? a.type}</span>
                        <span className="text-[10px] px-1.5 py-0.5 font-semibold" style={{ backgroundColor: sl.bg, color: sl.color, fontFamily: "var(--font-inter)" }}>{sl.label}</span>
                      </div>
                      <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                        {a.tijd}{a.auto_naam ? ` · ${a.auto_naam}` : ""}{a.klant_telefoon ? ` · ${a.klant_telefoon}` : ""}
                      </p>
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
                                ["Klant", a.klant_naam],
                                ["Telefoon", a.klant_telefoon],
                                ["E-mail", a.klant_email],
                                ["Auto", a.auto_naam],
                                ["Datum", datumFormatted],
                                ["Tijd", a.tijd],
                                ["Type", TYPES[a.type] ?? a.type],
                              ].filter(([, v]) => v).map(([l, v]) => (
                                <tr key={l}><td className="py-0.5 pr-3" style={{ color: "rgba(0,19,55,0.45)", width: 80 }}>{l}</td><td className="py-0.5 font-semibold" style={{ color: "#001337" }}>{v}</td></tr>
                              ))}
                            </tbody>
                          </table>
                          {a.notitie && (
                            <div className="mt-3 p-3 text-xs" style={{ backgroundColor: "rgba(0,19,55,0.03)", border: "1px solid rgba(0,19,55,0.07)", color: "rgba(0,19,55,0.65)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>{a.notitie}</div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Status</p>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {Object.entries(STATUS_LABELS).map(([key, val]) => (
                              <button key={key} onClick={() => updateStatus(a.id, key)}
                                className="px-3 py-1 text-xs font-semibold transition-all"
                                style={{
                                  backgroundColor: a.status === key ? val.bg : "transparent",
                                  color: a.status === key ? val.color : "rgba(0,19,55,0.4)",
                                  border: `1px solid ${a.status === key ? val.color : "rgba(0,19,55,0.15)"}`,
                                  fontFamily: "var(--font-inter)",
                                }}
                              >{val.label}</button>
                            ))}
                          </div>
                          <p className="text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Notitie</p>
                          <textarea defaultValue={a.notitie} rows={3} onBlur={(e) => { if (e.target.value !== a.notitie) updateNotitie(a.id, e.target.value); }} placeholder="Interne notitie..." className="w-full px-3 py-2 text-xs outline-none resize-none" style={{ ...S.veld, lineHeight: 1.6 }} />
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex gap-2">
                              {a.klant_email && <a href={`mailto:${a.klant_email}`} className="px-4 py-2 text-xs font-semibold" style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>Mail</a>}
                              {a.klant_telefoon && <a href={`tel:${a.klant_telefoon}`} className="px-4 py-2 text-xs font-semibold" style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}>Bel</a>}
                            </div>
                            <button onClick={() => verwijder(a.id)} className="flex items-center gap-1.5 text-xs transition-all hover:opacity-70" style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>
                              <Trash2 size={12} /> Verwijder
                            </button>
                          </div>
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
    </div>
  );
}

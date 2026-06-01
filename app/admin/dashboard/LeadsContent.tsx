"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Target, ChevronDown, ChevronUp, Trash2 } from "lucide-react";

type Lead = {
  id: string;
  naam: string;
  telefoon: string;
  email: string;
  bron: string;
  interesse: string;
  budget: string;
  notitie: string;
  status: string;
  aangemaakt: string;
};

const BRONNEN: Record<string, string> = {
  website: "Website",
  telefoon: "Telefoon",
  doorverwijzing: "Doorverwijzing",
  walk_in: "Walk-in",
  social: "Social media",
  marktplaats: "Marktplaats",
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  nieuw:         { label: "Nieuw",          color: "#b45309", bg: "#fef3c7" },
  contact_gehad: { label: "Contact gehad",  color: "#1d4ed8", bg: "#dbeafe" },
  afspraak:      { label: "Afspraak",       color: "#7c3aed", bg: "#ede9fe" },
  deal:          { label: "Deal gesloten",  color: "#15803d", bg: "#dcfce7" },
  verloren:      { label: "Verloren",       color: "#b91c1c", bg: "#fee2e2" },
};

const S = {
  label: { color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" } as React.CSSProperties,
  veld: { border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", backgroundColor: "#fafafa" } as React.CSSProperties,
};

type LeegForm = Omit<Lead, "id" | "aangemaakt">;

const LEEG: LeegForm = { naam: "", telefoon: "", email: "", bron: "website", interesse: "", budget: "", notitie: "", status: "nieuw" };

export default function LeadsContent() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toonNieuw, setToonNieuw] = useState(false);
  const [form, setForm] = useState<LeegForm>(LEEG);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("alle");

  const laad = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/leads");
    if (res.ok) setLeads(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { laad(); }, [laad]);

  const maakAan = async () => {
    if (!form.naam.trim() && !form.telefoon.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) {
      const l: Lead = await res.json();
      setLeads((p) => [l, ...p]);
      setForm(LEEG);
      setToonNieuw(false);
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setLeads((p) => p.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  const updateNotitie = async (id: string, notitie: string) => {
    await fetch(`/api/admin/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notitie }) });
    setLeads((p) => p.map((l) => (l.id === id ? { ...l, notitie } : l)));
  };

  const verwijder = async (id: string) => {
    if (!confirm("Lead verwijderen?")) return;
    await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
    setLeads((p) => p.filter((l) => l.id !== id));
    if (openId === id) setOpenId(null);
  };

  const gefilterd = filterStatus === "alle" ? leads : leads.filter((l) => l.status === filterStatus);
  const nieuwLeads = leads.filter((l) => l.status === "nieuw").length;

  return (
    <div>
      <div className="px-4 md:px-8 py-4 md:py-5 flex items-center justify-between sticky top-0 z-10" style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}>
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Lead Tracker</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
            {leads.length} leads{nieuwLeads > 0 ? ` · ${nieuwLeads} nieuw` : ""}
          </p>
        </div>
        <button onClick={() => setToonNieuw((v) => !v)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90" style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
          <Plus size={14} /> Nieuwe lead
        </button>
      </div>

      <div className="p-4 md:p-8">
        {toonNieuw && (
          <div className="mb-6" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={S.label}>Nieuwe lead</p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { label: "Naam", field: "naam" as const },
                { label: "Telefoon", field: "telefoon" as const },
                { label: "E-mail", field: "email" as const },
                { label: "Interesse (auto)", field: "interesse" as const },
                { label: "Budget (€)", field: "budget" as const },
              ]).map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>{label}</label>
                  <input type="text" value={form[field]} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={S.veld} />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Bron</label>
                <select value={form.bron} onChange={(e) => setForm((p) => ({ ...p, bron: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={S.veld}>
                  {Object.entries(BRONNEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Notitie</label>
                <textarea value={form.notitie} onChange={(e) => setForm((p) => ({ ...p, notitie: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm outline-none resize-none" style={{ ...S.veld, lineHeight: 1.6 }} />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={maakAan} disabled={saving || (!form.naam.trim() && !form.telefoon.trim())} className="px-6 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
                {saving ? "Opslaan..." : "Lead toevoegen"}
              </button>
              <button onClick={() => setToonNieuw(false)} className="px-4 py-2.5 text-sm" style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}>Annuleer</button>
            </div>
          </div>
        )}

        {/* Pipeline stats */}
        {leads.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-5">
            {Object.entries(STATUS_LABELS).map(([key, val]) => {
              const count = leads.filter(l => l.status === key).length;
              return (
                <button key={key} onClick={() => setFilterStatus(filterStatus === key ? "alle" : key)}
                  className="flex flex-col items-center py-3 transition-all"
                  style={{ backgroundColor: filterStatus === key ? val.bg : "#ffffff", border: `1px solid ${filterStatus === key ? val.color : "rgba(0,19,55,0.07)"}` }}>
                  <p className="text-xl font-bold" style={{ color: filterStatus === key ? val.color : "#001337", fontFamily: "var(--font-playfair)" }}>{count}</p>
                  <p className="text-[10px] text-center leading-snug mt-0.5 px-1" style={{ color: filterStatus === key ? val.color : "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{val.label}</p>
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24"><div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} /></div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <Target size={40} style={{ color: "rgba(0,19,55,0.1)" }} />
            <p className="text-lg font-bold mt-5 mb-2" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Geen leads</p>
            <p className="text-sm" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Voeg leads toe en houd bij in welke fase ze zitten.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {gefilterd.map((l) => {
              const sl = STATUS_LABELS[l.status] ?? STATUS_LABELS.nieuw;
              const isOpen = openId === l.id;
              return (
                <div key={l.id} style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                  <button onClick={() => setOpenId(isOpen ? null : l.id)} className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all hover:bg-gray-50">
                    <div className="flex-shrink-0 flex items-center justify-center text-sm font-bold" style={{ width: 36, height: 36, backgroundColor: sl.bg, color: sl.color, fontFamily: "var(--font-playfair)" }}>
                      {(l.naam || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>{l.naam || "Naamloos"}</p>
                        <span className="text-[10px] px-1.5 py-0.5 font-semibold" style={{ backgroundColor: sl.bg, color: sl.color, fontFamily: "var(--font-inter)" }}>{sl.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5" style={{ backgroundColor: "rgba(0,19,55,0.05)", color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>{BRONNEN[l.bron] ?? l.bron}</span>
                      </div>
                      <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                        {[l.telefoon, l.email, l.interesse ? `Interesse: ${l.interesse}` : "", l.budget ? `Budget: €${l.budget}` : ""].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <p className="text-[10px] flex-shrink-0 mr-2" style={{ color: "rgba(0,19,55,0.3)", fontFamily: "var(--font-inter)" }}>
                      {new Date(l.aangemaakt).toLocaleDateString("nl-NL")}
                    </p>
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
                                ["Naam", l.naam],
                                ["Telefoon", l.telefoon],
                                ["E-mail", l.email],
                                ["Bron", BRONNEN[l.bron] ?? l.bron],
                                ["Interesse", l.interesse],
                                ["Budget", l.budget ? `€${l.budget}` : ""],
                              ].filter(([, v]) => v).map(([lbl, v]) => (
                                <tr key={lbl}><td className="py-0.5 pr-3" style={{ color: "rgba(0,19,55,0.45)", width: 80 }}>{lbl}</td><td className="py-0.5 font-semibold" style={{ color: "#001337" }}>{v}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Pipeline status</p>
                          <div className="flex flex-col gap-1.5 mb-3">
                            {Object.entries(STATUS_LABELS).map(([key, val]) => (
                              <button key={key} onClick={() => updateStatus(l.id, key)}
                                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-left transition-all"
                                style={{ backgroundColor: l.status === key ? val.bg : "transparent", color: l.status === key ? val.color : "rgba(0,19,55,0.4)", border: `1px solid ${l.status === key ? val.color : "rgba(0,19,55,0.1)"}`, fontFamily: "var(--font-inter)" }}>
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: val.color }} />
                                {val.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Notitie</p>
                          <textarea defaultValue={l.notitie} rows={3} onBlur={(e) => { if (e.target.value !== l.notitie) updateNotitie(l.id, e.target.value); }} placeholder="Opvolging, afspraken..." className="w-full px-3 py-2 text-xs outline-none resize-none" style={{ ...S.veld, lineHeight: 1.6 }} />
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex gap-2">
                              {l.email && <a href={`mailto:${l.email}`} className="px-4 py-2 text-xs font-semibold" style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>Mail</a>}
                              {l.telefoon && <a href={`tel:${l.telefoon}`} className="px-4 py-2 text-xs font-semibold" style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}>Bel</a>}
                            </div>
                            <button onClick={() => verwijder(l.id)} className="flex items-center gap-1.5 text-xs transition-all hover:opacity-70" style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>
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

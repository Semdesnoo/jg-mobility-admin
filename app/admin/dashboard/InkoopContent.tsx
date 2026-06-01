"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, TrendingDown, ChevronDown, ChevronUp, Trash2 } from "lucide-react";

type InkoopDossier = {
  id: string;
  datum: string;
  merk: string;
  model: string;
  bouwjaar: string;
  km: string;
  kenteken: string;
  kleur: string;
  vin: string;
  aanbod_prijs: number;
  bod_prijs: number;
  aankoopprijs: number;
  naam: string;
  telefoon: string;
  email: string;
  status: string;
  notitie: string;
  aangemaakt: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  nieuw:            { label: "Nieuw",             color: "#b45309", bg: "#fef3c7" },
  in_onderhandeling:{ label: "In onderhandeling", color: "#1d4ed8", bg: "#dbeafe" },
  akkoord:          { label: "Akkoord",           color: "#15803d", bg: "#dcfce7" },
  afgewezen:        { label: "Afgewezen",         color: "#b91c1c", bg: "#fee2e2" },
};

const S = {
  label: { color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" } as React.CSSProperties,
  veld: { border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", backgroundColor: "#fafafa" } as React.CSSProperties,
};

type LeegForm = Omit<InkoopDossier, "id" | "aangemaakt" | "aanbod_prijs" | "bod_prijs" | "aankoopprijs"> & {
  aanbod_prijs: string; bod_prijs: string; aankoopprijs: string;
};

function maakLeeg(): LeegForm {
  return {
    datum: new Date().toLocaleDateString("nl-NL"),
    merk: "", model: "", bouwjaar: "", km: "", kenteken: "", kleur: "", vin: "",
    aanbod_prijs: "", bod_prijs: "", aankoopprijs: "",
    naam: "", telefoon: "", email: "",
    status: "nieuw", notitie: "",
  };
}

export default function InkoopContent() {
  const [dossiers, setDossiers] = useState<InkoopDossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toonNieuw, setToonNieuw] = useState(false);
  const [form, setForm] = useState<LeegForm>(maakLeeg);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("alle");
  const [rdwLaden, setRdwLaden] = useState(false);

  const laad = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/inkoop");
    if (res.ok) setDossiers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { laad(); }, [laad]);

  const rdwOpzoeken = async (kenteken: string) => {
    if (!kenteken.trim()) return;
    setRdwLaden(true);
    const res = await fetch(`/api/admin/rdw-lookup?kenteken=${encodeURIComponent(kenteken)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.merk) setForm((p) => ({ ...p, merk: data.merk ?? p.merk, model: data.handelsbenaming ?? p.model, bouwjaar: data.datum_eerste_toelating?.slice(0, 4) ?? p.bouwjaar, kleur: data.eerste_kleur ?? p.kleur }));
    }
    setRdwLaden(false);
  };

  const maakAan = async () => {
    if (!form.merk.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/inkoop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        aanbod_prijs: parseInt(form.aanbod_prijs) || 0,
        bod_prijs: parseInt(form.bod_prijs) || 0,
        aankoopprijs: parseInt(form.aankoopprijs) || 0,
      }),
    });
    if (res.ok) {
      const d: InkoopDossier = await res.json();
      setDossiers((p) => [d, ...p]);
      setForm(maakLeeg());
      setToonNieuw(false);
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/inkoop/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setDossiers((p) => p.map((d) => (d.id === id ? { ...d, status } : d)));
  };

  const updateNotitie = async (id: string, notitie: string) => {
    await fetch(`/api/admin/inkoop/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notitie }) });
    setDossiers((p) => p.map((d) => (d.id === id ? { ...d, notitie } : d)));
  };

  const verwijder = async (id: string) => {
    if (!confirm("Dossier verwijderen?")) return;
    await fetch(`/api/admin/inkoop/${id}`, { method: "DELETE" });
    setDossiers((p) => p.filter((d) => d.id !== id));
    if (openId === id) setOpenId(null);
  };

  const gefilterd = filterStatus === "alle" ? dossiers : dossiers.filter((d) => d.status === filterStatus);

  const f = (v: string | number) => String(v);

  return (
    <div>
      <div className="px-4 md:px-8 py-4 md:py-5 flex items-center justify-between sticky top-0 z-10" style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}>
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Inkoop & Taxatie</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
            {dossiers.length} dossiers · {dossiers.filter(d => d.status === "nieuw").length} nieuw
          </p>
        </div>
        <button onClick={() => setToonNieuw((v) => !v)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90" style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
          <Plus size={14} /> Nieuw dossier
        </button>
      </div>

      <div className="p-4 md:p-8">
        {toonNieuw && (
          <div className="mb-6" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={S.label}>Nieuw inkoop dossier</p>
            </div>
            <div className="p-5">
              {/* Kenteken lookup */}
              <div className="flex gap-2 mb-5">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Kenteken (auto-invullen)</label>
                  <input type="text" value={form.kenteken} onChange={(e) => setForm((p) => ({ ...p, kenteken: e.target.value.toUpperCase() }))} onBlur={(e) => rdwOpzoeken(e.target.value)} placeholder="bijv. AB-123-C" className="w-full px-3 py-2 text-sm outline-none" style={S.veld} />
                </div>
                {rdwLaden && <div className="self-end mb-2 w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { label: "Merk *", field: "merk" as const },
                  { label: "Model", field: "model" as const },
                  { label: "Bouwjaar", field: "bouwjaar" as const },
                  { label: "Kilometerstand", field: "km" as const },
                  { label: "Kleur", field: "kleur" as const },
                  { label: "VIN", field: "vin" as const },
                  { label: "Aanbodprijs (€)", field: "aanbod_prijs" as const },
                  { label: "Bod (€)", field: "bod_prijs" as const },
                  { label: "Aankoopprijs (€)", field: "aankoopprijs" as const },
                  { label: "Naam verkoper", field: "naam" as const },
                  { label: "Telefoon", field: "telefoon" as const },
                  { label: "E-mail", field: "email" as const },
                ]).map(({ label, field }) => (
                  <div key={field}>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>{label}</label>
                    <input type="text" value={f(form[field])} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={S.veld} />
                  </div>
                ))}
                <div style={{ gridColumn: "span 2" }}>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Notitie</label>
                  <textarea value={form.notitie} onChange={(e) => setForm((p) => ({ ...p, notitie: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm outline-none resize-none" style={{ ...S.veld, lineHeight: 1.6 }} />
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={maakAan} disabled={saving || !form.merk.trim()} className="px-6 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
                {saving ? "Opslaan..." : "Dossier aanmaken"}
              </button>
              <button onClick={() => setToonNieuw(false)} className="px-4 py-2.5 text-sm" style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}>Annuleer</button>
            </div>
          </div>
        )}

        {dossiers.length > 0 && (
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {(["alle", ...Object.keys(STATUS_LABELS)] as const).map((s) => {
              const count = s === "alle" ? dossiers.length : dossiers.filter(d => d.status === s).length;
              return (
                <button key={s} onClick={() => setFilterStatus(s)} className="px-3 py-1.5 text-xs font-semibold transition-all"
                  style={{ backgroundColor: filterStatus === s ? "#001337" : "transparent", color: filterStatus === s ? "#ffffff" : "rgba(0,19,55,0.4)", border: `1px solid ${filterStatus === s ? "#001337" : "rgba(0,19,55,0.12)"}`, fontFamily: "var(--font-inter)" }}>
                  {s === "alle" ? "Alle" : STATUS_LABELS[s].label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24"><div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} /></div>
        ) : dossiers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <TrendingDown size={40} style={{ color: "rgba(0,19,55,0.1)" }} />
            <p className="text-lg font-bold mt-5 mb-2" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Geen inkoop dossiers</p>
            <p className="text-sm" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Maak een dossier aan voor elke taxatie of inkoopaanvraag.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {gefilterd.map((d) => {
              const sl = STATUS_LABELS[d.status] ?? STATUS_LABELS.nieuw;
              const isOpen = openId === d.id;
              return (
                <div key={d.id} style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                  <button onClick={() => setOpenId(isOpen ? null : d.id)} className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>{d.merk} {d.model} {d.bouwjaar && <span style={{ fontWeight: 400, color: "rgba(0,19,55,0.5)" }}>{d.bouwjaar}</span>}</p>
                        <span className="text-[10px] px-1.5 py-0.5 font-semibold" style={{ backgroundColor: sl.bg, color: sl.color, fontFamily: "var(--font-inter)" }}>{sl.label}</span>
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
                          <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Voertuig & Verkoper</p>
                          <table className="text-xs w-full" style={{ fontFamily: "var(--font-inter)" }}>
                            <tbody>
                              {[
                                ["Auto", `${d.merk} ${d.model} ${d.bouwjaar}`.trim()],
                                ["Kenteken", d.kenteken],
                                ["Km-stand", d.km ? `${parseInt(d.km).toLocaleString("nl-NL")} km` : ""],
                                ["Kleur", d.kleur],
                                ["VIN", d.vin],
                                ["Aanbodprijs", d.aanbod_prijs > 0 ? `€${d.aanbod_prijs.toLocaleString("nl-NL")}` : ""],
                                ["Bod", d.bod_prijs > 0 ? `€${d.bod_prijs.toLocaleString("nl-NL")}` : ""],
                                ["Aankoopprijs", d.aankoopprijs > 0 ? `€${d.aankoopprijs.toLocaleString("nl-NL")}` : ""],
                                ["Verkoper", d.naam],
                                ["Telefoon", d.telefoon],
                                ["E-mail", d.email],
                              ].filter(([, v]) => v).map(([l, v]) => (
                                <tr key={l}><td className="py-0.5 pr-3" style={{ color: "rgba(0,19,55,0.45)", width: 90 }}>{l}</td><td className="py-0.5 font-semibold" style={{ color: "#001337" }}>{v}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Status</p>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {Object.entries(STATUS_LABELS).map(([key, val]) => (
                              <button key={key} onClick={() => updateStatus(d.id, key)} className="px-3 py-1 text-xs font-semibold transition-all"
                                style={{ backgroundColor: d.status === key ? val.bg : "transparent", color: d.status === key ? val.color : "rgba(0,19,55,0.4)", border: `1px solid ${d.status === key ? val.color : "rgba(0,19,55,0.15)"}`, fontFamily: "var(--font-inter)" }}>
                                {val.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Notitie</p>
                          <textarea defaultValue={d.notitie} rows={3} onBlur={(e) => { if (e.target.value !== d.notitie) updateNotitie(d.id, e.target.value); }} placeholder="Interne notitie..." className="w-full px-3 py-2 text-xs outline-none resize-none" style={{ ...S.veld, lineHeight: 1.6 }} />
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex gap-2">
                              {d.email && <a href={`mailto:${d.email}`} className="px-4 py-2 text-xs font-semibold" style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>Mail</a>}
                              {d.telefoon && <a href={`tel:${d.telefoon}`} className="px-4 py-2 text-xs font-semibold" style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}>Bel</a>}
                            </div>
                            <button onClick={() => verwijder(d.id)} className="flex items-center gap-1.5 text-xs transition-all hover:opacity-70" style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>
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

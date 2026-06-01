"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Handshake, ChevronDown, ChevronUp, Trash2, RefreshCw, Send, ExternalLink } from "lucide-react";

type Cosignatie = {
  id: string;
  datum: string;
  tijd: string;
  naam: string;
  email: string;
  telefoon: string;
  merk: string;
  model: string;
  bouwjaar: string;
  km: string;
  vraagprijs: string;
  opmerking: string;
  aantal_fotos: number;
  status: string;
  notitie: string;
  platform_prijzen?: Record<string, string> | null;
  geaccepteerd_op?: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  nieuw:          { label: "Nieuw",          color: "#b45309", bg: "#fef3c7" },
  in_behandeling: { label: "In behandeling", color: "#1d4ed8", bg: "#dbeafe" },
  geaccepteerd:   { label: "Geaccepteerd",   color: "#15803d", bg: "#dcfce7" },
  afgewezen:      { label: "Afgewezen",      color: "#b91c1c", bg: "#fee2e2" },
};

const PLATFORMS: Record<string, string> = {
  marktplaats: "Marktplaats.nl",
  nederlandmobiel: "NederlandMobiel.nl",
  autoscout24: "AutoScout24.nl",
};

const S = {
  label: { color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" } as React.CSSProperties,
  veld: { border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", backgroundColor: "#fafafa" } as React.CSSProperties,
};

type LeegForm = {
  naam: string; email: string; telefoon: string;
  merk: string; model: string; bouwjaar: string; km: string;
  vraagprijs: string; opmerking: string;
};

const LEEG: LeegForm = {
  naam: "", email: "", telefoon: "",
  merk: "", model: "", bouwjaar: "", km: "",
  vraagprijs: "", opmerking: "",
};

export default function CosignatieContent() {
  const [aanvragen, setAanvragen] = useState<Cosignatie[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toonNieuw, setToonNieuw] = useState(false);
  const [form, setForm] = useState<LeegForm>(LEEG);
  const [saving, setSaving] = useState(false);
  const [prijzenLaden, setPrijzenLaden] = useState<Record<string, boolean>>({});
  const [updateLaden, setUpdateLaden] = useState<Record<string, boolean>>({});
  const [updateOk, setUpdateOk] = useState<Record<string, boolean>>({});
  const [filterStatus, setFilterStatus] = useState<string>("alle");
  const [rdwLaden, setRdwLaden] = useState(false);

  const laad = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/cosignaties");
    if (res.ok) setAanvragen(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { laad(); }, [laad]);

  const rdwOpzoeken = async (kenteken: string) => {
    if (!kenteken.trim()) return;
    setRdwLaden(true);
    const res = await fetch(`/api/admin/rdw-lookup?kenteken=${encodeURIComponent(kenteken)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.merk) setForm((p) => ({
        ...p,
        merk: data.merk ?? p.merk,
        model: data.handelsbenaming ?? p.model,
        bouwjaar: data.datum_eerste_toelating?.slice(0, 4) ?? p.bouwjaar,
      }));
    }
    setRdwLaden(false);
  };

  const maakAan = async () => {
    if (!form.merk.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/cosignaties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      await laad();
      setForm(LEEG);
      setToonNieuw(false);
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/cosignaties/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setAanvragen((p) => p.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  const updateNotitie = async (id: string, notitie: string) => {
    await fetch(`/api/admin/cosignaties/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notitie }),
    });
    setAanvragen((p) => p.map((a) => (a.id === id ? { ...a, notitie } : a)));
  };

  const haalMarktprijzen = async (id: string) => {
    setPrijzenLaden((p) => ({ ...p, [id]: true }));
    const res = await fetch(`/api/admin/cosignaties/${id}/zoek-prijzen`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setAanvragen((p) => p.map((a) => (a.id === id ? { ...a, platform_prijzen: data.platform_prijzen } : a)));
    }
    setPrijzenLaden((p) => ({ ...p, [id]: false }));
  };

  const verstuurUpdate = async (id: string) => {
    setUpdateLaden((p) => ({ ...p, [id]: true }));
    const res = await fetch(`/api/admin/cosignaties/${id}/verstuur-update`, { method: "POST" });
    if (res.ok) {
      setUpdateOk((p) => ({ ...p, [id]: true }));
      setTimeout(() => setUpdateOk((p) => ({ ...p, [id]: false })), 3000);
      await laad();
    }
    setUpdateLaden((p) => ({ ...p, [id]: false }));
  };

  const verwijder = async (id: string) => {
    if (!confirm("Aanvraag verwijderen?")) return;
    await fetch(`/api/admin/cosignaties/${id}`, { method: "DELETE" });
    setAanvragen((p) => p.filter((a) => a.id !== id));
    if (openId === id) setOpenId(null);
  };

  const gefilterd = filterStatus === "alle" ? aanvragen : aanvragen.filter((a) => a.status === filterStatus);
  const nieuweAanvragen = aanvragen.filter((a) => a.status === "nieuw").length;

  const dagsSinds = (datum: string | undefined) => {
    if (!datum) return null;
    const d = new Date(datum);
    const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div>
      <div className="px-4 md:px-8 py-4 md:py-5 flex items-center justify-between sticky top-0 z-10"
        style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}>
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Cosignatie</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
            {aanvragen.length} aanvragen{nieuweAanvragen > 0 ? ` · ${nieuweAanvragen} nieuw` : ""}
          </p>
        </div>
        <button type="button" onClick={() => setToonNieuw((v) => !v)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
          <Plus size={14} /> Klant toevoegen
        </button>
      </div>

      <div className="p-4 md:p-8">
        {/* Nieuw formulier */}
        {toonNieuw && (
          <div className="mb-6" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={S.label}>Nieuwe cosignatie klant</p>
            </div>
            <div className="p-5">
              {/* Kenteken lookup */}
              <div className="flex gap-2 mb-5 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>
                    Kenteken (auto-invullen)
                  </label>
                  <input type="text" placeholder="bijv. AB-123-C"
                    onBlur={(e) => rdwOpzoeken(e.target.value)}
                    className="w-full px-3 py-2 text-sm outline-none" style={S.veld} />
                </div>
                {rdwLaden && <div className="mb-2 w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { label: "Naam klant *", field: "naam" as const },
                  { label: "E-mail", field: "email" as const },
                  { label: "Telefoon", field: "telefoon" as const },
                  { label: "Merk *", field: "merk" as const },
                  { label: "Model", field: "model" as const },
                  { label: "Bouwjaar", field: "bouwjaar" as const },
                  { label: "Kilometerstand", field: "km" as const },
                  { label: "Vraagprijs (€)", field: "vraagprijs" as const },
                ]).map(({ label, field }) => (
                  <div key={field}>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>{label}</label>
                    <input type="text" value={form[field]}
                      onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                      className="w-full px-3 py-2 text-sm outline-none" style={S.veld} />
                  </div>
                ))}
                <div style={{ gridColumn: "span 2" }}>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Opmerking</label>
                  <textarea value={form.opmerking} rows={2}
                    onChange={(e) => setForm((p) => ({ ...p, opmerking: e.target.value }))}
                    className="w-full px-3 py-2 text-sm outline-none resize-none" style={{ ...S.veld, lineHeight: 1.6 }} />
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button type="button" onClick={maakAan} disabled={saving || !form.merk.trim()}
                className="px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
                {saving ? "Opslaan..." : "Klant toevoegen"}
              </button>
              <button type="button" onClick={() => { setToonNieuw(false); setForm(LEEG); }}
                className="px-4 py-2.5 text-sm"
                style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}>
                Annuleer
              </button>
            </div>
          </div>
        )}

        {/* Status filter */}
        {aanvragen.length > 0 && (
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {(["alle", ...Object.keys(STATUS_LABELS)] as const).map((s) => {
              const count = s === "alle" ? aanvragen.length : aanvragen.filter((a) => a.status === s).length;
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
        ) : aanvragen.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28"
            style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <Handshake size={40} style={{ color: "rgba(0,19,55,0.1)" }} />
            <p className="text-lg font-bold mt-5 mb-2" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
              Nog geen aanvragen
            </p>
            <p className="text-sm" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
              Voeg een klant handmatig toe of wacht op aanvragen via de website.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {gefilterd.map((a) => {
              const sl = STATUS_LABELS[a.status] ?? STATUS_LABELS.nieuw;
              const isOpen = openId === a.id;
              const dagen = dagsSinds(a.geaccepteerd_op);
              let prijzen: Record<string, string> = {};
              try { prijzen = typeof a.platform_prijzen === "string" ? JSON.parse(a.platform_prijzen) : (a.platform_prijzen ?? {}); } catch { /* */ }

              return (
                <div key={a.id} style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                  <button type="button" onClick={() => setOpenId(isOpen ? null : a.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                          {a.merk} {a.model}{" "}
                          <span style={{ fontWeight: 400, color: "rgba(0,19,55,0.5)" }}>{a.bouwjaar}</span>
                        </p>
                        <span className="text-[10px] px-1.5 py-0.5 font-semibold"
                          style={{ backgroundColor: sl.bg, color: sl.color, fontFamily: "var(--font-inter)" }}>
                          {sl.label}
                        </span>
                        {dagen !== null && (
                          <span className="text-[10px] px-1.5 py-0.5"
                            style={{ backgroundColor: "rgba(0,19,55,0.05)", color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                            {dagen} dag{dagen !== 1 ? "en" : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                        {a.naam}{a.email ? ` · ${a.email}` : ""}{a.telefoon ? ` · ${a.telefoon}` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {a.vraagprijs && (
                        <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                          €{parseInt(a.vraagprijs).toLocaleString("nl-NL")}
                        </p>
                      )}
                      <p className="text-[10px]" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                        {a.datum}{a.aantal_fotos > 0 ? ` · ${a.aantal_fotos} foto's` : ""}
                      </p>
                    </div>
                    {isOpen
                      ? <ChevronUp size={14} style={{ color: "rgba(0,19,55,0.3)", flexShrink: 0 }} />
                      : <ChevronDown size={14} style={{ color: "rgba(0,19,55,0.3)", flexShrink: 0 }} />}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5" style={{ borderTop: "1px solid rgba(0,19,55,0.06)" }}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                        {/* Links: auto + marktprijzen */}
                        <div>
                          <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Auto & klant</p>
                          <table className="w-full text-xs mb-4" style={{ fontFamily: "var(--font-inter)" }}>
                            <tbody>
                              {[
                                ["Auto", `${a.merk} ${a.model} ${a.bouwjaar}`.trim()],
                                ["Km-stand", a.km ? `${parseInt(a.km).toLocaleString("nl-NL")} km` : ""],
                                ["Vraagprijs", a.vraagprijs ? `€ ${parseInt(a.vraagprijs).toLocaleString("nl-NL")}` : ""],
                                ["Klant", a.naam],
                                ["E-mail", a.email],
                                ["Telefoon", a.telefoon],
                                ["In consignatie", dagen !== null ? `${dagen} dag${dagen !== 1 ? "en" : ""}` : ""],
                              ].filter(([, v]) => v).map(([l, v]) => (
                                <tr key={l}>
                                  <td className="py-0.5 pr-3" style={{ color: "rgba(0,19,55,0.45)", width: 100 }}>{l}</td>
                                  <td className="py-0.5 font-semibold" style={{ color: "#001337" }}>{v}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {/* Marktprijzen */}
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                              Marktprijzen online
                            </p>
                            <button type="button" onClick={() => haalMarktprijzen(a.id)}
                              disabled={prijzenLaden[a.id]}
                              className="flex items-center gap-1 text-[10px] px-2 py-1 transition-all hover:opacity-70 disabled:opacity-40"
                              style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}>
                              <RefreshCw size={9} className={prijzenLaden[a.id] ? "animate-spin" : ""} />
                              {prijzenLaden[a.id] ? "Zoeken..." : "Ophalen"}
                            </button>
                          </div>
                          {Object.keys(prijzen).length > 0 ? (
                            <div style={{ backgroundColor: "rgba(0,19,55,0.02)", border: "1px solid rgba(0,19,55,0.07)", padding: "10px 12px" }}>
                              {Object.entries(prijzen).map(([platform, prijs]) => (
                                <div key={platform} className="flex items-center justify-between py-1">
                                  <div className="flex items-center gap-1.5">
                                    <ExternalLink size={9} style={{ color: "rgba(0,19,55,0.3)" }} />
                                    <span className="text-xs" style={{ color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)" }}>
                                      {PLATFORMS[platform] ?? platform}
                                    </span>
                                  </div>
                                  <span className="text-xs font-bold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                                    € {parseInt(prijs).toLocaleString("nl-NL")}
                                  </span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: "1px solid rgba(0,19,55,0.07)" }}>
                                <span className="text-[10px]" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Gemiddeld</span>
                                <span className="text-xs font-bold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                                  € {Math.round(Object.values(prijzen).reduce((s, p) => s + parseInt(p), 0) / Object.values(prijzen).length).toLocaleString("nl-NL")}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                              Nog niet opgehaald — klik op &quot;Ophalen&quot; om actuele marktprijzen te zoeken.
                            </p>
                          )}

                          {a.opmerking && (
                            <div className="mt-4 p-3 text-xs" style={{ backgroundColor: "rgba(0,19,55,0.03)", border: "1px solid rgba(0,19,55,0.07)", color: "rgba(0,19,55,0.65)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
                              {a.opmerking}
                            </div>
                          )}
                        </div>

                        {/* Rechts: status + acties */}
                        <div>
                          <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Status</p>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {Object.entries(STATUS_LABELS).map(([key, val]) => (
                              <button type="button" key={key} onClick={() => updateStatus(a.id, key)}
                                className="px-3 py-1 text-xs font-semibold transition-all"
                                style={{
                                  backgroundColor: a.status === key ? val.bg : "transparent",
                                  color: a.status === key ? val.color : "rgba(0,19,55,0.4)",
                                  border: `1px solid ${a.status === key ? val.color : "rgba(0,19,55,0.15)"}`,
                                  fontFamily: "var(--font-inter)",
                                }}>
                                {val.label}
                              </button>
                            ))}
                          </div>

                          <p className="text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Interne notitie</p>
                          <textarea defaultValue={a.notitie} rows={4}
                            onBlur={(e) => { if (e.target.value !== a.notitie) updateNotitie(a.id, e.target.value); }}
                            placeholder="Intern bijhouden wat er besproken is..."
                            className="w-full px-3 py-2 text-xs outline-none resize-none mb-4"
                            style={{ ...S.veld, lineHeight: 1.6 }} />

                          <div className="flex flex-col gap-2">
                            {/* Wekelijkse update */}
                            {a.email && (
                              <button type="button" onClick={() => verstuurUpdate(a.id)}
                                disabled={updateLaden[a.id]}
                                className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                                style={{ backgroundColor: updateOk[a.id] ? "#15803d" : "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
                                <Send size={12} />
                                {updateLaden[a.id] ? "Versturen..." : updateOk[a.id] ? "✓ Update verstuurd!" : "Stuur wekelijkse update"}
                              </button>
                            )}

                            <div className="flex gap-2">
                              {a.email && (
                                <a href={`mailto:${a.email}`} className="flex-1 flex items-center justify-center py-2 text-xs font-semibold transition-all hover:opacity-80"
                                  style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}>
                                  Mail klant
                                </a>
                              )}
                              {a.telefoon && (
                                <a href={`tel:${a.telefoon}`} className="flex-1 flex items-center justify-center py-2 text-xs font-semibold transition-all hover:opacity-80"
                                  style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}>
                                  Bel klant
                                </a>
                              )}
                            </div>
                            <button type="button" onClick={() => verwijder(a.id)}
                              className="text-xs py-1.5 transition-all hover:opacity-70 text-center"
                              style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>
                              <Trash2 size={11} className="inline mr-1" /> Verwijder aanvraag
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

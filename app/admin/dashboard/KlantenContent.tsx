"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Users, Trash2, ChevronDown, ChevronUp } from "lucide-react";

type Klant = {
  id: string;
  naam: string;
  email: string;
  telefoon: string;
  adres: string;
  stad: string;
  notitie: string;
  aangemaakt: string;
};

type LeegForm = Omit<Klant, "id" | "aangemaakt">;

const LEEG: LeegForm = { naam: "", email: "", telefoon: "", adres: "", stad: "", notitie: "" };

const S = {
  label: { color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" } as React.CSSProperties,
  veld: { border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", backgroundColor: "#fafafa" } as React.CSSProperties,
};

export default function KlantenContent() {
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toonNieuw, setToonNieuw] = useState(false);
  const [form, setForm] = useState<LeegForm>(LEEG);
  const [saving, setSaving] = useState(false);
  const [zoek, setZoek] = useState("");

  const laad = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/klanten");
    if (res.ok) setKlanten(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { laad(); }, [laad]);

  const maakAan = async () => {
    if (!form.naam.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/klanten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const k: Klant = await res.json();
      setKlanten((p) => [k, ...p]);
      setForm(LEEG);
      setToonNieuw(false);
    }
    setSaving(false);
  };

  const patch = async (id: string, data: Partial<LeegForm>) => {
    await fetch(`/api/admin/klanten/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setKlanten((p) => p.map((k) => (k.id === id ? { ...k, ...data } : k)));
  };

  const verwijder = async (id: string) => {
    if (!confirm("Klant verwijderen?")) return;
    await fetch(`/api/admin/klanten/${id}`, { method: "DELETE" });
    setKlanten((p) => p.filter((k) => k.id !== id));
    if (openId === id) setOpenId(null);
  };

  const gefilterd = klanten.filter((k) => {
    if (!zoek) return true;
    const q = zoek.toLowerCase();
    return k.naam.toLowerCase().includes(q) || k.email.toLowerCase().includes(q) || k.telefoon.includes(q);
  });

  return (
    <div>
      {/* Header */}
      <div
        className="px-4 md:px-8 py-4 md:py-5 flex items-center justify-between sticky top-0 z-10"
        style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}
      >
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
            Klantenbeheer
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
            {klanten.length} klanten
          </p>
        </div>
        <button
          onClick={() => setToonNieuw((v) => !v)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
        >
          <Plus size={14} /> Nieuwe klant
        </button>
      </div>

      <div className="p-4 md:p-8">
        {/* Nieuw formulier */}
        {toonNieuw && (
          <div className="mb-6" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={S.label}>Nieuwe klant</p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { label: "Volledige naam *", field: "naam" as const, col: 2 },
                { label: "E-mailadres", field: "email" as const },
                { label: "Telefoonnummer", field: "telefoon" as const },
                { label: "Adres", field: "adres" as const },
                { label: "Stad", field: "stad" as const },
              ]).map(({ label, field, col }) => (
                <div key={field} style={{ gridColumn: col ? `span ${col}` : undefined }}>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>{label}</label>
                  <input
                    type="text"
                    value={form[field]}
                    onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm outline-none"
                    style={S.veld}
                  />
                </div>
              ))}
              <div style={{ gridColumn: "span 2" }}>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Notitie</label>
                <textarea
                  value={form.notitie}
                  onChange={(e) => setForm((p) => ({ ...p, notitie: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-sm outline-none resize-none"
                  style={{ ...S.veld, lineHeight: 1.6 }}
                />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={maakAan}
                disabled={saving || !form.naam.trim()}
                className="px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
              >
                {saving ? "Opslaan..." : "Klant toevoegen"}
              </button>
              <button
                onClick={() => { setToonNieuw(false); setForm(LEEG); }}
                className="px-4 py-2.5 text-sm"
                style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
              >
                Annuleer
              </button>
            </div>
          </div>
        )}

        {/* Zoekbalk */}
        {klanten.length > 0 && (
          <div className="mb-4">
            <input
              type="text"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek op naam, e-mail of telefoon..."
              className="w-full max-w-sm px-3 py-2 text-sm outline-none"
              style={S.veld}
            />
          </div>
        )}

        {/* Lijst */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />
          </div>
        ) : klanten.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <Users size={40} style={{ color: "rgba(0,19,55,0.1)" }} />
            <p className="text-lg font-bold mt-5 mb-2" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Nog geen klanten</p>
            <p className="text-sm" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Voeg de eerste klant toe via de knop rechtsboven.</p>
          </div>
        ) : gefilterd.length === 0 ? (
          <div className="flex items-center justify-center py-16" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <p className="text-sm" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Geen klanten gevonden voor &quot;{zoek}&quot;</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {gefilterd.map((k) => {
              const isOpen = openId === k.id;
              return (
                <div key={k.id} style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                  <button
                    onClick={() => setOpenId(isOpen ? null : k.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all hover:bg-gray-50"
                  >
                    <div
                      className="flex-shrink-0 flex items-center justify-center text-sm font-bold"
                      style={{ width: 36, height: 36, backgroundColor: "rgba(0,19,55,0.06)", color: "#001337", fontFamily: "var(--font-playfair)" }}
                    >
                      {k.naam.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>{k.naam}</p>
                      <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                        {[k.email, k.telefoon, k.stad].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <p className="text-[10px] flex-shrink-0 mr-2" style={{ color: "rgba(0,19,55,0.3)", fontFamily: "var(--font-inter)" }}>
                      {new Date(k.aangemaakt).toLocaleDateString("nl-NL")}
                    </p>
                    {isOpen ? <ChevronUp size={14} style={{ color: "rgba(0,19,55,0.3)", flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: "rgba(0,19,55,0.3)", flexShrink: 0 }} />}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5" style={{ borderTop: "1px solid rgba(0,19,55,0.06)" }}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                        {([
                          { label: "Naam", field: "naam" as const },
                          { label: "E-mail", field: "email" as const },
                          { label: "Telefoon", field: "telefoon" as const },
                          { label: "Adres", field: "adres" as const },
                          { label: "Stad", field: "stad" as const },
                        ]).map(({ label, field }) => (
                          <div key={field}>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>{label}</label>
                            <input
                              type="text"
                              defaultValue={k[field]}
                              onBlur={(e) => { if (e.target.value !== k[field]) patch(k.id, { [field]: e.target.value }); }}
                              className="w-full px-3 py-2 text-sm outline-none"
                              style={S.veld}
                            />
                          </div>
                        ))}
                        <div style={{ gridColumn: "span 2" }}>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Notitie</label>
                          <textarea
                            defaultValue={k.notitie}
                            rows={3}
                            onBlur={(e) => { if (e.target.value !== k.notitie) patch(k.id, { notitie: e.target.value }); }}
                            placeholder="Interne notitie..."
                            className="w-full px-3 py-2 text-sm outline-none resize-none"
                            style={{ ...S.veld, lineHeight: 1.6 }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex gap-2">
                          {k.email && (
                            <a href={`mailto:${k.email}`} className="px-4 py-2 text-xs font-semibold transition-all hover:opacity-80"
                              style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
                              Mail
                            </a>
                          )}
                          {k.telefoon && (
                            <a href={`tel:${k.telefoon}`} className="px-4 py-2 text-xs font-semibold transition-all hover:opacity-80"
                              style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}>
                              Bel
                            </a>
                          )}
                        </div>
                        <button onClick={() => verwijder(k.id)} className="flex items-center gap-1.5 text-xs transition-all hover:opacity-70"
                          style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>
                          <Trash2 size={12} /> Verwijder
                        </button>
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

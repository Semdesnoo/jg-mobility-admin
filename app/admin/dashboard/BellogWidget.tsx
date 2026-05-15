"use client";

import { useState, useEffect, useCallback } from "react";
import { Phone, Plus, Check, Trash2, PhoneIncoming, RotateCcw } from "lucide-react";

type Oproep = {
  id: string;
  datum: string;
  tijd: string;
  nummer: string;
  naam: string;
  notitie: string;
  terugbellen: boolean;
  afgehandeld: boolean;
};

const vandaag = () => new Date().toISOString().slice(0, 10);
const nuTijd = () => new Date().toTimeString().slice(0, 5);

const leegForm = () => ({
  datum: vandaag(),
  tijd: nuTijd(),
  nummer: "",
  naam: "",
  notitie: "",
  terugbellen: false,
});

export default function BellogWidget() {
  const [oproepen, setOproepen] = useState<Oproep[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<"vandaag" | "alle">("vandaag");
  const [form, setForm] = useState(leegForm());
  const [saving, setSaving] = useState(false);

  const laadOproepen = useCallback(async () => {
    const res = await fetch("/api/admin/bellog");
    if (res.ok) setOproepen(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laadOproepen();
  }, [laadOproepen]);

  const slaOproepOp = async () => {
    setSaving(true);
    await fetch("/api/admin/bellog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    await laadOproepen();
    setForm(leegForm());
    setFormOpen(false);
    setSaving(false);
  };

  const toggle = async (id: string, field: "afgehandeld" | "terugbellen", val: boolean) => {
    await fetch(`/api/admin/bellog/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: val }),
    });
    setOproepen((prev) =>
      prev.map((o) => (o.id === id ? { ...o, [field]: val } : o))
    );
  };

  const verwijder = async (id: string) => {
    await fetch(`/api/admin/bellog/${id}`, { method: "DELETE" });
    setOproepen((prev) => prev.filter((o) => o.id !== id));
  };

  const gefilterd =
    filter === "vandaag"
      ? oproepen.filter((o) => o.datum === vandaag())
      : oproepen;

  const openstaand = oproepen.filter((o) => o.terugbellen && !o.afgehandeld).length;

  return (
    <div
      className="flex flex-col"
      style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", minHeight: "400px" }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}
      >
        <div className="flex items-center gap-2">
          <Phone size={15} style={{ color: "#001337" }} />
          <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
            Bellog
          </h2>
          {openstaand > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5"
              style={{ backgroundColor: "#dc2626", color: "#ffffff", fontFamily: "var(--font-inter)" }}
            >
              {openstaand} terugbellen
            </span>
          )}
        </div>
        <button
          onClick={() => { setFormOpen((v) => !v); setForm(leegForm()); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
        >
          <Plus size={11} /> Oproep
        </button>
      </div>

      {/* Nieuw oproep formulier */}
      {formOpen && (
        <div
          className="px-5 py-4"
          style={{ borderBottom: "1px solid rgba(0,19,55,0.07)", backgroundColor: "rgba(0,19,55,0.02)" }}
        >
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="date"
              value={form.datum}
              onChange={(e) => setForm((p) => ({ ...p, datum: e.target.value }))}
              className="px-3 py-2 text-xs outline-none"
              style={{ backgroundColor: "#fff", border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
            />
            <input
              type="time"
              value={form.tijd}
              onChange={(e) => setForm((p) => ({ ...p, tijd: e.target.value }))}
              className="px-3 py-2 text-xs outline-none"
              style={{ backgroundColor: "#fff", border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
            />
          </div>
          <div className="flex flex-col gap-2 mb-3">
            <input
              value={form.nummer}
              onChange={(e) => setForm((p) => ({ ...p, nummer: e.target.value }))}
              placeholder="Telefoonnummer"
              className="px-3 py-2 text-xs outline-none"
              style={{ backgroundColor: "#fff", border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
            />
            <input
              value={form.naam}
              onChange={(e) => setForm((p) => ({ ...p, naam: e.target.value }))}
              placeholder="Naam (optioneel)"
              className="px-3 py-2 text-xs outline-none"
              style={{ backgroundColor: "#fff", border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
            />
            <textarea
              value={form.notitie}
              onChange={(e) => setForm((p) => ({ ...p, notitie: e.target.value }))}
              placeholder="Notitie (bijv. interesse in Golf TDI)"
              rows={2}
              className="px-3 py-2 text-xs outline-none resize-none"
              style={{ backgroundColor: "#fff", border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.terugbellen}
                onChange={(e) => setForm((p) => ({ ...p, terugbellen: e.target.checked }))}
                className="w-3 h-3"
              />
              <span className="text-xs" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                Terugbellen
              </span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormOpen(false)}
                className="px-3 py-1.5 text-xs transition-all hover:opacity-70"
                style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
              >
                Annuleren
              </button>
              <button
                onClick={slaOproepOp}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
              >
                {saving ? "Opslaan..." : "Opslaan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
        {(["vandaag", "alle"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-5 py-2.5 text-xs font-semibold tracking-wide uppercase transition-all"
            style={{
              fontFamily: "var(--font-inter)",
              color: filter === f ? "#001337" : "rgba(0,19,55,0.4)",
              borderBottom: filter === f ? "2px solid #001337" : "2px solid transparent",
            }}
          >
            {f === "vandaag" ? "Vandaag" : `Alle (${oproepen.length})`}
          </button>
        ))}
      </div>

      {/* Lijst */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: "420px" }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div
              className="w-5 h-5 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }}
            />
          </div>
        ) : gefilterd.length === 0 ? (
          <div className="text-center py-12">
            <PhoneIncoming size={24} className="mx-auto mb-3" style={{ color: "rgba(0,19,55,0.12)" }} />
            <p className="text-sm" style={{ color: "rgba(0,19,55,0.3)", fontFamily: "var(--font-inter)" }}>
              {filter === "vandaag" ? "Geen oproepen vandaag" : "Nog geen oproepen gelogd"}
            </p>
          </div>
        ) : (
          gefilterd.map((o) => (
            <div
              key={o.id}
              className="px-5 py-3.5 flex items-start gap-3 transition-all hover:bg-gray-50"
              style={{
                borderBottom: "1px solid rgba(0,19,55,0.05)",
                opacity: o.afgehandeld ? 0.45 : 1,
              }}
            >
              <PhoneIncoming
                size={13}
                className="flex-shrink-0 mt-0.5"
                style={{ color: o.terugbellen && !o.afgehandeld ? "#dc2626" : "rgba(0,19,55,0.25)" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "#001337", fontFamily: "var(--font-inter)" }}
                  >
                    {o.naam || o.nummer || "Onbekend nummer"}
                  </span>
                  {o.naam && o.nummer && (
                    <span className="text-[10px]" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                      {o.nummer}
                    </span>
                  )}
                  <span
                    className="text-[10px] ml-auto flex-shrink-0"
                    style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}
                  >
                    {o.datum === vandaag()
                      ? o.tijd
                      : `${o.datum.slice(8)}-${o.datum.slice(5, 7)} ${o.tijd}`}
                  </span>
                </div>
                {o.notitie && (
                  <p className="text-xs" style={{ color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)" }}>
                    {o.notitie}
                  </p>
                )}
                {o.terugbellen && !o.afgehandeld && (
                  <span
                    className="inline-block text-[9px] px-1.5 py-0.5 mt-1 tracking-wide uppercase"
                    style={{
                      backgroundColor: "#fef2f2",
                      color: "#dc2626",
                      fontFamily: "var(--font-inter)",
                      border: "1px solid #fca5a5",
                    }}
                  >
                    Terugbellen
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {o.terugbellen && (
                  <button
                    onClick={() => toggle(o.id, "afgehandeld", !o.afgehandeld)}
                    title={o.afgehandeld ? "Heropenen" : "Afgehandeld markeren"}
                    className="p-1.5 transition-all hover:opacity-70"
                  >
                    {o.afgehandeld ? (
                      <RotateCcw size={11} style={{ color: "rgba(0,19,55,0.3)" }} />
                    ) : (
                      <Check size={11} style={{ color: "#16a34a" }} />
                    )}
                  </button>
                )}
                <button
                  onClick={() => verwijder(o.id)}
                  className="p-1.5 transition-all hover:opacity-70"
                >
                  <Trash2 size={11} style={{ color: "rgba(0,19,55,0.25)" }} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

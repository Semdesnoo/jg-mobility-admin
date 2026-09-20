"use client";

import { useState, useEffect, useRef } from "react";
import { useDialoog } from "./Dialoog";
import { Plus, Trash2, Check, StickyNote, Calendar, X } from "lucide-react";

/**
 * Notities & afspraken — een kladblok voor jezelf.
 *
 * Bewust simpel gehouden: je schrijft een briefje, kiest er optioneel een datum bij,
 * en vinkt het af als het klaar is. Geen klantvelden, geen kalenderrooster, geen
 * statussen om uit te kiezen — alleen "te doen" en "afgerond".
 *
 * Onder water is dit dezelfde `afspraken`-tabel als voorheen (zodat bestaande data
 * en de API intact blijven): `notitie` draagt de tekst, `datum` de optionele datum,
 * en `status` is "gepland" (open) of "afgerond" (afgevinkt). De overige kolommen
 * blijven leeg.
 */
type Notitie = {
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

/** "JJJJ-MM-DD" van vandaag/over n dagen, zonder tijdzone-verschuiving. */
function dagSleutel(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Menselijke datumtekst: Vandaag / Morgen / Gisteren, anders "za 12 sep". */
function datumLabel(sleutel: string): string {
  if (!sleutel) return "";
  const vandaag = dagSleutel(0);
  const morgen = dagSleutel(1);
  const gisteren = dagSleutel(-1);
  if (sleutel === vandaag) return "Vandaag";
  if (sleutel === morgen) return "Morgen";
  if (sleutel === gisteren) return "Gisteren";
  return new Date(`${sleutel}T00:00:00`).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Is deze datum in het verleden (vóór vandaag)? Voor een rode "te laat"-tint. */
function isVerlopen(sleutel: string): boolean {
  return !!sleutel && sleutel < dagSleutel(0);
}

const VELD: React.CSSProperties = {
  border: "1px solid rgba(0,19,55,0.15)",
  color: "#001337",
  fontFamily: "var(--font-inter)",
  backgroundColor: "#ffffff",
  borderRadius: "var(--radius-control)",
};

export default function AfsprakenContent() {
  const { vraag } = useDialoog();
  const [items, setItems] = useState<Notitie[]>([]);
  const [loading, setLoading] = useState(true);

  // Nieuw briefje.
  const [tekst, setTekst] = useState("");
  const [datum, setDatum] = useState(""); // "" = losse notitie zonder datum
  const [saving, setSaving] = useState(false);
  const invoerRef = useRef<HTMLTextAreaElement>(null);

  // Inline bewerken van een bestaande regel.
  const [bewerkId, setBewerkId] = useState<string | null>(null);
  const [bewerkTekst, setBewerkTekst] = useState("");
  // Welke regel toont zijn datumkiezer.
  const [datumOpenId, setDatumOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/afspraken")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Notitie[] | null) => {
        if (d) setItems(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const voegToe = async () => {
    const schoon = tekst.trim();
    if (!schoon) return;
    setSaving(true);
    const res = await fetch("/api/admin/afspraken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notitie: schoon, datum, tijd: "", type: "notitie", status: "gepland" }),
    });
    if (res.ok) {
      const nieuw: Notitie = await res.json();
      setItems((p) => [nieuw, ...p]);
      setTekst("");
      setDatum("");
      invoerRef.current?.focus();
    }
    setSaving(false);
  };

  const zetAf = async (id: string, afgerond: boolean) => {
    const status = afgerond ? "afgerond" : "gepland";
    setItems((p) => p.map((i) => (i.id === id ? { ...i, status } : i)));
    await fetch(`/api/admin/afspraken/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  };

  const bewaarTekst = async (id: string) => {
    const schoon = bewerkTekst.trim();
    setBewerkId(null);
    const huidig = items.find((i) => i.id === id);
    if (!huidig || schoon === huidig.notitie || !schoon) {
      // Niets gewijzigd of leeg gemaakt: laat staan zoals het was.
      return;
    }
    setItems((p) => p.map((i) => (i.id === id ? { ...i, notitie: schoon } : i)));
    await fetch(`/api/admin/afspraken/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notitie: schoon }),
    });
  };

  const zetDatum = async (id: string, nieuweDatum: string) => {
    setDatumOpenId(null);
    setItems((p) => p.map((i) => (i.id === id ? { ...i, datum: nieuweDatum } : i)));
    await fetch(`/api/admin/afspraken/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // Een lege string wist de datum: de API's COALESCE laat "" gewoon door
      // (alleen een echte null valt terug op de oude waarde).
      body: JSON.stringify({ datum: nieuweDatum }),
    });
  };

  const verwijder = async (id: string) => {
    const it = items.find((i) => i.id === id);
    const kort = it ? it.notitie.slice(0, 40) + (it.notitie.length > 40 ? "…" : "") : "";
    const ok = await vraag({
      titel: "Notitie verwijderen?",
      tekst: kort ? `"${kort}" wordt verwijderd. Dit is niet ongedaan te maken.` : "Deze notitie wordt verwijderd.",
      bevestig: "Verwijderen",
      gevaar: true,
    });
    if (!ok) return;
    setItems((p) => p.filter((i) => i.id !== id));
    await fetch(`/api/admin/afspraken/${id}`, { method: "DELETE" });
  };

  // Datum geldt als "leeg" als hij ontbreekt of alleen spaties bevat.
  const heeftDatum = (i: Notitie) => !!i.datum && i.datum.trim() !== "";

  const open = items
    .filter((i) => i.status !== "afgerond")
    .sort((a, b) => {
      const da = heeftDatum(a);
      const db = heeftDatum(b);
      // Items met datum eerst, oplopend (eerste deadline bovenaan).
      if (da && db) return a.datum.localeCompare(b.datum);
      if (da) return -1;
      if (db) return 1;
      // Losse notities: nieuwste bovenaan.
      return (b.aangemaakt || "").localeCompare(a.aangemaakt || "");
    });

  const afgerond = items
    .filter((i) => i.status === "afgerond")
    .sort((a, b) => (b.aangemaakt || "").localeCompare(a.aangemaakt || ""));

  return (
    <div>
      {/* Kop */}
      <div
        className="px-4 md:px-8 py-4 md:py-5 sticky top-0 z-10"
        style={{
          backgroundColor: "rgba(255,255,255,0.85)",
          backdropFilter: "saturate(180%) blur(10px)",
          WebkitBackdropFilter: "saturate(180%) blur(10px)",
          borderBottom: "1px solid rgba(0,19,55,0.08)",
        }}
      >
        <h2 className="text-lg md:text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
          Notities &amp; afspraken
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
          Je eigen kladblok — schrijf op, vink af
        </p>
      </div>

      <div className="p-4 md:p-8 max-w-3xl">
        {/* ── Snel toevoegen ── */}
        <div
          className="mb-6 p-4 md:p-5"
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid rgba(0,19,55,0.07)",
            borderRadius: "var(--radius-card)",
            boxShadow: "0 1px 2px rgba(0,19,55,0.04), 0 8px 24px -16px rgba(0,19,55,0.18)",
          }}
        >
          <textarea
            ref={invoerRef}
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            onKeyDown={(e) => {
              // Enter = toevoegen, Shift+Enter = nieuwe regel.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                voegToe();
              }
            }}
            rows={2}
            placeholder="Schrijf een notitie of afspraak… bijv. 'Bellen met garage over BMW' of 'Proefrit Jan zaterdag 14:00'"
            className="w-full px-3.5 py-3 text-sm outline-none resize-none"
            style={{ ...VELD, lineHeight: 1.6 }}
          />

          <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
            {/* Datumkeuze — optioneel */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: "Geen datum", waarde: "" },
                { label: "Vandaag", waarde: dagSleutel(0) },
                { label: "Morgen", waarde: dagSleutel(1) },
              ].map((d) => {
                const actief = datum === d.waarde;
                return (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => setDatum(d.waarde)}
                    className="px-3 py-1.5 text-xs font-semibold transition-all"
                    style={{
                      fontFamily: "var(--font-inter)",
                      backgroundColor: actief ? "#001337" : "transparent",
                      color: actief ? "#ffffff" : "rgba(0,19,55,0.55)",
                      border: `1px solid ${actief ? "#001337" : "rgba(0,19,55,0.15)"}`,
                      borderRadius: 999,
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
              {/* Eigen datum */}
              <label
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all"
                style={{
                  fontFamily: "var(--font-inter)",
                  backgroundColor: datum && ![dagSleutel(0), dagSleutel(1), ""].includes(datum) ? "#001337" : "transparent",
                  color: datum && ![dagSleutel(0), dagSleutel(1), ""].includes(datum) ? "#ffffff" : "rgba(0,19,55,0.55)",
                  border: "1px solid rgba(0,19,55,0.15)",
                  borderRadius: 999,
                }}
              >
                <Calendar size={12} />
                {datum && ![dagSleutel(0), dagSleutel(1), ""].includes(datum) ? datumLabel(datum) : "Datum"}
                <input
                  type="date"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>

            <button
              onClick={voegToe}
              disabled={saving || !tekst.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 disabled:opacity-40 disabled:translate-y-0"
              style={{
                backgroundColor: "#001337",
                fontFamily: "var(--font-inter)",
                borderRadius: "var(--radius-control)",
                boxShadow: "0 6px 16px -8px rgba(0,19,55,0.5)",
              }}
            >
              <Plus size={16} /> Toevoegen
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />
          </div>
        ) : items.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20"
            style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", borderRadius: "var(--radius-card)" }}
          >
            <StickyNote size={38} style={{ color: "rgba(0,19,55,0.12)" }} />
            <p className="text-base font-bold mt-4" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
              Nog niets genoteerd
            </p>
            <p className="text-sm mt-1" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
              Schrijf hierboven je eerste notitie of afspraak.
            </p>
          </div>
        ) : (
          <>
            {/* ── Te doen ── */}
            {open.length > 0 && (
              <div className="mb-6">
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2.5 px-1" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                  Te doen · {open.length}
                </p>
                <div className="flex flex-col gap-2">
                  {open.map((it) => (
                    <Regel
                      key={it.id}
                      it={it}
                      afgerond={false}
                      heeftDatum={heeftDatum(it)}
                      bewerkId={bewerkId}
                      bewerkTekst={bewerkTekst}
                      datumOpenId={datumOpenId}
                      onStartBewerk={(id, t) => { setBewerkId(id); setBewerkTekst(t); }}
                      onWijzigBewerk={setBewerkTekst}
                      onBewaarBewerk={bewaarTekst}
                      onAnnuleerBewerk={() => setBewerkId(null)}
                      onToggleAf={zetAf}
                      onOpenDatum={setDatumOpenId}
                      onZetDatum={zetDatum}
                      onVerwijder={verwijder}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Afgerond ── */}
            {afgerond.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2.5 px-1" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                  Afgerond · {afgerond.length}
                </p>
                <div className="flex flex-col gap-2">
                  {afgerond.map((it) => (
                    <Regel
                      key={it.id}
                      it={it}
                      afgerond
                      heeftDatum={heeftDatum(it)}
                      bewerkId={bewerkId}
                      bewerkTekst={bewerkTekst}
                      datumOpenId={datumOpenId}
                      onStartBewerk={(id, t) => { setBewerkId(id); setBewerkTekst(t); }}
                      onWijzigBewerk={setBewerkTekst}
                      onBewaarBewerk={bewaarTekst}
                      onAnnuleerBewerk={() => setBewerkId(null)}
                      onToggleAf={zetAf}
                      onOpenDatum={setDatumOpenId}
                      onZetDatum={zetDatum}
                      onVerwijder={verwijder}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Eén regel in het kladblok ───────────────────────────────────
function Regel({
  it,
  afgerond,
  heeftDatum,
  bewerkId,
  bewerkTekst,
  datumOpenId,
  onStartBewerk,
  onWijzigBewerk,
  onBewaarBewerk,
  onAnnuleerBewerk,
  onToggleAf,
  onOpenDatum,
  onZetDatum,
  onVerwijder,
}: {
  it: Notitie;
  afgerond: boolean;
  heeftDatum: boolean;
  bewerkId: string | null;
  bewerkTekst: string;
  datumOpenId: string | null;
  onStartBewerk: (id: string, tekst: string) => void;
  onWijzigBewerk: (t: string) => void;
  onBewaarBewerk: (id: string) => void;
  onAnnuleerBewerk: () => void;
  onToggleAf: (id: string, af: boolean) => void;
  onOpenDatum: (id: string | null) => void;
  onZetDatum: (id: string, datum: string) => void;
  onVerwijder: (id: string) => void;
}) {
  const inBewerking = bewerkId === it.id;
  const datumOpen = datumOpenId === it.id;
  const verlopen = !afgerond && heeftDatum && isVerlopen(it.datum);

  return (
    <div
      className="group flex items-start gap-3 px-3.5 py-3 transition-all"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid rgba(0,19,55,0.07)",
        borderRadius: "var(--radius-card)",
        opacity: afgerond ? 0.62 : 1,
      }}
    >
      {/* Ronde afvink-knop */}
      <button
        onClick={() => onToggleAf(it.id, !afgerond)}
        aria-label={afgerond ? "Terugzetten naar te doen" : "Afvinken"}
        title={afgerond ? "Terugzetten" : "Afvinken"}
        className="flex-shrink-0 flex items-center justify-center transition-all hover:scale-105 mt-0.5"
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          border: `2px solid ${afgerond ? "#15803d" : "rgba(0,19,55,0.25)"}`,
          backgroundColor: afgerond ? "#15803d" : "transparent",
        }}
      >
        {afgerond && <Check size={14} style={{ color: "#ffffff" }} strokeWidth={3} />}
      </button>

      {/* Tekst + datum */}
      <div className="flex-1 min-w-0">
        {inBewerking ? (
          <textarea
            autoFocus
            value={bewerkTekst}
            onChange={(e) => onWijzigBewerk(e.target.value)}
            onBlur={() => onBewaarBewerk(it.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onBewaarBewerk(it.id);
              }
              if (e.key === "Escape") onAnnuleerBewerk();
            }}
            rows={2}
            className="w-full px-2.5 py-1.5 text-sm outline-none resize-none"
            style={{ ...VELD, lineHeight: 1.6 }}
          />
        ) : (
          <p
            onClick={() => !afgerond && onStartBewerk(it.id, it.notitie)}
            className={`text-sm whitespace-pre-wrap break-words ${!afgerond ? "cursor-text" : ""}`}
            style={{
              color: "#001337",
              fontFamily: "var(--font-inter)",
              lineHeight: 1.6,
              textDecoration: afgerond ? "line-through" : "none",
            }}
            title={afgerond ? "" : "Klik om te bewerken"}
          >
            {it.notitie || "(leeg)"}
          </p>
        )}

        {/* Datumregel */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {datumOpen ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <input
                type="date"
                defaultValue={heeftDatum ? it.datum.trim() : ""}
                onChange={(e) => onZetDatum(it.id, e.target.value)}
                className="px-2 py-1 text-xs outline-none"
                style={VELD}
              />
              {heeftDatum && (
                <button
                  onClick={() => onZetDatum(it.id, "")}
                  className="text-[11px] font-semibold px-2 py-1 transition-all hover:opacity-70"
                  style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}
                >
                  Datum wissen
                </button>
              )}
              <button
                onClick={() => onOpenDatum(null)}
                aria-label="Sluiten"
                className="flex items-center justify-center transition-all hover:opacity-70"
                style={{ width: 24, height: 24, color: "rgba(0,19,55,0.4)" }}
              >
                <X size={13} />
              </button>
            </div>
          ) : heeftDatum ? (
            <button
              onClick={() => onOpenDatum(it.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold transition-all hover:opacity-80"
              style={{
                fontFamily: "var(--font-inter)",
                backgroundColor: verlopen ? "#fee2e2" : "#dbeafe",
                color: verlopen ? "#b91c1c" : "#1d4ed8",
                borderRadius: 999,
              }}
            >
              <Calendar size={11} />
              {datumLabel(it.datum.trim())}
              {verlopen ? " · te laat" : ""}
            </button>
          ) : (
            !afgerond && (
              <button
                onClick={() => onOpenDatum(it.id)}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold transition-all hover:opacity-80 opacity-0 group-hover:opacity-100"
                style={{ fontFamily: "var(--font-inter)", color: "rgba(0,19,55,0.4)", border: "1px dashed rgba(0,19,55,0.2)", borderRadius: 999 }}
              >
                <Calendar size={11} /> Datum
              </button>
            )
          )}
        </div>
      </div>

      {/* Verwijderen */}
      <button
        onClick={() => onVerwijder(it.id)}
        aria-label="Verwijderen"
        title="Verwijderen"
        className="flex-shrink-0 flex items-center justify-center transition-all hover:-translate-y-0.5 mt-0.5 md:opacity-0 md:group-hover:opacity-100"
        style={{
          width: 32,
          height: 32,
          color: "#b91c1c",
          backgroundColor: "#ffffff",
          border: "1px solid #fecaca",
          borderRadius: "var(--radius-control)",
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

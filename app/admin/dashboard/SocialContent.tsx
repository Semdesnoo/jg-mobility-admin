"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Share2, Sparkles, Copy, Check, AlertTriangle, Car, Search } from "lucide-react";

type Auto = {
  id: number; merk: string; model: string; versie?: string; bouwjaar: number;
  km: number; brandstof: string; transmissie?: string; vermogen?: string;
  kleur?: string; apk?: string; btw?: string; bodytype?: string; prijs: number;
  omschrijving?: string; verkocht: boolean; fotos: string[];
  opties?: { categorie?: string; items?: string[] }[];
};

type Resultaat = {
  intro?: string; advertentie?: string; instagram?: string; hashtags?: string;
  error?: string; ontbrekendeSleutel?: boolean;
};

const BLAUW = "#1d4ed8";

/** Tekstvak met kopieerknop — de knop is het hele punt van deze pagina. */
function TekstVak({ titel, tekst, hint }: { titel: string; tekst: string; hint?: string }) {
  const [gekopieerd, setGekopieerd] = useState(false);

  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(tekst);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2000);
    } catch {
      /* clipboard geweigerd — de tekst staat gewoon te selecteren */
    }
  };

  return (
    <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
      <div className="px-5 py-3.5 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
        <div className="min-w-0">
          <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{titel}</h3>
          {hint && <p className="text-[11px] mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{hint}</p>}
        </div>
        <button
          onClick={kopieer}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold flex-shrink-0 transition-all hover:opacity-85"
          style={{
            backgroundColor: gekopieerd ? "#dcfce7" : "#001337",
            color: gekopieerd ? "#15803d" : "#ffffff",
            fontFamily: "var(--font-inter)",
          }}
        >
          {gekopieerd ? <><Check size={12} /> Gekopieerd</> : <><Copy size={12} /> Kopieer</>}
        </button>
      </div>
      <pre
        className="px-5 py-4 text-sm whitespace-pre-wrap"
        style={{ color: "#001337", fontFamily: "var(--font-inter)", lineHeight: 1.75, margin: 0 }}
      >
        {tekst}
      </pre>
    </div>
  );
}

export default function SocialContent() {
  const [autos, setAutos] = useState<Auto[]>([]);
  const [gekozen, setGekozen] = useState<Auto | null>(null);
  const [zoek, setZoek] = useState("");
  const [extra, setExtra] = useState("");
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState<Resultaat | null>(null);

  useEffect(() => {
    fetch("/api/admin/autos")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Auto[]) => setAutos(d.filter((a) => !a.verkocht)))
      .catch(() => {});
  }, []);

  const term = zoek.trim().toLowerCase();
  const gefilterd = autos.filter(
    (a) =>
      !term ||
      `${a.merk} ${a.model} ${a.versie ?? ""} ${a.bouwjaar} ${a.brandstof}`.toLowerCase().includes(term)
  );

  const genereer = async () => {
    if (!gekozen && !extra.trim()) return;
    setBezig(true);
    setResultaat(null);
    try {
      const res = await fetch("/api/admin/social-tekst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(gekozen ?? {}), extra }),
      });
      setResultaat(await res.json());
    } catch (e) {
      setResultaat({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBezig(false);
    }
  };

  return (
    <div>
      <div className="px-4 md:px-8 py-4 md:py-5 sticky top-0 z-10" style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}>
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Social Media</h2>
        <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
          Kies een auto uit je voorraad en genereer een tekst voor Marktplaats en Instagram
        </p>
      </div>

      <div className="p-4 md:p-8 flex flex-col gap-6">

        {/* ── Auto kiezen ── */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
          <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
            <div className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, backgroundColor: "rgba(29,78,216,0.1)", borderRadius: 7 }}>
              <Car size={14} style={{ color: BLAUW }} />
            </div>
            <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Kies een auto</h3>
            <span className="text-[11px] ml-auto" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
              {term ? `${gefilterd.length} van ${autos.length}` : `${autos.length} op voorraad`}
            </span>
          </div>

          {/* Zoeken — bij dertig auto's is scrollen geen doen meer */}
          {autos.length > 6 && (
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)" }}>
              <Search size={13} style={{ color: "rgba(0,19,55,0.3)", flexShrink: 0 }} />
              <input
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
                placeholder="Zoek op merk, model, jaar of kenteken..."
                className="flex-1 min-w-0 text-sm outline-none bg-transparent"
                style={{ color: "#001337", fontFamily: "var(--font-inter)" }}
              />
              {zoek && (
                <button
                  onClick={() => setZoek("")}
                  className="text-[11px] transition-all hover:opacity-70"
                  style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}
                >
                  wissen
                </button>
              )}
            </div>
          )}

          {autos.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
              Geen auto&apos;s op voorraad
            </p>
          ) : gefilterd.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
              Geen auto&apos;s gevonden voor &quot;{zoek}&quot;
            </p>
          ) : (
            // Compacte rijen met kleine miniatuur: blijft werkbaar bij dertig
            // auto's, met een vaste maximumhoogte zodat de knop eronder in beeld blijft.
            <div
              className="p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1"
              style={{ maxHeight: 300, overflowY: "auto" }}
            >
              {gefilterd.map((a) => {
                const actief = gekozen?.id === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setGekozen(actief ? null : a)}
                    className="flex items-center gap-2.5 px-2 py-1.5 text-left transition-all hover:bg-slate-50"
                    style={{
                      border: `1px solid ${actief ? BLAUW : "transparent"}`,
                      backgroundColor: actief ? "#eef4ff" : "transparent",
                    }}
                  >
                    <div className="relative flex-shrink-0 overflow-hidden" style={{ width: 44, height: 30, backgroundColor: "#001337" }}>
                      {a.fotos?.length > 0 ? (
                        <Image src={a.fotos[0]} alt="" fill sizes="44px" className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Car size={12} style={{ color: "rgba(255,255,255,0.25)" }} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold truncate" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                        {a.merk} {a.model}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                        {a.bouwjaar} · {a.km.toLocaleString("nl-NL")} km
                      </p>
                    </div>
                    {actief && <Check size={13} style={{ color: BLAUW, flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Extra aanwijzingen + knop ── */}
        <div className="px-5 py-4 flex flex-col gap-3" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
          <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
            Iets dat erin moet? (optioneel)
          </label>
          <input
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="bijv. net nieuwe banden, of nadruk op de zuinigheid"
            className="px-3 py-2.5 text-sm outline-none"
            style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", backgroundColor: "#fafafa" }}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={genereer}
              disabled={bezig || (!gekozen && !extra.trim())}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
            >
              <Sparkles size={14} />
              {bezig ? "Bezig met schrijven..." : "Genereer teksten"}
            </button>
            {gekozen && (
              <span className="text-[11px]" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                voor {gekozen.merk} {gekozen.model} ({gekozen.bouwjaar})
              </span>
            )}
            {!gekozen && !extra.trim() && (
              <span className="text-[11px]" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                Kies eerst een auto hierboven
              </span>
            )}
          </div>
        </div>

        {/* ── Resultaat ── */}
        {resultaat?.ontbrekendeSleutel && (
          <div className="flex items-start gap-3 px-4 py-3.5" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
            <AlertTriangle size={16} style={{ color: "#b45309", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="text-[12px] font-bold" style={{ color: "#b45309", fontFamily: "var(--font-inter)" }}>
                Geen API-sleutel ingesteld
              </p>
              <p className="text-[11px] mt-1" style={{ color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)", lineHeight: 1.65 }}>
                <code>ANTHROPIC_API_KEY</code> staat wel in je omgevingsvariabelen maar is leeg. Vul hem
                in <code>.env.local</code> én in Vercel om deze generator (en de AI-omschrijving bij
                auto toevoegen) te laten werken.
              </p>
            </div>
          </div>
        )}

        {resultaat?.error && !resultaat.ontbrekendeSleutel && (
          <p className="text-sm px-4 py-3" style={{ color: "#b91c1c", backgroundColor: "#fef2f2", border: "1px solid #fecaca", fontFamily: "var(--font-inter)" }}>
            {resultaat.error}
          </p>
        )}

        {resultaat?.advertentie && (
          <div className="flex flex-col gap-5">
            <TekstVak
              titel="Marktplaats — introductietekst"
              tekst={resultaat.intro ?? ""}
              hint="De korte tekst boven je advertentie"
            />
            <TekstVak
              titel="Marktplaats — advertentietekst"
              tekst={resultaat.advertentie}
              hint="Contactgegevens staan er al onder. Prijs bewust niet — die vul je in het prijsveld in"
            />
            <TekstVak
              titel="Instagram"
              tekst={`${resultaat.instagram ?? ""}

${resultaat.hashtags ?? ""}`.trim()}
              hint="Bijschrift plus hashtags"
            />
          </div>
        )}

        {!resultaat && (
          <div className="flex flex-col items-center justify-center py-14" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <Share2 size={28} style={{ color: "rgba(0,19,55,0.12)" }} />
            <p className="text-sm font-bold mt-3" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
              Nog geen tekst
            </p>
            <p className="text-[11px] mt-1 text-center max-w-sm" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)", lineHeight: 1.65 }}>
              Kies een auto en klik op Genereer. Je krijgt een Marktplaats-advertentie en een
              Instagram-bijschrift met hashtags, allebei met een kopieerknop.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

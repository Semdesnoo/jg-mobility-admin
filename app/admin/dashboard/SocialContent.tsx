"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Share2, Sparkles, Copy, Check, AlertTriangle, Car, Search, RefreshCw, Camera, Music2, Store } from "lucide-react";
import { useAiTaak } from "./AiTaken";

type Auto = {
  id: number; merk: string; model: string; versie?: string; bouwjaar: number;
  km: number; brandstof: string; transmissie?: string; vermogen?: string;
  kleur?: string; apk?: string; btw?: string; bodytype?: string; prijs: number;
  omschrijving?: string; verkocht: boolean; fotos: string[];
  opties?: { categorie?: string; items?: string[] }[];
};

type Resultaat = {
  intro?: string; advertentie?: string; instagram?: string; tiktok?: string; hashtags?: string;
  error?: string; ontbrekendeSleutel?: boolean;
  /** true = kwam uit het archief, dus zonder tokens te verbruiken. */
  uitArchief?: boolean;
  aangemaakt?: string;
  introIngekort?: boolean;
  verbruik?: { invoer: number; uitvoer: number };
};

/** Molibox (voorheen Marktplaats) kapt de introductietekst af op 130 tekens. */
const INTRO_MAX = 130;

const BLAUW = "#1d4ed8";

type PlatformId = "instagram" | "molibox" | "tiktok";
const PLATFORMS: { id: PlatformId; label: string; Icon: typeof Camera }[] = [
  { id: "instagram", label: "Instagram", Icon: Camera },
  { id: "molibox", label: "Molibox", Icon: Store },
  { id: "tiktok", label: "TikTok", Icon: Music2 },
];

/** Los kopieerknopje, hergebruikt door alle platformkaarten. */
function KopieerKnop({ tekst }: { tekst: string }) {
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
    <button
      onClick={kopieer}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold flex-shrink-0 transition-all hover:-translate-y-0.5"
      style={{
        backgroundColor: gekopieerd ? "#dcfce7" : "#001337",
        color: gekopieerd ? "#15803d" : "#ffffff",
        fontFamily: "var(--font-inter)",
        borderRadius: "var(--radius-control)",
      }}
    >
      {gekopieerd ? <><Check size={13} /> Gekopieerd</> : <><Copy size={13} /> Kopieer</>}
    </button>
  );
}

/** Eén tekstblok met titel, hint, optionele tekenteller en kopieerknop. */
function TekstBlok({ titel, tekst, hint, limiet }: { titel: string; tekst: string; hint?: string; limiet?: number }) {
  return (
    <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
      <div className="px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{titel}</h3>
          {hint && <p className="text-[11px] mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{hint}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {limiet && (
            <span
              className="text-[11px] font-semibold flex-shrink-0 px-2 py-1"
              style={{
                fontFamily: "var(--font-inter)",
                color: tekst.length > limiet ? "#b91c1c" : "#15803d",
                backgroundColor: tekst.length > limiet ? "#fee2e2" : "#dcfce7",
                borderRadius: 999,
              }}
              title={`Molibox staat maximaal ${limiet} tekens toe`}
            >
              {tekst.length} / {limiet}
            </span>
          )}
          <KopieerKnop tekst={tekst} />
        </div>
      </div>
      <pre
        className="px-4 sm:px-5 py-4 text-sm whitespace-pre-wrap"
        style={{ color: "#001337", fontFamily: "var(--font-inter)", lineHeight: 1.75, margin: 0, overflowWrap: "anywhere", wordBreak: "break-word" }}
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
  const [platform, setPlatform] = useState<PlatformId>("instagram");

  const { taak, start } = useAiTaak<Resultaat>("social-tekst");
  const bezig = taak?.bezig ?? false;
  const resultaat: Resultaat | null = taak?.fout ? { error: taak.fout } : taak?.resultaat ?? null;

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

  const genereer = (opnieuw = false) => {
    if ((!gekozen && !extra.trim()) || bezig) return;
    const auto = gekozen;
    const wens = extra;
    const label = auto ? `Social tekst ${auto.merk} ${auto.model}` : "Social tekst";
    start(label, async () => {
      const res = await fetch("/api/admin/social-tekst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(auto ?? {}), extra: wens, opnieuw }),
      });
      return await res.json();
    });
  };

  const heeftTekst = !!resultaat?.advertentie;

  return (
    <div className="flex flex-col lg:flex-row" style={{ minHeight: "100%" }}>
      {/* ══ Zijbalk: auto's kiezen ══ */}
      <aside
        className="w-full lg:w-[320px] lg:flex-shrink-0 flex flex-col lg:h-[calc(100vh-0px)] lg:sticky lg:top-0"
        style={{ backgroundColor: "#ffffff", borderRight: "1px solid rgba(0,19,55,0.08)" }}
      >
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Social Media</h2>
          <p className="text-[11px] mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
            Kies een auto en genereer teksten
          </p>
        </div>

        {/* Zoeken */}
        <div className="px-4 pb-2 flex-shrink-0">
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ border: "1px solid rgba(0,19,55,0.12)", borderRadius: "var(--radius-control)", backgroundColor: "#fafbfc" }}
          >
            <Search size={13} style={{ color: "rgba(0,19,55,0.3)", flexShrink: 0 }} />
            <input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek merk, model, jaar…"
              className="flex-1 min-w-0 text-sm outline-none bg-transparent"
              style={{ color: "#001337", fontFamily: "var(--font-inter)" }}
            />
            {zoek && (
              <button onClick={() => setZoek("")} aria-label="Zoekopdracht wissen" className="flex-shrink-0" style={{ color: "rgba(0,19,55,0.4)" }}>
                <span className="text-[11px]" style={{ fontFamily: "var(--font-inter)" }}>wis</span>
              </button>
            )}
          </div>
          <p className="text-[10px] mt-2 px-1 font-semibold uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
            {term ? `${gefilterd.length} van ${autos.length}` : `${autos.length} op voorraad`}
          </p>
        </div>

        {/* Autolijst — scrollt binnen de zijbalk */}
        <div className="flex-1 overflow-y-auto jg-scroll px-3 pb-4">
          {autos.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
              Geen auto&apos;s op voorraad
            </p>
          ) : gefilterd.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
              Niets gevonden voor &quot;{zoek}&quot;
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {gefilterd.map((a) => {
                const actief = gekozen?.id === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setGekozen(actief ? null : a)}
                    className="flex items-center gap-3 px-2.5 py-2 text-left transition-all"
                    style={{
                      border: `1px solid ${actief ? BLAUW : "transparent"}`,
                      backgroundColor: actief ? "#eef4ff" : "transparent",
                      borderRadius: "var(--radius-control)",
                    }}
                    onMouseEnter={(e) => { if (!actief) e.currentTarget.style.backgroundColor = "rgba(0,19,55,0.03)"; }}
                    onMouseLeave={(e) => { if (!actief) e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <div className="relative flex-shrink-0 overflow-hidden" style={{ width: 52, height: 38, backgroundColor: "#001337", borderRadius: 7 }}>
                      {a.fotos?.length > 0 ? (
                        <Image src={a.fotos[0]} alt="" fill sizes="52px" className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Car size={13} style={{ color: "rgba(255,255,255,0.25)" }} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold truncate" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                        {a.merk} {a.model}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                        {a.bouwjaar} · {a.km.toLocaleString("nl-NL")} km
                      </p>
                    </div>
                    {actief && <Check size={15} style={{ color: BLAUW, flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ══ Hoofdpaneel ══ */}
      <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 flex flex-col gap-5" style={{ backgroundColor: "#eef1f5" }}>
        {/* Aanwijzing + genereren */}
        <div
          className="p-4 md:p-5 flex flex-col gap-3"
          style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", borderRadius: "var(--radius-card)", boxShadow: "0 1px 2px rgba(0,19,55,0.04), 0 8px 24px -16px rgba(0,19,55,0.18)" }}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            {gekozen ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold" style={{ backgroundColor: "#eef4ff", color: BLAUW, fontFamily: "var(--font-inter)", borderRadius: 999 }}>
                <Car size={13} /> {gekozen.merk} {gekozen.model} ({gekozen.bouwjaar})
              </span>
            ) : (
              <span className="text-[12px]" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                Kies links een auto uit je voorraad
              </span>
            )}
          </div>
          <input
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="Iets dat erin moet? (optioneel) — bijv. net nieuwe banden, of nadruk op de zuinigheid"
            className="px-3.5 py-2.5 text-sm outline-none"
            style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", backgroundColor: "#fafafa", borderRadius: "var(--radius-control)" }}
          />
          <div>
            <button
              onClick={() => genereer(false)}
              disabled={bezig || (!gekozen && !extra.trim())}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 disabled:opacity-40 disabled:translate-y-0"
              style={{ backgroundColor: "#001337", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)", boxShadow: "0 6px 16px -8px rgba(0,19,55,0.5)" }}
            >
              <Sparkles size={15} />
              {bezig ? "Bezig met schrijven..." : heeftTekst ? "Opnieuw genereren" : "Genereer teksten"}
            </button>
          </div>
        </div>

        {/* Foutmeldingen */}
        {resultaat?.ontbrekendeSleutel && (
          <div className="flex items-start gap-3 px-4 py-3.5" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius-card)" }}>
            <AlertTriangle size={16} style={{ color: "#b45309", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="text-[12px] font-bold" style={{ color: "#b45309", fontFamily: "var(--font-inter)" }}>Geen API-sleutel ingesteld</p>
              <p className="text-[11px] mt-1" style={{ color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)", lineHeight: 1.65 }}>
                <code>ANTHROPIC_API_KEY</code> staat wel in je omgevingsvariabelen maar is leeg. Vul hem in <code>.env.local</code> én in Vercel.
              </p>
            </div>
          </div>
        )}
        {resultaat?.error && !resultaat.ontbrekendeSleutel && (
          <p className="text-sm px-4 py-3" style={{ color: "#b91c1c", backgroundColor: "#fef2f2", border: "1px solid #fecaca", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-card)" }}>
            {resultaat.error}
          </p>
        )}

        {heeftTekst ? (
          <>
            {/* Herkomst + opnieuw schrijven */}
            <div
              className="flex items-center gap-3 px-4 py-3 flex-wrap"
              style={{
                backgroundColor: resultaat!.uitArchief ? "#eef4ff" : "#f0fdf4",
                border: `1px solid ${resultaat!.uitArchief ? "rgba(29,78,216,0.25)" : "rgba(21,128,61,0.25)"}`,
                borderRadius: "var(--radius-card)",
              }}
            >
              {resultaat!.uitArchief ? <Sparkles size={15} style={{ color: BLAUW, flexShrink: 0 }} /> : <Sparkles size={15} style={{ color: "#15803d", flexShrink: 0 }} />}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold" style={{ color: resultaat!.uitArchief ? BLAUW : "#15803d", fontFamily: "var(--font-inter)" }}>
                  {resultaat!.uitArchief ? "Uit het archief — geen tokens verbruikt" : "Nieuw geschreven en opgeslagen"}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>
                  {resultaat!.aangemaakt
                    ? `Gegenereerd op ${new Date(resultaat!.aangemaakt).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })}`
                    : ""}
                  {resultaat!.verbruik && !resultaat!.uitArchief ? ` · ${resultaat!.verbruik.invoer + resultaat!.verbruik.uitvoer} tokens` : ""}
                </p>
              </div>
              <button
                onClick={() => genereer(true)}
                disabled={bezig}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold flex-shrink-0 transition-all hover:-translate-y-0.5 disabled:opacity-40"
                style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", backgroundColor: "#ffffff", borderRadius: "var(--radius-control)" }}
                title="Negeert het archief en schrijft een nieuwe versie — dit kost tokens"
              >
                <RefreshCw size={11} className={bezig ? "animate-spin" : ""} /> Opnieuw schrijven
              </button>
            </div>

            {/* ── Platform-schakelaar ── */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {PLATFORMS.map((p) => {
                const actief = platform === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all"
                    style={{
                      fontFamily: "var(--font-inter)",
                      backgroundColor: actief ? "#001337" : "#ffffff",
                      color: actief ? "#ffffff" : "rgba(0,19,55,0.55)",
                      border: `1px solid ${actief ? "#001337" : "rgba(0,19,55,0.12)"}`,
                      borderRadius: "var(--radius-control)",
                    }}
                  >
                    <p.Icon size={15} />
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* ── Inhoud per platform ── */}
            {platform === "instagram" && (
              <TekstBlok
                titel="Instagram"
                tekst={`${resultaat!.instagram ?? ""}\n\n${resultaat!.hashtags ?? ""}`.trim()}
                hint="Bijschrift plus hashtags — plak in je Instagram-post"
              />
            )}

            {platform === "molibox" && (
              <div className="flex flex-col gap-5">
                {resultaat!.introIngekort && (
                  <p className="text-[11px] px-4 py-2.5" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", color: "#b45309", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}>
                    De introductietekst was langer dan {INTRO_MAX} tekens en is netjes ingekort tot de laatste hele zin die past.
                  </p>
                )}
                <TekstBlok
                  titel="Molibox — introductietekst"
                  tekst={resultaat!.intro ?? ""}
                  hint={`De korte tekst boven je advertentie — maximaal ${INTRO_MAX} tekens`}
                  limiet={INTRO_MAX}
                />
                <TekstBlok
                  titel="Molibox — advertentietekst"
                  tekst={resultaat!.advertentie ?? ""}
                  hint="Contactgegevens staan er al onder. Prijs bewust niet — die vul je in het prijsveld in"
                />
              </div>
            )}

            {platform === "tiktok" && (
              <TekstBlok
                titel="TikTok"
                tekst={resultaat!.tiktok ?? ""}
                hint="Korte caption met hook en hashtags — plak bij je TikTok-video"
              />
            )}
          </>
        ) : (
          !resultaat?.error && !resultaat?.ontbrekendeSleutel && (
            <div className="flex flex-col items-center justify-center py-20 flex-1" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", borderRadius: "var(--radius-card)" }}>
              <Share2 size={30} style={{ color: "rgba(0,19,55,0.12)" }} />
              <p className="text-base font-bold mt-3" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                Nog geen tekst
              </p>
              <p className="text-[12px] mt-1.5 text-center max-w-sm" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)", lineHeight: 1.65 }}>
                Kies links een auto en klik op Genereer. Je krijgt teksten voor Instagram, Molibox en TikTok — schakel er bovenaan tussen, elk met een kopieerknop.
              </p>
            </div>
          )
        )}
      </main>
    </div>
  );
}

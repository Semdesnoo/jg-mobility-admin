"use client";

import { useState, useEffect } from "react";
import { BarChart2, Car, TrendingUp } from "lucide-react";

type Stats = {
  totaalVerkocht: number;
  verkochtDitJaar: number;
  verkochtDezeMaand: number;
  inVoorraad: number;
  gereserveerd: number;
  voorraadwaarde: number;
  gemVraagprijs: number;
  totaalOmzet: number;
  omzetDitJaar: number;
  omzetDezeMaand: number;
  gemVerkoopprijs: number;
  betaaldeFacturen: number;
  omzetPerMaand: Record<string, number>;
  verkopenPerMaand: Record<string, number>;
  gemStandtijdVerkocht: number | null;
  gemStandtijdVoorraad: number | null;
  standtijdDataCount: number;
  langstInVoorraad: { merk: string; model: string; dagen: number }[];
  perMerk: {
    merk: string;
    voorraad: number;
    verkocht: number;
    gemStandtijd: number | null;
    gemStandtijdVerkocht: number | null;
    voorraadwaarde: number;
  }[];
  openAfspraken: number;
};

type IconType = React.ComponentType<{ size?: number; style?: React.CSSProperties }>;

const MAAND_NAMEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

// Sequentiële blauwe ramp — gevalideerd tegen het witte kaartoppervlak.
const BLAUW_LICHT = "#9ec5f4";
const BLAUW = "#1d4ed8";
const GROEN = "#15803d";

const fmtEur = (v: number) => `€${v.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;
const fmtEurKort = (v: number) =>
  v >= 1000 ? `€${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `€${Math.round(v)}`;

/** Laatste 12 maanden als sleutels "JJJJ-MM", gerekend vanaf een vast moment.
 *  De klok wordt één keer bij het laden vastgelegd, niet elke render opnieuw —
 *  anders is de render onzuiver en kan de as tijdens gebruik verspringen. */
function laatste12Maanden(vanaf: number): string[] {
  const nu = new Date(vanaf);
  const uit: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
    uit.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return uit;
}

/** Kolommen — voor tellingen (hoeveel auto's per maand). */
function KolomGrafiek({
  data,
  formatter,
  vanaf,
  kleur = BLAUW,
}: {
  data: Record<string, number>;
  formatter: (v: number) => string;
  vanaf: number;
  kleur?: string;
}) {
  const maanden = laatste12Maanden(vanaf);
  const waarden = maanden.map((m) => data[m] ?? 0);
  const max = Math.max(...waarden, 1);
  const huidig = maanden[maanden.length - 1];

  return (
    <div className="flex items-end gap-1.5" style={{ height: 150 }}>
      {maanden.map((m, i) => {
        const v = waarden[i];
        const isHuidig = m === huidig;
        return (
          <div key={m} className="flex-1 flex flex-col items-center gap-1.5 group">
            <div className="w-full flex flex-col justify-end items-center" style={{ height: 118 }}>
              {v > 0 && (
                <span
                  className="text-[10px] font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                  style={{ color: "#001337", fontFamily: "var(--font-inter)" }}
                >
                  {formatter(v)}
                </span>
              )}
              <div
                title={`${MAAND_NAMEN[parseInt(m.split("-")[1]) - 1]} — ${formatter(v)}`}
                className="w-full transition-all"
                style={{
                  height: `${(v / max) * 100}%`,
                  backgroundColor: v > 0 ? (isHuidig ? kleur : BLAUW_LICHT) : "rgba(0,19,55,0.05)",
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  minHeight: v > 0 ? 4 : 2,
                }}
              />
            </div>
            <p
              className="text-[9px]"
              style={{
                color: isHuidig ? "#001337" : "rgba(0,19,55,0.35)",
                fontWeight: isHuidig ? 700 : 400,
                fontFamily: "var(--font-inter)",
              }}
            >
              {MAAND_NAMEN[parseInt(m.split("-")[1]) - 1]}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Vlakgrafiek — voor een doorlopende reeks zoals omzet. */
function VlakGrafiek({ data, vanaf, kleur = GROEN }: { data: Record<string, number>; vanaf: number; kleur?: string }) {
  const maanden = laatste12Maanden(vanaf);
  const waarden = maanden.map((m) => data[m] ?? 0);
  const max = Math.max(...waarden, 1);
  const B = 100;
  const H = 40;
  const stap = B / Math.max(maanden.length - 1, 1);

  const punten = waarden.map((v, i) => ({ x: i * stap, y: H - (v / max) * H }));
  const lijn = punten.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const vlak = `${lijn} L${B},${H} L0,${H} Z`;

  return (
    <div>
      <div style={{ position: "relative", height: 150 }}>
        <svg viewBox={`0 0 ${B} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 118, display: "block" }}>
          <defs>
            <linearGradient id="omzetVlak" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={kleur} stopOpacity="0.22" />
              <stop offset="100%" stopColor={kleur} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={vlak} fill="url(#omzetVlak)" />
          <path d={lijn} fill="none" stroke={kleur} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Markeringen met tooltip — los van de SVG zodat ze niet uitrekken */}
        <div className="absolute inset-x-0 top-0 flex" style={{ height: 118 }}>
          {waarden.map((v, i) => (
            <div key={maanden[i]} className="flex-1 relative group" title={`${MAAND_NAMEN[parseInt(maanden[i].split("-")[1]) - 1]} — ${fmtEur(v)}`}>
              {v > 0 && (
                <span
                  className="absolute left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{
                    top: `${(1 - v / max) * 100}%`,
                    marginTop: -22,
                    backgroundColor: "#001337",
                    color: "#fff",
                    fontFamily: "var(--font-inter)",
                    borderRadius: 3,
                  }}
                >
                  {fmtEurKort(v)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex">
        {maanden.map((m, i) => (
          <p
            key={m}
            className="flex-1 text-center text-[9px]"
            style={{
              color: i === maanden.length - 1 ? "#001337" : "rgba(0,19,55,0.35)",
              fontWeight: i === maanden.length - 1 ? 700 : 400,
              fontFamily: "var(--font-inter)",
            }}
          >
            {MAAND_NAMEN[parseInt(m.split("-")[1]) - 1]}
          </p>
        ))}
      </div>
    </div>
  );
}

function Kaart({
  titel,
  rechts,
  icon: Icon,
  children,
}: {
  titel: string;
  rechts?: string;
  icon?: IconType;
  children: React.ReactNode;
}) {
  return (
    <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
      <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
        {Icon && (
          <div className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, backgroundColor: "rgba(29,78,216,0.1)", borderRadius: 7 }}>
            <Icon size={14} style={{ color: BLAUW }} />
          </div>
        )}
        <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{titel}</h3>
        {rechts && (
          <span className="text-[11px] ml-auto" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
            {rechts}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Leeg({ tekst }: { tekst: string }) {
  return (
    <div className="flex items-center justify-center" style={{ height: 150 }}>
      <p className="text-sm" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>{tekst}</p>
    </div>
  );
}

/** Compacte cijferregel — vervangt de losse KPI-kaarten. */
function Cijfer({ label, waarde, sub }: { label: string; waarde: string | number; sub?: string }) {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
        {label}
      </p>
      <p className="text-xl sm:text-2xl font-bold leading-none break-words" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
        {waarde}
      </p>
      {sub && (
        <p className="text-[11px] mt-1.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{sub}</p>
      )}
    </div>
  );
}

type Blad = "omzet" | "voorraad";

export default function StatistiekenContent() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blad, setBlad] = useState<Blad>("omzet");
  // Klok één keer vastleggen zodat de maand-as niet verspringt tijdens gebruik.
  const [vanaf] = useState(() => Date.now());

  useEffect(() => {
    fetch("/api/admin/statistieken")
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `Fout ${r.status}`);
        return data;
      })
      .then(setStats)
      .catch((e) => setError(String(e instanceof Error ? e.message : e)))
      .finally(() => setLoading(false));
  }, []);

  const heeftOmzet = stats && Object.values(stats.omzetPerMaand).some((v) => v > 0);
  const heeftVerkopen = stats && Object.values(stats.verkopenPerMaand).some((v) => v > 0);

  const BLADEN: { key: Blad; label: string }[] = [
    { key: "omzet", label: "Omzet & verkoop" },
    { key: "voorraad", label: "Voorraad" },
  ];

  return (
    <div>
      <div className="px-4 md:px-8 pt-4 md:pt-5 sticky top-0 z-10" style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}>
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Statistieken</h2>
        <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
          Overzicht van je bedrijfsprestaties
        </p>
        {/* Bladen — houdt de pagina kort in plaats van één lange kolom */}
        <div className="flex flex-wrap items-center gap-1 mt-3">
          {BLADEN.map((b) => {
            const actief = blad === b.key;
            return (
              <button
                key={b.key}
                onClick={() => setBlad(b.key)}
                className="px-3 py-2 text-xs font-semibold transition-all"
                style={{
                  fontFamily: "var(--font-inter)",
                  color: actief ? "#001337" : "rgba(0,19,55,0.4)",
                  borderBottom: `2px solid ${actief ? "#001337" : "transparent"}`,
                }}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 md:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm" style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>Fout bij laden: {error}</p>
          </div>
        ) : !stats ? null : (
          <div className="flex flex-col gap-6">

            {/* ══ Omzet & verkoop ══ */}
            {blad === "omzet" && (
              <>
                {/* Hoofdcijfer + context ernaast */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-1 p-5 sm:p-6" style={{ backgroundColor: "#001337" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-inter)" }}>
                      Omzet dit jaar
                    </p>
                    <p className="text-3xl sm:text-4xl font-bold leading-none text-white break-words" style={{ fontFamily: "var(--font-playfair)" }}>
                      {fmtEur(stats.omzetDitJaar)}
                    </p>
                    <p className="text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-inter)" }}>
                      {fmtEur(stats.omzetDezeMaand)} deze maand · {stats.betaaldeFacturen} betaalde facturen
                    </p>
                  </div>
                  <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 divide-x" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)", borderColor: "rgba(0,19,55,0.07)" }}>
                    <Cijfer label="Verkocht totaal" waarde={stats.totaalVerkocht} sub={`${stats.verkochtDitJaar} dit jaar`} />
                    <Cijfer label="Deze maand" waarde={stats.verkochtDezeMaand} sub="auto's verkocht" />
                    <Cijfer label="Gem. verkoopprijs" waarde={stats.gemVerkoopprijs > 0 ? fmtEur(stats.gemVerkoopprijs) : "—"} sub="per auto" />
                    <Cijfer label="Open afspraken" waarde={stats.openAfspraken} sub="gepland" />
                  </div>
                </div>

                {/* Twee verschillende vormen: vlak voor omzet, kolommen voor aantallen */}
                <Kaart titel="Omzet per maand" icon={TrendingUp} rechts="laatste 12 maanden">
                  {heeftOmzet ? <VlakGrafiek data={stats.omzetPerMaand} vanaf={vanaf} /> : <Leeg tekst="Nog geen betaalde facturen" />}
                </Kaart>

                <Kaart titel="Verkochte auto's per maand" icon={BarChart2} rechts="laatste 12 maanden">
                  {heeftVerkopen ? (
                    <KolomGrafiek data={stats.verkopenPerMaand} vanaf={vanaf} formatter={(v) => `${v} auto${v !== 1 ? "'s" : ""}`} />
                  ) : (
                    <Leeg tekst="Nog geen verkopen geregistreerd" />
                  )}
                </Kaart>
              </>
            )}

            {/* ══ Voorraad ══ */}
            {blad === "voorraad" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 divide-x" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)", borderColor: "rgba(0,19,55,0.07)" }}>
                  <Cijfer label="Op voorraad" waarde={stats.inVoorraad} sub={stats.gereserveerd > 0 ? `+ ${stats.gereserveerd} gereserveerd` : "beschikbaar"} />
                  <Cijfer label="Voorraadwaarde" waarde={fmtEur(stats.voorraadwaarde)} sub={`gem. ${fmtEur(stats.gemVraagprijs)}`} />
                  <Cijfer label="Staat gemiddeld" waarde={stats.gemStandtijdVoorraad != null ? `${stats.gemStandtijdVoorraad} dgn` : "—"} sub="in de showroom" />
                  <Cijfer label="Doorlooptijd" waarde={stats.gemStandtijdVerkocht != null ? `${stats.gemStandtijdVerkocht} dgn` : "—"} sub="inkoop tot verkoop" />
                </div>

                {/* Merken — geordende balken, één hue. Kleur zegt niets extra's,
                    dus geen regenboog van merkkleuren meer. */}
                <Kaart titel="Voorraad per merk" icon={Car} rechts="op voorraad · verkocht">
                  {stats.perMerk.length === 0 ? (
                    <Leeg tekst="Nog geen auto's" />
                  ) : (
                    <div className="flex flex-col gap-3">
                      {(() => {
                        const max = Math.max(...stats.perMerk.map((m) => m.voorraad + m.verkocht), 1);
                        return stats.perMerk.map((m) => (
                          <div key={m.merk} className="flex items-center gap-2 sm:gap-3">
                            <span className="w-20 sm:w-[130px] text-xs sm:text-sm font-semibold flex-shrink-0 truncate" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                              {m.merk}
                            </span>
                            <div className="flex-1 min-w-0 h-5 flex" style={{ backgroundColor: "rgba(0,19,55,0.04)" }}>
                              {m.voorraad > 0 && (
                                <div title={`${m.voorraad} op voorraad`} style={{ width: `${(m.voorraad / max) * 100}%`, backgroundColor: BLAUW }} />
                              )}
                              {m.verkocht > 0 && (
                                <div title={`${m.verkocht} verkocht`} style={{ width: `${(m.verkocht / max) * 100}%`, backgroundColor: BLAUW_LICHT, marginLeft: m.voorraad > 0 ? 2 : 0 }} />
                              )}
                            </div>
                            <span className="w-14 sm:w-[90px] text-[11px] flex-shrink-0 text-right" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>
                              {m.voorraad} · {m.verkocht}
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-4" style={{ borderTop: "1px solid rgba(0,19,55,0.07)" }}>
                    {[
                      { label: "Op voorraad", kleur: BLAUW },
                      { label: "Verkocht", kleur: BLAUW_LICHT },
                    ].map((l) => (
                      <span key={l.label} className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>
                        <span style={{ width: 10, height: 10, backgroundColor: l.kleur, display: "inline-block", borderRadius: 2 }} />
                        {l.label}
                      </span>
                    ))}
                    <span className="text-[11px] ml-auto" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                      Standtijd per merk staat onder Standtijd &amp; Merken
                    </span>
                  </div>
                </Kaart>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

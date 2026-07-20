"use client";

import { useState, useEffect } from "react";
import { Clock, Car, AlertTriangle, Info } from "lucide-react";

type PerMerk = {
  merk: string;
  voorraad: number;
  verkocht: number;
  gemStandtijd: number | null;
  gemStandtijdVerkocht: number | null;
  verkochtMetStandtijd: number;
  voorraadwaarde: number;
  gemVerkoopprijs: number | null;
};

type Stats = {
  gemStandtijdVerkocht: number | null;
  gemStandtijdVoorraad: number | null;
  standtijdDataCount: number;
  standtijdVerdeling: { label: string; verkocht: number; voorraad: number }[];
  langstInVoorraad: { merk: string; model: string; dagen: number }[];
  perMerk: PerMerk[];
};

// Sequentiële blauwe ramp — gevalideerd tegen het witte kaartoppervlak.
const BLAUW = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#1d4ed8"];
// Statuskleuren dragen nooit betekenis alleen: altijd met label ernaast.
const GOED = "#15803d";
const LET_OP = "#b45309";
const SLECHT = "#b91c1c";

// Onder dit aantal verkopen is een gemiddelde ruis, geen signaal.
const MIN_VERKOPEN_VOOR_ADVIES = 3;

const dagen = (n: number | null) => (n == null ? "—" : `${n} ${n === 1 ? "dag" : "dagen"}`);
const euro = (n: number | null) => (n == null || n === 0 ? "—" : `€${Math.round(n).toLocaleString("nl-NL")}`);

function standtijdKleur(d: number) {
  return d >= 90 ? SLECHT : d >= 45 ? LET_OP : GOED;
}

function Kaart({
  titel,
  toelichting,
  icon: Icon,
  children,
}: {
  titel: string;
  toelichting?: string;
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  children: React.ReactNode;
}) {
  return (
    <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
      <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, backgroundColor: "rgba(29,78,216,0.1)", borderRadius: 7 }}>
              <Icon size={14} style={{ color: "#1d4ed8" }} />
            </div>
          )}
          <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{titel}</h3>
        </div>
        {toelichting && (
          <p className="text-[11px] mt-1.5" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
            {toelichting}
          </p>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function MerkAnalyseContent() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/statistieken")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || `Fout ${r.status}`);
        return d;
      })
      .then(setStats)
      .catch((e) => setFout(e instanceof Error ? e.message : String(e)))
      .finally(() => setLaden(false));
  }, []);

  // Merken met genoeg verkoopdata om iets zinnigs over te zeggen.
  const metData = (stats?.perMerk ?? []).filter(
    (m) => m.gemStandtijdVerkocht != null && m.verkochtMetStandtijd >= MIN_VERKOPEN_VOOR_ADVIES
  );
  const teWeinigData = (stats?.perMerk ?? []).filter(
    (m) => m.verkocht > 0 && m.verkochtMetStandtijd < MIN_VERKOPEN_VOOR_ADVIES
  );

  const gesorteerd = [...metData].sort(
    (a, b) => (a.gemStandtijdVerkocht ?? 0) - (b.gemStandtijdVerkocht ?? 0)
  );
  const maxDoorloop = Math.max(...gesorteerd.map((m) => m.gemStandtijdVerkocht ?? 0), 1);

  const verdeling = stats?.standtijdVerdeling ?? [];
  const maxBak = Math.max(...verdeling.map((b) => Math.max(b.verkocht, b.voorraad)), 1);

  return (
    <div>
      <div className="px-4 md:px-8 py-4 md:py-5 sticky top-0 z-10" style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}>
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
          Standtijd &amp; Merken
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
          Hoe lang staat een auto in de showroom, en welke merken lopen het snelst door
        </p>
      </div>

      <div className="p-4 md:p-8">
        {laden ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />
          </div>
        ) : fout ? (
          <p className="text-sm py-16 text-center" style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>
            Fout bij laden: {fout}
          </p>
        ) : !stats ? null : (
          <div className="flex flex-col gap-6">

            {/* ── Kerncijfers: twee getallen die het verhaal dragen ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  label: "Gemiddelde doorlooptijd",
                  waarde: stats.gemStandtijdVerkocht,
                  sub: "van inkoop tot verkoop, over alle verkochte auto's",
                },
                {
                  label: "Huidige voorraad staat gemiddeld",
                  waarde: stats.gemStandtijdVoorraad,
                  sub: "hoe lang de auto's die er nu staan er al staan",
                },
              ].map((k) => (
                <div key={k.label} className="p-5" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                    {k.label}
                  </p>
                  <p className="text-4xl font-bold leading-none" style={{ fontFamily: "var(--font-playfair)", color: k.waarde != null ? standtijdKleur(k.waarde) : "rgba(0,19,55,0.25)" }}>
                    {k.waarde != null ? k.waarde : "—"}
                    {k.waarde != null && (
                      <span className="text-lg font-normal ml-1.5" style={{ color: "rgba(0,19,55,0.4)" }}>
                        {k.waarde === 1 ? "dag" : "dagen"}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] mt-2" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
                    {k.sub}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Histogram: hoe snel stroomt voorraad door ── */}
            <Kaart
              titel="Verdeling van de standtijd"
              icon={Clock}
              toelichting="Hoeveel auto's er in elke tijdsklasse vallen. Zwaartepunt links betekent snelle omloop; auto's rechts kosten geld zolang ze staan."
            >
              {verdeling.every((b) => b.verkocht === 0 && b.voorraad === 0) ? (
                <p className="text-sm py-6 text-center" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                  Nog geen standtijd-data
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    {[
                      { label: "Verkocht", kleur: "#1d4ed8" },
                      { label: "Nu in voorraad", kleur: "#9ec5f4" },
                    ].map((l) => (
                      <span key={l.label} className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>
                        <span style={{ width: 10, height: 10, backgroundColor: l.kleur, display: "inline-block", borderRadius: 2 }} />
                        {l.label}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-end gap-4" style={{ height: 150 }}>
                    {verdeling.map((b) => (
                      <div key={b.label} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full flex items-end justify-center gap-1" style={{ height: 120 }}>
                          {[
                            { n: b.verkocht, kleur: "#1d4ed8", titel: "verkocht" },
                            { n: b.voorraad, kleur: "#9ec5f4", titel: "in voorraad" },
                          ].map((s) => (
                            <div key={s.titel} className="flex-1 flex flex-col justify-end items-center" style={{ height: "100%" }}>
                              {s.n > 0 && (
                                <span className="text-[10px] font-bold mb-1" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                                  {s.n}
                                </span>
                              )}
                              <div
                                title={`${b.label} dagen — ${s.n} ${s.titel}`}
                                className="w-full"
                                style={{
                                  height: `${(s.n / maxBak) * 100}%`,
                                  backgroundColor: s.n > 0 ? s.kleur : "transparent",
                                  borderTopLeftRadius: 4,
                                  borderTopRightRadius: 4,
                                  minHeight: s.n > 0 ? 4 : 0,
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] font-semibold" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>
                          {b.label} dgn
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Kaart>

            {/* ── Doorlooptijd per merk: gerangschikte balken ── */}
            <Kaart
              titel="Doorlooptijd per merk"
              icon={Car}
              toelichting={`Gemiddeld aantal dagen tussen inkoop en verkoop, per merk. Alleen merken met minstens ${MIN_VERKOPEN_VOOR_ADVIES} verkochte auto's — daaronder is een gemiddelde te toevallig om op te sturen.`}
            >
              {gesorteerd.length === 0 ? (
                <div className="flex items-start gap-2.5 px-3 py-3" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
                  <AlertTriangle size={14} style={{ color: LET_OP, flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p className="text-[12px] font-semibold" style={{ color: LET_OP, fontFamily: "var(--font-inter)" }}>
                      Nog te weinig verkoopdata voor een merkvergelijking
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
                      Geen enkel merk heeft al {MIN_VERKOPEN_VOOR_ADVIES} verkochte auto&apos;s met een
                      geregistreerde inkoop- én verkoopdatum. Naarmate je meer auto&apos;s via dit systeem
                      verkoopt, vult deze vergelijking zichzelf.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {gesorteerd.map((m, i) => {
                    const d = m.gemStandtijdVerkocht ?? 0;
                    return (
                      <div key={m.merk} className="flex items-center gap-3">
                        <span className="text-sm font-semibold flex-shrink-0 truncate" style={{ color: "#001337", fontFamily: "var(--font-inter)", width: 130 }}>
                          {m.merk}
                        </span>
                        <div className="flex-1 h-6 relative" style={{ backgroundColor: "rgba(0,19,55,0.04)" }}>
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.max((d / maxDoorloop) * 100, 3)}%`,
                              backgroundColor: BLAUW[Math.min(i, BLAUW.length - 1)],
                              borderTopRightRadius: 4,
                              borderBottomRightRadius: 4,
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold flex-shrink-0 text-right" style={{ color: "#001337", fontFamily: "var(--font-inter)", width: 70 }}>
                          {d} dgn
                        </span>
                        <span className="text-[11px] flex-shrink-0 text-right" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)", width: 90 }}>
                          {m.verkochtMetStandtijd} verkocht
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {teWeinigData.length > 0 && (
                <div className="flex items-start gap-2 mt-5 pt-4" style={{ borderTop: "1px solid rgba(0,19,55,0.07)" }}>
                  <Info size={13} style={{ color: "rgba(0,19,55,0.35)", flexShrink: 0, marginTop: 2 }} />
                  <p className="text-[11px]" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
                    Buiten beeld wegens te weinig data:{" "}
                    {teWeinigData.map((m) => `${m.merk} (${m.verkochtMetStandtijd})`).join(", ")}.
                    Deze merken verschijnen zodra ze {MIN_VERKOPEN_VOOR_ADVIES} verkopen met inkoop- en
                    verkoopdatum hebben.
                  </p>
                </div>
              )}
            </Kaart>

            {/* ── Volledige tabel ── */}
            <Kaart
              titel="Alle merken"
              icon={Car}
              toelichting="De ruwe cijfers per merk. Doorlooptijd is leidend voor de inkoopbeslissing: hoe korter, hoe minder lang je geld vaststaat."
            >
              <div style={{ overflowX: "auto" }}>
                <table className="w-full" style={{ fontFamily: "var(--font-inter)", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1.5px solid rgba(0,19,55,0.12)" }}>
                      {["Merk", "Voorraad", "Verkocht", "Doorlooptijd", "Staat nu", "Gem. prijs", "Voorraadwaarde"].map((h, i) => (
                        <th
                          key={h}
                          className="px-3 py-2.5"
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            color: "rgba(0,19,55,0.45)",
                            textAlign: i === 0 ? "left" : "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.perMerk.map((m, i) => (
                      <tr key={m.merk} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                        <td className="px-3 py-2.5 text-sm font-semibold" style={{ color: "#001337" }}>{m.merk}</td>
                        <td className="px-3 py-2.5 text-sm text-right" style={{ color: "rgba(0,19,55,0.6)" }}>{m.voorraad}</td>
                        <td className="px-3 py-2.5 text-sm text-right" style={{ color: "rgba(0,19,55,0.6)" }}>{m.verkocht}</td>
                        <td className="px-3 py-2.5 text-sm text-right font-semibold" style={{ color: m.gemStandtijdVerkocht != null ? standtijdKleur(m.gemStandtijdVerkocht) : "rgba(0,19,55,0.3)" }}>
                          {m.gemStandtijdVerkocht != null ? dagen(m.gemStandtijdVerkocht) : "te weinig data"}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-right" style={{ color: m.gemStandtijd != null ? standtijdKleur(m.gemStandtijd) : "rgba(0,19,55,0.3)" }}>
                          {dagen(m.gemStandtijd)}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-right" style={{ color: "rgba(0,19,55,0.6)" }}>{euro(m.gemVerkoopprijs)}</td>
                        <td className="px-3 py-2.5 text-sm text-right" style={{ color: "rgba(0,19,55,0.6)" }}>{euro(m.voorraadwaarde)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Kaart>

            {/* ── Langst in de showroom ── */}
            <Kaart
              titel="Langst in de showroom"
              icon={AlertTriangle}
              toelichting="De auto's die er nu het langst staan. Hoe langer een auto staat, hoe meer rente en ruimte hij kost — overweeg prijsverlaging of extra promotie."
            >
              {stats.langstInVoorraad.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                  Nog geen data
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {stats.langstInVoorraad.map((a, i) => {
                    const max = stats.langstInVoorraad[0].dagen || 1;
                    return (
                      <div key={`${a.merk}-${a.model}-${i}`} className="flex items-center gap-3">
                        <span className="text-sm font-semibold flex-shrink-0 truncate" style={{ color: "#001337", fontFamily: "var(--font-inter)", width: 190 }}>
                          {a.merk} {a.model}
                        </span>
                        <div className="flex-1 h-2.5" style={{ backgroundColor: "rgba(0,19,55,0.06)", borderRadius: 99 }}>
                          <div className="h-full" style={{ width: `${Math.max((a.dagen / max) * 100, 4)}%`, backgroundColor: standtijdKleur(a.dagen), borderRadius: 99 }} />
                        </div>
                        <span className="text-sm font-bold flex-shrink-0 text-right" style={{ color: standtijdKleur(a.dagen), fontFamily: "var(--font-inter)", width: 80 }}>
                          {dagen(a.dagen)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Kaart>

            <p className="text-[11px] px-1" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)", lineHeight: 1.7 }}>
              Standtijd wordt gemeten vanaf het moment dat een auto in dit systeem is gezet, niet vanaf
              de werkelijke inkoopdatum. Auto&apos;s die al in de voorraad stonden voordat je dit dashboard
              gebruikte, tellen daarom lager uit dan ze in werkelijkheid waren.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

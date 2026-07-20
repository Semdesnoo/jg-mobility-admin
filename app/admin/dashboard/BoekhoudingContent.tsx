"use client";

import { useState, useEffect } from "react";
import { Banknote, Receipt, AlertTriangle, Info, Wallet } from "lucide-react";

type Kwartaal = {
  sleutel: string; jaar: number; kwartaal: number; label: string;
  omzet: number; btwHoog: number; btwMarge: number; btwTotaal: number;
  margeGrondslag: number; aantal: number; zonderInkoop: string[];
};

type Debiteur = {
  id: string; factuur_nr: string; klant: string; auto: string;
  bedrag: number; datum: string; vervaldatum: string;
  dagenOver: number | null; status: string;
};

type Boekhouding = {
  perKwartaal: Kwartaal[];
  resultaat: {
    omzet: number; inkoopwaarde: number; kosten: number;
    brutowinst: number; btwAfdracht: number; nettowinst: number;
  };
  debiteuren: Debiteur[];
  debiteurenTotaal: number;
  debiteurenTeLaat: number;
  voorraadInkoop: number;
  zonderInkoop: string[];
  afgeleideKoppelingen: string[];
};

const BLAUW = "#1d4ed8";
const GROEN = "#15803d";
const AMBER = "#b45309";
const ROOD = "#b91c1c";

const euro = (n: number) =>
  `€${n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const euroKort = (n: number) => `€${Math.round(n).toLocaleString("nl-NL")}`;

function Kaart({ titel, icon: Icon, toelichting, children }: {
  titel: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  toelichting?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
      <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, backgroundColor: "rgba(29,78,216,0.1)", borderRadius: 7 }}>
            <Icon size={14} style={{ color: BLAUW }} />
          </div>
          <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{titel}</h3>
        </div>
        {toelichting && (
          <p className="text-[11px] mt-1.5" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
            {toelichting}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

/** Regel in de resultatenrekening. `zwaar` markeert een subtotaal. */
function Regel({ label, bedrag, teken = "", zwaar = false, kleur }: {
  label: string; bedrag: number; teken?: string; zwaar?: boolean; kleur?: string;
}) {
  return (
    <div
      className="flex items-baseline justify-between px-5 py-2.5"
      style={{ borderTop: zwaar ? "1px solid rgba(0,19,55,0.12)" : "1px solid rgba(0,19,55,0.04)" }}
    >
      <p className={zwaar ? "text-sm font-bold" : "text-sm"} style={{ color: zwaar ? "#001337" : "rgba(0,19,55,0.6)", fontFamily: "var(--font-inter)" }}>
        {label}
      </p>
      <p
        className={zwaar ? "text-base font-bold" : "text-sm font-semibold"}
        style={{ color: kleur ?? "#001337", fontFamily: zwaar ? "var(--font-playfair)" : "var(--font-inter)", fontVariantNumeric: "tabular-nums" }}
      >
        {teken}{euro(Math.abs(bedrag))}
      </p>
    </div>
  );
}

type Blad = "resultaat" | "btw" | "debiteuren";

export default function BoekhoudingContent() {
  const [data, setData] = useState<Boekhouding | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [blad, setBlad] = useState<Blad>("resultaat");

  useEffect(() => {
    fetch("/api/admin/boekhouding")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || `Fout ${r.status}`);
        return d;
      })
      .then(setData)
      .catch((e) => setFout(e instanceof Error ? e.message : String(e)))
      .finally(() => setLaden(false));
  }, []);

  const BLADEN: { key: Blad; label: string }[] = [
    { key: "resultaat", label: "Resultaat" },
    { key: "btw", label: "BTW per kwartaal" },
    { key: "debiteuren", label: "Openstaand" },
  ];

  const r = data?.resultaat;
  const onvolledig = (data?.zonderInkoop.length ?? 0) > 0;

  return (
    <div>
      <div className="px-4 md:px-8 pt-4 md:pt-5 sticky top-0 z-10" style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}>
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Boekhouding</h2>
        <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
          Resultaat, BTW en openstaande posten — op basis van je facturen en calculatordossiers
        </p>
        <div className="flex items-center gap-1 mt-3">
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
                {b.key === "debiteuren" && (data?.debiteurenTeLaat ?? 0) > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold" style={{ backgroundColor: "#fee2e2", color: ROOD }}>
                    {data!.debiteurenTeLaat}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 md:p-8">
        {laden ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />
          </div>
        ) : fout ? (
          <p className="text-sm py-16 text-center" style={{ color: ROOD, fontFamily: "var(--font-inter)" }}>Fout bij laden: {fout}</p>
        ) : !data || !r ? null : (
          <div className="flex flex-col gap-6">

            {/* Waarschuwing bovenaan: zonder inkoopprijs kloppen marge en BTW niet */}
            {onvolledig && (
              <div className="flex items-start gap-3 px-4 py-3.5" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
                <AlertTriangle size={16} style={{ color: AMBER, flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p className="text-[12px] font-bold" style={{ color: AMBER, fontFamily: "var(--font-inter)" }}>
                    {data.zonderInkoop.length} margefactuur{data.zonderInkoop.length === 1 ? "" : "en"} zonder inkoopprijs
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)", lineHeight: 1.65 }}>
                    Bij de margeregeling wordt BTW berekend over verkoop min inkoop. Zonder inkoopprijs
                    is dat niet te bepalen, dus {data.zonderInkoop.length === 1 ? "die factuur telt" : "die facturen tellen"} nu
                    <strong> niet mee</strong> in de BTW en het resultaat hieronder — een geraden bedrag zou je aangifte fout maken.
                    Vul de inkoop in bij Calculator: {data.zonderInkoop.join(", ")}.
                  </p>
                </div>
              </div>
            )}

            {(data.afgeleideKoppelingen.length > 0) && (
              <div className="flex items-start gap-3 px-4 py-3" style={{ backgroundColor: "#f8fafc", border: "1px solid rgba(0,19,55,0.08)" }}>
                <Info size={14} style={{ color: "rgba(0,19,55,0.4)", flexShrink: 0, marginTop: 2 }} />
                <p className="text-[11px]" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)", lineHeight: 1.65 }}>
                  Bij {data.afgeleideKoppelingen.join(", ")} is de inkoopprijs gevonden op merk en model,
                  niet op kenteken. Loop die na voor je aangifte doet — vul het kenteken in bij de auto
                  om de koppeling waterdicht te maken.
                </p>
              </div>
            )}

            {/* ══ Resultaat ══ */}
            {blad === "resultaat" && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-1 p-6" style={{ backgroundColor: "#001337" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-inter)" }}>
                      Nettowinst
                    </p>
                    <p className="text-4xl font-bold leading-none text-white" style={{ fontFamily: "var(--font-playfair)" }}>
                      {euroKort(r.nettowinst)}
                    </p>
                    <p className="text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-inter)" }}>
                      na inkoop, kosten en BTW-afdracht
                    </p>
                  </div>
                  <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 divide-x" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)", borderColor: "rgba(0,19,55,0.07)" }}>
                    {[
                      { label: "Omzet", waarde: euroKort(r.omzet), sub: "gefactureerd" },
                      { label: "Voorraad (inkoop)", waarde: euroKort(data.voorraadInkoop), sub: "geld in de schappen" },
                      { label: "Openstaand", waarde: euroKort(data.debiteurenTotaal), sub: `${data.debiteuren.length} factu${data.debiteuren.length === 1 ? "ur" : "ren"}` },
                    ].map((c) => (
                      <div key={c.label} className="px-5 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>{c.label}</p>
                        <p className="text-2xl font-bold leading-none" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{c.waarde}</p>
                        <p className="text-[11px] mt-1.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{c.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Kaart
                  titel="Resultatenrekening"
                  icon={Banknote}
                  toelichting="Van omzet naar nettowinst. Inkoop en kosten komen uit de calculatordossiers van de verkochte auto's."
                >
                  <div>
                    <Regel label="Omzet (gefactureerd)" bedrag={r.omzet} />
                    <Regel label="Inkoopwaarde verkochte auto's" bedrag={-r.inkoopwaarde} teken="− " kleur="rgba(0,19,55,0.6)" />
                    <Regel label="Brutowinst" bedrag={r.brutowinst} zwaar kleur={r.brutowinst >= 0 ? GROEN : ROOD} />
                    <Regel label="Kosten (poets, APK, reparatie…)" bedrag={-r.kosten} teken="− " kleur="rgba(0,19,55,0.6)" />
                    <Regel label="BTW-afdracht" bedrag={-r.btwAfdracht} teken="− " kleur="rgba(0,19,55,0.6)" />
                    <Regel label="Nettowinst" bedrag={r.nettowinst} zwaar kleur={r.nettowinst >= 0 ? GROEN : ROOD} />
                  </div>
                </Kaart>
              </>
            )}

            {/* ══ BTW per kwartaal ══ */}
            {blad === "btw" && (
              <Kaart
                titel="BTW per kwartaal"
                icon={Receipt}
                toelichting="Marge-BTW is 21/121 over verkoop min inkoop; bij 21%-facturen over het hele bedrag. Voorbelasting op je kosten staat hier niet in — die trek je apart af in je aangifte."
              >
                {data.perKwartaal.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                    Nog geen facturen
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="w-full" style={{ fontFamily: "var(--font-inter)", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid rgba(0,19,55,0.12)" }}>
                          {["Periode", "Facturen", "Omzet", "Marge-grondslag", "BTW marge", "BTW 21%", "Totaal af te dragen"].map((h, i) => (
                            <th key={h} className="px-4 py-2.5" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(0,19,55,0.45)", textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.perKwartaal.map((k, i) => (
                          <tr key={k.sleutel} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                            <td className="px-4 py-3 text-sm font-semibold" style={{ color: "#001337" }}>
                              {k.label}
                              {k.zonderInkoop.length > 0 && (
                                <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold" style={{ backgroundColor: "#fef3c7", color: AMBER }}>
                                  {k.zonderInkoop.length} onvolledig
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right" style={{ color: "rgba(0,19,55,0.6)" }}>{k.aantal}</td>
                            <td className="px-4 py-3 text-sm text-right" style={{ color: "rgba(0,19,55,0.6)", fontVariantNumeric: "tabular-nums" }}>{euro(k.omzet)}</td>
                            <td className="px-4 py-3 text-sm text-right" style={{ color: "rgba(0,19,55,0.6)", fontVariantNumeric: "tabular-nums" }}>{euro(k.margeGrondslag)}</td>
                            <td className="px-4 py-3 text-sm text-right" style={{ color: "rgba(0,19,55,0.6)", fontVariantNumeric: "tabular-nums" }}>{euro(k.btwMarge)}</td>
                            <td className="px-4 py-3 text-sm text-right" style={{ color: "rgba(0,19,55,0.6)", fontVariantNumeric: "tabular-nums" }}>{euro(k.btwHoog)}</td>
                            <td className="px-4 py-3 text-sm text-right font-bold" style={{ color: "#001337", fontVariantNumeric: "tabular-nums" }}>{euro(k.btwTotaal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="px-5 py-3.5 text-[11px]" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)", lineHeight: 1.65, borderTop: "1px solid rgba(0,19,55,0.07)" }}>
                  Dit is een hulpmiddel om je aangifte voor te bereiden, geen aangifte zelf. Controleer de
                  bedragen met je boekhouder voordat je indient.
                </p>
              </Kaart>
            )}

            {/* ══ Debiteuren ══ */}
            {blad === "debiteuren" && (
              <Kaart
                titel="Openstaande facturen"
                icon={Wallet}
                toelichting="Facturen die nog niet op betaald staan, met de oudste bovenaan."
              >
                {data.debiteuren.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Wallet size={26} style={{ color: "rgba(0,19,55,0.12)" }} />
                    <p className="text-sm font-bold mt-3" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                      Alles is betaald
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                      Geen openstaande facturen
                    </p>
                  </div>
                ) : (
                  data.debiteuren.map((d) => {
                    const teLaat = (d.dagenOver ?? 0) > 0;
                    return (
                      <div key={d.id} className="px-5 py-3 flex items-center gap-4 flex-wrap" style={{ borderBottom: "1px solid rgba(0,19,55,0.05)" }}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                            {d.factuur_nr} — {d.klant || "geen naam"}
                          </p>
                          <p className="text-[11px] truncate" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                            {[d.auto, `factuurdatum ${d.datum}`, d.vervaldatum ? `vervalt ${d.vervaldatum}` : ""].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        {d.dagenOver != null && (
                          <span
                            className="px-2 py-1 text-[10px] font-bold flex-shrink-0"
                            style={{
                              backgroundColor: teLaat ? "#fee2e2" : "#f1f5f9",
                              color: teLaat ? ROOD : "rgba(0,19,55,0.5)",
                              fontFamily: "var(--font-inter)",
                            }}
                          >
                            {teLaat ? `${d.dagenOver} dagen te laat` : `nog ${Math.abs(d.dagenOver)} dagen`}
                          </span>
                        )}
                        <p className="text-base font-bold flex-shrink-0" style={{ color: "#001337", fontFamily: "var(--font-playfair)", fontVariantNumeric: "tabular-nums" }}>
                          {euro(d.bedrag)}
                        </p>
                      </div>
                    );
                  })
                )}
                {data.debiteuren.length > 0 && (
                  <div className="px-5 py-3.5 flex items-baseline justify-between" style={{ borderTop: "1px solid rgba(0,19,55,0.12)" }}>
                    <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>Totaal openstaand</p>
                    <p className="text-lg font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)", fontVariantNumeric: "tabular-nums" }}>
                      {euro(data.debiteurenTotaal)}
                    </p>
                  </div>
                )}
              </Kaart>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

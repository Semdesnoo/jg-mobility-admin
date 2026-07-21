"use client";

import { useState, useEffect } from "react";
import { Banknote, Receipt, AlertTriangle, Info, Wallet, ArrowRight, ArrowLeftRight } from "lucide-react";

/** Waar een waarschuwing je heen kan brengen om het recht te zetten. */
type Herstelpunt = {
  factuur_nr: string;
  auto_naam: string;
  dossier_id: number | null;
  auto_id: number | null;
};

// Deze tabs bestaan in het dashboard; los getypt zodat dit bestand niet van de
// grote Tab-union in DashboardHub hoeft te importeren.
type DashTab = "calculator" | "voorraad";

type Kwartaal = {
  sleutel: string; jaar: number; kwartaal: number; label: string;
  omzet: number; btwHoog: number; btwMarge: number; btwTotaal: number;
  margeGrondslag: number; aantal: number; zonderInkoop: string[];
};

type InUit = {
  sleutel: string; label: string; jaar: number; kwartaal: number;
  inkomsten: number; inkomstenAantal: number;
  uitgaven: number; uitgavenAantal: number; saldo: number;
};

type Debiteur = {
  id: string; factuur_nr: string; klant: string; auto: string;
  bedrag: number; datum: string; vervaldatum: string;
  dagenOver: number | null; status: string;
};

type Crediteur = {
  id: string; factuurnummer: string; leverancier: string; categorie: string;
  omschrijving: string; bedrag: number; datum: string; vervaldatum: string;
  dagenOver: number | null;
};

type Boekhouding = {
  perKwartaal: Kwartaal[];
  inUit: InUit[];
  resultaat: {
    omzet: number; inkoopwaarde: number; kosten: number;
    brutowinst: number; btwAfdracht: number; nettowinst: number;
  };
  debiteuren: Debiteur[];
  debiteurenTotaal: number;
  debiteurenTeLaat: number;
  crediteuren: Crediteur[];
  crediteurenTotaal: number;
  crediteurenTeLaat: number;
  voorraadInkoop: number;
  zonderInkoop: Herstelpunt[];
  afgeleideKoppelingen: Herstelpunt[];
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

type Blad = "resultaat" | "btw" | "inuit" | "debiteuren";

export default function BoekhoudingContent({ onNavigeer }: {
  onNavigeer?: (tab: DashTab, focus?: { dossierId?: number; autoId?: number }) => void;
} = {}) {
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
    { key: "inuit", label: "In & uit" },
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
        <div className="flex items-center gap-1 mt-3 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          {BLADEN.map((b) => {
            const actief = blad === b.key;
            return (
              <button
                key={b.key}
                onClick={() => setBlad(b.key)}
                className="px-3 py-2 text-xs font-semibold transition-all flex-shrink-0 whitespace-nowrap"
                style={{
                  fontFamily: "var(--font-inter)",
                  color: actief ? "#001337" : "rgba(0,19,55,0.4)",
                  borderBottom: `2px solid ${actief ? "#001337" : "transparent"}`,
                }}
              >
                {b.label}
                {b.key === "debiteuren" && ((data?.debiteurenTeLaat ?? 0) + (data?.crediteurenTeLaat ?? 0)) > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold" style={{ backgroundColor: "#fee2e2", color: ROOD }}>
                    {(data?.debiteurenTeLaat ?? 0) + (data?.crediteurenTeLaat ?? 0)}
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

            {/* Waarschuwing bovenaan: zonder inkoopprijs kloppen marge en BTW niet.
                Elke factuur krijgt een knop die je direct naar het juiste dossier
                brengt om de inkoop in te vullen. */}
            {onvolledig && (
              <div className="flex items-start gap-3 px-4 py-3.5" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
                <AlertTriangle size={16} style={{ color: AMBER, flexShrink: 0, marginTop: 1 }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold" style={{ color: AMBER, fontFamily: "var(--font-inter)" }}>
                    {data.zonderInkoop.length} margefactuur{data.zonderInkoop.length === 1 ? "" : "en"} zonder inkoopprijs
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)", lineHeight: 1.65 }}>
                    Bij de margeregeling wordt BTW berekend over verkoop min inkoop. Zonder inkoopprijs
                    is dat niet te bepalen, dus {data.zonderInkoop.length === 1 ? "die factuur telt" : "die facturen tellen"} nu
                    <strong> niet mee</strong> in de BTW en het resultaat hieronder — een geraden bedrag zou je aangifte fout maken.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {data.zonderInkoop.map((h) => (
                      <button
                        key={h.factuur_nr}
                        type="button"
                        onClick={() => onNavigeer?.("calculator", { dossierId: h.dossier_id ?? undefined, autoId: h.auto_id ?? undefined })}
                        disabled={!onNavigeer || (h.dossier_id == null && h.auto_id == null)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: AMBER, color: "#ffffff", fontFamily: "var(--font-inter)" }}
                        title={h.dossier_id == null && h.auto_id == null ? "Geen dossier gevonden — maak er een aan in de Calculator" : "Inkoop invullen in de Calculator"}
                      >
                        {h.factuur_nr}{h.auto_naam ? ` · ${h.auto_naam}` : ""} — inkoop invullen
                        <ArrowRight size={12} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(data.afgeleideKoppelingen.length > 0) && (
              <div className="flex items-start gap-3 px-4 py-3" style={{ backgroundColor: "#f8fafc", border: "1px solid rgba(0,19,55,0.08)" }}>
                <Info size={14} style={{ color: "rgba(0,19,55,0.4)", flexShrink: 0, marginTop: 2 }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px]" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)", lineHeight: 1.65 }}>
                    Bij {data.afgeleideKoppelingen.map((h) => h.factuur_nr).join(", ")} is de inkoopprijs gevonden op
                    merk en model, niet op kenteken. Loop die na voor je aangifte doet — vul het kenteken in bij de
                    auto om de koppeling waterdicht te maken.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {data.afgeleideKoppelingen.map((h) => (
                      <button
                        key={h.factuur_nr}
                        type="button"
                        onClick={() => onNavigeer?.("voorraad", { autoId: h.auto_id ?? undefined })}
                        disabled={!onNavigeer || h.auto_id == null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ border: "1px solid rgba(0,19,55,0.2)", color: "#001337", fontFamily: "var(--font-inter)" }}
                        title="Ga naar de auto in de voorraad"
                      >
                        {h.auto_naam || h.factuur_nr} — kenteken nalopen
                        <ArrowRight size={12} />
                      </button>
                    ))}
                  </div>
                </div>
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
                  <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)", borderColor: "rgba(0,19,55,0.07)" }}>
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
                    <table className="w-full" style={{ fontFamily: "var(--font-inter)", borderCollapse: "collapse", minWidth: 760 }}>
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

            {/* ══ Geld in & uit per kwartaal (om naast de bank te leggen) ══ */}
            {blad === "inuit" && (
              <Kaart
                titel="Geld in & uit per kwartaal"
                icon={ArrowLeftRight}
                toelichting="Erbij = gefactureerde verkoop, eraf = gefactureerde inkoop, per kwartaal. Op factuurdatum (niet betaaldatum), dus de timing kan iets van je bank afwijken — het gaat erom of er iets ontbreekt."
              >
                {data.inUit.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                    Nog geen facturen
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="w-full" style={{ fontFamily: "var(--font-inter)", borderCollapse: "collapse", minWidth: 560 }}>
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid rgba(0,19,55,0.12)" }}>
                          {["Periode", "Erbij (verkoop)", "Eraf (inkoop)", "Saldo"].map((h, i) => (
                            <th key={h} className="px-4 py-2.5" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(0,19,55,0.45)", textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.inUit.map((k, i) => (
                          <tr key={k.sleutel} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                            <td className="px-4 py-3 text-sm font-semibold" style={{ color: "#001337", whiteSpace: "nowrap" }}>{k.label}</td>
                            <td className="px-4 py-3 text-right" style={{ whiteSpace: "nowrap" }}>
                              <span className="text-sm font-semibold" style={{ color: GROEN, fontVariantNumeric: "tabular-nums" }}>+ {euro(k.inkomsten)}</span>
                              <span className="block text-[10px]" style={{ color: "rgba(0,19,55,0.4)" }}>{k.inkomstenAantal} factu{k.inkomstenAantal === 1 ? "ur" : "ren"}</span>
                            </td>
                            <td className="px-4 py-3 text-right" style={{ whiteSpace: "nowrap" }}>
                              <span className="text-sm font-semibold" style={{ color: ROOD, fontVariantNumeric: "tabular-nums" }}>− {euro(k.uitgaven)}</span>
                              <span className="block text-[10px]" style={{ color: "rgba(0,19,55,0.4)" }}>{k.uitgavenAantal} factu{k.uitgavenAantal === 1 ? "ur" : "ren"}</span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-bold" style={{ color: k.saldo >= 0 ? GROEN : ROOD, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                              {k.saldo >= 0 ? "+ " : "− "}{euro(Math.abs(k.saldo))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="px-5 py-3.5 text-[11px]" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)", lineHeight: 1.65, borderTop: "1px solid rgba(0,19,55,0.07)" }}>
                  Leg dit per kwartaal naast de af- en bijschriften van je bank. Klopt <strong>erbij</strong> niet met je bijschriften, dan mist er waarschijnlijk een verkoopfactuur; klopt <strong>eraf</strong> niet, dan mist er een inkoopfactuur.
                </p>
              </Kaart>
            )}

            {/* ══ Openstaand: te ontvangen (verkoop) + te betalen (inkoop) ══ */}
            {blad === "debiteuren" && (
              <>
                {/* Samenvatting — geld dat binnenkomt vs. geld dat de deur uit moet */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Te ontvangen", sub: `${data.debiteuren.length} verkoopfactu${data.debiteuren.length === 1 ? "ur" : "ren"}`, bedrag: data.debiteurenTotaal, teLaat: data.debiteurenTeLaat, kleur: GROEN },
                    { label: "Te betalen", sub: `${data.crediteuren.length} inkoopfactu${data.crediteuren.length === 1 ? "ur" : "ren"}`, bedrag: data.crediteurenTotaal, teLaat: data.crediteurenTeLaat, kleur: ROOD },
                  ].map((c) => (
                    <div key={c.label} className="p-5" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)", borderLeft: `3px solid ${c.kleur}` }}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>{c.label}</p>
                        {c.teLaat > 0 && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: "#fee2e2", color: ROOD }}>{c.teLaat} te laat</span>
                        )}
                      </div>
                      <p className="text-2xl font-bold leading-none" style={{ fontFamily: "var(--font-playfair)", color: c.kleur }}>{euro(c.bedrag)}</p>
                      <p className="text-[11px] mt-1.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{c.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Te ontvangen — verkoopfacturen (debiteuren) */}
                <Kaart
                  titel="Te ontvangen — verkoopfacturen"
                  icon={Wallet}
                  toelichting="Verkoopfacturen die de klant nog niet betaald heeft; meest te laat bovenaan."
                >
                  {data.debiteuren.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <Wallet size={24} style={{ color: "rgba(0,19,55,0.12)" }} />
                      <p className="text-sm font-bold mt-2.5" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Alles ontvangen</p>
                      <p className="text-[11px] mt-1" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Geen openstaande verkoopfacturen</p>
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
                              style={{ backgroundColor: teLaat ? "#fee2e2" : "#f1f5f9", color: teLaat ? ROOD : "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}
                            >
                              {teLaat ? `${d.dagenOver} dagen te laat` : `nog ${Math.abs(d.dagenOver)} dagen`}
                            </span>
                          )}
                          <p className="text-base font-bold flex-shrink-0" style={{ color: GROEN, fontFamily: "var(--font-playfair)", fontVariantNumeric: "tabular-nums" }}>
                            {euro(d.bedrag)}
                          </p>
                        </div>
                      );
                    })
                  )}
                  {data.debiteuren.length > 0 && (
                    <div className="px-5 py-3.5 flex items-baseline justify-between" style={{ borderTop: "1px solid rgba(0,19,55,0.12)" }}>
                      <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>Totaal te ontvangen</p>
                      <p className="text-lg font-bold" style={{ color: GROEN, fontFamily: "var(--font-playfair)", fontVariantNumeric: "tabular-nums" }}>
                        {euro(data.debiteurenTotaal)}
                      </p>
                    </div>
                  )}
                </Kaart>

                {/* Te betalen — inkoopfacturen (crediteuren) */}
                <Kaart
                  titel="Te betalen — inkoopfacturen"
                  icon={Receipt}
                  toelichting="Inkoopfacturen die JG Mobility nog moet betalen; meest te laat bovenaan."
                >
                  {data.crediteuren.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <Receipt size={24} style={{ color: "rgba(0,19,55,0.12)" }} />
                      <p className="text-sm font-bold mt-2.5" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Alles betaald</p>
                      <p className="text-[11px] mt-1" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Geen openstaande inkoopfacturen</p>
                    </div>
                  ) : (
                    data.crediteuren.map((c) => {
                      const teLaat = (c.dagenOver ?? 0) > 0;
                      return (
                        <div key={c.id} className="px-5 py-3 flex items-center gap-4 flex-wrap" style={{ borderBottom: "1px solid rgba(0,19,55,0.05)" }}>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold truncate" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                              {c.leverancier || "onbekende leverancier"}{c.factuurnummer ? ` — ${c.factuurnummer}` : ""}
                            </p>
                            <p className="text-[11px] truncate" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                              {[c.categorie, c.omschrijving, `factuurdatum ${c.datum}`, c.vervaldatum ? `vervalt ${c.vervaldatum}` : ""].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          {c.dagenOver != null && (
                            <span
                              className="px-2 py-1 text-[10px] font-bold flex-shrink-0"
                              style={{ backgroundColor: teLaat ? "#fee2e2" : "#f1f5f9", color: teLaat ? ROOD : "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}
                            >
                              {teLaat ? `${c.dagenOver} dagen te laat` : `nog ${Math.abs(c.dagenOver)} dagen`}
                            </span>
                          )}
                          <p className="text-base font-bold flex-shrink-0" style={{ color: ROOD, fontFamily: "var(--font-playfair)", fontVariantNumeric: "tabular-nums" }}>
                            {euro(c.bedrag)}
                          </p>
                        </div>
                      );
                    })
                  )}
                  {data.crediteuren.length > 0 && (
                    <div className="px-5 py-3.5 flex items-baseline justify-between" style={{ borderTop: "1px solid rgba(0,19,55,0.12)" }}>
                      <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>Totaal te betalen</p>
                      <p className="text-lg font-bold" style={{ color: ROOD, fontFamily: "var(--font-playfair)", fontVariantNumeric: "tabular-nums" }}>
                        {euro(data.crediteurenTotaal)}
                      </p>
                    </div>
                  )}
                </Kaart>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

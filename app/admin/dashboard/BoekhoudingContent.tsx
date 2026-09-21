"use client";

import { useState, useEffect } from "react";
import { Banknote, Sparkles, ExternalLink } from "lucide-react";

/** Waar een waarschuwing je heen kan brengen om het recht te zetten. */
type Herstelpunt = {
  factuur_nr: string;
  auto_naam: string;
  dossier_id: number | null;
  auto_id: number | null;
};

type DashTab = "calculator" | "voorraad";

type Boekhouding = {
  resultaat: {
    omzet: number; inkoopwaarde: number; kosten: number;
    brutowinst: number; btwAfdracht: number; nettowinst: number;
  };
  debiteuren: { id: string }[];
  debiteurenTotaal: number;
  voorraadInkoop: number;
  zonderInkoop: Herstelpunt[];
  afgeleideKoppelingen: Herstelpunt[];
};

const GROEN = "#15803d";
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
            <Icon size={14} style={{ color: "#1d4ed8" }} />
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

function AiTegoed() {
  const knop = (href: string, label: string, primair: boolean) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-bold transition-all hover:opacity-90"
      style={{
        backgroundColor: primair ? "#001337" : "#ffffff",
        color: primair ? "#ffffff" : "#001337",
        border: primair ? "1px solid #001337" : "1px solid rgba(0,19,55,0.15)",
        fontFamily: "var(--font-inter)",
      }}
    >
      {label} <ExternalLink size={11} />
    </a>
  );

  return (
    <Kaart titel="AI-tegoed" icon={Sparkles} toelichting="Waar de AI in dit dashboard op draait">
      <div className="px-5 py-4">
        <p className="text-[12px]" style={{ color: "rgba(0,19,55,0.6)", fontFamily: "var(--font-inter)", lineHeight: 1.7 }}>
          Alles wat de AI hier doet — omschrijvingen schrijven, taxeren, de verkopersradar —
          gaat van je tegoed bij Anthropic af. Is dat op, dan stopt dat er middenin mee.
          Je koopt tegoed bij met een creditcard; het staat er direct op.
        </p>
        <div className="flex flex-wrap gap-2 mt-3.5">
          {knop("https://console.anthropic.com/settings/billing", "Tegoed bijkopen", true)}
          {knop("https://console.anthropic.com/settings/usage", "Verbruik bekijken", false)}
          {knop("https://console.anthropic.com/settings/cost", "Kosten per dag", false)}
        </div>
        <p className="text-[11px] mt-3" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
          Inloggen met het account waar de API-sleutel van dit dashboard onder valt. Zet in de
          Console ook <strong>auto-reload</strong> aan als je niet wilt dat het onverwacht opraakt.
        </p>
      </div>
    </Kaart>
  );
}

export default function BoekhoudingContent({ onNavigeer }: {
  onNavigeer?: (tab: DashTab, focus?: { dossierId?: number; autoId?: number }) => void;
} = {}) {
  const [data, setData] = useState<Boekhouding | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

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

  const r = data?.resultaat;
  const onvolledig = (data?.zonderInkoop.length ?? 0) > 0;

  return (
    <div>
      <div className="px-4 md:px-8 pt-4 md:pt-5 pb-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.08)" }}>
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Boekhouding</h2>
        <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
          Resultaat op basis van je facturen en calculatordossiers
        </p>
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

            {/* ══ Overzichtskaarten ══ */}
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
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
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

            {/* ══ Resultatenrekening ══ */}
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
          </div>
        )}

        {/* AI-tegoed altijd zichtbaar, ook als boekhouding niet laadt */}
        <div className="mt-6">
          <AiTegoed />
        </div>
      </div>
    </div>
  );
}

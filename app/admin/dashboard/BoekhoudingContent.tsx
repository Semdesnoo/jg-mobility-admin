"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Car,
  CircleDollarSign,
  ExternalLink,
  Handshake,
  ReceiptText,
  ShoppingCart,
  Sparkles,
  Wallet,
} from "lucide-react";

/** Waar een waarschuwing je heen kan brengen om het recht te zetten. */
type Herstelpunt = {
  factuur_nr: string;
  auto_naam: string;
  dossier_id: number | null;
  auto_id: number | null;
};

type DashTab = "calculator" | "voorraad";

type OpenPost = {
  id: string;
  bedrag: number;
  dagenOver: number | null;
  factuur_nr?: string;
  factuurnummer?: string;
  klant?: string;
  leverancier?: string;
};

type Boekhouding = {
  resultaat: {
    omzet: number;
    omzetInclBtw: number;
    inkoopwaarde: number;
    kosten: number;
    brutowinst: number;
    btwAfdracht: number;
    nettowinst: number;
  };
  verkoop: {
    definitiefAantal: number;
    conceptAantal: number;
    omzetInclBtw: number;
    omzetExclBtw: number;
    openstaand: number;
    betaald: number;
  };
  inkoop: {
    aantal: number;
    totaalInclBtw: number;
    bedrijfskostenExclBtw: number;
    autoInkoopInclBtw: number;
    openstaand: number;
    betaald: number;
  };
  btw: { verschuldigd: number; voorbelasting: number; saldo: number };
  consignatie: {
    nieuw: number;
    teContracteren: number;
    inVerkoop: number;
    vraagprijsInVerkoop: number;
    verwachteVergoeding: number;
  };
  debiteuren: OpenPost[];
  debiteurenTotaal: number;
  debiteurenTeLaat: number;
  crediteuren: OpenPost[];
  crediteurenTotaal: number;
  crediteurenTeLaat: number;
  voorraadInkoop: number;
  zonderInkoop: Herstelpunt[];
  afgeleideKoppelingen: Herstelpunt[];
};

const NAVY = "#001337";
const GROEN = "#15803d";
const ROOD = "#b91c1c";
const GRIJS = "rgba(0,19,55,0.58)";
const RAND = "1px solid rgba(0,19,55,0.09)";
const SCHADUW = "0 8px 24px rgba(0,19,55,0.055)";

const euro = (n: number) =>
  `€${Math.abs(n).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const euroKort = (n: number) => `${n < 0 ? "− " : ""}€${Math.round(Math.abs(n)).toLocaleString("nl-NL")}`;

function Kaart({ titel, icon: Icon, toelichting, children }: {
  titel: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  toelichting?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ backgroundColor: "#fff", border: RAND, borderRadius: "var(--radius-card)", boxShadow: SCHADUW, overflow: "hidden" }}>
      <div className="px-5 py-4" style={{ borderBottom: RAND }}>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, backgroundColor: "rgba(29,78,216,0.1)", borderRadius: "var(--radius-control)" }}>
            <Icon size={15} style={{ color: "#1d4ed8" }} />
          </div>
          <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: NAVY }}>{titel}</h3>
        </div>
        {toelichting && <p className="text-[11px] mt-1.5" style={{ color: "rgba(0,19,55,0.46)", lineHeight: 1.6 }}>{toelichting}</p>}
      </div>
      {children}
    </section>
  );
}

function Regel({ label, bedrag, teken = "", zwaar = false, kleur, toelichting }: {
  label: string;
  bedrag: number;
  teken?: string;
  zwaar?: boolean;
  kleur?: string;
  toelichting?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3" style={{ borderTop: zwaar ? "1px solid rgba(0,19,55,0.13)" : "1px solid rgba(0,19,55,0.045)" }}>
      <div>
        <p className={zwaar ? "text-sm font-bold" : "text-sm"} style={{ color: zwaar ? NAVY : GRIJS }}>{label}</p>
        {toelichting && <p className="text-[10px] mt-0.5" style={{ color: "rgba(0,19,55,0.38)" }}>{toelichting}</p>}
      </div>
      <p className={zwaar ? "text-base font-bold" : "text-sm font-semibold"} style={{ color: kleur ?? NAVY, fontFamily: zwaar ? "var(--font-playfair)" : "var(--font-inter)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {teken}{euro(bedrag)}
      </p>
    </div>
  );
}

function Kengetal({ label, waarde, sub, donker = false }: { label: string; waarde: string; sub: string; donker?: boolean }) {
  return (
    <div className="px-5 py-4 min-h-[112px]" style={{ backgroundColor: donker ? NAVY : "#fff", border: donker ? "1px solid #001337" : RAND, borderRadius: "var(--radius-card)", boxShadow: donker ? "0 10px 28px rgba(0,19,55,0.16)" : SCHADUW }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: donker ? "rgba(255,255,255,0.55)" : "rgba(0,19,55,0.45)" }}>{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ fontFamily: "var(--font-playfair)", color: donker ? "#fff" : NAVY }}>{waarde}</p>
      <p className="text-[11px] mt-2" style={{ color: donker ? "rgba(255,255,255,0.48)" : "rgba(0,19,55,0.42)" }}>{sub}</p>
    </div>
  );
}

function AiTegoed() {
  const knop = (href: string, label: string, primair: boolean) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-bold transition-all hover:opacity-90" style={{ backgroundColor: primair ? NAVY : "#fff", color: primair ? "#fff" : NAVY, border: primair ? `1px solid ${NAVY}` : "1px solid rgba(0,19,55,0.15)", borderRadius: "var(--radius-control)" }}>
      {label} <ExternalLink size={11} />
    </a>
  );

  return (
    <Kaart titel="AI-tegoed" icon={Sparkles} toelichting="Waar de AI in dit dashboard op draait">
      <div className="px-5 py-4">
        <p className="text-[12px]" style={{ color: GRIJS, lineHeight: 1.7 }}>
          Omschrijvingen, taxaties en de verkopersradar gebruiken je Anthropic-tegoed. Zet auto-reload aan om onverwachte onderbrekingen te voorkomen.
        </p>
        <div className="flex flex-wrap gap-2 mt-3.5">
          {knop("https://console.anthropic.com/settings/billing", "Tegoed bijkopen", true)}
          {knop("https://console.anthropic.com/settings/usage", "Verbruik bekijken", false)}
          {knop("https://console.anthropic.com/settings/cost", "Kosten per dag", false)}
        </div>
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
      .then(async (reactie) => {
        const inhoud = await reactie.json().catch(() => ({}));
        if (!reactie.ok) throw new Error(inhoud.error || `Fout ${reactie.status}`);
        return inhoud;
      })
      .then(setData)
      .catch((error) => setFout(error instanceof Error ? error.message : String(error)))
      .finally(() => setLaden(false));
  }, []);

  const r = data?.resultaat;
  const cashSaldo = data ? data.verkoop.betaald - data.inkoop.betaald : 0;

  return (
    <div>
      <div className="px-4 md:px-8 pt-4 md:pt-5 pb-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.08)" }}>
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: NAVY }}>Boekhouding</h2>
        <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)" }}>
          Verkoop, inkoop, voorraad en consignatie in één financieel overzicht
        </p>
      </div>

      <div className="p-4 md:p-8">
        {laden ? (
          <div className="flex items-center justify-center py-24"><div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: NAVY }} /></div>
        ) : fout ? (
          <p className="text-sm py-16 text-center" style={{ color: ROOD }}>Fout bij laden: {fout}</p>
        ) : !data || !r ? null : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
              <Kengetal label="Nettowinst" waarde={euroKort(r.nettowinst)} sub="excl. BTW, na kostprijs en kosten" donker />
              <Kengetal label="Omzet" waarde={euroKort(r.omzet)} sub={`${data.verkoop.definitiefAantal} definitieve verkoopfacturen`} />
              <Kengetal label="Debiteuren" waarde={euroKort(data.debiteurenTotaal)} sub={`${data.debiteuren.length} open · ${data.debiteurenTeLaat} te laat`} />
              <Kengetal label="Crediteuren" waarde={euroKort(data.crediteurenTotaal)} sub={`${data.crediteuren.length} open · ${data.crediteurenTeLaat} te laat`} />
              <Kengetal label="Eigen voorraad" waarde={euroKort(data.voorraadInkoop)} sub="inkoopwaarde, consignatie uitgesloten" />
              <Kengetal label="Consignatie" waarde={euroKort(data.consignatie.verwachteVergoeding)} sub={`${data.consignatie.inVerkoop} in verkoop · verwachte fee`} />
            </div>

            {data.zonderInkoop.length > 0 && (
              <section className="p-4" style={{ backgroundColor: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "var(--radius-card)" }}>
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} style={{ color: "#c2410c", marginTop: 1, flexShrink: 0 }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: "#9a3412" }}>Winst nog niet volledig controleerbaar</p>
                    <p className="text-[11px] mt-1" style={{ color: "#9a3412", lineHeight: 1.6 }}>
                      Bij {data.zonderInkoop.length} definitieve verkoopfactu{data.zonderInkoop.length === 1 ? "ur ontbreekt" : "ren ontbreekt"} een betrouwbare inkoopprijs. Deze omzet telt mee, maar de kostprijs nog niet.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {data.zonderInkoop.slice(0, 5).map((punt) => (
                        <button key={punt.factuur_nr} type="button" onClick={() => onNavigeer?.("calculator", { dossierId: punt.dossier_id ?? undefined, autoId: punt.auto_id ?? undefined })} className="px-3 py-1.5 text-[11px] font-semibold" style={{ backgroundColor: "#fff", color: NAVY, border: "1px solid rgba(0,19,55,0.18)" }}>
                          {punt.factuur_nr} · {punt.auto_naam || "auto koppelen"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <Kaart titel="Resultatenrekening" icon={Banknote} toelichting="Definitieve verkoopfacturen, gekoppelde autokostprijs en geboekte algemene inkoopkosten.">
                <Regel label="Omzet exclusief BTW" bedrag={r.omzet} />
                <Regel label="Kostprijs verkochte auto's" bedrag={r.inkoopwaarde} teken="− " />
                <Regel label="Brutowinst" bedrag={r.brutowinst} zwaar kleur={r.brutowinst >= 0 ? GROEN : ROOD} />
                <Regel label="Bedrijfskosten exclusief BTW" bedrag={r.kosten} teken="− " toelichting="Auto-inkoopfacturen zijn hier uitgesloten om dubbeltelling te voorkomen." />
                <Regel label="Nettowinst" bedrag={r.nettowinst} zwaar kleur={r.nettowinst >= 0 ? GROEN : ROOD} />
              </Kaart>

              <Kaart titel="BTW-positie" icon={ReceiptText} toelichting="Verschuldigde BTW minus terug te vragen BTW op inkoopfacturen.">
                <Regel label="BTW over verkoop" bedrag={data.btw.verschuldigd} />
                <Regel label="Voorbelasting op inkoop" bedrag={data.btw.voorbelasting} teken="− " />
                <Regel label={data.btw.saldo >= 0 ? "Te betalen BTW" : "Terug te vragen BTW"} bedrag={data.btw.saldo} zwaar kleur={data.btw.saldo >= 0 ? ROOD : GROEN} />
              </Kaart>

              <Kaart titel="Verkoopfacturen" icon={CircleDollarSign} toelichting="Concepten tellen bewust niet mee in omzet, BTW of debiteuren.">
                <Regel label="Gefactureerd inclusief BTW" bedrag={data.verkoop.omzetInclBtw} />
                <Regel label="Betaald" bedrag={data.verkoop.betaald} kleur={GROEN} />
                <Regel label="Openstaand" bedrag={data.verkoop.openstaand} zwaar kleur={data.verkoop.openstaand > 0 ? ROOD : GROEN} />
                <div className="px-5 py-3 text-[11px]" style={{ color: GRIJS, borderTop: RAND }}>
                  {data.verkoop.definitiefAantal} definitief · {data.verkoop.conceptAantal} concept/geannuleerd uitgesloten
                </div>
              </Kaart>

              <Kaart titel="Inkoopfacturen" icon={ShoppingCart} toelichting="Openstaande leveranciers, betaalde uitgaven en bedrijfskosten.">
                <Regel label="Totaal inclusief BTW" bedrag={data.inkoop.totaalInclBtw} />
                <Regel label="Betaald" bedrag={data.inkoop.betaald} kleur={GROEN} />
                <Regel label="Openstaand" bedrag={data.inkoop.openstaand} zwaar kleur={data.inkoop.openstaand > 0 ? ROOD : GROEN} />
                <div className="px-5 py-3 text-[11px]" style={{ color: GRIJS, borderTop: RAND }}>
                  Waarvan {euroKort(data.inkoop.autoInkoopInclBtw)} auto-inkoop en {euroKort(data.inkoop.bedrijfskostenExclBtw)} algemene kosten excl. BTW
                </div>
              </Kaart>

              <Kaart titel="Cashflow op betaalstatus" icon={Wallet} toelichting="Alleen wat daadwerkelijk als betaald is gemarkeerd; dit is geen banksaldo.">
                <Regel label="Ontvangen verkoopfacturen" bedrag={data.verkoop.betaald} />
                <Regel label="Betaalde inkoopfacturen" bedrag={data.inkoop.betaald} teken="− " />
                <Regel label="Netto betaalstroom" bedrag={cashSaldo} zwaar kleur={cashSaldo >= 0 ? GROEN : ROOD} />
              </Kaart>

              <Kaart titel="Consignatie" icon={Handshake} toelichting="Auto's blijven eigendom van de klant en tellen niet mee als eigen voorraad.">
                <Regel label="Vraagprijs auto's in verkoop" bedrag={data.consignatie.vraagprijsInVerkoop} />
                <Regel label="Verwachte vergoeding bij verkoop" bedrag={data.consignatie.verwachteVergoeding} zwaar kleur={GROEN} />
                <div className="grid grid-cols-3" style={{ borderTop: RAND }}>
                  {[
                    ["Nieuw", data.consignatie.nieuw],
                    ["Te contracteren", data.consignatie.teContracteren],
                    ["In verkoop", data.consignatie.inVerkoop],
                  ].map(([label, aantal]) => (
                    <div key={String(label)} className="px-3 py-3 text-center" style={{ borderRight: label !== "In verkoop" ? RAND : undefined }}>
                      <p className="text-lg font-bold" style={{ color: NAVY, fontFamily: "var(--font-playfair)" }}>{aantal}</p>
                      <p className="text-[10px]" style={{ color: GRIJS }}>{label}</p>
                    </div>
                  ))}
                </div>
              </Kaart>
            </div>

            <Kaart titel="Voorraad & controle" icon={Car} toelichting="Eigen voorraad wordt apart gehouden van klantauto's in consignatie.">
              <div className="grid grid-cols-1 md:grid-cols-3">
                <div className="px-5 py-4"><p className="text-[10px] uppercase tracking-wider" style={{ color: GRIJS }}>Eigen voorraadwaarde</p><p className="text-2xl font-bold mt-1" style={{ color: NAVY, fontFamily: "var(--font-playfair)" }}>{euroKort(data.voorraadInkoop)}</p></div>
                <div className="px-5 py-4" style={{ borderLeft: RAND }}><p className="text-[10px] uppercase tracking-wider" style={{ color: GRIJS }}>Afgeleide koppelingen</p><p className="text-2xl font-bold mt-1" style={{ color: NAVY, fontFamily: "var(--font-playfair)" }}>{data.afgeleideKoppelingen.length}</p><p className="text-[10px] mt-1" style={{ color: GRIJS }}>op merk/model i.p.v. kenteken</p></div>
                <div className="px-5 py-4" style={{ borderLeft: RAND }}><p className="text-[10px] uppercase tracking-wider" style={{ color: GRIJS }}>Ontbrekende kostprijs</p><p className="text-2xl font-bold mt-1" style={{ color: data.zonderInkoop.length ? ROOD : GROEN, fontFamily: "var(--font-playfair)" }}>{data.zonderInkoop.length}</p><p className="text-[10px] mt-1" style={{ color: GRIJS }}>definitieve verkopen om te controleren</p></div>
              </div>
            </Kaart>
          </div>
        )}

        <div className="mt-5"><AiTegoed /></div>
      </div>
    </div>
  );
}

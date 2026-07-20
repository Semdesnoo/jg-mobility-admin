"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Globe, Award, FolderOpen } from "lucide-react";
import { T, micro, num } from "./inkoop/ui";
import type { InkoopDossier, PrestatiesData } from "./inkoop/types";
import TaxatieTab from "./inkoop/TaxatieTab";
import MarktTab from "./inkoop/MarktTab";
import PrestatiesTab from "./inkoop/PrestatiesTab";
import DossiersTab from "./inkoop/DossiersTab";

type TabId = "taxatie" | "markt" | "prestaties" | "dossiers";

const TABS: { id: TabId; label: string; Icon: typeof Search; context: string }[] = [
  { id: "taxatie", label: "Taxatietool", Icon: Search, context: "Waardebepaling aan de stoeprand" },
  { id: "markt", label: "Marktoverzicht", Icon: Globe, context: "Live marktbeeld Nederland" },
  { id: "prestaties", label: "Prestaties", Icon: Award, context: "Wat verkoopt er bij JG Mobility" },
  { id: "dossiers", label: "Dossiers", Icon: FolderOpen, context: "Lopende inkooptrajecten" },
];

export default function InkoopContent() {
  const [tab, setTab] = useState<TabId>("taxatie");

  // Gedeelde data: één keer ophalen in de shell, alle tabs lezen eruit.
  const [dossiers, setDossiers] = useState<InkoopDossier[] | null>(null);
  const [prestaties, setPrestaties] = useState<PrestatiesData | null>(null);

  const laadDossiers = useCallback(async () => {
    const res = await fetch("/api/admin/inkoop");
    if (res.ok) setDossiers(await res.json());
    else setDossiers([]);
  }, []);

  // Eerste lading: alleen promise-ketens starten, geen setState in de effectbody zelf.
  // laadDossiers blijft bestaan als verversfunctie voor de tabbladen na opslaan of wijzigen.
  useEffect(() => {
    fetch("/api/admin/inkoop")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDossiers)
      .catch(() => setDossiers([]));
    fetch("/api/admin/inkoop/prestaties")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPrestaties(d))
      .catch(() => {});
  }, []);

  const open = dossiers?.filter((d) => d.status === "nieuw" || d.status === "in_onderhandeling").length ?? null;
  const actieveTab = TABS.find((t) => t.id === tab)!;

  const kerncijfers: { label: string; waarde: string; onClick?: () => void }[] = [
    { label: "Open dossiers", waarde: open === null ? "—" : String(open), onClick: () => setTab("dossiers") },
    {
      label: "Voorraad",
      waarde: prestaties ? String(prestaties.kpis.actieve_voorraad) : "—",
      onClick: () => setTab("prestaties"),
    },
    {
      label: "Gem. marge",
      waarde:
        prestaties?.kpis.gem_marge != null
          ? `€ ${Math.round(prestaties.kpis.gem_marge).toLocaleString("nl-NL")}`
          : "—",
      onClick: () => setTab("prestaties"),
    },
  ];

  return (
    <div style={{ backgroundColor: T.wash, minHeight: "100%" }}>
      {/* ── Kop: één regel, met live kerncijfers rechts ── */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 xl:px-8"
        style={{ height: 56, backgroundColor: T.paper, borderBottom: `1px solid ${T.line2}` }}
      >
        <h2 style={{ fontFamily: T.play, fontSize: 19, fontWeight: 700, color: T.navy, whiteSpace: "nowrap" }}>
          Inkoop &amp; Taxatie
        </h2>
        <span className="hidden md:block flex-shrink-0" style={{ width: 1, height: 16, backgroundColor: T.line2 }} />
        <p className="hidden md:block truncate" style={micro(T.ink(0.35))}>
          {actieveTab.context}
        </p>

        <div className="ml-auto flex items-stretch gap-0 flex-shrink-0">
          {/* Op smalle schermen is er geen ruimte voor drie cijfers mét label, en drie
              kale getallen zeggen niets — dan alleen het eerste, wél met label. */}
          {kerncijfers.map((k, i) => (
            <button
              key={k.label}
              type="button"
              onClick={k.onClick}
              className={`${i > 0 ? "hidden sm:flex" : "flex"} flex-col items-end justify-center px-3 md:px-4 transition-all hover:opacity-60`}
              style={{ borderLeft: i > 0 ? `1px solid ${T.line}` : undefined }}
            >
              <span style={{ ...micro(T.ink(0.32)), fontSize: 8.5 }}>{k.label}</span>
              <span style={num(15)}>{k.waarde}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ── Tabbalk ── */}
      <nav
        className="sticky z-30 flex items-center px-2 md:px-4 xl:px-6 overflow-x-auto"
        style={{ top: 56, height: 46, backgroundColor: T.paper, borderBottom: `1px solid ${T.line2}` }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const actief = tab === id;
          const teller = id === "dossiers" ? dossiers?.length : undefined;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className="flex items-center gap-2 px-3 md:px-4 transition-all flex-shrink-0"
              style={{
                height: 45,
                fontFamily: T.inter,
                fontSize: 12.5,
                fontWeight: 600,
                whiteSpace: "nowrap",
                color: actief ? T.navy : T.ink(0.38),
                borderBottom: `2px solid ${actief ? T.navy : "transparent"}`,
              }}
            >
              <Icon size={13} />
              {label}
              {teller != null && teller > 0 && (
                <span style={{ ...micro(actief ? T.ink(0.45) : T.ink(0.28)), fontSize: 9 }}>{teller}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Inhoud ── */}
      <div className="px-4 md:px-6 xl:px-8 py-4 md:py-6" style={{ maxWidth: 1800, margin: "0 auto" }}>
        {tab === "taxatie" && (
          <TaxatieTab dossiers={dossiers} prestaties={prestaties} onOpgeslagen={laadDossiers} onTab={setTab} />
        )}
        {tab === "markt" && <MarktTab />}
        {tab === "prestaties" && <PrestatiesTab data={prestaties} />}
        {tab === "dossiers" && (
          <DossiersTab dossiers={dossiers} herlaad={laadDossiers} onNieuweTaxatie={() => setTab("taxatie")} />
        )}
      </div>
    </div>
  );
}

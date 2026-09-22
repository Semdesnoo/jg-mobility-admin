"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Archive, Brain } from "lucide-react";
import { T, micro, num } from "./inkoop/ui";
import type { InkoopDossier, PrestatiesData } from "./inkoop/types";
import TaxatieTab from "./inkoop/TaxatieTab";
import ArchiefTab from "./inkoop/ArchiefTab";
import PrijsgeheugenTab from "./inkoop/PrijsgeheugenTab";

type TabId = "taxatie" | "archief" | "prijsgeheugen";

const TABS: { id: TabId; label: string; Icon: typeof Search; context: string }[] = [
  { id: "taxatie", label: "Taxatietool", Icon: Search, context: "Waardebepaling aan de stoeprand" },
  { id: "archief", label: "Archief", Icon: Archive, context: "Bewaarde analyses per kwartaal" },
  { id: "prijsgeheugen", label: "Prijsgeheugen", Icon: Brain, context: "Wat auto's in het echt deden" },
];

export default function InkoopContent({
  kenteken,
}: {
  /** Vanuit een aanvraag doorgestuurd: begin meteen op de taxatietool met dit kenteken. */
  kenteken?: string;
} = {}) {
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

  // Kerncijfers rechts in de kop — informatief, niet meer klikbaar (de tabbladen
  // waar ze naartoe sprongen zijn weg).
  const kerncijfers: { label: string; waarde: string }[] = [
    { label: "Open dossiers", waarde: open === null ? "—" : String(open) },
    {
      label: "Voorraad",
      waarde: prestaties ? String(prestaties.kpis.actieve_voorraad) : "—",
    },
    {
      label: "Gem. marge",
      waarde:
        prestaties?.kpis.gem_marge != null
          ? `€ ${Math.round(prestaties.kpis.gem_marge).toLocaleString("nl-NL")}`
          : "—",
    },
  ];

  return (
    <div style={{ backgroundColor: T.wash, minHeight: "100%" }}>
      {/* ── Kop: één regel, met live kerncijfers rechts ── */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 xl:px-8"
        style={{ height: 56, backgroundColor: T.paper, borderBottom: `1px solid ${T.line2}` }}
      >
        <h2
          className="min-w-0 truncate text-[17px] sm:text-[19px]"
          style={{ fontFamily: T.play, fontWeight: 700, color: T.navy }}
        >
          Inkoop &amp; Taxatie
        </h2>
        <span className="hidden md:block flex-shrink-0" style={{ width: 1, height: 16, backgroundColor: T.line2 }} />
        <p className="hidden md:block min-w-0 truncate" style={micro(T.ink(0.35))}>
          {actieveTab.context}
        </p>

        <div className="ml-auto flex items-stretch gap-0 flex-shrink-0">
          {/* Op smalle schermen is er geen ruimte voor drie cijfers mét label, en drie
              kale getallen zeggen niets — dan alleen het eerste, wél met label. */}
          {kerncijfers.map((k, i) => (
            <div
              key={k.label}
              className={`${i > 0 ? "hidden sm:flex" : "flex"} flex-col items-end justify-center px-3 md:px-4`}
              style={{ borderLeft: i > 0 ? `1px solid ${T.line}` : undefined }}
            >
              <span style={{ ...micro(T.ink(0.32)), fontSize: 8.5 }}>{k.label}</span>
              <span style={num(15)}>{k.waarde}</span>
            </div>
          ))}
        </div>
      </header>

      {/* ── Tabbalk ── */}
      <nav
        className="sticky z-30 flex items-center gap-2 px-2 md:px-4 xl:px-6 overflow-x-auto"
        style={{ top: 56, height: 44, backgroundColor: T.paper, borderBottom: `1px solid ${T.line2}` }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const actief = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className="jg-tab-swatch"
              data-active={actief}
            >
              <Icon size={13} style={{ opacity: actief ? 1 : 0.55 }} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* ── Inhoud ── */}
      <div className="px-4 md:px-6 xl:px-8 py-4 md:py-6" style={{ maxWidth: 1800, margin: "0 auto" }}>
        {tab === "taxatie" && (
          <TaxatieTab
            prestaties={prestaties}
            onOpgeslagen={laadDossiers}
            startKenteken={kenteken}
          />
        )}
        {tab === "archief" && <ArchiefTab />}
        {tab === "prijsgeheugen" && <PrijsgeheugenTab />}
      </div>
    </div>
  );
}

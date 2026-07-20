"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Car,
  Handshake,
  Share2,
  FileText,
  RefreshCw,
  LogOut,
  Plus,
  ExternalLink,
  Calculator,
  Trash2,
  Users,
  Calendar,
  TrendingDown,
  BarChart2,
  Search,
  Pencil,
  LayoutGrid,
  CheckCircle2,
  Package,
  Wallet,
  AlertTriangle,
  Clock,
  ImageOff,
  TrendingUp,
  Cpu,
  Bell,
  Banknote,
} from "lucide-react";
import DeleteButton from "./DeleteButton";
import KlantenContent from "./KlantenContent";
import AfsprakenContent from "./AfsprakenContent";
import InkoopContent from "./InkoopContent";
import StatistiekenContent from "./StatistiekenContent";
import MoliboxPage from "./MoliboxPage";
import CosignatieContent from "./CosignatieContent";
import MerkAnalyseContent from "./MerkAnalyseContent";
import BoekhoudingContent from "./BoekhoudingContent";
import InkoopFacturenContent from "./InkoopFacturenContent";
import SocialContent from "./SocialContent";

type Tab = "dashboard" | "voorraad" | "cosignatie" | "social" | "facturen" | "calculator" | "klanten" | "afspraken" | "inkoop" | "statistieken" | "merkanalyse" | "boekhouding" | "inkoopfacturen" | "molibox";

type Auto = {
  id: number;
  slug: string;
  merk: string;
  model: string;
  bouwjaar: number;
  km: number;
  brandstof: string;
  prijs: number;
  verkocht: boolean;
  gereserveerd?: boolean;
  fotos: string[];
  apk?: string;              // "MM-JJJJ" of "Onbekend"
  kenteken?: string;
  toegevoegd_op?: string;    // ISO — basis voor de standtijd
  verkocht_op?: string;
};

type KostenRegel = { label: string; bedrag: string };

type Dossier = {
  id: number;
  auto_naam: string;
  inkoop: number;
  btw_type: "marge" | "21";
  verkoopprijs: number;
  kosten: KostenRegel[];
  aangemaakt: string;
  auto_id?: number | null;
  gearchiveerd?: boolean;
};

type IconProps = { size?: number; style?: React.CSSProperties; className?: string };

type NavItem = { id: Tab; label: string; icon: React.ComponentType<IconProps> };

// Menu gegroepeerd onder kopjes (zoals een dashboard met secties).
// `icon` wordt gebruikt voor het vakje van de groep op het hub-startscherm.
const NAV_GROUPS: { title: string; icon: React.ComponentType<IconProps>; items: NavItem[] }[] = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { id: "dashboard",    label: "Dashboard",       icon: LayoutDashboard },
      { id: "statistieken", label: "Statistieken",    icon: BarChart2 },
      { id: "merkanalyse",  label: "Standtijd & Merken", icon: Clock },
    ],
  },
  {
    title: "Auto",
    icon: Car,
    items: [
      { id: "voorraad",   label: "Auto Voorraad",    icon: Car },
      { id: "inkoop",     label: "Inkoop & Taxatie", icon: TrendingDown },
      { id: "cosignatie", label: "Cosignatie",       icon: Handshake },
      { id: "calculator", label: "Calculator",       icon: Calculator },
      { id: "afspraken",  label: "Afspraken",        icon: Calendar },
      { id: "molibox",    label: "Molibox",          icon: LayoutGrid },
    ],
  },
  {
    title: "Socials",
    icon: Share2,
    items: [
      { id: "social", label: "Social Media", icon: Share2 },
    ],
  },
  {
    title: "Boekhouding",
    icon: FileText,
    items: [
      { id: "boekhouding", label: "Boekhouding", icon: Banknote },
      { id: "facturen", label: "Verkoopfacturen", icon: FileText },
      { id: "inkoopfacturen", label: "Inkoopfacturen", icon: Wallet },
      { id: "klanten",  label: "Klanten",  icon: Users },
    ],
  },
];


function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="px-4 md:px-8 py-4 md:py-5 flex items-center justify-between sticky top-0 z-10"
      style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}
    >
      <div>
        <h2
          className="text-xl font-bold"
          style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="text-xs mt-0.5"
            style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent = "#001337",
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<IconProps>;
  accent?: string;
}) {
  return (
    <div
      className="relative p-5 md:p-6 overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid rgba(0,19,55,0.07)",
        boxShadow: "0 1px 3px rgba(0,19,55,0.05)",
      }}
    >
      {/* accentstreep links */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accent }} />
      <div className="flex items-start justify-between gap-2 mb-3">
        <p
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}
        >
          {label}
        </p>
        {Icon && (
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 30, height: 30, backgroundColor: `${accent}14`, borderRadius: 8 }}
          >
            <Icon size={15} style={{ color: accent }} />
          </div>
        )}
      </div>
      <p
        className="text-2xl md:text-[28px] font-bold leading-none"
        style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}
      >
        {value}
      </p>
    </div>
  );
}

// ── Hulp: standtijd & aandachtspunten ──────────────────────────
const MS_PER_DAG = 86_400_000;

function standtijdDagen(auto: Auto): number | null {
  if (!auto.toegevoegd_op) return null;
  const d = new Date(auto.toegevoegd_op);
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / MS_PER_DAG));
}

// APK staat er in twee smaken in: "MM-JJJJ" (RDW-lookup) en "DD-MM-JJJJ" (handmatig
// ingevuld). Geeft het aantal maanden tot verval terug, of null als het onbekend is.
function maandenTotApk(apk: string | undefined): number | null {
  if (!apk || apk === "Onbekend") return null;
  const kort = apk.match(/^(\d{1,2})-(\d{4})$/);          // MM-JJJJ
  const lang = apk.match(/^\d{1,2}-(\d{1,2})-(\d{4})$/);  // DD-MM-JJJJ
  const m = kort ?? lang;
  if (!m) return null;
  const maand = parseInt(m[1]);
  const jaar = parseInt(m[2]);
  if (isNaN(maand) || isNaN(jaar) || maand < 1 || maand > 12) return null;
  const nu = new Date();
  return (jaar - nu.getFullYear()) * 12 + (maand - (nu.getMonth() + 1));
}

type Aandachtspunt = { auto: Auto; reden: string; kleur: string; icon: React.ComponentType<IconProps> };

// Alles wat een auto in de weg staat om te verkopen, op één hoop.
function verzamelAandachtspunten(beschikbaar: Auto[]): Aandachtspunt[] {
  const punten: Aandachtspunt[] = [];
  for (const a of beschikbaar) {
    if (!a.fotos || a.fotos.length === 0) {
      punten.push({ auto: a, reden: "Geen foto's", kleur: "#b91c1c", icon: ImageOff });
    } else if (a.fotos.length < 5) {
      punten.push({ auto: a, reden: `Maar ${a.fotos.length} foto's`, kleur: "#b45309", icon: ImageOff });
    }
    if (!a.prijs || a.prijs <= 0) {
      punten.push({ auto: a, reden: "Geen prijs ingevuld", kleur: "#b91c1c", icon: Wallet });
    }
    const apkMaanden = maandenTotApk(a.apk);
    if (apkMaanden != null && apkMaanden < 0) {
      punten.push({ auto: a, reden: "APK verlopen", kleur: "#b91c1c", icon: AlertTriangle });
    } else if (apkMaanden != null && apkMaanden <= 2) {
      punten.push({ auto: a, reden: `APK verloopt over ${apkMaanden} mnd`, kleur: "#b45309", icon: AlertTriangle });
    }
    const dagen = standtijdDagen(a);
    if (dagen != null && dagen >= 90) {
      punten.push({ auto: a, reden: `${dagen} dagen in voorraad`, kleur: "#b45309", icon: Clock });
    }
  }
  return punten;
}


export default function DashboardHub() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [hubOpen, setHubOpen] = useState(true);
  // Welke hub-groep is gekozen — de zijbalk toont alleen de items van deze groep.
  // Terug naar de hub om een andere groep te openen.
  const [groep, setGroep] = useState<string>(NAV_GROUPS[0].title);
  const actieveGroep = NAV_GROUPS.find((g) => g.title === groep) ?? NAV_GROUPS[0];

  const openGroep = (titel: string, eersteTab: Tab) => {
    setGroep(titel);
    setTab(eersteTab);
    setHubOpen(false);
  };

  // Spring naar een tab én zet de zijbalk op de groep waar die tab in zit.
  // Zonder dat laatste toont het menu een andere sectie dan de pagina die openstaat.
  const gaNaarTab = (doel: Tab) => {
    const groepVanTab = NAV_GROUPS.find((g) => g.items.some((i) => i.id === doel));
    if (groepVanTab) setGroep(groepVanTab.title);
    setTab(doel);
    setHubOpen(false);
  };
  const [autos, setAutos] = useState<Auto[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const laadAutos = useCallback(async () => {
    const res = await fetch("/api/admin/autos");
    if (res.ok) setAutos(await res.json());
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await laadAutos();
    setLastRefresh(new Date());
    setCountdown(60);
    setRefreshing(false);
  }, [laadAutos]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refresh();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [refresh]);

  const beschikbaar = autos.filter((a) => !a.verkocht);
  const verkocht = autos.filter((a) => a.verkocht);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#f0f2f5" }}>
      {/* ── Zijbalk (alleen desktop) ── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0"
        style={{ width: "220px", backgroundColor: "#001337", height: "100vh" }}
      >
        {/* Logo */}
        <div className="px-6 py-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <p
            className="text-[9px] tracking-widest uppercase mb-1.5"
            style={{ color: "rgba(255,255,255,0.28)", fontFamily: "var(--font-inter)" }}
          >
            Beheer
          </p>
          <h1
            className="text-xl font-bold text-white"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            JG Mobility
          </h1>
        </div>

        {/* Navigatie */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {/* Terug naar het hub-startscherm */}
          <button
            onClick={() => setHubOpen(true)}
            className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left transition-all hover:opacity-80"
            style={{
              fontFamily: "var(--font-inter)",
              color: "rgba(255,255,255,0.55)",
              backgroundColor: "rgba(255,255,255,0.05)",
              borderLeft: "2px solid transparent",
            }}
          >
            <LayoutGrid size={15} />
            Hub
          </button>
          {/* Alleen de gekozen groep — via de hub wissel je van groep */}
          <div className="mb-1.5">
            <p
              className="px-5 pt-3 pb-1 text-[9px] font-semibold tracking-widest uppercase"
              style={{ color: "rgba(255,255,255,0.28)", fontFamily: "var(--font-inter)" }}
            >
              {actieveGroep.title}
            </p>
            {actieveGroep.items.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left transition-all"
                style={{
                  fontFamily: "var(--font-inter)",
                  color: tab === id ? "#ffffff" : "rgba(255,255,255,0.42)",
                  backgroundColor: tab === id ? "rgba(255,255,255,0.09)" : "transparent",
                  borderLeft: `2px solid ${tab === id ? "#ffffff" : "transparent"}`,
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* Voettekst */}
        <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 mb-3 text-[11px] transition-all hover:opacity-70"
            style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-inter)" }}
          >
            <RefreshCw size={10} className={refreshing ? "animate-spin" : ""} />
            {refreshing
              ? "Verversen..."
              : `${countdown}s · ${lastRefresh.toLocaleTimeString("nl-NL", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
          </button>
          <form action="/api/admin/logout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium transition-all hover:opacity-70"
              style={{
                backgroundColor: "rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.45)",
                fontFamily: "var(--font-inter)",
              }}
            >
              <LogOut size={12} />
              Uitloggen
            </button>
          </form>
        </div>
      </aside>

      {/* ── Hoofdinhoud ── */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobiel: terug naar de hub + de items van de gekozen groep
            (op mobiel is er geen zijbalk, dus die items horen hier) */}
        <div
          className={`md:hidden sticky top-0 z-20 ${hubOpen ? "hidden" : "block"}`}
          style={{ backgroundColor: "#001337" }}
        >
          <div className="flex items-center gap-3 px-4" style={{ height: "52px" }}>
            <button
              onClick={() => setHubOpen(true)}
              className="flex items-center gap-1.5 text-sm transition-all hover:opacity-70"
              style={{ color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-inter)" }}
            >
              ← Hub
            </button>
            <span className="text-sm font-semibold text-white" style={{ fontFamily: "var(--font-inter)" }}>
              {actieveGroep.title}
            </span>
          </div>
          {actieveGroep.items.length > 1 && (
            <div
              className="flex items-center gap-1 px-3 pb-2 overflow-x-auto"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "8px" }}
            >
              {actieveGroep.items.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all"
                  style={{
                    fontFamily: "var(--font-inter)",
                    color: tab === id ? "#001337" : "rgba(255,255,255,0.55)",
                    backgroundColor: tab === id ? "#ffffff" : "rgba(255,255,255,0.07)",
                  }}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {tab === "dashboard" && (
          <DashboardContent
            autos={autos}
            beschikbaar={beschikbaar}
            verkocht={verkocht}
            lastRefresh={lastRefresh}
            refresh={refresh}
            onTab={gaNaarTab}
          />
        )}
        {tab === "voorraad" && <VoorraadContent autos={autos} refresh={refresh} />}
        {tab === "klanten" && <KlantenContent />}
        {tab === "afspraken" && <AfsprakenContent />}
        {tab === "inkoop" && <InkoopContent />}
        {tab === "cosignatie" && <CosignatieContent />}
        {tab === "facturen" && <FacturenContent />}
        {tab === "calculator" && <CalculatorContent />}
        {tab === "statistieken" && <StatistiekenContent />}
        {tab === "merkanalyse" && <MerkAnalyseContent />}
        {tab === "boekhouding" && <BoekhoudingContent />}
        {tab === "inkoopfacturen" && <InkoopFacturenContent />}
        {tab === "molibox" && <MoliboxPage />}
        {tab === "social" && <SocialContent />}
      </main>

      {/* ── Hub (full-screen startscherm, mobiel én desktop) ── */}
      {hubOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto"
          style={{ backgroundColor: "#001337" }}
        >
          {/* Bovenbalk — logo links, uitloggen rechts */}
          <div className="flex-shrink-0 px-5 md:px-10 pt-7 md:pt-8 pb-4 flex items-center justify-between">
            <div>
              <p className="text-[9px] tracking-widest uppercase mb-0.5" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-inter)" }}>
                Beheer
              </p>
              <h1 className="text-xl md:text-2xl font-bold text-white" style={{ fontFamily: "var(--font-playfair)" }}>
                JG Mobility
              </h1>
            </div>
            <div className="flex items-center gap-2.5">
              <MeldingenBel onGaNaar={gaNaarTab} />
              <form action="/api/admin/logout" method="POST">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all hover:opacity-80"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-inter)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <LogOut size={11} />
                  Uitloggen
                </button>
              </form>
            </div>
          </div>

          {/* Midden — vakjes gecentreerd op het scherm */}
          <div className="flex-1 flex items-center justify-center px-5 md:px-10 py-8">
            <div className="w-full max-w-3xl">
              <p
                className="text-center text-[10px] md:text-[11px] tracking-widest uppercase mb-6 md:mb-8"
                style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-inter)" }}
              >
                Waar wil je heen?
              </p>

              {/* Hoofdkopjes als vakjes — klik opent die sectie met het menu links */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
                {NAV_GROUPS.map((group) => {
                  const Icon = group.icon;
                  return (
                    <button
                      key={group.title}
                      onClick={() => openGroep(group.title, group.items[0].id)}
                      className="group flex flex-col items-center justify-center gap-3 md:gap-4 py-7 md:py-9 px-3 transition-all active:scale-95 hover:-translate-y-1"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      {/* Icoonvlak */}
                      <div
                        className="flex items-center justify-center transition-all"
                        style={{
                          width: 56,
                          height: 56,
                          backgroundColor: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.14)",
                        }}
                      >
                        <Icon size={26} style={{ color: "#ffffff" }} />
                      </div>
                      {/* Titel onder het icoon */}
                      <p
                        className="text-xs md:text-sm font-semibold leading-tight text-center text-white"
                        style={{ fontFamily: "var(--font-inter)" }}
                      >
                        {group.title}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Snelle stats — slanke regel onder de vakjes */}
              <div className="mt-8 md:mt-10 flex items-center justify-center">
                {[
                  { label: "Beschikbaar", value: beschikbaar.length },
                  { label: "Verkocht", value: verkocht.length },
                  { label: "Totaal", value: autos.length },
                ].map((s, i) => (
                  <div
                    key={s.label}
                    className="px-6 md:px-9 text-center"
                    style={{ borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <p className="text-xl md:text-2xl font-bold text-white" style={{ fontFamily: "var(--font-playfair)" }}>
                      {s.value}
                    </p>
                    <p className="text-[9px] md:text-[10px] tracking-wider uppercase mt-0.5" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-inter)" }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dashboard overzicht ─────────────────────────────────────────
function DashboardContent({
  autos,
  beschikbaar,
  verkocht,
  lastRefresh,
  refresh,
  onTab,
}: {
  autos: Auto[];
  beschikbaar: Auto[];
  verkocht: Auto[];
  lastRefresh: Date;
  refresh: () => void;
  onTab: (t: Tab) => void;
}) {
  // Prijs- en statusbewerking zitten in VoorraadTabel — hier alleen het totaal.
  const totaalWaarde = beschikbaar.reduce((s, a) => s + a.prijs, 0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Laatste update: ${lastRefresh.toLocaleTimeString("nl-NL", {
          hour: "2-digit",
          minute: "2-digit",
        })}`}
        action={
          <a
            href="https://www.jgmobility.nl/aanbod"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all hover:opacity-70"
            style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
          >
            <ExternalLink size={12} /> Website
          </a>
        }
      />

      <div className="p-4 md:p-8 flex flex-col gap-5 md:gap-7">
        {/* Statistieken */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="In aanbod" value={beschikbaar.length} icon={Car} accent="#15803d" />
          <StatCard label="Verkocht" value={verkocht.length} icon={CheckCircle2} accent="#1d4ed8" />
          <StatCard label="Totaal voertuigen" value={autos.length} icon={Package} accent="#7c3aed" />
          <StatCard
            label="Totale voorraadwaarde"
            value={totaalWaarde ? `€${totaalWaarde.toLocaleString("nl-NL")}` : "—"}
            icon={Wallet}
            accent="#b45309"
          />
        </div>

        {/* Snelle acties */}
        <SnelleActies onTab={onTab} />

        {/* Omzet & marge (links) + aandachtspunten (rechts) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-7 items-start">
          <MaandWidget />
          <AandachtWidget beschikbaar={beschikbaar} />
        </div>

        {/* Claude Code verbruik */}
        <ClaudeVerbruikWidget />

        {/* Kenteken check */}
        <KentekenWidget />

        {/* Voorraad — compacte tabel */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: "rgba(0,19,55,0.06)", borderRadius: 7 }}>
                <Car size={14} style={{ color: "#001337" }} />
              </div>
              <h3 className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                Op voorraad
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5" style={{ backgroundColor: "rgba(0,19,55,0.05)", color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)", borderRadius: 6 }}>{beschikbaar.length}</span>
            </div>
            <Link
              href="/admin/auto-toevoegen"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
            >
              <Plus size={12} /> Nieuwe auto
            </Link>
          </div>
          <VoorraadTabel autos={autos} refresh={refresh} compact alleenLezen toon="voorraad" />
        </div>
      </div>
    </div>
  );
}

// ── Compacte voorraadtabel ──────────────────────────────────────
type SorteerVeld = "auto" | "bouwjaar" | "km" | "prijs" | "standtijd";

function statusVan(a: Auto): "beschikbaar" | "gereserveerd" | "verkocht" {
  if (a.verkocht) return "verkocht";
  if (a.gereserveerd) return "gereserveerd";
  return "beschikbaar";
}

const STATUS_STIJL: Record<string, { bg: string; color: string; label: string }> = {
  beschikbaar:  { bg: "#dcfce7", color: "#15803d", label: "Beschikbaar" },
  gereserveerd: { bg: "#fef3c7", color: "#b45309", label: "Gereserveerd" },
  verkocht:     { bg: "#e0e7ff", color: "#3730a3", label: "Verkocht" },
};

// Korte labels: drie knoppen naast elkaar passen niet met de volledige woorden.
const STATUS_KORT: Record<string, string> = {
  beschikbaar: "Beschikb.",
  gereserveerd: "Geres.",
  verkocht: "Verkocht",
};
const STATUS_BREEDTE = 230;

/** Sorteerbare kolomkop. Buiten de tabel gedefinieerd zodat React hem niet bij
 *  elke render als nieuw componenttype ziet (dat remount de hele kop). */
function SorteerKop({
  veld, label, actief, oplopend, rechts = false, onClick,
}: {
  veld: SorteerVeld;
  label: string;
  actief: boolean;
  oplopend: boolean;
  rechts?: boolean;
  onClick: (veld: SorteerVeld) => void;
}) {
  return (
    <button
      onClick={() => onClick(veld)}
      className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-all hover:opacity-70 ${rechts ? "ml-auto" : ""}`}
      style={{ color: actief ? "#001337" : "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}
    >
      {label}
      {actief && <span style={{ fontSize: 8 }}>{oplopend ? "▲" : "▼"}</span>}
    </button>
  );
}

function VoorraadTabel({
  autos: alleAutos,
  refresh,
  compact = false,
  alleenLezen = false,
  toon = "voorraad",
}: {
  autos: Auto[];
  refresh: () => void;
  compact?: boolean;
  /** Dashboard-modus: alleen kijken, niets aanpassen. */
  alleenLezen?: boolean;
  /** Welke map: wat er nu staat, of wat verkocht is. Nooit door elkaar. */
  toon?: "voorraad" | "verkocht";
}) {
  // Gereserveerde auto's staan er fysiek nog, dus die vallen onder voorraad.
  const autos = alleAutos.filter((a) => (toon === "verkocht" ? a.verkocht : !a.verkocht));
  const [zoek, setZoek] = useState("");
  const [sorteer, setSorteer] = useState<SorteerVeld>("standtijd");
  const [oplopend, setOplopend] = useState(false);
  // Alles bewerken loopt via de Bewerken-knop naar de bewerkpagina. Alleen de
  // status kan hier direct om — dat is de handeling die je het vaakst doet.
  const [statusBezig, setStatusBezig] = useState<number | null>(null);

  const zetStatus = async (id: number, status: "beschikbaar" | "gereserveerd" | "verkocht") => {
    if (status === "gereserveerd" && !confirm("Wil je deze auto als Gereserveerd markeren?")) return;
    if (status === "verkocht" && !confirm("Wil je deze auto als Verkocht markeren?")) return;
    setStatusBezig(id);
    try {
      await fetch(`/api/admin/autos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      refresh();
    } finally {
      setStatusBezig(null);
    }
  };

  const term = zoek.trim().toLowerCase();
  const gefilterd = autos
    .filter((a) =>
      !term ||
      `${a.merk} ${a.model} ${a.bouwjaar} ${a.brandstof} ${a.kenteken ?? ""}`.toLowerCase().includes(term)
    );

  const gesorteerd = [...gefilterd].sort((a, b) => {
    const richting = oplopend ? 1 : -1;
    switch (sorteer) {
      case "auto":     return richting * `${a.merk} ${a.model}`.localeCompare(`${b.merk} ${b.model}`);
      case "bouwjaar": return richting * (a.bouwjaar - b.bouwjaar);
      case "km":       return richting * (a.km - b.km);
      case "prijs":    return richting * (a.prijs - b.prijs);
      case "standtijd": return richting * ((standtijdDagen(a) ?? -1) - (standtijdDagen(b) ?? -1));
    }
  });

  const lijst = compact ? gesorteerd.slice(0, 8) : gesorteerd;

  const sorteerOp = (veld: SorteerVeld) => {
    if (sorteer === veld) setOplopend((o) => !o);
    else { setSorteer(veld); setOplopend(false); }
  };

  return (
    <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
      {/* Zoeken + filteren — op het dashboard overbodig, daar is het een overzicht */}
      <div
        className={`px-4 py-3 flex-col md:flex-row md:items-center gap-3 ${compact ? "hidden" : "flex"}`}
        style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Search size={13} style={{ color: "rgba(0,19,55,0.3)", flexShrink: 0 }} />
          <input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek op merk, model, jaar of kenteken..."
            className="flex-1 min-w-0 text-sm outline-none bg-transparent"
            style={{ color: "#001337", fontFamily: "var(--font-inter)" }}
          />
        </div>
        <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
          {gefilterd.length} van {autos.length}
        </span>
      </div>

      {/* Kolomkoppen — alleen op desktop, mobiel wordt het een lijst */}
      <div
        className="hidden md:flex items-center gap-3 px-4 py-2"
        style={{ borderBottom: "1px solid rgba(0,19,55,0.07)", backgroundColor: "#fafbfc" }}
      >
        <div style={{ width: 48 }} />
        <div className="flex-1 min-w-0"><SorteerKop veld="auto" label="Auto" actief={sorteer === "auto"} oplopend={oplopend} onClick={sorteerOp} /></div>
        <div style={{ width: 60 }}><SorteerKop veld="bouwjaar" label="Jaar" actief={sorteer === "bouwjaar"} oplopend={oplopend} onClick={sorteerOp} /></div>
        <div style={{ width: 90 }}><SorteerKop veld="km" label="Km" actief={sorteer === "km"} oplopend={oplopend} onClick={sorteerOp} /></div>
        <div style={{ width: 80 }}><SorteerKop veld="standtijd" label="Standtijd" actief={sorteer === "standtijd"} oplopend={oplopend} onClick={sorteerOp} /></div>
        <div style={{ width: 100 }} className="flex"><SorteerKop veld="prijs" label="Prijs" actief={sorteer === "prijs"} oplopend={oplopend} onClick={sorteerOp} rechts /></div>
        <div style={{ width: STATUS_BREEDTE }}>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Status</p>
        </div>
        {!alleenLezen && <div style={{ width: 200 }} />}
      </div>

      {/* Rijen */}
      {lijst.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Car size={32} style={{ color: "rgba(0,19,55,0.1)" }} />
          <p className="text-sm font-bold mt-3" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
            {autos.length === 0 ? "Nog geen auto's" : "Geen auto's gevonden"}
          </p>
          {term && (
            <p className="text-[11px] mt-1" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
              Probeer een andere zoekterm
            </p>
          )}
        </div>
      ) : (
        lijst.map((auto) => {
          const st = statusVan(auto);
          const dagen = standtijdDagen(auto);
          const lang = dagen != null && dagen >= 90;
          return (
            <div
              key={auto.id}
              className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 px-4 py-2.5 transition-all hover:bg-slate-50"
              style={{ borderBottom: "1px solid rgba(0,19,55,0.05)" }}
            >
              {/* Foto */}
              <div className="flex items-center gap-3 md:contents">
                <div className="relative flex-shrink-0 overflow-hidden" style={{ width: 48, height: 34, backgroundColor: "#001337" }}>
                  {auto.fotos?.length > 0 ? (
                    <Image src={auto.fotos[0]} alt="" fill sizes="48px" className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageOff size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
                    </div>
                  )}
                </div>

                {/* Naam — platte tekst; bewerken loopt via de knop rechts */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold block truncate" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                    {auto.merk} {auto.model}
                  </p>
                  <p className="md:hidden text-[11px]" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                    {auto.bouwjaar} · {auto.km.toLocaleString("nl-NL")} km · {auto.brandstof}
                  </p>
                </div>
              </div>

              {/* Kolommen — desktop */}
              <p className="hidden md:block text-xs" style={{ width: 60, color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)" }}>
                {auto.bouwjaar}
              </p>
              <p className="hidden md:block text-xs" style={{ width: 90, color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)" }}>
                {auto.km.toLocaleString("nl-NL")}
              </p>
              <p
                className="hidden md:block text-xs font-semibold"
                style={{ width: 80, color: lang ? "#b45309" : "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)" }}
              >
                {dagen != null ? `${dagen} dgn` : "—"}
              </p>

              {/* Prijs */}
              <p className="hidden md:block text-sm font-bold text-right" style={{ width: 100, color: "#001337", fontFamily: "var(--font-playfair)" }}>
                €{auto.prijs.toLocaleString("nl-NL")}
              </p>

              {/* Status — klikbaar: dit is de handeling die het vaakst nodig is */}
              <div style={{ width: STATUS_BREEDTE }} className="hidden md:flex items-center gap-1">
                {alleenLezen ? (
                  <span
                    className="inline-block px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ fontFamily: "var(--font-inter)", backgroundColor: STATUS_STIJL[st].bg, color: STATUS_STIJL[st].color }}
                  >
                    {STATUS_STIJL[st].label}
                  </span>
                ) : (
                  (["beschikbaar", "gereserveerd", "verkocht"] as const).map((s) => {
                    const actief = st === s;
                    return (
                      <button
                        key={s}
                        onClick={() => !actief && zetStatus(auto.id, s)}
                        disabled={statusBezig === auto.id}
                        title={`Markeer als ${STATUS_STIJL[s].label}`}
                        className="px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition-all hover:opacity-80 disabled:opacity-40"
                        style={{
                          fontFamily: "var(--font-inter)",
                          backgroundColor: actief ? STATUS_STIJL[s].bg : "transparent",
                          color: actief ? STATUS_STIJL[s].color : "rgba(0,19,55,0.3)",
                          border: `1px solid ${actief ? STATUS_STIJL[s].color : "rgba(0,19,55,0.12)"}`,
                          cursor: actief ? "default" : "pointer",
                        }}
                      >
                        {STATUS_KORT[s]}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Mobiel: prijs + status op één regel */}
              <div className="md:hidden flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                  €{auto.prijs.toLocaleString("nl-NL")}
                </span>
                {alleenLezen ? (
                  <span
                    className="px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                    style={{ backgroundColor: STATUS_STIJL[st].bg, color: STATUS_STIJL[st].color, fontFamily: "var(--font-inter)" }}
                  >
                    {STATUS_STIJL[st].label}
                  </span>
                ) : (
                  (["beschikbaar", "gereserveerd", "verkocht"] as const).map((s) => {
                    const actief = st === s;
                    return (
                      <button
                        key={s}
                        onClick={() => !actief && zetStatus(auto.id, s)}
                        disabled={statusBezig === auto.id}
                        className="px-2 py-1 text-[9px] font-bold uppercase transition-all disabled:opacity-40"
                        style={{
                          fontFamily: "var(--font-inter)",
                          backgroundColor: actief ? STATUS_STIJL[s].bg : "transparent",
                          color: actief ? STATUS_STIJL[s].color : "rgba(0,19,55,0.3)",
                          border: `1px solid ${actief ? STATUS_STIJL[s].color : "rgba(0,19,55,0.12)"}`,
                        }}
                      >
                        {STATUS_KORT[s]}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Acties — één bewerkknop, die naar de bewerkpagina gaat */}
              {!alleenLezen && (
                <div className="flex items-center gap-1.5 flex-wrap md:flex-nowrap md:justify-end" style={{ minWidth: 200 }}>
                  <Link
                    href={`/admin/auto-bewerken/${auto.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
                  >
                    <Pencil size={11} /> Bewerken
                  </Link>
                  <a
                    href={`https://www.jgmobility.nl/aanbod/${auto.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 text-[11px] font-semibold transition-all hover:opacity-70"
                    style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
                  >
                    Bekijk
                  </a>
                  <DeleteButton id={auto.id} naam={`${auto.merk} ${auto.model}`} />
                </div>
              )}
            </div>
          );
        })
      )}

      {compact && (
        <p className="px-4 py-2.5 text-[11px] text-center" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
          {gesorteerd.length > lijst.length
            ? `Nog ${gesorteerd.length - lijst.length} auto's — aanpassen doe je in de Auto Voorraad tab`
            : "Aanpassen doe je in de Auto Voorraad tab"}
        </p>
      )}
    </div>
  );
}

// ── Kaartje met kop ─────────────────────────────────────────────
function Paneel({
  titel,
  icon: Icon,
  actie,
  children,
}: {
  titel: string;
  icon: React.ComponentType<IconProps>;
  actie?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
      <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
        <div className="flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: "rgba(0,19,55,0.06)", borderRadius: 7 }}>
          <Icon size={14} style={{ color: "#001337" }} />
        </div>
        <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{titel}</h2>
        {actie && <div className="ml-auto">{actie}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Snelle acties ───────────────────────────────────────────────
function SnelleActies({ onTab }: { onTab: (t: Tab) => void }) {
  const knoppen: { label: string; icon: React.ComponentType<IconProps>; actie: () => void; href?: string }[] = [
    { label: "Nieuwe auto", icon: Plus, actie: () => {}, href: "/admin/auto-toevoegen" },
    { label: "Nieuwe factuur", icon: FileText, actie: () => onTab("facturen") },
    { label: "Nieuwe taxatie", icon: TrendingDown, actie: () => onTab("inkoop") },
    { label: "Nieuwe klant", icon: Users, actie: () => onTab("klanten") },
    { label: "Nieuwe afspraak", icon: Calendar, actie: () => onTab("afspraken") },
    { label: "Marge berekenen", icon: Calculator, actie: () => onTab("calculator") },
  ];

  const stijl = {
    backgroundColor: "#ffffff",
    border: "1px solid rgba(0,19,55,0.07)",
    boxShadow: "0 1px 3px rgba(0,19,55,0.05)",
    fontFamily: "var(--font-inter)",
    color: "#001337",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {knoppen.map(({ label, icon: Icon, actie, href }) =>
        href ? (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-2.5 px-4 py-3 text-xs font-semibold transition-all hover:-translate-y-0.5"
            style={stijl}
          >
            <Icon size={14} style={{ color: "#1d4ed8" }} />
            {label}
          </Link>
        ) : (
          <button
            key={label}
            onClick={actie}
            className="flex items-center gap-2.5 px-4 py-3 text-xs font-semibold text-left transition-all hover:-translate-y-0.5"
            style={stijl}
          >
            <Icon size={14} style={{ color: "#1d4ed8" }} />
            {label}
          </button>
        )
      )}
    </div>
  );
}

// ── Omzet & marge deze maand ────────────────────────────────────
type Stats = {
  verkochtDezeMaand: number;
  omzetDezeMaand: number;
  omzetPerMaand: Record<string, number>;
  verkopenPerMaand: Record<string, number>;
  gemStandtijdVoorraad: number | null;
  gemStandtijdVerkocht: number | null;
};

// Eén regel in het maandoverzicht. Delta = verschil met vorige maand in procenten.
function MaandRegel({ label, waarde, delta }: { label: string; waarde: string; delta: number | null }) {
  return (
    <div className="flex items-baseline justify-between py-2.5" style={{ borderBottom: "1px solid rgba(0,19,55,0.05)" }}>
      <p className="text-xs" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-base font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>{waarde}</p>
        {delta != null && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5"
            style={{
              fontFamily: "var(--font-inter)",
              backgroundColor: delta >= 0 ? "#dcfce7" : "#fee2e2",
              color: delta >= 0 ? "#15803d" : "#b91c1c",
            }}
          >
            {delta >= 0 ? "+" : ""}{delta}%
          </span>
        )}
      </div>
    </div>
  );
}

function MaandWidget() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);

  useEffect(() => {
    fetch("/api/admin/statistieken").then((r) => (r.ok ? r.json() : null)).then(setStats).catch(() => {});
    fetch("/api/admin/dossiers").then((r) => (r.ok ? r.json() : [])).then(setDossiers).catch(() => {});
  }, []);

  // Zelfde marge-formule als de calculator: margeregeling vs. 21% BTW.
  const winstVan = (d: Dossier): number => {
    const kostprijs = d.inkoop + d.kosten.reduce((s, k) => s + (parseFloat(k.bedrag) || 0), 0);
    if (d.verkoopprijs <= 0) return 0;
    if (d.btw_type === "marge") {
      const m = d.verkoopprijs - kostprijs;
      return m > 0 ? Math.round((m - (m * 21) / 121) * 100) / 100 : m;
    }
    return Math.round((Math.round((d.verkoopprijs / 1.21) * 100) / 100 - kostprijs) * 100) / 100;
  };

  const nu = new Date();
  const maandKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const vorige = new Date(nu.getFullYear(), nu.getMonth() - 1, 1);

  const omzetVorig = stats?.omzetPerMaand?.[maandKey(vorige)] ?? 0;
  const verkochtVorig = stats?.verkopenPerMaand?.[maandKey(vorige)] ?? 0;
  const omzet = stats?.omzetDezeMaand ?? 0;
  const aantal = stats?.verkochtDezeMaand ?? 0;

  const totaleMarge = dossiers.reduce((s, d) => s + winstVan(d), 0);
  const gemMarge = dossiers.length ? Math.round(totaleMarge / dossiers.length) : 0;

  const euro = (n: number) => `€${Math.round(n).toLocaleString("nl-NL")}`;

  // Verschil t.o.v. vorige maand, als percentage. Null als vorige maand leeg was.
  const verschil = (nieuw: number, oud: number): number | null =>
    oud > 0 ? Math.round(((nieuw - oud) / oud) * 100) : null;

  const omzetVerschil = verschil(omzet, omzetVorig);
  const aantalVerschil = verschil(aantal, verkochtVorig);

  const maandNaam = nu.toLocaleDateString("nl-NL", { month: "long" });

  return (
    <Paneel titel={`Deze maand — ${maandNaam}`} icon={TrendingUp}>
      <div className="px-5 py-2">
        <MaandRegel label="Omzet (betaalde facturen)" waarde={euro(omzet)} delta={omzetVerschil} />
        <MaandRegel label="Auto's verkocht" waarde={String(aantal)} delta={aantalVerschil} />
        <MaandRegel
          label="Gem. standtijd voorraad"
          waarde={stats?.gemStandtijdVoorraad != null ? `${stats.gemStandtijdVoorraad} dgn` : "—"}
          delta={null}
        />
        <MaandRegel
          label={`Gem. marge (${dossiers.length} dossier${dossiers.length === 1 ? "" : "s"})`}
          waarde={dossiers.length ? euro(gemMarge) : "—"}
          delta={null}
        />
      </div>
      {!stats && (
        <p className="px-5 pb-4 text-[11px]" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
          Cijfers laden...
        </p>
      )}
    </Paneel>
  );
}

// ── Meldingen ───────────────────────────────────────────────────
type Melding = {
  id: string;
  soort: "afspraak" | "auto" | "cosignatie" | "factuur";
  titel: string;
  detail: string;
  urgent: boolean;
  tab: string;
};

const MELDING_ICOON: Record<Melding["soort"], React.ComponentType<IconProps>> = {
  afspraak: Calendar,
  auto: Car,
  cosignatie: Handshake,
  factuur: FileText,
};

/** Belletje rechtsboven in de hub. Toont afspraken die eraan komen, auto's die
 *  aandacht vragen, nieuwe cosignaties en openstaande facturen. */
function MeldingenBel({ onGaNaar }: { onGaNaar: (tab: Tab) => void }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ totaal: number; urgent: number; meldingen: Melding[] } | null>(null);
  const paneel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const laad = () =>
      fetch("/api/admin/meldingen")
        .then((r) => (r.ok ? r.json() : null))
        .then(setData)
        .catch(() => {});
    laad();
    // Elke 2 minuten bijwerken — vaker heeft geen zin voor afspraken en facturen.
    const t = setInterval(laad, 120_000);
    return () => clearInterval(t);
  }, []);

  // Klik buiten het paneel sluit het.
  useEffect(() => {
    if (!open) return;
    const sluit = (e: MouseEvent) => {
      if (paneel.current && !paneel.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", sluit);
    return () => document.removeEventListener("mousedown", sluit);
  }, [open]);

  const aantal = data?.totaal ?? 0;
  const urgent = data?.urgent ?? 0;

  return (
    <div className="relative" ref={paneel}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Meldingen${aantal > 0 ? ` (${aantal})` : ""}`}
        className="relative flex items-center justify-center transition-all hover:opacity-80"
        style={{
          width: 38,
          height: 38,
          backgroundColor: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <Bell size={16} style={{ color: "rgba(255,255,255,0.75)" }} />
        {aantal > 0 && (
          <span
            className="absolute flex items-center justify-center text-[10px] font-bold"
            style={{
              top: -7,
              right: -7,
              minWidth: 19,
              height: 19,
              padding: "0 5px",
              borderRadius: 99,
              backgroundColor: urgent > 0 ? "#dc2626" : "#b45309",
              color: "#ffffff",
              fontFamily: "var(--font-inter)",
              border: "2px solid #001337",
            }}
          >
            {aantal > 99 ? "99+" : aantal}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 overflow-hidden"
          style={{
            top: 46,
            width: 340,
            maxHeight: 420,
            backgroundColor: "#ffffff",
            border: "1px solid rgba(0,19,55,0.12)",
            boxShadow: "0 12px 32px rgba(0,19,55,0.22)",
          }}
        >
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
            <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
              Meldingen
            </p>
            {aantal > 0 && (
              <span className="text-[11px]" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                {urgent > 0 ? `${urgent} urgent` : `${aantal} open`}
              </span>
            )}
          </div>

          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {!data ? (
              <p className="px-4 py-6 text-center text-[11px]" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                Laden...
              </p>
            ) : aantal === 0 ? (
              <div className="flex flex-col items-center justify-center py-9 px-4">
                <CheckCircle2 size={26} style={{ color: "#bbf7d0" }} />
                <p className="text-sm font-bold mt-2.5" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                  Niets te doen
                </p>
                <p className="text-[11px] mt-1 text-center" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
                  Geen afspraken vandaag of morgen, geen openstaande facturen of aanvragen.
                </p>
              </div>
            ) : (
              data.meldingen.map((m) => {
                const Icon = MELDING_ICOON[m.soort];
                return (
                  <button
                    key={m.id}
                    onClick={() => { onGaNaar(m.tab as Tab); setOpen(false); }}
                    className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-all hover:bg-slate-50"
                    style={{ borderBottom: "1px solid rgba(0,19,55,0.05)" }}
                  >
                    <div
                      className="flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        width: 26,
                        height: 26,
                        backgroundColor: m.urgent ? "#fee2e2" : "rgba(0,19,55,0.05)",
                        borderRadius: 6,
                      }}
                    >
                      <Icon size={13} style={{ color: m.urgent ? "#b91c1c" : "rgba(0,19,55,0.5)" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                        {m.titel}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                        {m.detail}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Claude Code verbruik ────────────────────────────────────────
type ClaudeVerbruik = {
  valuta?: string;
  totaalUSD?: number;
  prognoseUSD?: number;
  perDag?: { datum: string; usd: number }[];
  perModel?: { model: string; usd: number }[];
  tokens?: { invoer: number; uitvoer: number; cache: number };
  periode?: { van: string; tot: string };
  error?: string;
  ontbrekendeSleutel?: boolean;
};

function ClaudeVerbruikWidget() {
  const [data, setData] = useState<ClaudeVerbruik | null>(null);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    fetch("/api/admin/claude-usage")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setData({ error: String(e) }))
      .finally(() => setLaden(false));
  }, []);

  const usd = (n: number) =>
    `$${n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const kort = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : String(n);

  const perDag = data?.perDag ?? [];
  const maxDag = Math.max(...perDag.map((d) => d.usd), 0.01);

  return (
    <Paneel titel="Claude Code verbruik" icon={Cpu}>
      <div className="p-5">
        {laden && (
          <p className="text-[11px]" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
            Verbruik laden...
          </p>
        )}

        {!laden && data?.ontbrekendeSleutel && (
          <div className="flex items-start gap-2.5 px-3 py-2.5" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
            <AlertTriangle size={13} style={{ color: "#b45309", flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-[11px] font-semibold" style={{ color: "#b45309", fontFamily: "var(--font-inter)" }}>
                Nog niet gekoppeld
              </p>
              <p className="text-[11px] mt-1" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
                Zet <code>ANTHROPIC_ADMIN_KEY</code> in de omgevingsvariabelen. Die maak je aan in de
                Anthropic Console onder Settings → Admin keys.
              </p>
            </div>
          </div>
        )}

        {!laden && data?.error && !data.ontbrekendeSleutel && (
          <p className="text-[11px]" style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>
            {data.error}
          </p>
        )}

        {!laden && data?.totaalUSD != null && (
          <>
            {/* Kerncijfer */}
            <div className="flex items-end justify-between mb-1">
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                  Verbruikt deze maand
                </p>
                <p className="text-3xl font-bold leading-none" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                  {usd(data.totaalUSD)}
                </p>
              </div>
              {data.prognoseUSD != null && data.prognoseUSD > 0 && (
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                    Verwacht hele maand
                  </p>
                  <p className="text-base font-bold" style={{ color: "rgba(0,19,55,0.6)", fontFamily: "var(--font-playfair)" }}>
                    {usd(data.prognoseUSD)}
                  </p>
                </div>
              )}
            </div>

            {/* Verloop per dag — sequentiële blauwe balken */}
            {perDag.length > 0 && (
              <div className="mt-5">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                  Per dag
                </p>
                <div className="flex items-end gap-[3px]" style={{ height: 56 }}>
                  {perDag.map((d) => (
                    <div
                      key={d.datum}
                      title={`${d.datum} — ${usd(d.usd)}`}
                      className="flex-1 transition-all hover:opacity-70"
                      style={{
                        height: `${Math.max((d.usd / maxDag) * 100, d.usd > 0 ? 4 : 1)}%`,
                        backgroundColor: d.usd > 0 ? "#1d4ed8" : "rgba(0,19,55,0.08)",
                        borderTopLeftRadius: 3,
                        borderTopRightRadius: 3,
                        minHeight: 2,
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[9px]" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                    {data.periode?.van}
                  </span>
                  <span className="text-[9px]" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                    {data.periode?.tot}
                  </span>
                </div>
              </div>
            )}

            {/* Tokens */}
            {data.tokens && (
              <div className="grid grid-cols-3 gap-2 mt-5">
                {[
                  { label: "Invoer", waarde: data.tokens.invoer },
                  { label: "Uitvoer", waarde: data.tokens.uitvoer },
                  { label: "Cache", waarde: data.tokens.cache },
                ].map((t) => (
                  <div key={t.label} className="px-3 py-2" style={{ backgroundColor: "#f8fafc" }}>
                    <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                      {kort(t.waarde)}
                    </p>
                    <p className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                      {t.label}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Per model */}
            {data.perModel && data.perModel.length > 0 && (
              <div className="mt-5">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                  Per model
                </p>
                {data.perModel.slice(0, 5).map((m) => (
                  <div key={m.model} className="flex items-baseline justify-between gap-3 py-1" style={{ borderBottom: "1px solid rgba(0,19,55,0.05)" }}>
                    <p className="text-[11px] truncate" style={{ color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)" }}>
                      {m.model}
                    </p>
                    <p className="text-[11px] font-semibold flex-shrink-0" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                      {usd(m.usd)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] mt-4" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
              Bedragen in USD, zoals Anthropic factureert. Je resterende tegoed is niet via de API
              op te vragen — dat staat alleen in de Console onder Billing.
            </p>
          </>
        )}
      </div>
    </Paneel>
  );
}

// ── Aandachtspunten ─────────────────────────────────────────────
function AandachtWidget({ beschikbaar }: { beschikbaar: Auto[] }) {
  const punten = verzamelAandachtspunten(beschikbaar);

  return (
    <Paneel
      titel="Vraagt aandacht"
      icon={AlertTriangle}
      actie={
        <span
          className="text-[11px] font-semibold px-2 py-0.5"
          style={{
            fontFamily: "var(--font-inter)",
            backgroundColor: punten.length ? "#fef3c7" : "#dcfce7",
            color: punten.length ? "#b45309" : "#15803d",
          }}
        >
          {punten.length}
        </span>
      }
    >
      {punten.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <CheckCircle2 size={28} style={{ color: "#bbf7d0" }} />
          <p className="text-sm font-bold mt-3" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
            Alles op orde
          </p>
          <p className="text-[11px] mt-1" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
            Geen auto&apos;s die actie nodig hebben
          </p>
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          {punten.map((p, i) => {
            const Icon = p.icon;
            return (
              <Link
                key={`${p.auto.id}-${i}`}
                href={`/admin/auto-bewerken/${p.auto.id}`}
                className="flex items-center gap-3 px-5 py-2.5 transition-all hover:bg-slate-50"
                style={{ borderBottom: "1px solid rgba(0,19,55,0.05)" }}
              >
                <Icon size={14} style={{ color: p.kleur, flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                    {p.auto.merk} {p.auto.model}
                  </p>
                </div>
                <p className="text-[11px] font-semibold flex-shrink-0" style={{ color: p.kleur, fontFamily: "var(--font-inter)" }}>
                  {p.reden}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </Paneel>
  );
}


// Eén pagina, twee gescheiden lijsten. De schakelaar bovenaan bepaalt welke je
// ziet — voorraad en verkocht lopen nooit door elkaar heen.
function VoorraadContent({ autos, refresh }: { autos: Auto[]; refresh: () => void }) {
  const [toon, setToon] = useState<"voorraad" | "verkocht">("voorraad");

  const opVoorraad = autos.filter((a) => !a.verkocht);
  const verkocht = autos.filter((a) => a.verkocht);
  const gereserveerd = opVoorraad.filter((a) => a.gereserveerd);

  const subtitel =
    toon === "voorraad"
      ? gereserveerd.length > 0
        ? `${opVoorraad.length} op voorraad · waarvan ${gereserveerd.length} gereserveerd`
        : `${opVoorraad.length} op voorraad`
      : `${verkocht.length} verkocht · archief`;

  return (
    <div>
      <PageHeader
        title="Auto Voorraad"
        subtitle={subtitel}
        action={
          <Link
            href="/admin/auto-toevoegen"
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
            style={{
              backgroundColor: "#001337",
              color: "#ffffff",
              fontFamily: "var(--font-inter)",
            }}
          >
            <Plus size={14} /> Nieuwe auto
          </Link>
        }
      />

      <div className="p-4 md:p-8">
        {/* Schakelaar tussen de twee lijsten */}
        <div className="flex items-center gap-1 mb-5">
          {([
            { key: "voorraad", label: "Op voorraad", aantal: opVoorraad.length, icon: Car },
            { key: "verkocht", label: "Verkocht", aantal: verkocht.length, icon: CheckCircle2 },
          ] as const).map((w) => {
            const actief = toon === w.key;
            const Icon = w.icon;
            return (
              <button
                key={w.key}
                onClick={() => setToon(w.key)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-80"
                style={{
                  fontFamily: "var(--font-inter)",
                  backgroundColor: actief ? "#001337" : "#ffffff",
                  color: actief ? "#ffffff" : "rgba(0,19,55,0.5)",
                  border: `1px solid ${actief ? "#001337" : "rgba(0,19,55,0.12)"}`,
                }}
              >
                <Icon size={14} />
                {w.label}
                <span
                  className="px-1.5 py-0.5 text-[10px] font-bold"
                  style={{
                    backgroundColor: actief ? "rgba(255,255,255,0.18)" : "rgba(0,19,55,0.06)",
                    color: actief ? "#ffffff" : "rgba(0,19,55,0.5)",
                  }}
                >
                  {w.aantal}
                </span>
              </button>
            );
          })}
        </div>

        <VoorraadTabel autos={autos} refresh={refresh} toon={toon} />
      </div>
    </div>
  );
}

// ── Facturen ────────────────────────────────────────────────────
type FactuurRegel = { omschrijving: string; prijs: string };

type Factuur = {
  id: string;
  factuur_nr: string;
  datum: string;
  vervaldatum: string;
  klant_naam: string;
  klant_adres: string;
  klant_postcode: string;
  klant_stad: string;
  klant_email: string;
  klant_telefoon: string;
  auto_merk: string;
  auto_model: string;
  auto_bouwjaar: string;
  auto_kenteken: string;
  auto_km: string;
  auto_kleur: string;
  auto_vin: string;
  verkoopprijs: number;
  btw_type: string;
  betaalwijze: string;
  notitie: string;
  status: string;
  regels: string;
  factuurmail_verstuurd_op?: string;
  bedankmail_verstuurd_op?: string;
};

const FACTUUR_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  concept:   { label: "Concept",   color: "#92400e", bg: "#fef3c7" },
  verzonden: { label: "Verzonden", color: "#1d4ed8", bg: "#dbeafe" },
  betaald:   { label: "Betaald",   color: "#15803d", bg: "#dcfce7" },
};

// Toont een opgeslagen ISO-verzendmoment als "2 juni 2026, 14:30" (leeg = nog niet verstuurd)
const formatVerstuurd = (val?: string): string => {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("nl-NL", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

type FactuurForm = {
  klant_naam: string; klant_adres: string; klant_postcode: string; klant_stad: string;
  klant_email: string; klant_telefoon: string;
  auto_merk: string; auto_model: string; auto_bouwjaar: string; auto_kenteken: string;
  auto_km: string; auto_kleur: string; auto_vin: string;
  verkoopprijs: string;
  btw_type: string; betaalwijze: string;
  datum: string; vervaldatum: string; notitie: string;
};

const LEEG_REGELS: FactuurRegel[] = [
  { omschrijving: "", prijs: "" },
  { omschrijving: "", prijs: "" },
  { omschrijving: "", prijs: "" },
];

const LEEG_FORM: FactuurForm = {
  klant_naam: "", klant_adres: "", klant_postcode: "", klant_stad: "",
  klant_email: "", klant_telefoon: "",
  auto_merk: "", auto_model: "", auto_bouwjaar: "", auto_kenteken: "",
  auto_km: "", auto_kleur: "", auto_vin: "",
  verkoopprijs: "",
  btw_type: "marge", betaalwijze: "bank",
  datum: new Date().toLocaleDateString("nl-NL"),
  vervaldatum: "", notitie: "",
};

function genereerFactuurHTML(f: Factuur, logoSrc: string, opts: { betaald?: boolean } = {}): string {
  const autoBasePrijs = Number(f.verkoopprijs);
  let extraRegels: FactuurRegel[] = [];
  try { extraRegels = JSON.parse(f.regels || "[]").filter((r: FactuurRegel) => r.omschrijving && Number(r.prijs) > 0); } catch { /* */ }

  const is21 = f.btw_type === "21";
  // Ingevoerde prijzen zijn incl. BTW. In de regeltabel staat het bedrag ex. BTW;
  // bij 21% reken je dat terug (prijs / 1,21), bij marge blijft het gelijk.
  const exBtw = (incl: number): number => (is21 ? Math.round((incl / 1.21) * 100) / 100 : incl);
  const fmtBedrag = (n: number): string =>
    n.toLocaleString("nl-NL", is21 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {});

  const subtotaalExAuto = exBtw(autoBasePrijs);
  const brutoTotaal = autoBasePrijs + extraRegels.reduce((s, r) => s + Number(r.prijs), 0);
  const subtotaal = subtotaalExAuto + extraRegels.reduce((s, r) => s + exBtw(Number(r.prijs)), 0);
  const btwBedrag = is21 ? Math.round((brutoTotaal - subtotaal) * 100) / 100 : 0;
  const eindtotaal = brutoTotaal;

  const autoOmschrijving = [f.auto_merk, f.auto_model, f.auto_bouwjaar].filter(Boolean).join(" ") || "Voertuig";
  const autoKenteken = f.auto_kenteken ? ` &middot; ${f.auto_kenteken.toUpperCase()}` : "";
  const autoVin = f.auto_vin ? `<br><span style="font-size:8pt;color:#94a3b8">VIN: ${f.auto_vin.toUpperCase()}</span>` : "";

  // Geen voertuigvelden ingevuld én geen verkoopprijs → factuur zonder voertuig (bv. een dienst)
  const heeftVoertuig = Boolean(
    f.auto_merk || f.auto_model || f.auto_bouwjaar || f.auto_kenteken || f.auto_vin
  ) || autoBasePrijs > 0;

  const betaald = opts.betaald === true;
  const margeNote = f.btw_type === "marge" && heeftVoertuig
    ? `<br><span style="font-size:8pt;color:#94a3b8">Op dit voertuig is de margeregeling van toepassing. BTW is niet afzonderlijk vermeld (art. 28b t/m 28h Wet OB 1968).</span>`
    : "";
  const betaaldBadge = betaald
    ? `<div style="display:inline-block;margin-top:10px;padding:5px 13px;background:#dcfce7;border:1px solid #15803d;font-size:8.5pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#15803d">&#10003; Betaald</div>`
    : "";

  const regelRijen = [
    heeftVoertuig
      ? `<tr>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;color:#1e293b;font-size:10pt">${autoOmschrijving}${autoKenteken}${autoVin}</td>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;text-align:center;color:#1e293b;font-size:10pt">€&nbsp;${fmtBedrag(subtotaalExAuto)}</td>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;text-align:center;color:#1e293b;font-size:10pt;width:60px">1</td>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;text-align:center;color:#1e293b;font-size:10pt">€&nbsp;${fmtBedrag(subtotaalExAuto)}</td>
    </tr>`
      : "",
    ...extraRegels.map((r) => {
      const regelEx = fmtBedrag(exBtw(Number(r.prijs)));
      return `<tr>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;color:#1e293b;font-size:10pt">${r.omschrijving}</td>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;text-align:center;color:#1e293b;font-size:10pt">€&nbsp;${regelEx}</td>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;text-align:center;color:#1e293b;font-size:10pt">1</td>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;text-align:center;color:#1e293b;font-size:10pt">€&nbsp;${regelEx}</td>
    </tr>`;
    }),
  ].filter(Boolean).join("");

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>Factuur ${f.factuur_nr}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  body { font-family:'Helvetica Neue',Arial,sans-serif; color:#1e293b; background:#fff; width:794px; margin:0 auto; }
  @media print { @page { size:A4; margin:0; } body { width:100%; } }
  table { border-collapse:collapse; }
</style>
</head>
<body>

<!-- HEADER: logo met ingebakken achtergrond -->
<div style="width:100%;background-color:#001337;text-align:center;line-height:0;padding:10px 0">
  <img src="${logoSrc}" alt="JG Mobility"
       style="height:85px;object-fit:contain;display:inline-block">
</div>

<!-- BODY -->
<div style="padding:44px 48px 44px">

  <!-- Bedrijf links + FACTUUR rechts -->
  <table style="width:100%;margin-bottom:32px">
    <tr>
      <td style="vertical-align:top;width:55%">
        <div style="font-size:10.5pt;font-weight:700;color:#001337;margin-bottom:2px">JG MOBILITY</div>
        <div style="font-size:9pt;color:#64748b;line-height:1.75">
          Arnhemseweg 10a<br>
          2994LA Barendrecht<br>
          info@jgmobility.nl<br>
          www.jgmobility.nl
        </div>
      </td>
      <td style="text-align:right;vertical-align:top;width:45%">
        <div style="font-size:28pt;font-weight:300;letter-spacing:8px;color:#001337;line-height:1;text-transform:uppercase">Factuur</div>
        <div style="font-size:10pt;color:#94a3b8;margin-top:6px;letter-spacing:.5px">#${f.factuur_nr}</div>
        ${betaaldBadge}
      </td>
    </tr>
  </table>

  <!-- KVK/BTW/IBAN + datum links | Klant rechts -->
  <table style="width:100%">
    <tr>
      <td style="vertical-align:top;width:50%">
        <table style="font-size:9pt">
          <tr>
            <td style="color:#475569;font-weight:600;padding:2px 14px 2px 0;width:64px">KVK nr.</td>
            <td style="color:#1e293b">42042275</td>
          </tr>
          <tr>
            <td style="color:#475569;font-weight:600;padding:2px 14px 2px 0">BTW nr.</td>
            <td style="color:#1e293b">NL005450398B70</td>
          </tr>
          <tr>
            <td style="color:#475569;font-weight:600;padding:2px 14px 2px 0">IBAN</td>
            <td style="color:#1e293b">NL94 ABNA 0154171638</td>
          </tr>
        </table>
        <div style="font-size:9pt;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#001337;margin-top:13px">
          Datum: ${f.datum}${f.vervaldatum ? `<br>Vervalt: ${f.vervaldatum}` : ""}
        </div>
      </td>
      <td style="vertical-align:top;padding-left:120px;width:50%">
        <div style="font-size:11pt;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#001337;margin-bottom:6px">${f.klant_naam || "—"}</div>
        <div style="font-size:9.5pt;color:#475569;line-height:1.75">
          ${f.klant_adres ? f.klant_adres + "<br>" : ""}
          ${[f.klant_postcode, f.klant_stad].filter(Boolean).join(" ")}${(f.klant_postcode || f.klant_stad) ? "<br>" : ""}
          ${f.klant_email ? f.klant_email + "<br>" : ""}
          ${f.klant_telefoon || ""}
        </div>
      </td>
    </tr>
  </table>

  <!-- Scheidingslijn: ruim onder de klantgegevens (telefoonnummer), net boven de kolomtitels -->
  <div style="border-bottom:1.5px solid #001337;margin-top:40px;margin-bottom:36px"></div>

  <!-- Regelstabel -->
  <table style="width:100%;margin-bottom:4px">
    <thead>
      <tr style="border-bottom:1.5px solid #001337">
        <th style="font-size:7.5pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#001337;padding:0 0 9px;text-align:left">Omschrijving</th>
        <th style="font-size:7.5pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#001337;padding:0 0 9px;text-align:center;width:115px">Tarief</th>
        <th style="font-size:7.5pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#001337;padding:0 0 9px;text-align:center;width:55px">Aantal</th>
        <th style="font-size:7.5pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#001337;padding:0 0 9px;text-align:center;width:115px">Subtotaal</th>
      </tr>
    </thead>
    <tbody>
      ${regelRijen}
    </tbody>
  </table>

  <!-- Totalen rechts uitgelijnd -->
  <table style="width:270px;margin-left:auto;margin-bottom:30px;margin-top:10px">
    <tr>
      <td style="font-size:9.5pt;color:#64748b;padding:4px 0">Subtotaal</td>
      <td style="font-size:9.5pt;color:#64748b;text-align:right;padding:4px 0">€&nbsp;${fmtBedrag(subtotaal)}</td>
    </tr>
    ${f.btw_type === "21"
      ? `<tr>
          <td style="font-size:9.5pt;color:#1d4ed8;padding:4px 0;border-bottom:1px solid #e2e8f0">BTW (21%)</td>
          <td style="font-size:9.5pt;color:#1d4ed8;text-align:right;padding:4px 0;border-bottom:1px solid #e2e8f0">€&nbsp;${fmtBedrag(btwBedrag)}</td>
        </tr>`
      : `<tr><td colspan="2" style="border-bottom:1px solid #e2e8f0;padding:3px 0"></td></tr>`}
    <tr>
      <td style="font-size:12pt;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#001337;padding:9px 0 0">Eindtotaal</td>
      <td style="font-size:12pt;font-weight:700;color:#001337;text-align:right;padding:9px 0 0">€&nbsp;${fmtBedrag(eindtotaal)}</td>
    </tr>
  </table>

  <!-- Betaaltekst -->
  <div style="font-size:9pt;color:#475569;line-height:1.85;border-top:1px solid #e2e8f0;padding-top:16px;margin-bottom:12px">
    ${betaald
      ? `Deze factuur is volledig voldaan. Hartelijk dank voor uw betaling en het vertrouwen in JG Mobility &mdash; wij wensen u heel veel rijplezier!${margeNote}`
      : `Wij vragen u vriendelijk het bedrag van €${fmtBedrag(eindtotaal)} ${f.vervaldatum ? `voor ${f.vervaldatum}` : "binnen 30 dagen na ontvangst"} over te maken
    ${f.betaalwijze === "bank" ? "op rekening NL94 ABNA 0154171638 onder vermelding van factuurnummer <strong>" + f.factuur_nr + "</strong>" : "te voldoen per contant"}.
    <br>Factuur uitgereikt door JG MOBILITY.${margeNote}`}
  </div>

  ${f.notitie ? `<div style="font-size:9pt;color:#475569;font-style:italic;margin-bottom:16px;padding:10px 14px;background:#f8fafc;border-left:3px solid #cbd5e1">${f.notitie}</div>` : ""}

  <!-- Footer -->
  <div style="text-align:center;font-size:8pt;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#001337;border-top:1px solid #e2e8f0;padding-top:16px">
    HARTELIJK DANK VOOR HET VERTROUWEN IN JG MOBILITY
  </div>

</div>
</body>
</html>`;
}

function FacturenContent() {
  const [facturen, setFacturen] = useState<Factuur[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"lijst" | "nieuw" | "archief">("lijst");
  const [selectedJaar, setSelectedJaar] = useState<string>("");
  const [selectie, setSelectie] = useState<Set<string>>(new Set());
  const [exportBezig, setExportBezig] = useState(false);
  const [form, setForm] = useState<FactuurForm>(LEEG_FORM);
  const [regels, setRegels] = useState<FactuurRegel[]>(LEEG_REGELS);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [nieuwsteFactuur, setNieuwsteFactuur] = useState<Factuur | null>(null);
  const [bewerkFactuur, setBewerkFactuur] = useState<Factuur | null>(null);
  const [rdwLaden, setRdwLaden] = useState(false);
  const [rdwStatus, setRdwStatus] = useState<"idle" | "gevonden" | "niet_gevonden">("idle");
  const [periode, setPeriode] = useState<"alles" | "week" | "maand" | "kwartaal" | "jaar">("alles");
  const [mailStatus, setMailStatus] = useState<Record<string, "laden" | "ok" | "fout">>({});
  const [bedankStatus, setBedankStatus] = useState<Record<string, "laden" | "ok" | "fout">>({});
  const [downloadStatus, setDownloadStatus] = useState<Record<string, "laden" | "ok" | "fout">>({});

  const laad = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/facturen");
    if (res.ok) setFacturen(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { laad(); }, [laad]);

  const zoekRdw = useCallback(async (kenteken: string) => {
    const schoon = kenteken.replace(/[-\s]/g, "").toUpperCase();
    if (schoon.length < 4) return;
    setRdwLaden(true);
    setRdwStatus("idle");
    try {
      const res = await fetch(`https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${schoon}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const v = data[0];
        const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
        setForm((prev) => ({
          ...prev,
          auto_merk: v.merk ? cap(v.merk) : prev.auto_merk,
          auto_model: v.handelsbenaming ? cap(v.handelsbenaming) : prev.auto_model,
          auto_bouwjaar: v.datum_eerste_toelating ? String(v.datum_eerste_toelating).slice(0, 4) : prev.auto_bouwjaar,
          auto_kleur: v.eerste_kleur ? cap(v.eerste_kleur) : prev.auto_kleur,
        }));
        setRdwStatus("gevonden");
      } else {
        setRdwStatus("niet_gevonden");
      }
    } catch {
      setRdwStatus("niet_gevonden");
    } finally {
      setRdwLaden(false);
    }
  }, []);

  useEffect(() => {
    const schoon = form.auto_kenteken.replace(/[-\s]/g, "");
    if (schoon.length < 4) { setRdwStatus("idle"); return; }
    const t = setTimeout(() => zoekRdw(form.auto_kenteken), 700);
    return () => clearTimeout(t);
  }, [form.auto_kenteken, zoekRdw]);

  const startBewerken = (f: Factuur) => {
    let parsedRegels: FactuurRegel[] = [];
    try { parsedRegels = JSON.parse(f.regels || "[]"); } catch { /* */ }
    while (parsedRegels.length < 3) parsedRegels.push({ omschrijving: "", prijs: "" });
    setBewerkFactuur(f);
    setForm({
      klant_naam: f.klant_naam, klant_adres: f.klant_adres, klant_postcode: f.klant_postcode,
      klant_stad: f.klant_stad, klant_email: f.klant_email, klant_telefoon: f.klant_telefoon,
      auto_merk: f.auto_merk, auto_model: f.auto_model, auto_bouwjaar: f.auto_bouwjaar,
      auto_kenteken: f.auto_kenteken, auto_km: f.auto_km, auto_kleur: f.auto_kleur, auto_vin: f.auto_vin,
      verkoopprijs: String(f.verkoopprijs),
      btw_type: f.btw_type, betaalwijze: f.betaalwijze,
      datum: f.datum, vervaldatum: f.vervaldatum, notitie: f.notitie,
    });
    setRegels(parsedRegels);
    setFout(null);
    setView("nieuw");
  };

  const sla = async () => {
    setFout(null);
    setSaving(true);
    try {
      const actieveRegels = regels.filter((r) => r.omschrijving && Number(r.prijs) > 0);
      if (bewerkFactuur) {
        const res = await fetch(`/api/admin/facturen/${bewerkFactuur.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, verkoopprijs: Number(form.verkoopprijs) || 0, regels: actieveRegels, fullUpdate: true }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          setFout(`Opslaan mislukt (${res.status})${txt ? ": " + txt.slice(0, 200) : ""}.`);
          return;
        }
        const bijgewerkt: Factuur = await res.json();
        setFacturen((prev) => prev.map((f) => (f.id === bijgewerkt.id ? bijgewerkt : f)));
        setNieuwsteFactuur(bijgewerkt);
        setBewerkFactuur(null);
      } else {
        const res = await fetch("/api/admin/facturen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, verkoopprijs: Number(form.verkoopprijs) || 0, regels: actieveRegels }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          setFout(`Opslaan mislukt (${res.status})${txt ? ": " + txt.slice(0, 200) : ""}. Controleer of init-db is uitgevoerd.`);
          return;
        }
        const nieuw: Factuur = await res.json();
        setFacturen((prev) => [nieuw, ...prev]);
        setNieuwsteFactuur(nieuw);
      }
      setView("lijst");
      setForm(LEEG_FORM);
      setRegels(LEEG_REGELS);
    } catch (err) {
      setFout(`Netwerkfout: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/facturen/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setFacturen((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
  };

  // Zet het verzendmoment direct in beeld (lijst + "nieuwste factuur"-banner) zonder refresh
  const markVerstuurd = (
    id: string,
    veld: "factuurmail_verstuurd_op" | "bedankmail_verstuurd_op",
    iso: string,
  ) => {
    setFacturen((prev) => prev.map((f) => (f.id === id ? { ...f, [veld]: iso } : f)));
    setNieuwsteFactuur((prev) => (prev && prev.id === id ? { ...prev, [veld]: iso } : prev));
  };

  /** Geeft een geblokkeerde mail weer vrij. Bewust een aparte, expliciete
   *  handeling: zo is dubbel versturen nooit een ongeluk, maar wel mogelijk
   *  als een mail echt niet is aangekomen. */
  const draaiVerzendingTerug = async (
    f: Factuur,
    veld: "factuurmail_verstuurd_op" | "bedankmail_verstuurd_op",
  ) => {
    const wat = veld === "factuurmail_verstuurd_op" ? "factuurmail" : "bedankmail";
    if (!confirm(
      `Verzending van de ${wat} terugdraaien?\n\n` +
      `De registratie wordt gewist zodat je hem opnieuw kunt versturen. ` +
      `De klant heeft de eerder verstuurde mail nog steeds ontvangen.`
    )) return;
    await fetch(`/api/admin/facturen/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [veld]: "" }),
    });
    setFacturen((prev) => prev.map((x) => (x.id === f.id ? { ...x, [veld]: "" } : x)));
    setNieuwsteFactuur((prev) => (prev && prev.id === f.id ? { ...prev, [veld]: "" } : prev));
  };

  const verwijder = async (id: string) => {
    if (!confirm("Factuur definitief verwijderen?")) return;
    await fetch(`/api/admin/facturen/${id}`, { method: "DELETE" });
    setFacturen((prev) => prev.filter((f) => f.id !== id));
    if (openId === id) setOpenId(null);
  };

  const haalLogoSrc = async (): Promise<string> => {
    try {
      const res = await fetch(encodeURI("/JG Mobility.png"));
      if (!res.ok) return "";
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve("");
        reader.readAsDataURL(blob);
      });
    } catch { return ""; }
  };

  // Rendert factuur-HTML naar een base64 PDF via html2pdf.js (client-side)
  const factuurNaarPdfBase64 = async (html: string, filename: string): Promise<string> => {
    const html2pdf = (await import("html2pdf.js")).default;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;height:1123px;border:none;visibility:hidden;";
    document.body.appendChild(iframe);
    return await new Promise<string>((resolve, reject) => {
      iframe.onload = async () => {
        try {
          const body = iframe.contentDocument?.body;
          if (!body) { reject(new Error("Render mislukt")); return; }
          const dataUri = await html2pdf().set({
            margin: 0,
            filename,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          }).from(body).output("datauristring");
          document.body.removeChild(iframe);
          resolve((dataUri as string).split(",")[1]);
        } catch (err) {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
          reject(err);
        }
      };
      const doc = iframe.contentDocument;
      if (doc) { doc.open(); doc.write(html); doc.close(); }
    });
  };

  const printFactuur = async (f: Factuur) => {
    const logoSrc = await haalLogoSrc();
    const html = genereerFactuurHTML(f, logoSrc);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 2000);
    }, 500);
  };

  // Slaat de factuur als PDF-bestand op (download), via dezelfde PDF-generatie als de mailbijlage
  const downloadFactuur = async (f: Factuur) => {
    setDownloadStatus((prev) => ({ ...prev, [f.id]: "laden" }));
    try {
      const logoSrc = await haalLogoSrc();
      const html = genereerFactuurHTML(f, logoSrc);
      const filename = `Factuur-${f.factuur_nr}.pdf`;
      const pdfBase64 = await factuurNaarPdfBase64(html, filename);

      const bytes = atob(pdfBase64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      setDownloadStatus((prev) => ({ ...prev, [f.id]: "ok" }));
      setTimeout(() => setDownloadStatus((prev) => { const n = { ...prev }; delete n[f.id]; return n; }), 3000);
    } catch (err) {
      setDownloadStatus((prev) => ({ ...prev, [f.id]: "fout" }));
      alert(`Opslaan mislukt: ${String(err)}`);
      setTimeout(() => setDownloadStatus((prev) => { const n = { ...prev }; delete n[f.id]; return n; }), 3000);
    }
  };

  const verstuurMail = async (f: Factuur) => {
    if (!f.klant_email) {
      alert("Deze factuur heeft geen e-mailadres voor de klant. Vul dit eerst in via Bewerken.");
      return;
    }
    // Harde blokkade: een klant twee keer dezelfde factuur sturen is een fout die
    // je niet wilt kúnnen maken. Opnieuw sturen kan alleen na expliciet vrijgeven.
    if (f.factuurmail_verstuurd_op) {
      alert(
        `Deze factuurmail is al verstuurd op ${formatVerstuurd(f.factuurmail_verstuurd_op)}.\n\n` +
        `Opnieuw versturen is geblokkeerd. Gebruik "Verzending terugdraaien" als je ` +
        `zeker weet dat de klant hem niet heeft ontvangen.`
      );
      return;
    }
    setMailStatus((prev) => ({ ...prev, [f.id]: "laden" }));
    try {
      const logoSrc = await haalLogoSrc();
      const html = genereerFactuurHTML(f, logoSrc);
      const pdfBase64 = await factuurNaarPdfBase64(html, `Factuur-${f.factuur_nr}.pdf`);

      const res = await fetch(`/api/admin/facturen/${f.id}/mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64 }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setMailStatus((prev) => ({ ...prev, [f.id]: "ok" }));
        markVerstuurd(f.id, "factuurmail_verstuurd_op", data.verstuurd_op ?? new Date().toISOString());
        await updateStatus(f.id, "verzonden");
        setTimeout(() => setMailStatus((prev) => { const n = { ...prev }; delete n[f.id]; return n; }), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Onbekende fout");
      }
    } catch (err) {
      setMailStatus((prev) => ({ ...prev, [f.id]: "fout" }));
      alert(`Versturen mislukt: ${String(err)}`);
      setTimeout(() => setMailStatus((prev) => { const n = { ...prev }; delete n[f.id]; return n; }), 3000);
    }
  };

  // Bedankmail: stuurt de factuur met "Betaald"-stempel als blijvend bewijs voor de klant
  const verstuurBedankmail = async (f: Factuur) => {
    if (!f.klant_email) {
      alert("Deze factuur heeft geen e-mailadres voor de klant. Vul dit eerst in via Bewerken.");
      return;
    }
    if (f.bedankmail_verstuurd_op) {
      alert(
        `Deze bedankmail is al verstuurd op ${formatVerstuurd(f.bedankmail_verstuurd_op)}.\n\n` +
        `Opnieuw versturen is geblokkeerd. Gebruik "Verzending terugdraaien" als je ` +
        `zeker weet dat de klant hem niet heeft ontvangen.`
      );
      return;
    }
    setBedankStatus((prev) => ({ ...prev, [f.id]: "laden" }));
    try {
      const logoSrc = await haalLogoSrc();
      const html = genereerFactuurHTML(f, logoSrc, { betaald: true });
      const pdfBase64 = await factuurNaarPdfBase64(html, `Factuur-${f.factuur_nr}-betaald.pdf`);

      const res = await fetch(`/api/admin/facturen/${f.id}/mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64, type: "bedankt" }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setBedankStatus((prev) => ({ ...prev, [f.id]: "ok" }));
        markVerstuurd(f.id, "bedankmail_verstuurd_op", data.verstuurd_op ?? new Date().toISOString());
        await updateStatus(f.id, "betaald");
        setTimeout(() => setBedankStatus((prev) => { const n = { ...prev }; delete n[f.id]; return n; }), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Onbekende fout");
      }
    } catch (err) {
      setBedankStatus((prev) => ({ ...prev, [f.id]: "fout" }));
      alert(`Versturen mislukt: ${String(err)}`);
      setTimeout(() => setBedankStatus((prev) => { const n = { ...prev }; delete n[f.id]; return n; }), 3000);
    }
  };

  const berekenTotalen = (f: Factuur) => {
    let bruto = Number(f.verkoopprijs) || 0;
    try {
      const regels = JSON.parse(f.regels || "[]");
      bruto += regels.reduce((s: number, r: { prijs: string }) => s + (Number(r.prijs) || 0), 0);
    } catch { /* */ }
    // Prijzen zijn incl. BTW. Bij 21% reken je het ex-BTW bedrag en de BTW terug uit het bruto.
    const subtotaal = f.btw_type === "21" ? Math.round((bruto / 1.21) * 100) / 100 : bruto;
    const btw = f.btw_type === "21" ? Math.round((bruto - subtotaal) * 100) / 100 : 0;
    return { subtotaal, btw, eindtotaal: bruto };
  };

  // Exporteert de facturen als CSV (semicolon + komma-decimaal + BOM → opent direct in Excel NL)
  // Genereert een net opgemaakt Excel-bestand (.xlsx) met logo via de server-route.
  const exportFacturenExcel = async (lijst: Factuur[], jaar: string) => {
    if (lijst.length === 0) return;
    setExportBezig(true);
    try {
      const logo = await haalLogoSrc();
      const res = await fetch("/api/admin/facturen/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facturen: lijst, jaar, logo }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Fout ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `JG-Mobility-facturen-${jaar}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      alert(`Excel-export mislukt: ${String(err instanceof Error ? err.message : err)}`);
    } finally {
      setExportBezig(false);
    }
  };

  const printJaaroverzicht = (jaar: string, lijst: Factuur[]) => {
    const totalen = lijst.reduce((acc, f) => {
      const t = berekenTotalen(f);
      return { omzet: acc.omzet + t.subtotaal, btw: acc.btw + t.btw, totaal: acc.totaal + t.eindtotaal };
    }, { omzet: 0, btw: 0, totaal: 0 });

    const rijen = lijst.map((f, i) => {
      const t = berekenTotalen(f);
      const voertuig = [f.auto_merk, f.auto_model, f.auto_bouwjaar].filter(Boolean).join(" ");
      const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `<tr style="background:${bg}">
        <td style="padding:8px 10px;font-size:9pt;border-bottom:1px solid #f1f5f9">${f.factuur_nr}</td>
        <td style="padding:8px 10px;font-size:9pt;border-bottom:1px solid #f1f5f9">${f.datum}</td>
        <td style="padding:8px 10px;font-size:9pt;border-bottom:1px solid #f1f5f9">${f.klant_naam || "—"}</td>
        <td style="padding:8px 10px;font-size:9pt;border-bottom:1px solid #f1f5f9">${voertuig || "—"}${f.auto_kenteken ? ` · ${f.auto_kenteken.toUpperCase()}` : ""}</td>
        <td style="padding:8px 10px;font-size:9pt;border-bottom:1px solid #f1f5f9;text-align:center">${f.betaalwijze === "bank" ? "Bank" : "Contant"}</td>
        <td style="padding:8px 10px;font-size:9pt;border-bottom:1px solid #f1f5f9;text-align:center">${f.btw_type === "21" ? "21%" : "Marge"}</td>
        <td style="padding:8px 10px;font-size:9pt;border-bottom:1px solid #f1f5f9;text-align:right">€ ${t.subtotaal.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
        <td style="padding:8px 10px;font-size:9pt;border-bottom:1px solid #f1f5f9;text-align:right">${t.btw > 0 ? `€ ${t.btw.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}` : "—"}</td>
        <td style="padding:8px 10px;font-size:9pt;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right;color:#001337">€ ${t.eindtotaal.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Jaaroverzicht ${jaar} – JG Mobility</title>
<style>
  body { font-family: Arial, sans-serif; color: #1e293b; margin: 0; padding: 32px; }
  @page { margin: 20mm; }
  @media print { body { padding: 0; } }
</style></head><body>
<table style="width:100%;margin-bottom:28px"><tr>
  <td><div style="font-size:22pt;font-weight:700;color:#001337;letter-spacing:3px">JG MOBILITY</div>
      <div style="font-size:9pt;color:#94a3b8;margin-top:4px">Arnhemseweg 10a · 2994 LA Barendrecht · info@jgmobility.nl</div></td>
  <td style="text-align:right;vertical-align:top">
    <div style="font-size:18pt;font-weight:300;color:#001337">Jaaroverzicht ${jaar}</div>
    <div style="font-size:9pt;color:#94a3b8;margin-top:4px">Gegenereerd op ${new Date().toLocaleDateString("nl-NL")}</div>
  </td>
</tr></table>
<table style="width:100%;margin-bottom:28px;border-collapse:collapse">
  <tr style="background:#001337">
    <td style="padding:10px;color:#ffffff;font-size:9pt;font-weight:700">Aantal facturen</td>
    <td style="padding:10px;color:#ffffff;font-size:9pt;font-weight:700;text-align:right">${lijst.length}</td>
    <td style="padding:10px;color:#ffffff;font-size:9pt;font-weight:700">Omzet excl. BTW</td>
    <td style="padding:10px;color:#ffffff;font-size:9pt;font-weight:700;text-align:right">€ ${totalen.omzet.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
    <td style="padding:10px;color:#ffffff;font-size:9pt;font-weight:700">BTW</td>
    <td style="padding:10px;color:#ffffff;font-size:9pt;font-weight:700;text-align:right">€ ${totalen.btw.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
    <td style="padding:10px;color:#ffffff;font-size:9pt;font-weight:700">Totaal incl. BTW</td>
    <td style="padding:10px;color:#ffffff;font-size:14pt;font-weight:700;text-align:right">€ ${totalen.totaal.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
  </tr>
</table>
<table style="width:100%;border-collapse:collapse">
  <thead><tr style="border-bottom:2px solid #001337">
    <th style="padding:9px 10px;font-size:8pt;text-align:left;color:#001337;text-transform:uppercase;letter-spacing:1px">Factuur nr.</th>
    <th style="padding:9px 10px;font-size:8pt;text-align:left;color:#001337;text-transform:uppercase;letter-spacing:1px">Datum</th>
    <th style="padding:9px 10px;font-size:8pt;text-align:left;color:#001337;text-transform:uppercase;letter-spacing:1px">Klant</th>
    <th style="padding:9px 10px;font-size:8pt;text-align:left;color:#001337;text-transform:uppercase;letter-spacing:1px">Voertuig</th>
    <th style="padding:9px 10px;font-size:8pt;text-align:center;color:#001337;text-transform:uppercase;letter-spacing:1px">Betaling</th>
    <th style="padding:9px 10px;font-size:8pt;text-align:center;color:#001337;text-transform:uppercase;letter-spacing:1px">BTW</th>
    <th style="padding:9px 10px;font-size:8pt;text-align:right;color:#001337;text-transform:uppercase;letter-spacing:1px">Excl. BTW</th>
    <th style="padding:9px 10px;font-size:8pt;text-align:right;color:#001337;text-transform:uppercase;letter-spacing:1px">BTW</th>
    <th style="padding:9px 10px;font-size:8pt;text-align:right;color:#001337;text-transform:uppercase;letter-spacing:1px">Totaal</th>
  </thead><tbody>${rijen}</tbody>
  <tfoot><tr style="border-top:2px solid #001337;background:#f8fafc">
    <td colspan="6" style="padding:10px;font-size:9pt;font-weight:700;color:#001337">Totaal ${lijst.length} facturen</td>
    <td style="padding:10px;font-size:9pt;font-weight:700;text-align:right;color:#001337">€ ${totalen.omzet.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
    <td style="padding:10px;font-size:9pt;font-weight:700;text-align:right;color:#001337">€ ${totalen.btw.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
    <td style="padding:10px;font-size:14pt;font-weight:700;text-align:right;color:#001337">€ ${totalen.totaal.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
  </tr></tfoot>
</table></body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 400); }
  };

  const inp = (field: keyof FactuurForm) => ({
    value: form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value })),
  });

  const veldStijl: React.CSSProperties = {
    border: "1px solid rgba(0,19,55,0.15)",
    color: "#001337",
    fontFamily: "var(--font-inter)",
    backgroundColor: "#fafafa",
  };

  const labelStijl: React.CSSProperties = {
    color: "rgba(0,19,55,0.4)",
    fontFamily: "var(--font-inter)",
  };

  // ── Nieuwe factuur ──────────────────────────────────────────
  if (view === "nieuw") {
    const secties: { titel: string; velden: { label: string; field: keyof FactuurForm; col?: number }[] }[] = [
      {
        titel: "Klantgegevens",
        velden: [
          { label: "Volledige naam", field: "klant_naam", col: 2 },
          { label: "Adres", field: "klant_adres", col: 2 },
          { label: "Postcode", field: "klant_postcode" },
          { label: "Stad", field: "klant_stad" },
          { label: "E-mailadres", field: "klant_email" },
          { label: "Telefoonnummer", field: "klant_telefoon" },
        ],
      },
      {
        titel: "Voertuig",
        velden: [
          { label: "Merk", field: "auto_merk" },
          { label: "Model", field: "auto_model" },
          { label: "Bouwjaar", field: "auto_bouwjaar" },
          { label: "Kenteken", field: "auto_kenteken" },
          { label: "Kilometerstand", field: "auto_km" },
          { label: "Kleur", field: "auto_kleur" },
          { label: "VIN-nummer", field: "auto_vin", col: 2 },
        ],
      },
    ];

    return (
      <div>
        <PageHeader
          title={bewerkFactuur ? `Bewerken: ${bewerkFactuur.factuur_nr}` : "Nieuwe factuur"}
          subtitle={bewerkFactuur ? "Wijzig de gegevens en sla op — factuurnummer blijft ongewijzigd" : "Vul de gegevens in en genereer de factuur"}
          action={
            <button
              onClick={() => { setView("lijst"); setForm(LEEG_FORM); setRegels(LEEG_REGELS); setBewerkFactuur(null); }}
              className="text-xs px-4 py-2 transition-all hover:opacity-70"
              style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
            >
              ← Annuleer
            </button>
          }
        />
        <div className="p-4 md:p-8 md:max-w-[720px]">
          {fout && (
            <div className="mb-5 px-4 py-3 text-sm" style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#b91c1c", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
              <strong>Fout:</strong> {fout}
            </div>
          )}
          {secties.map(({ titel, velden }) => (
            <div key={titel} className="mb-5" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={labelStijl}>{titel}</p>
                {titel === "Voertuig" && rdwLaden && (
                  <span className="text-[10px] flex items-center gap-1.5" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                    <span className="inline-block w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin" />
                    RDW ophalen...
                  </span>
                )}
                {titel === "Voertuig" && !rdwLaden && rdwStatus === "gevonden" && (
                  <span className="text-[10px]" style={{ color: "#15803d", fontFamily: "var(--font-inter)" }}>
                    ✓ Gevonden via RDW
                  </span>
                )}
                {titel === "Voertuig" && !rdwLaden && rdwStatus === "niet_gevonden" && (
                  <span className="text-[10px]" style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>
                    Kenteken niet gevonden
                  </span>
                )}
              </div>
              <div className="p-4 md:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {velden.map(({ label, field, col }) => (
                  <div key={field} style={{ gridColumn: col ? `span ${col}` : undefined }}>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={labelStijl}>{label}</label>
                    <input type="text" {...inp(field)} className="w-full px-3 py-2 text-sm outline-none" style={veldStijl} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Financieel */}
          <div className="mb-5" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={labelStijl}>Financieel</p>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={labelStijl}>Verkoopprijs (€)</label>
                <input type="number" {...inp("verkoopprijs")} className="w-full px-3 py-2 text-sm outline-none" style={veldStijl} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={labelStijl}>BTW type</label>
                <select {...inp("btw_type")} className="w-full px-3 py-2 text-sm outline-none" style={veldStijl}>
                  <option value="marge">Margeregeling (geen BTW)</option>
                  <option value="21">21% BTW</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={labelStijl}>Betaalwijze</label>
                <select {...inp("betaalwijze")} className="w-full px-3 py-2 text-sm outline-none" style={veldStijl}>
                  <option value="bank">Bankoverschrijving</option>
                  <option value="contant">Contant</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={labelStijl}>Factuurdatum</label>
                <input type="text" {...inp("datum")} className="w-full px-3 py-2 text-sm outline-none" style={veldStijl} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={labelStijl}>Vervaldatum</label>
                <input type="text" {...inp("vervaldatum")} placeholder="bijv. 30-05-2026" className="w-full px-3 py-2 text-sm outline-none" style={veldStijl} />
              </div>
            </div>
          </div>

          {/* Extra regels */}
          <div className="mb-5" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={labelStijl}>Extra regels (optioneel — bv. banden, garantie)</p>
            </div>
            <div className="p-5 flex flex-col gap-3">
              {regels.map((r, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex-1">
                    {i === 0 && <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={labelStijl}>Omschrijving</label>}
                    <input
                      type="text"
                      value={r.omschrijving}
                      onChange={(e) => setRegels((prev) => prev.map((x, j) => j === i ? { ...x, omschrijving: e.target.value } : x))}
                      placeholder="bijv. Banden, Garantie, Service..."
                      className="w-full px-3 py-2 text-sm outline-none"
                      style={veldStijl}
                    />
                  </div>
                  <div style={{ width: "130px" }}>
                    {i === 0 && <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={labelStijl}>Prijs (€)</label>}
                    <input
                      type="number"
                      value={r.prijs}
                      onChange={(e) => setRegels((prev) => prev.map((x, j) => j === i ? { ...x, prijs: e.target.value } : x))}
                      placeholder="0"
                      className="w-full px-3 py-2 text-sm outline-none"
                      style={veldStijl}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notitie */}
          <div className="mb-7" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={labelStijl}>Notitie (optioneel)</p>
            </div>
            <div className="p-5">
              <textarea
                {...inp("notitie")}
                rows={3}
                placeholder="Extra opmerkingen die op de factuur verschijnen..."
                className="w-full px-3 py-2 text-sm outline-none resize-none"
                style={{ ...veldStijl, lineHeight: 1.6 }}
              />
            </div>
          </div>

          <button
            onClick={sla}
            disabled={saving}
            className="px-8 py-3.5 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
          >
            {saving ? "Opslaan..." : bewerkFactuur ? "Wijzigingen opslaan" : "Factuur aanmaken & afdrukken"}
          </button>
        </div>
      </div>
    );
  }

  // ── Archief ─────────────────────────────────────────────────
  if (view === "archief") {
    const betaald = facturen.filter(f => f.status === "betaald");
    const jaren = [...new Set(betaald.map(f => f.datum.split("-").at(-1) ?? ""))].filter(Boolean).sort((a, b) => b.localeCompare(a));
    const actuelJaar = selectedJaar || jaren[0] || String(new Date().getFullYear());
    const jaarLijst = betaald
      .filter(f => f.datum.split("-").at(-1) === actuelJaar)
      .sort((a, b) => {
        const parse = (d: string) => { const p = d.split("-").map(Number); return new Date(p[2], p[1] - 1, p[0]).getTime(); };
        return parse(a.datum) - parse(b.datum);
      });
    const totalen = jaarLijst.reduce((acc, f) => {
      const t = berekenTotalen(f);
      return { omzet: acc.omzet + t.subtotaal, btw: acc.btw + t.btw, totaal: acc.totaal + t.eindtotaal };
    }, { omzet: 0, btw: 0, totaal: 0 });

    // Selectie: aangevinkte facturen, anders het hele jaar exporteren
    const geselecteerd = jaarLijst.filter(f => selectie.has(f.id));
    const exportLijst = geselecteerd.length ? geselecteerd : jaarLijst;
    const alleGeselecteerd = jaarLijst.length > 0 && geselecteerd.length === jaarLijst.length;
    const selectieTotaal = geselecteerd.reduce((s, f) => s + berekenTotalen(f).eindtotaal, 0);
    const toggleAlle = () => setSelectie(prev => {
      const n = new Set(prev);
      if (alleGeselecteerd) jaarLijst.forEach(f => n.delete(f.id));
      else jaarLijst.forEach(f => n.add(f.id));
      return n;
    });
    const toggleEen = (id: string) => setSelectie(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

    return (
      <div>
        <PageHeader
          title="Archief betaalde facturen"
          subtitle={`${betaald.length} betaalde facturen`}
          action={
            <div className="flex gap-2">
              <button
                onClick={() => exportFacturenExcel(exportLijst, actuelJaar)}
                disabled={exportLijst.length === 0 || exportBezig}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: "#15803d", color: "#ffffff", fontFamily: "var(--font-inter)" }}
              >
                {exportBezig ? "Bezig…" : `Excel${geselecteerd.length ? ` (${geselecteerd.length})` : ""}`}
              </button>
              <button
                onClick={() => printJaaroverzicht(actuelJaar, exportLijst)}
                disabled={exportLijst.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                style={{ border: "1px solid #001337", color: "#001337", fontFamily: "var(--font-inter)" }}
              >
                PDF{geselecteerd.length ? ` (${geselecteerd.length})` : ""}
              </button>
              <button
                onClick={() => setView("lijst")}
                className="px-4 py-2 text-xs font-semibold transition-all hover:opacity-70"
                style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
              >
                ← Terug
              </button>
            </div>
          }
        />
        <div className="p-4 md:p-8">
          {betaald.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-28" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
              <p className="text-lg font-bold mt-5 mb-2" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Nog geen betaalde facturen</p>
              <p className="text-sm" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Zet een factuur op "Betaald" om hem hier te zien.</p>
            </div>
          ) : (
            <>
              {/* Jaar tabs */}
              <div className="flex gap-1.5 mb-6 flex-wrap">
                {jaren.map(j => (
                  <button key={j} onClick={() => setSelectedJaar(j)}
                    className="px-4 py-2 text-sm font-semibold transition-all"
                    style={{
                      backgroundColor: actuelJaar === j ? "#001337" : "transparent",
                      color: actuelJaar === j ? "#ffffff" : "rgba(0,19,55,0.5)",
                      border: `1px solid ${actuelJaar === j ? "#001337" : "rgba(0,19,55,0.12)"}`,
                      fontFamily: "var(--font-inter)",
                    }}
                  >
                    {j} <span style={{ opacity: 0.6, fontSize: "11px" }}>({betaald.filter(f => f.datum.split("-").at(-1) === j).length})</span>
                  </button>
                ))}
              </div>

              {/* Statistieken */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Facturen", value: String(jaarLijst.length) },
                  { label: "Omzet excl. BTW", value: `€ ${totalen.omzet.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}` },
                  { label: "BTW totaal", value: `€ ${totalen.btw.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}` },
                  { label: "Totaal incl. BTW", value: `€ ${totalen.totaal.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}` },
                ].map(({ label, value }) => (
                  <div key={label} className="px-4 py-3" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{label}</p>
                    <p className="text-base font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Selectie-balk */}
              {jaarLijst.length > 0 && (
                <div className="flex items-center justify-between gap-3 mb-3 px-4 py-2.5" style={{ backgroundColor: geselecteerd.length ? "#f0fdf4" : "#ffffff", border: `1px solid ${geselecteerd.length ? "#86efac" : "rgba(0,19,55,0.07)"}` }}>
                  <p className="text-xs" style={{ color: "rgba(0,19,55,0.6)", fontFamily: "var(--font-inter)" }}>
                    {geselecteerd.length ? (
                      <><strong style={{ color: "#15803d" }}>{geselecteerd.length} geselecteerd</strong> · € {selectieTotaal.toLocaleString("nl-NL", { minimumFractionDigits: 2 })} — Excel/PDF exporteert alleen deze.</>
                    ) : (
                      "Vink facturen aan om alleen díe te exporteren. Niets aangevinkt = alle facturen van dit jaar."
                    )}
                  </p>
                  {geselecteerd.length > 0 && (
                    <button onClick={() => setSelectie(new Set())} className="text-xs font-semibold whitespace-nowrap transition-all hover:opacity-70" style={{ color: "#1d4ed8", fontFamily: "var(--font-inter)" }}>
                      Selectie wissen
                    </button>
                  )}
                </div>
              )}

              {/* Tabel */}
              {jaarLijst.length === 0 ? (
                <div className="flex items-center justify-center py-16" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                  <p className="text-sm" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Geen betaalde facturen in {actuelJaar}.</p>
                </div>
              ) : (
                <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", overflowX: "auto" }}>
                  <table className="w-full" style={{ fontFamily: "var(--font-inter)", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1.5px solid #001337" }}>
                        <th className="px-3 py-3" style={{ width: "34px" }}>
                          <input type="checkbox" checked={alleGeselecteerd} onChange={toggleAlle} aria-label="Alles selecteren" style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#001337" }} />
                        </th>
                        {["Factuur nr.", "Datum", "Klant", "Voertuig", "Betaling", "BTW-type", "Excl. BTW", "BTW", "Totaal"].map((h, i) => (
                          <th key={i} className={`px-3 py-3 ${i >= 6 ? "text-right" : i >= 4 ? "text-center" : "text-left"}`} style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#001337", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {jaarLijst.map((f, i) => {
                        const t = berekenTotalen(f);
                        const voertuig = [f.auto_merk, f.auto_model].filter(Boolean).join(" ");
                        return (
                          <tr key={f.id} style={{ backgroundColor: selectie.has(f.id) ? "#eff6ff" : (i % 2 === 0 ? "#ffffff" : "#f8fafc"), borderBottom: "1px solid #f1f5f9" }}>
                            <td className="px-3 py-2.5" style={{ width: "34px" }}>
                              <input type="checkbox" checked={selectie.has(f.id)} onChange={() => toggleEen(f.id)} aria-label={`Selecteer ${f.factuur_nr}`} style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#001337" }} />
                            </td>
                            <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: "#001337", whiteSpace: "nowrap" }}>{f.factuur_nr}</td>
                            <td className="px-3 py-2.5 text-xs" style={{ color: "#475569", whiteSpace: "nowrap" }}>{f.datum}</td>
                            <td className="px-3 py-2.5 text-xs" style={{ color: "#1e293b" }}>{f.klant_naam || "—"}</td>
                            <td className="px-3 py-2.5 text-xs" style={{ color: "#475569" }}>
                              {voertuig || "—"}{f.auto_kenteken ? ` · ${f.auto_kenteken.toUpperCase()}` : ""}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-center" style={{ color: "#475569" }}>{f.betaalwijze === "bank" ? "Bank" : "Contant"}</td>
                            <td className="px-3 py-2.5 text-xs text-center">
                              <span className="px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: f.btw_type === "21" ? "#dbeafe" : "#f1f5f9", color: f.btw_type === "21" ? "#1d4ed8" : "#64748b" }}>
                                {f.btw_type === "21" ? "21%" : "Marge"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-right" style={{ color: "#475569", whiteSpace: "nowrap" }}>€ {t.subtotaal.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2.5 text-xs text-right" style={{ color: "#475569", whiteSpace: "nowrap" }}>{t.btw > 0 ? `€ ${t.btw.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}` : "—"}</td>
                            <td className="px-3 py-2.5 text-xs text-right font-bold" style={{ color: "#001337", whiteSpace: "nowrap" }}>€ {t.eindtotaal.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #001337", backgroundColor: "#f8fafc" }}>
                        <td colSpan={7} className="px-3 py-3 text-xs font-bold" style={{ color: "#001337" }}>Totaal {jaarLijst.length} facturen</td>
                        <td className="px-3 py-3 text-xs font-bold text-right" style={{ color: "#001337", whiteSpace: "nowrap" }}>€ {totalen.omzet.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-3 text-xs font-bold text-right" style={{ color: "#001337", whiteSpace: "nowrap" }}>€ {totalen.btw.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-3 text-sm font-bold text-right" style={{ color: "#001337", whiteSpace: "nowrap" }}>€ {totalen.totaal.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Periode filter ──────────────────────────────────────────
  const gefilterdeFacturen = facturen.filter((f) => {
    if (periode === "alles") return true;
    const [dag, maand, jaar] = (f.datum ?? "").split("-").map(Number);
    const datum = new Date(jaar, maand - 1, dag);
    const nu = new Date();
    if (periode === "week") {
      const weekGeleden = new Date(nu); weekGeleden.setDate(nu.getDate() - 7);
      return datum >= weekGeleden;
    }
    if (periode === "maand") {
      return datum.getMonth() === nu.getMonth() && datum.getFullYear() === nu.getFullYear();
    }
    if (periode === "kwartaal") {
      return Math.floor(datum.getMonth() / 3) === Math.floor(nu.getMonth() / 3) && datum.getFullYear() === nu.getFullYear();
    }
    if (periode === "jaar") {
      return datum.getFullYear() === nu.getFullYear();
    }
    return true;
  }).sort((a, b) => b.factuur_nr.localeCompare(a.factuur_nr)); // op nummer, nieuwste boven (ongeacht status)

  // ── Lijstweergave ───────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Facturen"
        subtitle={`${gefilterdeFacturen.length} facturen`}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setView("archief")}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-80"
              style={{ border: "1px solid rgba(0,19,55,0.2)", color: "#001337", fontFamily: "var(--font-inter)" }}
            >
              Archief
              {facturen.filter(f => f.status === "betaald").length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 font-bold" style={{ backgroundColor: "#dcfce7", color: "#15803d" }}>
                  {facturen.filter(f => f.status === "betaald").length}
                </span>
              )}
            </button>
            <button
              onClick={() => setView("nieuw")}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
            >
              <Plus size={14} /> Nieuwe factuur
            </button>
          </div>
        }
      />
      <div className="p-4 md:p-8">
        {nieuwsteFactuur && (
          <div className="mb-5 flex items-center justify-between px-4 py-3" style={{ backgroundColor: "#dcfce7", border: "1px solid #86efac", fontFamily: "var(--font-inter)" }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#15803d" }}>
                Factuur {nieuwsteFactuur.factuur_nr} aangemaakt
              </p>
              <p className="text-xs" style={{ color: "#166534" }}>Klik op Afdrukken om de PDF te openen.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => printFactuur(nieuwsteFactuur)}
                className="px-4 py-2 text-xs font-semibold"
                style={{ backgroundColor: "#15803d", color: "#ffffff", fontFamily: "var(--font-inter)" }}
              >
                Afdrukken / PDF
              </button>
              <button
                onClick={() => verstuurMail(nieuwsteFactuur)}
                disabled={mailStatus[nieuwsteFactuur.id] === "laden"}
                className="px-4 py-2 text-xs font-semibold disabled:opacity-60"
                style={{ backgroundColor: (mailStatus[nieuwsteFactuur.id] === "ok" || nieuwsteFactuur.factuurmail_verstuurd_op) ? "#15803d" : "#1d4ed8", color: "#ffffff", fontFamily: "var(--font-inter)" }}
              >
                {mailStatus[nieuwsteFactuur.id] === "laden" ? "PDF maken..." : (mailStatus[nieuwsteFactuur.id] === "ok" || nieuwsteFactuur.factuurmail_verstuurd_op) ? "✓ Verstuurd" : "Verstuur per mail"}
              </button>
              <button
                onClick={() => setNieuwsteFactuur(null)}
                className="px-3 py-2 text-xs"
                style={{ color: "#15803d", border: "1px solid #86efac", fontFamily: "var(--font-inter)" }}
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {/* Periode filter */}
        {!loading && facturen.length > 0 && (
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {(["week", "maand", "kwartaal", "jaar", "alles"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriode(p)}
                className="px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  backgroundColor: periode === p ? "#001337" : "transparent",
                  color: periode === p ? "#ffffff" : "rgba(0,19,55,0.4)",
                  border: `1px solid ${periode === p ? "#001337" : "rgba(0,19,55,0.12)"}`,
                  fontFamily: "var(--font-inter)",
                }}
              >
                {p === "kwartaal" ? "Kwrt." : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />
          </div>
        ) : facturen.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-28"
            style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}
          >
            <FileText size={40} style={{ color: "rgba(0,19,55,0.1)" }} />
            <p className="text-lg font-bold mt-5 mb-2" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
              Nog geen facturen
            </p>
            <p className="text-sm mb-5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
              Maak de eerste factuur aan via de knop rechtsboven.
            </p>
            <button
              onClick={() => setView("nieuw")}
              className="flex items-center gap-2 px-6 py-3 text-sm font-semibold"
              style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
            >
              <Plus size={13} /> Eerste factuur aanmaken
            </button>
          </div>
        ) : gefilterdeFacturen.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <FileText size={32} style={{ color: "rgba(0,19,55,0.1)" }} />
            <p className="text-sm font-semibold mt-4" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>Geen facturen in deze periode</p>
            <p className="text-xs mt-1" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Kies een andere periode of maak een nieuwe factuur aan.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {gefilterdeFacturen.map((f) => {
              const s = FACTUUR_STATUS[f.status] ?? FACTUUR_STATUS.concept;
              const isOpen = openId === f.id;
              return (
                <div key={f.id} style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                  <button
                    onClick={() => setOpenId(isOpen ? null : f.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                          {f.factuur_nr} · {f.klant_naam || "Naamloos"}
                        </p>
                        <span
                          className="text-[10px] px-2 py-0.5 font-semibold"
                          style={{ backgroundColor: s.bg, color: s.color, fontFamily: "var(--font-inter)" }}
                        >
                          {s.label}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                        {[f.auto_merk, f.auto_model, f.auto_bouwjaar].filter(Boolean).join(" ")}
                        {f.auto_kenteken ? ` · ${f.auto_kenteken.toUpperCase()}` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                        €{berekenTotalen(f).eindtotaal.toLocaleString("nl-NL")}
                      </p>
                      <p className="text-[10px]" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                        {f.datum} · {f.btw_type === "marge" ? "Marge" : "21% BTW"}
                      </p>
                    </div>
                    <span className="text-xs ml-2 flex-shrink-0" style={{ color: "rgba(0,19,55,0.3)" }}>
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5" style={{ borderTop: "1px solid rgba(0,19,55,0.06)" }}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                        <div>
                          <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                            Details
                          </p>
                          <table className="w-full text-xs" style={{ fontFamily: "var(--font-inter)" }}>
                            <tbody>
                              {([
                                ["Klant", f.klant_naam],
                                ["Adres", [f.klant_adres, f.klant_postcode, f.klant_stad].filter(Boolean).join(", ")],
                                ["E-mail", f.klant_email],
                                ["Telefoon", f.klant_telefoon],
                                ["Voertuig", [f.auto_merk, f.auto_model, f.auto_bouwjaar].filter(Boolean).join(" ")],
                                ["Kenteken", f.auto_kenteken?.toUpperCase()],
                                ["KM-stand", f.auto_km ? `${parseInt(f.auto_km).toLocaleString("nl-NL")} km` : ""],
                              ] as [string, string][])
                                .filter(([, v]) => v)
                                .map(([label, val]) => (
                                  <tr key={label}>
                                    <td className="py-1 pr-3" style={{ color: "rgba(0,19,55,0.45)", width: "90px" }}>{label}</td>
                                    <td className="py-1 font-semibold" style={{ color: "#001337" }}>{val}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                            Status
                          </p>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {Object.entries(FACTUUR_STATUS).map(([key, val]) => (
                              <button
                                key={key}
                                onClick={() => updateStatus(f.id, key)}
                                className="px-3 py-1 text-xs font-semibold transition-all"
                                style={{
                                  backgroundColor: f.status === key ? val.bg : "transparent",
                                  color: f.status === key ? val.color : "rgba(0,19,55,0.4)",
                                  border: `1px solid ${f.status === key ? val.color : "rgba(0,19,55,0.15)"}`,
                                  fontFamily: "var(--font-inter)",
                                }}
                              >
                                {val.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => printFactuur(f)}
                              className="px-4 py-2 text-xs font-semibold transition-all hover:opacity-80"
                              style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
                            >
                              Afdrukken / PDF
                            </button>
                            <button
                              onClick={() => downloadFactuur(f)}
                              disabled={downloadStatus[f.id] === "laden"}
                              className="px-4 py-2 text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-60"
                              style={{ backgroundColor: downloadStatus[f.id] === "ok" ? "#15803d" : "#334155", color: "#ffffff", fontFamily: "var(--font-inter)" }}
                            >
                              {downloadStatus[f.id] === "laden" ? "PDF maken..." : downloadStatus[f.id] === "ok" ? "✓ Opgeslagen" : "Opslaan als PDF"}
                            </button>
                            <button
                              onClick={() => verstuurMail(f)}
                              disabled={mailStatus[f.id] === "laden"}
                              className="px-4 py-2 text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-60"
                              style={{ backgroundColor: (mailStatus[f.id] === "ok" || f.factuurmail_verstuurd_op) ? "#15803d" : "#1d4ed8", color: "#ffffff", fontFamily: "var(--font-inter)" }}
                            >
                              {mailStatus[f.id] === "laden" ? "PDF maken..." : (mailStatus[f.id] === "ok" || f.factuurmail_verstuurd_op) ? "✓ Verstuurd" : "Verstuur per mail"}
                            </button>
                            <button
                              onClick={() => verstuurBedankmail(f)}
                              disabled={bedankStatus[f.id] === "laden"}
                              className="px-4 py-2 text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-60"
                              style={{ backgroundColor: (bedankStatus[f.id] === "ok" || f.bedankmail_verstuurd_op) ? "#065f46" : "#047857", color: "#ffffff", fontFamily: "var(--font-inter)" }}
                            >
                              {bedankStatus[f.id] === "laden" ? "PDF maken..." : (bedankStatus[f.id] === "ok" || f.bedankmail_verstuurd_op) ? "✓ Verstuurd" : "Bedankmail + factuur"}
                            </button>
                            <button
                              onClick={() => startBewerken(f)}
                              className="px-4 py-2 text-xs font-semibold transition-all hover:opacity-80"
                              style={{ border: "1px solid rgba(0,19,55,0.2)", color: "#001337", fontFamily: "var(--font-inter)" }}
                            >
                              Bewerken
                            </button>
                            <button
                              onClick={() => verwijder(f.id)}
                              className="px-4 py-2 text-xs transition-all hover:opacity-70"
                              style={{ color: "#b91c1c", border: "1px solid #fecaca", fontFamily: "var(--font-inter)" }}
                            >
                              Verwijder
                            </button>
                          </div>
                          {(f.factuurmail_verstuurd_op || f.bedankmail_verstuurd_op) && (
                            <div className="mt-3 flex flex-col gap-1">
                              {([
                                { veld: "factuurmail_verstuurd_op", label: "Factuurmail" },
                                { veld: "bedankmail_verstuurd_op", label: "Bedankmail" },
                              ] as const).map(({ veld, label }) =>
                                f[veld] ? (
                                  <p key={veld} className="text-[11px] font-medium flex items-center gap-2 flex-wrap" style={{ color: "#15803d", fontFamily: "var(--font-inter)" }}>
                                    ✓ {label} verstuurd op {formatVerstuurd(f[veld])}
                                    <button
                                      onClick={() => draaiVerzendingTerug(f, veld)}
                                      className="underline transition-all hover:opacity-70"
                                      style={{ color: "rgba(0,19,55,0.4)" }}
                                    >
                                      Verzending terugdraaien
                                    </button>
                                  </p>
                                ) : null
                              )}
                            </div>
                          )}
                          {f.notitie && (
                            <div className="mt-4 p-3 text-xs" style={{ backgroundColor: "rgba(0,19,55,0.03)", border: "1px solid rgba(0,19,55,0.07)", color: "rgba(0,19,55,0.65)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
                              {f.notitie}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Marge Calculator ────────────────────────────────────────────
const STANDAARD_KOSTEN: KostenRegel[] = [
  { label: "APK keuring", bedrag: "" },
  { label: "Reparatie / onderhoud", bedrag: "" },
  { label: "Schoonmaak / polijsten", bedrag: "" },
];

// Dashboard-widget: compact dossier overzicht

// ── Interne helpers voor de calculators ─────────────────────────
function useCalculatorLogic(inkoopprijs: string, btwType: "marge" | "21", verkoopprijs: string, kosten: KostenRegel[]) {
  const n = (v: string) => parseFloat(v.replace(",", ".")) || 0;
  const inkoop = n(inkoopprijs);
  const verkoop = n(verkoopprijs);
  const totaalKosten = kosten.reduce((s, k) => s + n(k.bedrag), 0);
  const totaalKostprijs = inkoop + totaalKosten;

  let nettoWinst = 0, btwAfdracht = 0, breakEven = 0, verkoopExBtw = 0;

  if (btwType === "marge") {
    const marge = verkoop - totaalKostprijs;
    if (marge > 0) {
      btwAfdracht = Math.round((marge * 21) / 121 * 100) / 100;
      nettoWinst = Math.round((marge - btwAfdracht) * 100) / 100;
    } else { nettoWinst = marge; }
    breakEven = totaalKostprijs;
    verkoopExBtw = verkoop > 0 ? Math.round((verkoop / 1.21) * 100) / 100 : 0;
  } else {
    verkoopExBtw = Math.round((verkoop / 1.21) * 100) / 100;
    btwAfdracht = Math.round((verkoop - verkoopExBtw) * 100) / 100;
    nettoWinst = Math.round((verkoopExBtw - totaalKostprijs) * 100) / 100;
    breakEven = Math.round(totaalKostprijs * 1.21 * 100) / 100;
  }

  const winstPct = totaalKostprijs > 0 && verkoop > 0
    ? Math.round((nettoWinst / totaalKostprijs) * 1000) / 10 : 0;
  const fmt = (v: number) => v.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const winststatus: "winst" | "verlies" | "neutraal" = nettoWinst > 0 ? "winst" : nettoWinst < 0 ? "verlies" : "neutraal";

  return { inkoop, verkoop, totaalKostprijs, nettoWinst, btwAfdracht, breakEven, verkoopExBtw, winstPct, fmt, winststatus, n };
}

// ── Calculator per auto (dossier beheer) ────────────────────────
function CalculatorContent() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [actief, setActief] = useState<Dossier | null>(null);
  const [laden, setLaden] = useState(true);
  const [toonNieuw, setToonNieuw] = useState(false);
  const [nieuwNaam, setNieuwNaam] = useState("");
  const [mobileView, setMobileView] = useState<"lijst" | "detail">("lijst");
  const [opgeslagen, setOpgeslagen] = useState(false);
  const [periode, setPeriode] = useState<"alles" | "week" | "maand" | "kwartaal" | "jaar">("alles");
  const [dossierZoek, setDossierZoek] = useState("");
  // Verkochte auto's schuiven automatisch naar het archief; standaard toon je
  // wat er nog loopt, want daar stuur je op.
  const [dossierWeergave, setDossierWeergave] = useState<"lopend" | "archief" | "alle">("lopend");

  // Local edit state for the active dossier
  const [autoNaam, setAutoNaam] = useState("");
  const [inkoopprijs, setInkoopprijs] = useState("");
  const [btwType, setBtwType] = useState<"marge" | "21">("marge");
  const [verkoopprijs, setVerkoopprijs] = useState("");
  const [kosten, setKosten] = useState<KostenRegel[]>(STANDAARD_KOSTEN);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(false);

  const openDossier = useCallback((d: Dossier) => {
    setActief(d);
    skipSave.current = true;
    setAutoNaam(d.auto_naam);
    setInkoopprijs(d.inkoop > 0 ? String(d.inkoop) : "");
    setBtwType(d.btw_type);
    setVerkoopprijs(d.verkoopprijs > 0 ? String(d.verkoopprijs) : "");
    setKosten(d.kosten.length > 0 ? [...d.kosten] : [...STANDAARD_KOSTEN]);
    setMobileView("detail");
  }, []);

  useEffect(() => {
    fetch("/api/admin/dossiers")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Dossier[]) => {
        setDossiers(data);
        setLaden(false);
      });
  }, []);

  // Auto-save with 700ms debounce
  useEffect(() => {
    if (!actief) return;
    if (skipSave.current) { skipSave.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const data = {
      auto_naam: autoNaam,
      inkoop: parseFloat(inkoopprijs.replace(",", ".")) || 0,
      btw_type: btwType,
      verkoopprijs: parseFloat(verkoopprijs.replace(",", ".")) || 0,
      kosten,
    };
    const id = actief.id;
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/admin/dossiers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setDossiers((prev) => prev.map((d) => (d.id === id ? { ...d, ...data } : d)));
      setOpgeslagen(true);
      setTimeout(() => setOpgeslagen(false), 2000);
    }, 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNaam, inkoopprijs, btwType, verkoopprijs, kosten]);

  const maakNieuwDossier = async () => {
    if (!nieuwNaam.trim()) return;
    const res = await fetch("/api/admin/dossiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_naam: nieuwNaam.trim() }),
    });
    if (res.ok) {
      const d: Dossier = await res.json();
      setDossiers((prev) => [d, ...prev]);
      setNieuwNaam("");
      setToonNieuw(false);
    }
  };

  const verwijderDossier = async (id: number) => {
    const naam = dossiers.find((d) => d.id === id)?.auto_naam ?? "dit dossier";
    if (!confirm(`Weet je zeker dat je "${naam}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
    await fetch(`/api/admin/dossiers/${id}`, { method: "DELETE" });
    const rest = dossiers.filter((d) => d.id !== id);
    setDossiers(rest);
    if (actief?.id === id) {
      setActief(null);
      setMobileView("lijst");
    }
  };

  const addRegel = () => setKosten((p) => [...p, { label: "", bedrag: "" }]);
  const removeRegel = (i: number) => setKosten((p) => p.filter((_, j) => j !== i));
  const updateRegel = (i: number, f: "label" | "bedrag", v: string) =>
    setKosten((p) => p.map((k, j) => (j === i ? { ...k, [f]: v } : k)));

  const calc = useCalculatorLogic(inkoopprijs, btwType, verkoopprijs, kosten);

  const veld: React.CSSProperties = {
    border: "1px solid rgba(0,19,55,0.15)", color: "#001337",
    fontFamily: "var(--font-inter)", backgroundColor: "#fafafa", outline: "none",
  };

  // Quick winst for sidebar display
  const calcWinstSnel = (d: Dossier): number | null => {
    const k = d.inkoop + d.kosten.reduce((s, kk) => s + (parseFloat(kk.bedrag) || 0), 0);
    if (d.verkoopprijs <= 0) return null;
    if (d.btw_type === "marge") {
      const m = d.verkoopprijs - k;
      return m > 0 ? Math.round((m - (m * 21) / 121) * 100) / 100 : m;
    }
    const ex = Math.round((d.verkoopprijs / 1.21) * 100) / 100;
    return Math.round((ex - k) * 100) / 100;
  };

  const dossierTerm = dossierZoek.trim().toLowerCase();
  const gefilterdeDossiers = dossiers.filter((d) => {
    if (dossierTerm && !d.auto_naam.toLowerCase().includes(dossierTerm)) return false;
    if (dossierWeergave === "lopend" && d.gearchiveerd) return false;
    if (dossierWeergave === "archief" && !d.gearchiveerd) return false;
    if (periode === "alles") return true;
    const aangemaaktDatum = new Date(d.aangemaakt);
    const nu = new Date();
    if (periode === "week") {
      const weekGeleden = new Date(nu); weekGeleden.setDate(nu.getDate() - 7);
      return aangemaaktDatum >= weekGeleden;
    }
    if (periode === "maand") {
      return aangemaaktDatum.getMonth() === nu.getMonth() && aangemaaktDatum.getFullYear() === nu.getFullYear();
    }
    if (periode === "kwartaal") {
      const kwartaal = Math.floor(nu.getMonth() / 3);
      const kwartaalDatum = Math.floor(aangemaaktDatum.getMonth() / 3);
      return kwartaalDatum === kwartaal && aangemaaktDatum.getFullYear() === nu.getFullYear();
    }
    if (periode === "jaar") {
      return aangemaaktDatum.getFullYear() === nu.getFullYear();
    }
    return true;
  });

  // Summary stats across all dossiers
  const totaalNettoWinst = gefilterdeDossiers.reduce((s, d) => {
    const w = calcWinstSnel(d);
    return s + (w ?? 0);
  }, 0);
  const dossiersMetVerkoop = gefilterdeDossiers.filter((d) => d.verkoopprijs > 0);
  const fmtS = (v: number) => v.toLocaleString("nl-NL", { maximumFractionDigits: 0 });

  // Empty state before any dossiers
  if (!laden && dossiers.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title="Marge Calculator"
          subtitle="Per auto bijhouden"
          action={
            <button
              onClick={() => setToonNieuw((v) => !v)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
            >
              <Plus size={12} /> Nieuw dossier
            </button>
          }
        />
        {toonNieuw && (
          <div className="px-4 md:px-8 py-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)", backgroundColor: "#fff" }}>
            <div className="flex gap-2 max-w-sm">
              <input
                autoFocus
                type="text"
                value={nieuwNaam}
                onChange={(e) => setNieuwNaam(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") maakNieuwDossier();
                  if (e.key === "Escape") setToonNieuw(false);
                }}
                placeholder="bijv. Fiat 500 1.2 Lounge"
                className="flex-1 px-3 py-2 text-sm"
                style={veld}
              />
              <button
                onClick={maakNieuwDossier}
                className="px-4 py-2 text-xs font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
              >
                Aanmaken
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-col items-center justify-center flex-1 p-8">
          <div
            className="flex items-center justify-center w-20 h-20 mb-6"
            style={{ backgroundColor: "rgba(0,19,55,0.04)", borderRadius: "50%" }}
          >
            <Calculator size={36} style={{ color: "rgba(0,19,55,0.18)" }} />
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
            Bereken je marge
          </h3>
          <p className="text-sm text-center max-w-xs mb-6" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)", lineHeight: 1.7 }}>
            Maak een dossier aan per auto om inkoop, kosten en verkoopprijs bij te houden. Je ziet meteen wat je netto overhoudt na BTW.
          </p>
          <button
            onClick={() => setToonNieuw(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-80"
            style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
          >
            <Plus size={14} /> Eerste dossier aanmaken
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Marge Calculator"
        subtitle={actief ? (autoNaam || actief.auto_naam || "Dossier") : "Per auto bijhouden"}
        action={
          <div className="flex items-center gap-3">
            {opgeslagen && (
              <span className="text-[11px] hidden md:inline" style={{ color: "#15803d", fontFamily: "var(--font-inter)" }}>
                Opgeslagen ✓
              </span>
            )}
            <button
              onClick={() => { setToonNieuw((v) => !v); setNieuwNaam(""); }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
            >
              <Plus size={12} /> Nieuw dossier
            </button>
          </div>
        }
      />

      {/* Summary stats bar + periode filter */}
      <div
        className="px-4 md:px-6 py-2.5 flex items-center justify-between flex-shrink-0 gap-4 flex-wrap"
        style={{ borderBottom: "1px solid rgba(0,19,55,0.07)", backgroundColor: "#f8f9fb" }}
      >
        {/* Stats */}
        <div className="flex items-center gap-5 overflow-x-auto">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs font-bold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>{gefilterdeDossiers.length}</span>
            <span className="text-[10px]" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>dossier{gefilterdeDossiers.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="w-px h-3 flex-shrink-0" style={{ backgroundColor: "rgba(0,19,55,0.1)" }} />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs font-bold" style={{ color: dossiersMetVerkoop.length > 0 && totaalNettoWinst >= 0 ? "#15803d" : dossiersMetVerkoop.length > 0 ? "#b91c1c" : "#001337", fontFamily: "var(--font-inter)" }}>
              {dossiersMetVerkoop.length > 0 ? ((totaalNettoWinst >= 0 ? "+" : "−") + " €" + fmtS(Math.abs(totaalNettoWinst))) : "—"}
            </span>
            <span className="text-[10px]" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>netto winst</span>
          </div>
          <div className="w-px h-3 flex-shrink-0" style={{ backgroundColor: "rgba(0,19,55,0.1)" }} />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs font-bold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>{dossiersMetVerkoop.length}</span>
            <span className="text-[10px]" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>verkopen</span>
          </div>
        </div>
        {/* Periode knoppen */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {(["week", "maand", "kwartaal", "jaar", "alles"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriode(p)}
              className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-all"
              style={{
                fontFamily: "var(--font-inter)",
                backgroundColor: periode === p ? "#001337" : "transparent",
                color: periode === p ? "#ffffff" : "rgba(0,19,55,0.4)",
                border: `1px solid ${periode === p ? "#001337" : "rgba(0,19,55,0.12)"}`,
              }}
            >
              {p === "kwartaal" ? "Kwrt." : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Zijbalk: dossier lijst ── */}
        <aside
          className={`${mobileView === "detail" ? "hidden md:flex" : "flex"} flex-col flex-shrink-0`}
          style={{ width: "290px", borderRight: "1px solid rgba(0,19,55,0.08)", backgroundColor: "#f8f9fb" }}
        >
          {/* Zoeken + lopend/archief — bij tientallen dossiers is scrollen geen doen */}
          <div className="px-3 py-2.5 flex flex-col gap-2" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)", backgroundColor: "#fff" }}>
            <div className="flex items-center gap-2">
              <Search size={12} style={{ color: "rgba(0,19,55,0.3)", flexShrink: 0 }} />
              <input
                value={dossierZoek}
                onChange={(e) => setDossierZoek(e.target.value)}
                placeholder="Zoek auto..."
                className="flex-1 min-w-0 text-[12px] outline-none bg-transparent"
                style={{ color: "#001337", fontFamily: "var(--font-inter)" }}
              />
            </div>
            <div className="flex items-center gap-1">
              {([
                { key: "lopend", label: "Lopend" },
                { key: "archief", label: "Archief" },
                { key: "alle", label: "Alle" },
              ] as const).map((w) => {
                const actiefFilter = dossierWeergave === w.key;
                const aantal = dossiers.filter((d) =>
                  w.key === "alle" ? true : w.key === "archief" ? d.gearchiveerd : !d.gearchiveerd
                ).length;
                return (
                  <button
                    key={w.key}
                    onClick={() => setDossierWeergave(w.key)}
                    className="flex-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-all hover:opacity-80"
                    style={{
                      fontFamily: "var(--font-inter)",
                      backgroundColor: actiefFilter ? "#001337" : "transparent",
                      color: actiefFilter ? "#fff" : "rgba(0,19,55,0.4)",
                      border: `1px solid ${actiefFilter ? "#001337" : "rgba(0,19,55,0.12)"}`,
                    }}
                  >
                    {w.label} {aantal}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nieuw dossier formulier */}
          {toonNieuw && (
            <div className="px-3 py-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)", backgroundColor: "#fff" }}>
              <input
                autoFocus
                type="text"
                value={nieuwNaam}
                onChange={(e) => setNieuwNaam(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") maakNieuwDossier();
                  if (e.key === "Escape") setToonNieuw(false);
                }}
                placeholder="bijv. Fiat 500 1.2"
                className="w-full px-3 py-2 text-sm mb-2"
                style={veld}
              />
              <button
                onClick={maakNieuwDossier}
                className="w-full py-1.5 text-xs font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
              >
                Aanmaken
              </button>
            </div>
          )}

          {/* Dossier lijst */}
          <div className="flex-1 overflow-y-auto">
            {laden ? (
              <p className="p-4 text-xs" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Laden...</p>
            ) : gefilterdeDossiers.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                  Geen dossiers in deze periode
                </p>
              </div>
            ) : (
              gefilterdeDossiers.map((d) => {
                const w = calcWinstSnel(d);
                const isActief = actief?.id === d.id;
                return (
                  <div
                    key={d.id}
                    className="group relative cursor-pointer"
                    style={{
                      borderLeft: `3px solid ${isActief ? "#001337" : "transparent"}`,
                      borderBottom: "1px solid rgba(0,19,55,0.05)",
                      backgroundColor: isActief ? "#ffffff" : "transparent",
                    }}
                    onClick={() => openDossier(d)}
                  >
                    <div className="px-4 py-3 pr-8">
                      <p className="text-sm font-semibold truncate" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                        {d.auto_naam || "Naamloos"}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                        {d.inkoop > 0 ? ("Inkoop: €" + d.inkoop.toLocaleString("nl-NL")) : "Inkoop: —"}
                      </p>
                      {w !== null ? (
                        <div className="inline-flex items-center mt-1.5 px-2 py-0.5"
                          style={{
                            backgroundColor: w > 0 ? "rgba(21,128,61,0.1)" : w < 0 ? "rgba(185,28,28,0.08)" : "rgba(0,19,55,0.05)",
                            borderRadius: "3px",
                          }}>
                          <span className="text-[10px] font-bold" style={{ color: w > 0 ? "#15803d" : w < 0 ? "#b91c1c" : "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                            {w > 0 ? "+" : w < 0 ? "−" : ""}{"€" + Math.abs(w).toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[10px] mt-1" style={{ color: "rgba(0,19,55,0.28)", fontFamily: "var(--font-inter)" }}>Geen verkoop</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); verwijderDossier(d.id); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5"
                      style={{ color: "rgba(0,19,55,0.3)" }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Calculator paneel ── */}
        <div
          className={`${mobileView === "lijst" ? "hidden md:flex" : "flex"} flex-col flex-1 overflow-y-auto`}
        >
          {!actief ? (
            <div className="flex flex-col items-center justify-center flex-1 py-20 px-8">
              <Calculator size={36} style={{ color: "rgba(0,19,55,0.1)" }} />
              <p className="text-base font-bold mt-4 mb-2" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                Selecteer een dossier
              </p>
              <p className="text-sm text-center" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                Kies een auto in de lijst links
              </p>
            </div>
          ) : (
            <div className="p-4 md:p-6">
              {/* Mobiel: terug knop */}
              <button
                className="flex items-center gap-1.5 text-xs mb-4 md:hidden transition-all hover:opacity-70"
                style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}
                onClick={() => setMobileView("lijst")}
              >
                ← Terug naar overzicht
              </button>

              <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
                {/* Invoer */}
                <div className="flex flex-col gap-4 lg:flex-[3] min-w-0">
                  {/* Auto naam */}
                  <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                    <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Auto</p>
                    </div>
                    <div className="p-5">
                      <input
                        type="text"
                        value={autoNaam}
                        onChange={(e) => setAutoNaam(e.target.value)}
                        placeholder="bijv. Fiat 500 1.2 Lounge"
                        className="w-full px-3 py-2.5 text-sm"
                        style={veld}
                      />
                    </div>
                  </div>

                  {/* Inkoop */}
                  <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                    <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Inkoop</p>
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Inkoopprijs (€)</label>
                        <input type="number" value={inkoopprijs} onChange={(e) => setInkoopprijs(e.target.value)}
                          placeholder="bijv. 8500" className="w-full px-3 py-2.5 text-sm" style={veld} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>BTW type</label>
                        <select value={btwType} onChange={(e) => setBtwType(e.target.value as "marge" | "21")}
                          className="w-full px-3 py-2.5 text-sm" style={veld}>
                          <option value="marge">Margeregeling (particulier)</option>
                          <option value="21">21% BTW (bedrijf)</option>
                        </select>
                      </div>
                      {btwType === "21" && (
                        <p className="col-span-full text-[10px] leading-relaxed" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                          Inkoopprijs excl. BTW invullen, verkoopprijs incl. BTW.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Kosten */}
                  <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                    <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Extra kosten</p>
                    </div>
                    <div className="p-5 flex flex-col gap-3">
                      {kosten.map((k, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input type="text" value={k.label} onChange={(e) => updateRegel(i, "label", e.target.value)}
                            placeholder="Omschrijving" className="flex-1 px-3 py-2 text-sm" style={veld} />
                          <div className="relative" style={{ width: "110px" }}>
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>€</span>
                            <input type="number" value={k.bedrag} onChange={(e) => updateRegel(i, "bedrag", e.target.value)}
                              placeholder="0" className="w-full pl-8 pr-3 py-2 text-sm" style={veld} />
                          </div>
                          <button onClick={() => removeRegel(i)} className="flex-shrink-0 p-2 transition-all hover:opacity-60" style={{ color: "rgba(0,19,55,0.3)" }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button onClick={addRegel} className="mt-1 flex items-center gap-1.5 text-xs transition-all hover:opacity-70"
                        style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                        <Plus size={12} /> Regel toevoegen
                      </button>
                    </div>
                  </div>

                  {/* Verkoopprijs */}
                  <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                    <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Gewenste verkoopprijs</p>
                    </div>
                    <div className="p-5">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>€</span>
                        <input type="number" value={verkoopprijs} onChange={(e) => setVerkoopprijs(e.target.value)}
                          placeholder={calc.breakEven > 0 ? ("Min. " + Math.ceil(calc.breakEven).toLocaleString("nl-NL") + " voor break-even") : "bijv. 11500"}
                          className="w-full pl-12 pr-3 py-2.5 text-sm" style={veld} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resultaten */}
                <div className="lg:w-[320px] flex flex-col gap-3">
                  {/* Kostprijsoverzicht */}
                  <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                    <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Kostprijsoverzicht</p>
                    </div>
                    <div className="p-5">
                      <table className="w-full text-sm" style={{ fontFamily: "var(--font-inter)" }}>
                        <tbody>
                          <tr>
                            <td className="py-1.5" style={{ color: "rgba(0,19,55,0.55)" }}>Inkoopprijs</td>
                            <td className="py-1.5 text-right font-semibold" style={{ color: "#001337" }}>{calc.inkoop > 0 ? ("€ " + calc.fmt(calc.inkoop)) : "---"}</td>
                          </tr>
                          {kosten.filter((k) => calc.n(k.bedrag) > 0).map((k, i) => (
                            <tr key={i}>
                              <td className="py-1.5" style={{ color: "rgba(0,19,55,0.55)" }}>{k.label || "Kosten"}</td>
                              <td className="py-1.5 text-right font-semibold" style={{ color: "#001337" }}>{"€ " + calc.fmt(calc.n(k.bedrag))}</td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: "1px solid rgba(0,19,55,0.08)" }}>
                            <td className="pt-3 pb-1 font-bold" style={{ color: "#001337" }}>Totale kostprijs</td>
                            <td className="pt-3 pb-1 text-right font-bold" style={{ color: "#001337" }}>{calc.totaalKostprijs > 0 ? ("€ " + calc.fmt(calc.totaalKostprijs)) : "---"}</td>
                          </tr>
                          {calc.breakEven > 0 && (
                            <tr>
                              <td className="py-1" style={{ color: "rgba(0,19,55,0.45)", fontSize: "11px" }}>Break-even verkoopprijs</td>
                              <td className="py-1 text-right" style={{ color: "rgba(0,19,55,0.45)", fontSize: "11px" }}>{"€ " + calc.fmt(calc.breakEven)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Resultaat */}
                  {calc.verkoop > 0 && (
                    <div style={{
                      backgroundColor: calc.winststatus === "winst" ? "#f0fdf4" : calc.winststatus === "verlies" ? "#fef2f2" : "#f8fafc",
                      border: ("1px solid " + (calc.winststatus === "winst" ? "#86efac" : calc.winststatus === "verlies" ? "#fecaca" : "rgba(0,19,55,0.07)")),
                    }}>
                      <div className="px-5 py-3" style={{
                        borderBottom: ("1px solid " + (calc.winststatus === "winst" ? "#bbf7d0" : calc.winststatus === "verlies" ? "#fecaca" : "rgba(0,19,55,0.06)")),
                        backgroundColor: calc.winststatus === "winst" ? "rgba(21,128,61,0.05)" : calc.winststatus === "verlies" ? "rgba(185,28,28,0.04)" : "rgba(0,19,55,0.02)",
                      }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Resultaat</p>
                      </div>
                      <div className="p-5">
                        <table className="w-full text-sm" style={{ fontFamily: "var(--font-inter)" }}>
                          <tbody>
                            <tr>
                              <td className="py-1.5" style={{ color: "rgba(0,19,55,0.55)" }}>Verkoopprijs</td>
                              <td className="py-1.5 text-right font-semibold" style={{ color: "#001337" }}>{"€ " + calc.fmt(calc.verkoop)}</td>
                            </tr>
                            {btwType === "marge" && calc.verkoop > 0 && (
                              <tr>
                                <td className="py-1.5" style={{ color: "rgba(0,19,55,0.55)" }}>Bruto marge</td>
                                <td className="py-1.5 text-right font-semibold" style={{ color: "#001337" }}>{"€ " + calc.fmt(calc.verkoop - calc.totaalKostprijs)}</td>
                              </tr>
                            )}
                            {btwType === "21" && (
                              <tr>
                                <td className="py-1.5" style={{ color: "rgba(0,19,55,0.55)" }}>Excl. BTW</td>
                                <td className="py-1.5 text-right font-semibold" style={{ color: "#001337" }}>{"€ " + calc.fmt(calc.verkoopExBtw)}</td>
                              </tr>
                            )}
                            <tr>
                              <td className="py-1.5" style={{ color: "rgba(0,19,55,0.55)" }}>{btwType === "marge" ? "BTW afdragen (op marge)" : "BTW afdragen (21%)"}</td>
                              <td className="py-1.5 text-right font-semibold" style={{ color: calc.btwAfdracht > 0 ? "#b45309" : "rgba(0,19,55,0.55)" }}>
                                {calc.btwAfdracht > 0 ? ("− € " + calc.fmt(calc.btwAfdracht)) : "€ 0,00"}
                              </td>
                            </tr>
                            <tr style={{ borderTop: ("2px solid " + (calc.winststatus === "winst" ? "#86efac" : calc.winststatus === "verlies" ? "#fecaca" : "rgba(0,19,55,0.12)")) }}>
                              <td className="pt-3 font-bold text-base" style={{ color: "#001337" }}>Netto winst</td>
                              <td className="pt-3 text-right font-bold text-base" style={{ color: calc.winststatus === "winst" ? "#15803d" : calc.winststatus === "verlies" ? "#b91c1c" : "#001337" }}>
                                {(calc.nettoWinst >= 0 ? "" : "- ") + "€ " + calc.fmt(Math.abs(calc.nettoWinst))}
                              </td>
                            </tr>
                            {calc.winstPct !== 0 && (
                              <tr>
                                <td style={{ color: "rgba(0,19,55,0.4)", fontSize: "11px" }}>Winstmarge</td>
                                <td className="text-right" style={{ color: calc.winstPct > 0 ? "#15803d" : "#b91c1c", fontSize: "11px", fontWeight: 600 }}>
                                  {(calc.winstPct > 0 ? "+" : "") + calc.winstPct + "%"}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {calc.totaalKostprijs > 0 && calc.verkoop === 0 && (
                    <div className="px-4 py-3 text-xs" style={{ backgroundColor: "rgba(0,19,55,0.03)", border: "1px solid rgba(0,19,55,0.07)", color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)", lineHeight: 1.7 }}>
                      Vul een verkoopprijs in om je winst te berekenen.<br />
                      <strong style={{ color: "#001337" }}>{"Break-even: € " + calc.fmt(calc.breakEven)}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Kenteken Check Widget ────────────────────────────────────────
// Volledige RDW-respons (zie app/api/admin/rdw-lookup/route.ts)
type RdwResultaat = {
  kenteken: string; merk: string; model: string; bouwjaar: number | null;
  kleur: string; brandstof: string; bodytype: string; apk: string;
  vermogen: string; cilinderinhoud: string; aantalDeuren: string; aantalCilinders: string;
  catalogusprijs: number;
  voertuigsoort: string; handelsbenaming: string; variant: string; uitvoering: string;
  typegoedkeuring: string; inrichting: string; tweedeKleur: string;
  aantalZitplaatsen: string; aantalWielen: string;
  apkVervaldatum: string; datumEersteToelatingNL: string; datumTenaamstelling: string;
  eersteToelatingNederland: string;
  wamVerzekerd: boolean; tenaamstellenMogelijk: boolean; geexporteerd: boolean; taxiVerleden: boolean;
  tellerstandoordeel: string; tellerLogisch: boolean; jaarLaatsteTellerstand: string;
  openstaandeTerugroepactie: boolean; aantalTerugroepacties: number; aantalGebreken: number;
  brutoBpm: number | null; zuinigheidsclassificatie: string;
  massaLedig: number | null; massaRijklaar: number | null; maxMassa: number | null;
  trekgewichtGeremd: number | null; trekgewichtOngeremd: number | null;
  lengte: number | null; breedte: number | null; hoogte: number | null; wielbasis: number | null;
  topsnelheid: number | null; europeseCategorie: string; carrosserie: string;
  co2Uitstoot: number | null; emissiecode: string;
};

// Groen = goed nieuws, rood = let op. Zo zie je in één blik of een auto schoon is.
function Signaal({ ok, goedTekst, foutTekst }: { ok: boolean; goedTekst: string; foutTekst: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2"
      style={{
        backgroundColor: ok ? "#f0fdf4" : "#fef2f2",
        border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`,
      }}
    >
      {ok
        ? <CheckCircle2 size={13} style={{ color: "#15803d", flexShrink: 0 }} />
        : <AlertTriangle size={13} style={{ color: "#b91c1c", flexShrink: 0 }} />}
      <p className="text-[11px] font-semibold" style={{ color: ok ? "#15803d" : "#b91c1c", fontFamily: "var(--font-inter)" }}>
        {ok ? goedTekst : foutTekst}
      </p>
    </div>
  );
}

function KentekenWidget() {
  const [kenteken, setKenteken] = useState("");
  const [laden, setLaden] = useState(false);
  const [resultaat, setResultaat] = useState<RdwResultaat | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const zoek = async () => {
    if (!kenteken.trim()) return;
    setLaden(true);
    setResultaat(null);
    setFout(null);
    try {
      const res = await fetch(`/api/admin/rdw-lookup?kenteken=${encodeURIComponent(kenteken.trim())}`);
      const data = await res.json();
      if (res.ok && data?.merk) setResultaat(data as RdwResultaat);
      else setFout(data?.error ?? "Kenteken niet gevonden");
    } catch {
      setFout("Fout bij ophalen RDW-data");
    } finally {
      setLaden(false);
    }
  };

  const r = resultaat;
  const euro = (n: number | null | undefined) =>
    n != null && n > 0 ? `€${n.toLocaleString("nl-NL")}` : "";

  // Gegroepeerd zoals een kentekencheck: identiteit, techniek, maten, milieu.
  const groepen: { titel: string; velden: [string, string][] }[] = r ? [
    {
      titel: "Voertuig",
      velden: [
        ["Merk", r.merk],
        ["Model", r.model],
        ["Uitvoering", r.variant],
        ["Voertuigsoort", r.voertuigsoort],
        ["Carrosserie", r.carrosserie || r.inrichting],
        ["Kleur", [r.kleur, r.tweedeKleur].filter(Boolean).join(" / ")],
        ["Zitplaatsen", r.aantalZitplaatsen],
        ["Deuren", String(r.aantalDeuren ?? "")],
      ],
    },
    {
      titel: "Techniek",
      velden: [
        ["Brandstof", r.brandstof],
        ["Vermogen", r.vermogen],
        ["Cilinderinhoud", r.cilinderinhoud ? `${r.cilinderinhoud} L` : ""],
        ["Cilinders", String(r.aantalCilinders ?? "")],
        ["Topsnelheid", r.topsnelheid ? `${r.topsnelheid} km/u` : ""],
        ["Energielabel", r.zuinigheidsclassificatie],
        ["CO₂", r.co2Uitstoot ? `${r.co2Uitstoot} g/km` : ""],
        ["Emissieklasse", r.emissiecode],
      ],
    },
    {
      titel: "Datums & status",
      velden: [
        ["1e toelating", r.datumEersteToelatingNL],
        ["1e toelating NL", r.eersteToelatingNederland],
        ["Op naam sinds", r.datumTenaamstelling],
        ["APK geldig tot", r.apkVervaldatum],
        ["Tellerstand", r.tellerstandoordeel],
        ["Laatste telleraflezing", r.jaarLaatsteTellerstand],
        ["Catalogusprijs", euro(r.catalogusprijs)],
        ["Bruto BPM", euro(r.brutoBpm)],
      ],
    },
    {
      titel: "Massa & maten",
      velden: [
        ["Massa ledig", r.massaLedig ? `${r.massaLedig} kg` : ""],
        ["Massa rijklaar", r.massaRijklaar ? `${r.massaRijklaar} kg` : ""],
        ["Max. massa", r.maxMassa ? `${r.maxMassa} kg` : ""],
        ["Trekgewicht geremd", r.trekgewichtGeremd ? `${r.trekgewichtGeremd} kg` : ""],
        ["Trekgewicht ongeremd", r.trekgewichtOngeremd ? `${r.trekgewichtOngeremd} kg` : ""],
        ["Lengte × breedte", r.lengte && r.breedte ? `${r.lengte} × ${r.breedte} cm` : ""],
        ["Hoogte", r.hoogte ? `${r.hoogte} cm` : ""],
        ["Wielbasis", r.wielbasis ? `${r.wielbasis} cm` : ""],
      ],
    },
  ].map((g) => ({ titel: g.titel, velden: g.velden.filter(([, v]) => v) as [string, string][] }))
    .filter((g) => g.velden.length > 0)
    : [];

  return (
    <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
      <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
        <div className="flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: "rgba(0,19,55,0.06)", borderRadius: 7 }}>
          <Search size={14} style={{ color: "#001337" }} />
        </div>
        <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Kenteken Check</h2>
        <span className="text-[10px] ml-auto" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
          Bron: RDW open data
        </span>
      </div>
      <div className="p-4">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={kenteken}
            onChange={(e) => setKenteken(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && zoek()}
            placeholder="bijv. AB-123-C"
            className="flex-1 px-3 py-2 text-sm outline-none"
            style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", backgroundColor: "#fafafa" }}
          />
          <button
            type="button"
            onClick={zoek}
            disabled={laden}
            className="px-5 py-2 text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
          >
            {laden ? "Zoeken..." : "Zoek"}
          </button>
        </div>

        {fout && (
          <p className="text-xs" style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>{fout}</p>
        )}

        {r && (
          <>
            {/* Kop met kenteken */}
            <div className="flex items-center gap-3 mb-4 pb-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
              <span
                className="px-3 py-1.5 text-sm font-bold tracking-wider"
                style={{ backgroundColor: "#facc15", color: "#001337", fontFamily: "var(--font-inter)", border: "1px solid #001337" }}
              >
                {r.kenteken}
              </span>
              <div>
                <p className="text-base font-bold leading-tight" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                  {r.merk} {r.model}
                </p>
                <p className="text-[11px]" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                  {[r.bouwjaar, r.brandstof, r.vermogen].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>

            {/* Signalen — de dingen waar je bij inkoop op let */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
              <Signaal ok={r.tellerLogisch} goedTekst="Tellerstand logisch" foutTekst={r.tellerstandoordeel || "Tellerstand onlogisch"} />
              <Signaal ok={!r.openstaandeTerugroepactie} goedTekst="Geen terugroepactie" foutTekst="Openstaande terugroepactie" />
              <Signaal ok={r.wamVerzekerd} goedTekst="WAM verzekerd" foutTekst="Niet WAM verzekerd" />
              <Signaal ok={r.tenaamstellenMogelijk} goedTekst="Tenaamstellen mogelijk" foutTekst="Tenaamstellen geblokkeerd" />
              <Signaal ok={!r.taxiVerleden} goedTekst="Geen taxiverleden" foutTekst="Taxiverleden" />
              <Signaal ok={!r.geexporteerd} goedTekst="Niet geëxporteerd" foutTekst="Geëxporteerd" />
            </div>

            {r.aantalGebreken > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 mb-4" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
                <AlertTriangle size={13} style={{ color: "#b45309", flexShrink: 0 }} />
                <p className="text-[11px] font-semibold" style={{ color: "#b45309", fontFamily: "var(--font-inter)" }}>
                  {r.aantalGebreken} geconstateerd gebrek{r.aantalGebreken === 1 ? "" : "en"} bij eerdere keuring
                </p>
              </div>
            )}

            {/* Alle gegevens, gegroepeerd */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
              {groepen.map((g) => (
                <div key={g.titel}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                    {g.titel}
                  </p>
                  <div className="flex flex-col">
                    {g.velden.map(([l, v]) => (
                      <div key={l} className="flex items-baseline justify-between gap-3 py-1" style={{ borderBottom: "1px solid rgba(0,19,55,0.05)" }}>
                        <p className="text-[11px] flex-shrink-0" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>{l}</p>
                        <p className="text-[11px] font-semibold text-right" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

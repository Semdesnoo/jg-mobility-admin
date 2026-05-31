"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Mail,
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
} from "lucide-react";
import GmailWidget from "./GmailWidget";
import DeleteButton from "./DeleteButton";

type Tab = "dashboard" | "email" | "voorraad" | "cosignatie" | "social" | "facturen" | "calculator";

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
  verkocht_op?: string;
  fotos: string[];
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
};

type IconProps = { size?: number; style?: React.CSSProperties; className?: string };

const NAV: { id: Tab; label: string; icon: React.ComponentType<IconProps> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "email", label: "Email", icon: Mail },
  { id: "voorraad", label: "Auto Voorraad", icon: Car },
  { id: "cosignatie", label: "Cosignatie", icon: Handshake },
  { id: "social", label: "Social Media", icon: Share2 },
  { id: "facturen", label: "Facturen", icon: FileText },
  { id: "calculator", label: "Calculator", icon: Calculator },
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="p-6"
      style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}
    >
      <p
        className="text-3xl font-bold mb-1"
        style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}
      >
        {value}
      </p>
      <p
        className="text-xs"
        style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}
      >
        {label}
      </p>
    </div>
  );
}

function PlaceholderTab({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<IconProps>;
  title: string;
  description: string;
}) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="p-4 md:p-8">
        <div
          className="flex flex-col items-center justify-center py-28"
          style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}
        >
          <Icon size={40} style={{ color: "rgba(0,19,55,0.1)" }} />
          <p
            className="text-lg font-bold mt-5 mb-2"
            style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}
          >
            Binnenkort beschikbaar
          </p>
          <p
            className="text-sm text-center max-w-md"
            style={{
              color: "rgba(0,19,55,0.45)",
              fontFamily: "var(--font-inter)",
              lineHeight: 1.7,
            }}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

const NAV_META: Record<Tab, string> = {
  dashboard:   "Overzicht & voorraadstatus",
  email:       "Berichten & klantcontact",
  voorraad:    "Beheer je auto's",
  cosignatie:  "Aanvragen & deals",
  social:      "Posts & marketing",
  facturen:    "Maak en beheer facturen",
  calculator:  "Bereken marge per auto",
};

export default function DashboardHub() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [mobileHub, setMobileHub] = useState(true);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-left transition-all"
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
        {/* Mobiel: terug-balk */}
        <div
          className={`md:hidden sticky top-0 z-20 flex items-center gap-3 px-4 h-13 ${mobileHub ? "hidden" : "flex"}`}
          style={{ backgroundColor: "#001337", height: "52px" }}
        >
          <button
            onClick={() => setMobileHub(true)}
            className="flex items-center gap-1.5 text-sm transition-all hover:opacity-70"
            style={{ color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-inter)" }}
          >
            ← Menu
          </button>
          <span className="text-sm font-semibold text-white" style={{ fontFamily: "var(--font-inter)" }}>
            {NAV.find((n) => n.id === tab)?.label}
          </span>
        </div>
        {tab === "dashboard" && (
          <DashboardContent
            autos={autos}
            beschikbaar={beschikbaar}
            verkocht={verkocht}
            lastRefresh={lastRefresh}
            refresh={refresh}
          />
        )}
        {tab === "email" && <EmailContent />}
        {tab === "voorraad" && <VoorraadContent autos={autos} refresh={refresh} setTab={setTab} setMobileHub={setMobileHub} />}
        {tab === "cosignatie" && <CosignatieContent />}
        {tab === "social" && <SocialContent />}
        {tab === "facturen" && <FacturenContent />}
        {tab === "calculator" && <CalculatorContent />}
      </main>

      {/* ── Mobiele hub (full-screen overlay) ── */}
      {mobileHub && (
        <div
          className="md:hidden fixed inset-0 z-50 overflow-y-auto flex flex-col"
          style={{ backgroundColor: "#f0f2f5" }}
        >
          {/* Header */}
          <div style={{ backgroundColor: "#001337" }} className="px-6 pt-10 pb-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[10px] tracking-widest uppercase mb-1" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-inter)" }}>
                  Beheer
                </p>
                <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-playfair)" }}>
                  JG Mobility
                </h1>
              </div>
              <form action="/api/admin/logout" method="POST">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
                  style={{ backgroundColor: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-inter)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <LogOut size={11} />
                  Uitloggen
                </button>
              </form>
            </div>
            <div>
              <p className="text-base font-semibold text-white mb-0.5" style={{ fontFamily: "var(--font-inter)" }}>
                Welkom terug
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-inter)" }}>
                {new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Snelle stats */}
          <div className="px-4 pt-5 pb-2 grid grid-cols-3 gap-2">
            {[
              { label: "Beschikbaar", value: beschikbaar.length },
              { label: "Verkocht", value: verkocht.length },
              { label: "Totaal", value: autos.length },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center justify-center py-3" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
                <p className="text-xl font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>{s.value}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Nav kaarten */}
          <div className="px-4 pt-3 pb-8 grid grid-cols-2 gap-3">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setTab(id); setMobileHub(false); }}
                className="flex flex-col items-start p-4 text-left transition-all active:scale-95"
                style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}
              >
                <div
                  className="flex items-center justify-center mb-3"
                  style={{ width: "40px", height: "40px", backgroundColor: "rgba(0,19,55,0.05)" }}
                >
                  <Icon size={18} style={{ color: "#001337" }} />
                </div>
                <p className="text-sm font-bold mb-1" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                  {label}
                </p>
                <p className="text-[11px] leading-snug" style={{ color: "rgba(0,19,55,0.42)", fontFamily: "var(--font-inter)" }}>
                  {NAV_META[id]}
                </p>
              </button>
            ))}
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
}: {
  autos: Auto[];
  beschikbaar: Auto[];
  verkocht: Auto[];
  lastRefresh: Date;
  refresh: () => void;
}) {
  const totaalWaarde = beschikbaar.reduce((s, a) => s + a.prijs, 0);

  const updateStatus = async (id: number, status: "beschikbaar" | "gereserveerd" | "verkocht") => {
    if (status === "gereserveerd" && !confirm("Wil je deze auto als Gereserveerd markeren?")) return;
    if (status === "verkocht" && !confirm("Wil je deze auto als Verkocht markeren?")) return;
    await fetch(`/api/admin/autos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refresh();
  };

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
          <StatCard label="In aanbod" value={beschikbaar.length} />
          <StatCard label="Verkocht" value={verkocht.length} />
          <StatCard label="Totaal voertuigen" value={autos.length} />
          <StatCard
            label="Totale voorraadwaarde"
            value={totaalWaarde ? `€${totaalWaarde.toLocaleString("nl-NL")}` : "—"}
          />
        </div>

        {/* Mail (links) + Calculator (rechts) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-7 items-start">
          <GmailWidget />
          <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
            <div
              className="px-5 py-4 flex items-center gap-2"
              style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}
            >
              <Calculator size={15} style={{ color: "#001337" }} />
              <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                Marge Calculator
              </h2>
            </div>
            <div className="p-4">
              <CalculatorPanel />
            </div>
          </div>
        </div>

        {/* Voorraad — volle breedte */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
              Voorraad
            </h3>
            <Link
              href="/admin/auto-toevoegen"
              className="flex items-center gap-1.5 text-xs font-medium transition-all hover:opacity-60"
              style={{ color: "#001337", fontFamily: "var(--font-inter)" }}
            >
              <Plus size={11} /> Nieuwe auto
            </Link>
          </div>
          {autos.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16"
              style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}
            >
              <Car size={32} style={{ color: "rgba(0,19,55,0.1)" }} />
              <p className="text-sm font-bold mt-4" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                Nog geen auto&apos;s
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {autos.map((auto) => {
                const statusColors: Record<string, { bg: string; color: string }> = {
                  beschikbaar: { bg: "#dcfce7", color: "#15803d" },
                  gereserveerd: { bg: "#fef3c7", color: "#b45309" },
                  verkocht: { bg: "#001337", color: "#ffffff" },
                };
                return (
                  <div
                    key={auto.id}
                    className="flex flex-col md:flex-row md:items-center gap-2.5 md:gap-4 px-4 md:px-5 py-3.5"
                    style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-16 md:w-20 h-11 md:h-14 overflow-hidden" style={{ backgroundColor: "#001337" }}>
                        {auto.fotos?.length > 0 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={auto.fotos[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-lg font-bold" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-playfair)" }}>
                              {auto.merk.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                            {auto.merk} {auto.model}
                          </p>
                          {auto.verkocht && (
                            <span className="text-[9px] px-1.5 py-0.5 tracking-widest uppercase" style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
                              Verkocht
                            </span>
                          )}
                          {auto.gereserveerd && !auto.verkocht && (
                            <span className="text-[9px] px-1.5 py-0.5 tracking-widest uppercase" style={{ backgroundColor: "#b45309", color: "#ffffff", fontFamily: "var(--font-inter)" }}>
                              Gereserveerd
                            </span>
                          )}
                        </div>
                        <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                          {auto.bouwjaar} · {auto.km.toLocaleString("nl-NL")} km · {auto.brandstof}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 md:mr-2">
                        <p className="text-sm md:text-base font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                          €{auto.prijs.toLocaleString("nl-NL")}
                        </p>
                        <p className="text-[10px]" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                          {auto.fotos?.length ?? 0} foto&apos;s
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
                      {(["beschikbaar", "gereserveerd", "verkocht"] as const).map((s) => {
                        const active = s === "verkocht" ? auto.verkocht : s === "gereserveerd" ? (auto.gereserveerd && !auto.verkocht) : (!auto.verkocht && !auto.gereserveerd);
                        return (
                          <button
                            key={s}
                            onClick={() => updateStatus(auto.id, s)}
                            className="px-2 md:px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase transition-all hover:opacity-80"
                            style={{
                              backgroundColor: active ? statusColors[s].bg : "transparent",
                              color: active ? statusColors[s].color : "rgba(0,19,55,0.3)",
                              border: `1px solid ${active ? statusColors[s].color : "rgba(0,19,55,0.12)"}`,
                              fontFamily: "var(--font-inter)",
                            }}
                          >
                            {s === "beschikbaar" ? "Beschikbaar" : s === "gereserveerd" ? "Gereserveerd" : "Verkocht"}
                          </button>
                        );
                      })}
                      <a
                        href={`https://www.jgmobility.nl/aanbod/${auto.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-70"
                        style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
                      >
                        Bekijk
                      </a>
                      <DeleteButton id={auto.id} naam={`${auto.merk} ${auto.model}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Email ───────────────────────────────────────────────────────
function EmailContent() {
  return (
    <div>
      <PageHeader
        title="Email"
        subtitle="info@jgmobility.nl"
        action={
          <a
            href="https://mail.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all hover:opacity-70"
            style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
          >
            <ExternalLink size={12} /> Open Gmail
          </a>
        }
      />
      <div className="p-4 md:p-8">
        <GmailWidget />
      </div>
    </div>
  );
}

// ── Auto Voorraad ───────────────────────────────────────────────
const STATUS_COLORS = {
  beschikbaar: { bg: "#dcfce7", color: "#15803d", label: "Beschikbaar" },
  gereserveerd: { bg: "#fef3c7", color: "#b45309", label: "Gereserveerd" },
  verkocht: { bg: "#001337", color: "#ffffff", label: "Verkocht" },
};

type StatusKey = keyof typeof STATUS_COLORS;

function AutoKaart({
  auto,
  editPrijsWaarde,
  savingPrijs,
  onStartEdit,
  onCancelEdit,
  onSavePrijs,
  onEditChange,
  onUpdateStatus,
  onOpenCalculator,
}: {
  auto: Auto;
  editPrijsWaarde?: string;
  savingPrijs?: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSavePrijs: () => void;
  onEditChange: (val: string) => void;
  onUpdateStatus: (s: StatusKey) => void;
  onOpenCalculator: () => void;
}) {
  const status: StatusKey = auto.verkocht ? "verkocht" : auto.gereserveerd ? "gereserveerd" : "beschikbaar";
  const isEditing = editPrijsWaarde !== undefined;
  const sc = STATUS_COLORS[status];

  return (
    <div
      className="flex flex-col gap-3 p-3 md:p-4"
      style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}
    >
      {/* Bovenste rij: foto + info + prijs */}
      <div className="flex items-start gap-3">
        {/* Foto */}
        <div
          className="flex-shrink-0 overflow-hidden"
          style={{ width: "96px", height: "72px", backgroundColor: "#001337" }}
        >
          {auto.fotos?.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={auto.fotos[0]} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-lg font-bold" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-playfair)" }}>
                {auto.merk.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <p className="text-sm font-bold leading-tight" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
              {auto.merk} {auto.model}
            </p>
            <span
              className="text-[9px] px-1.5 py-0.5 tracking-widest uppercase"
              style={{ backgroundColor: sc.bg, color: sc.color, fontFamily: "var(--font-inter)" }}
            >
              {sc.label}
            </span>
          </div>
          <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
            {auto.bouwjaar} · {auto.km.toLocaleString("nl-NL")} km · {auto.brandstof}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "rgba(0,19,55,0.3)", fontFamily: "var(--font-inter)" }}>
            {auto.fotos?.length ?? 0} foto&apos;s
          </p>
        </div>

        {/* Prijs + bewerk */}
        <div className="flex-shrink-0 text-right">
          {isEditing ? (
            <div className="flex flex-col items-end gap-1">
              <input
                type="text"
                value={editPrijsWaarde}
                onChange={(e) => onEditChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onSavePrijs(); if (e.key === "Escape") onCancelEdit(); }}
                onBlur={() => {
                  if (editPrijsWaarde !== String(auto.prijs)) {
                    const opslaan = confirm(`Wil je de prijs opslaan als €${editPrijsWaarde}?`);
                    if (opslaan) onSavePrijs(); else onCancelEdit();
                  } else {
                    onCancelEdit();
                  }
                }}
                className="w-24 text-right text-sm font-bold px-2 py-1 outline-none"
                style={{ border: "1px solid #001337", fontFamily: "var(--font-inter)", color: "#001337" }}
                autoFocus
              />
              <div className="flex gap-1">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onSavePrijs}
                  disabled={savingPrijs}
                  className="text-[10px] px-2 py-0.5 font-semibold cursor-pointer"
                  style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
                >
                  {savingPrijs ? "..." : "Opslaan"}
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onCancelEdit}
                  className="text-[10px] px-2 py-0.5 cursor-pointer"
                  style={{ border: "1px solid rgba(0,19,55,0.2)", color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}
                >
                  Annuleer
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <p className="text-sm md:text-base font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                €{auto.prijs.toLocaleString("nl-NL")}
              </p>
              {!auto.verkocht && (
                <button
                  onClick={onStartEdit}
                  className="text-[10px] px-2 py-0.5 transition-all hover:opacity-70 cursor-pointer"
                  style={{ border: "1px solid rgba(0,19,55,0.2)", color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}
                >
                  Bewerk
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Onderste rij: status + acties */}
      <div
        className="flex items-center gap-1.5 flex-wrap pt-2.5"
        style={{ borderTop: "1px solid rgba(0,19,55,0.05)" }}
      >
        {(["beschikbaar", "gereserveerd", "verkocht"] as const).map((s) => {
          const active = s === status;
          return (
            <button
              key={s}
              onClick={() => onUpdateStatus(s)}
              className="px-2 py-1 text-[10px] font-semibold tracking-wide uppercase transition-all hover:opacity-80 cursor-pointer"
              style={{
                backgroundColor: active ? STATUS_COLORS[s].bg : "transparent",
                color: active ? STATUS_COLORS[s].color : "rgba(0,19,55,0.3)",
                border: `1px solid ${active ? STATUS_COLORS[s].color : "rgba(0,19,55,0.12)"}`,
                fontFamily: "var(--font-inter)",
              }}
            >
              {STATUS_COLORS[s].label}
            </button>
          );
        })}

        <div className="flex-1" />

        {!auto.verkocht && (
          <button
            onClick={onOpenCalculator}
            title="Maak calculator-dossier"
            className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold transition-all hover:opacity-70 cursor-pointer"
            style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
          >
            <Calculator size={10} />
            Calc
          </button>
        )}

        <a
          href={`https://www.jgmobility.nl/aanbod/${auto.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold transition-all hover:opacity-70"
          style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
        >
          <ExternalLink size={10} />
          Bekijk
        </a>

        <DeleteButton id={auto.id} naam={`${auto.merk} ${auto.model}`} />
      </div>
    </div>
  );
}

function VoorraadContent({
  autos,
  refresh,
  setTab,
  setMobileHub,
}: {
  autos: Auto[];
  refresh: () => void;
  setTab: (tab: Tab) => void;
  setMobileHub: (v: boolean) => void;
}) {
  const actief = autos.filter((a) => !a.verkocht);
  const verkocht = autos.filter((a) => a.verkocht);

  const [tabView, setTabView] = useState<"beschikbaar" | "verkocht">("beschikbaar");

  const jaren = Array.from(
    new Set(
      verkocht
        .map((a) => (a.verkocht_op ? new Date(a.verkocht_op).getFullYear() : null))
        .filter((y): y is number => y !== null)
    )
  ).sort((a, b) => b - a);

  const [filterJaar, setFilterJaar] = useState<number | "alles">("alles");
  const verkochtGefilterd =
    filterJaar === "alles"
      ? verkocht
      : verkocht.filter((a) => a.verkocht_op && new Date(a.verkocht_op).getFullYear() === filterJaar);

  const [editPrijs, setEditPrijs] = useState<Record<number, string>>({});
  const [savingPrijs, setSavingPrijs] = useState<Record<number, boolean>>({});

  const startEdit = (id: number, prijs: number) =>
    setEditPrijs((p) => ({ ...p, [id]: String(prijs) }));
  const cancelEdit = (id: number) =>
    setEditPrijs((p) => { const n = { ...p }; delete n[id]; return n; });
  const onEditChange = (id: number, val: string) =>
    setEditPrijs((p) => ({ ...p, [id]: val }));
  const savePrijs = async (id: number) => {
    const raw = editPrijs[id];
    const prijs = parseFloat(raw.replace(",", "."));
    if (!raw || isNaN(prijs) || prijs <= 0) { cancelEdit(id); return; }
    setSavingPrijs((p) => ({ ...p, [id]: true }));
    await fetch(`/api/admin/autos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prijs }),
    });
    setSavingPrijs((p) => { const n = { ...p }; delete n[id]; return n; });
    cancelEdit(id);
    refresh();
  };

  const updateStatus = async (id: number, status: StatusKey) => {
    if (status === "gereserveerd" && !confirm("Wil je deze auto als Gereserveerd markeren?")) return;
    if (status === "verkocht" && !confirm("Wil je deze auto als Verkocht markeren?")) return;
    await fetch(`/api/admin/autos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refresh();
  };

  const openInCalculator = async (auto: Auto) => {
    const res = await fetch("/api/admin/dossiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_naam: `${auto.merk} ${auto.model} (${auto.bouwjaar})`, verkoopprijs: auto.prijs }),
    });
    if (res.ok) {
      setMobileHub(false);
      setTab("calculator");
    }
  };

  return (
    <div>
      <PageHeader
        title="Auto Voorraad"
        subtitle={`${actief.length} beschikbaar · ${verkocht.length} verkocht`}
        action={
          <Link
            href="/admin/auto-toevoegen"
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
          >
            <Plus size={14} /> Nieuwe auto
          </Link>
        }
      />

      {/* Tab bar */}
      <div
        className="flex items-center gap-0 px-4 md:px-8 sticky top-[53px] md:top-0 z-10"
        style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}
      >
        {(["beschikbaar", "verkocht"] as const).map((t) => {
          const count = t === "beschikbaar" ? actief.length : verkocht.length;
          const active = tabView === t;
          return (
            <button
              key={t}
              onClick={() => setTabView(t)}
              className="flex items-center gap-1.5 px-4 py-3.5 text-sm font-semibold cursor-pointer transition-colors relative"
              style={{
                color: active ? "#001337" : "rgba(0,19,55,0.38)",
                fontFamily: "var(--font-inter)",
                borderBottom: active ? "2px solid #001337" : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              {t === "beschikbaar" ? "Beschikbaar" : "Verkocht"}
              <span
                className="text-[10px] px-1.5 py-0.5 font-semibold"
                style={{
                  backgroundColor: active ? "#001337" : "rgba(0,19,55,0.07)",
                  color: active ? "#ffffff" : "rgba(0,19,55,0.4)",
                  fontFamily: "var(--font-inter)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="p-4 md:p-8">
        {/* Tab: Beschikbaar */}
        {tabView === "beschikbaar" && (
          <section>
            {actief.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16"
                style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}
              >
                <Car size={32} style={{ color: "rgba(0,19,55,0.1)" }} />
                <p className="text-sm font-bold mt-4 mb-1" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                  Geen actieve auto&apos;s
                </p>
                <Link
                  href="/admin/auto-toevoegen"
                  className="mt-2 flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
                  style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
                >
                  <Plus size={13} /> Auto toevoegen
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {actief.map((auto) => (
                  <AutoKaart
                    key={auto.id}
                    auto={auto}
                    editPrijsWaarde={editPrijs[auto.id]}
                    savingPrijs={savingPrijs[auto.id] ?? false}
                    onStartEdit={() => startEdit(auto.id, auto.prijs)}
                    onCancelEdit={() => cancelEdit(auto.id)}
                    onSavePrijs={() => savePrijs(auto.id)}
                    onEditChange={(val) => onEditChange(auto.id, val)}
                    onUpdateStatus={(s) => updateStatus(auto.id, s)}
                    onOpenCalculator={() => openInCalculator(auto)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab: Verkocht */}
        {tabView === "verkocht" && (
          <section>
            {/* Jaar-filter */}
            {jaren.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-4">
                <button
                  onClick={() => setFilterJaar("alles")}
                  className="px-2.5 py-1 text-[10px] font-semibold tracking-wide cursor-pointer transition-all hover:opacity-80"
                  style={{
                    backgroundColor: filterJaar === "alles" ? "#001337" : "transparent",
                    color: filterJaar === "alles" ? "#ffffff" : "rgba(0,19,55,0.4)",
                    border: "1px solid rgba(0,19,55,0.15)",
                    fontFamily: "var(--font-inter)",
                  }}
                >
                  Alles
                </button>
                {jaren.map((j) => (
                  <button
                    key={j}
                    onClick={() => setFilterJaar(j)}
                    className="px-2.5 py-1 text-[10px] font-semibold tracking-wide cursor-pointer transition-all hover:opacity-80"
                    style={{
                      backgroundColor: filterJaar === j ? "#001337" : "transparent",
                      color: filterJaar === j ? "#ffffff" : "rgba(0,19,55,0.4)",
                      border: "1px solid rgba(0,19,55,0.15)",
                      fontFamily: "var(--font-inter)",
                    }}
                  >
                    {j}
                  </button>
                ))}
              </div>
            )}

            {filterJaar !== "alles" && verkochtGefilterd.length > 0 && (
              <div
                className="flex items-center gap-3 px-4 py-3 mb-3 text-xs flex-wrap"
                style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", fontFamily: "var(--font-inter)" }}
              >
                <span style={{ color: "rgba(0,19,55,0.5)" }}>
                  {verkochtGefilterd.length} auto&apos;s verkocht in {filterJaar}
                </span>
                <span style={{ color: "rgba(0,19,55,0.2)" }}>·</span>
                <span className="font-semibold" style={{ color: "#001337" }}>
                  Totaalwaarde: €{verkochtGefilterd.reduce((s, a) => s + a.prijs, 0).toLocaleString("nl-NL")}
                </span>
              </div>
            )}

            {verkochtGefilterd.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16"
                style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}
              >
                <Car size={32} style={{ color: "rgba(0,19,55,0.1)" }} />
                <p className="text-sm font-bold mt-4" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                  Nog geen verkochte auto&apos;s
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {verkochtGefilterd.map((auto) => (
                  <AutoKaart
                    key={auto.id}
                    auto={auto}
                    editPrijsWaarde={editPrijs[auto.id]}
                    savingPrijs={savingPrijs[auto.id] ?? false}
                    onStartEdit={() => startEdit(auto.id, auto.prijs)}
                    onCancelEdit={() => cancelEdit(auto.id)}
                    onSavePrijs={() => savePrijs(auto.id)}
                    onEditChange={(val) => onEditChange(auto.id, val)}
                    onUpdateStatus={(s) => updateStatus(auto.id, s)}
                    onOpenCalculator={() => openInCalculator(auto)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
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
};

const FACTUUR_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  concept:   { label: "Concept",   color: "#92400e", bg: "#fef3c7" },
  verzonden: { label: "Verzonden", color: "#1d4ed8", bg: "#dbeafe" },
  betaald:   { label: "Betaald",   color: "#15803d", bg: "#dcfce7" },
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

function maakLeegForm(): FactuurForm {
  const nu = new Date();
  const verval = new Date(nu);
  verval.setMonth(verval.getMonth() + 1);
  return {
    klant_naam: "", klant_adres: "", klant_postcode: "", klant_stad: "",
    klant_email: "", klant_telefoon: "",
    auto_merk: "", auto_model: "", auto_bouwjaar: "", auto_kenteken: "",
    auto_km: "", auto_kleur: "", auto_vin: "",
    verkoopprijs: "",
    btw_type: "marge", betaalwijze: "bank",
    datum: nu.toLocaleDateString("nl-NL"),
    vervaldatum: verval.toLocaleDateString("nl-NL"),
    notitie: "",
  };
}

function genereerFactuurHTML(f: Factuur, logoSrc: string): string {
  const autoBasePrijs = Number(f.verkoopprijs);
  let extraRegels: FactuurRegel[] = [];
  try { extraRegels = JSON.parse(f.regels || "[]").filter((r: FactuurRegel) => r.omschrijving && Number(r.prijs) > 0); } catch { /* */ }

  const extraTotaal = extraRegels.reduce((s, r) => s + Number(r.prijs), 0);
  const subtotaalExAuto = f.btw_type === "21" ? Math.round(autoBasePrijs / 1.21) : autoBasePrijs;
  const subtotaal = subtotaalExAuto + extraTotaal;
  const btwBedrag = f.btw_type === "21" ? autoBasePrijs - subtotaalExAuto : 0;
  const eindtotaal = subtotaal + btwBedrag;

  const autoOmschrijving = [f.auto_merk, f.auto_model, f.auto_bouwjaar].filter(Boolean).join(" ") || "Voertuig";
  const autoKenteken = f.auto_kenteken ? ` &middot; ${f.auto_kenteken.toUpperCase()}` : "";

  const regelRijen = [
    `<tr>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;color:#1e293b;font-size:10pt">${autoOmschrijving}${autoKenteken}</td>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;text-align:center;color:#1e293b;font-size:10pt">€&nbsp;${subtotaalExAuto.toLocaleString("nl-NL")}</td>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;text-align:center;color:#1e293b;font-size:10pt;width:60px">1</td>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;text-align:center;color:#1e293b;font-size:10pt">€&nbsp;${subtotaalExAuto.toLocaleString("nl-NL")}</td>
    </tr>`,
    ...extraRegels.map((r) => `<tr>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;color:#1e293b;font-size:10pt">${r.omschrijving}</td>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;text-align:center;color:#1e293b;font-size:10pt">€&nbsp;${Number(r.prijs).toLocaleString("nl-NL")}</td>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;text-align:center;color:#1e293b;font-size:10pt">1</td>
      <td style="padding:11px 0;border-bottom:1px solid #e8eaf0;text-align:center;color:#1e293b;font-size:10pt">€&nbsp;${Number(r.prijs).toLocaleString("nl-NL")}</td>
    </tr>`),
  ].join("");

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>Factuur ${f.factuur_nr}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  body { font-family:'Helvetica Neue',Arial,sans-serif; color:#1e293b; background:#fff; width:794px; margin:0 auto; }
  @page { size:A4; margin:0; }
  @media print { body { width:100%; } }
  table { border-collapse:collapse; }
</style>
</head>
<body>

<!-- HEADER: logo met ingebakken achtergrond -->
<div style="width:100%;background-color:#001337;text-align:center;line-height:0;padding:2px 0">
  <img src="${logoSrc}" alt="JG Mobility"
       style="height:110px;object-fit:contain;display:inline-block">
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
      </td>
    </tr>
  </table>

  <!-- KVK/BTW/IBAN + datum links | Klant rechts -->
  <table style="width:100%;margin-bottom:32px;padding-bottom:56px">
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

  <!-- Regelstabel -->
  <table style="width:100%;margin-bottom:4px">
    <thead>
      <tr style="border-top:1.5px solid #001337;border-bottom:1.5px solid #001337">
        <th style="font-size:7.5pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#001337;padding:10px 0;text-align:left">Omschrijving</th>
        <th style="font-size:7.5pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#001337;padding:10px 0;text-align:center;width:115px">Tarief</th>
        <th style="font-size:7.5pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#001337;padding:10px 0;text-align:center;width:55px">Aantal</th>
        <th style="font-size:7.5pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#001337;padding:10px 0;text-align:center;width:115px">Subtotaal</th>
      </tr>
    </thead>
    <tbody>
      ${regelRijen}
    </tbody>
  </table>

  <!-- Totalen rechts uitgelijnd -->
  <table style="width:280px;margin-left:auto;margin-bottom:30px;margin-top:10px;table-layout:fixed">
    <colgroup><col style="width:155px"><col style="width:125px"></colgroup>
    <tr>
      <td style="font-size:9.5pt;color:#64748b;padding:4px 0;text-align:left">Subtotaal</td>
      <td style="font-size:9.5pt;color:#64748b;text-align:right;padding:4px 0">€&nbsp;${subtotaal.toLocaleString("nl-NL")}</td>
    </tr>
    ${f.btw_type === "21"
      ? `<tr>
          <td style="font-size:9.5pt;color:#1d4ed8;padding:4px 0;border-bottom:1px solid #e2e8f0;text-align:left">BTW (21%)</td>
          <td style="font-size:9.5pt;color:#1d4ed8;text-align:right;padding:4px 0;border-bottom:1px solid #e2e8f0">€&nbsp;${btwBedrag.toLocaleString("nl-NL")}</td>
        </tr>`
      : `<tr><td colspan="2" style="border-bottom:1px solid #e2e8f0;padding:3px 0"></td></tr>`}
    <tr>
      <td style="font-size:12pt;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#001337;padding:9px 0 0;text-align:left">Eindtotaal</td>
      <td style="font-size:12pt;font-weight:700;color:#001337;text-align:right;padding:9px 0 0">€&nbsp;${eindtotaal.toLocaleString("nl-NL")}</td>
    </tr>
  </table>

  <!-- Betaaltekst -->
  <div style="font-size:9pt;color:#475569;line-height:1.85;border-top:1px solid #e2e8f0;padding-top:16px;margin-bottom:12px">
    Wij vragen u vriendelijk het bedrag van €${eindtotaal.toLocaleString("nl-NL")} ${f.vervaldatum ? `voor ${f.vervaldatum}` : "binnen 30 dagen na ontvangst"} over te maken
    ${f.betaalwijze === "bank" ? "op rekening NL94 ABNA 0154171638 onder vermelding van factuurnummer <strong>" + f.factuur_nr + "</strong>" : "te voldoen per contant"}.
    <br>Factuur uitgereikt door JG MOBILITY.
    ${f.btw_type === "marge" ? `<br><span style="font-size:8pt;color:#94a3b8">Op dit voertuig is de margeregeling van toepassing. BTW is niet afzonderlijk vermeld (art. 28b t/m 28h Wet OB 1968).</span>` : ""}
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
  const [view, setView] = useState<"lijst" | "nieuw">("lijst");
  const [form, setForm] = useState<FactuurForm>(maakLeegForm);
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
      setForm(maakLeegForm());
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

  const verwijder = async (id: string) => {
    if (!confirm("Factuur definitief verwijderen?")) return;
    await fetch(`/api/admin/facturen/${id}`, { method: "DELETE" });
    setFacturen((prev) => prev.filter((f) => f.id !== id));
    if (openId === id) setOpenId(null);
  };

  const printFactuur = async (f: Factuur) => {
    let logoSrc = "";
    try {
      const res = await fetch(encodeURI("/JG Mobility.png"));
      if (res.ok) {
        const blob = await res.blob();
        logoSrc = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve("");
          reader.readAsDataURL(blob);
        });
      }
    } catch { /* logo niet beschikbaar */ }

    const html = genereerFactuurHTML(f, logoSrc);
    const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const win = window.open(blobUrl, "_blank");
    if (win) {
      win.addEventListener("load", () => setTimeout(() => win.print(), 400));
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }
    // Fallback als popup geblokkeerd is
    URL.revokeObjectURL(blobUrl);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 2000);
    }, 500);
  };

  const verstuurMail = async (f: Factuur) => {
    if (!f.klant_email) {
      alert("Deze factuur heeft geen e-mailadres voor de klant. Vul dit eerst in via Bewerken.");
      return;
    }

    // Factuur downloaden als HTML-bestand
    let logoSrc = "";
    try {
      const res = await fetch(encodeURI("/JG Mobility.png"));
      if (res.ok) {
        const blob = await res.blob();
        logoSrc = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve("");
          reader.readAsDataURL(blob);
        });
      }
    } catch { /* logo niet beschikbaar */ }

    const html = genereerFactuurHTML(f, logoSrc);
    const bestand = new Blob([html], { type: "text/html;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(bestand);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `Factuur-${f.factuur_nr}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

    // Totaal berekenen
    let totaal = Number(f.verkoopprijs) || 0;
    try {
      const regels = JSON.parse(f.regels || "[]");
      totaal += regels.reduce((s: number, r: { prijs: string }) => s + (Number(r.prijs) || 0), 0);
      if (f.btw_type === "21") totaal = Math.round(totaal * 1.21);
    } catch { /* gebruik verkoopprijs */ }

    const voertuig = [f.auto_merk, f.auto_model, f.auto_bouwjaar ? `(${f.auto_bouwjaar})` : ""].filter(Boolean).join(" ");
    const subject = `Factuur ${f.factuur_nr} - JG Mobility`;
    const body = [
      `Geachte ${f.klant_naam || "klant"},`,
      ``,
      `Hartelijk dank voor uw aankoop bij JG Mobility! Wij hopen dat u veel plezier zult beleven aan uw voertuig.`,
      ``,
      `In de bijlage vindt u de factuur voor uw aankoop. Wij verzoeken u vriendelijk het openstaande bedrag te voldoen voor de vervaldatum.`,
      ``,
      `── Factuuroverzicht ──────────────────────`,
      `Factuurnummer : ${f.factuur_nr}`,
      voertuig ? `Voertuig      : ${voertuig}` : "",
      `Totaalbedrag  : €${totaal.toLocaleString("nl-NL")}`,
      f.vervaldatum ? `Uiterlijk betalen voor : ${f.vervaldatum}` : `Betaaltermijn : 30 dagen na ontvangst`,
      ``,
      f.betaalwijze === "bank" ? [
        `── Betaalgegevens ────────────────────────`,
        `IBAN          : NL94 ABNA 0154171638`,
        `T.n.v.        : JG Mobility`,
        `Omschrijving  : ${f.factuur_nr}`,
      ].join("\n") : `Betaling geschiedt contant bij afhaling.`,
      ``,
      `Heeft u vragen over uw factuur? Neem dan gerust contact met ons op via info@jgmobility.nl.`,
      ``,
      `Met vriendelijke groet,`,
      ``,
      `JG Mobility`,
      `info@jgmobility.nl`,
      `www.jgmobility.nl`,
    ].filter((r) => r !== undefined).join("\n");

    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(f.klant_email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setTimeout(() => window.open(gmailUrl, "_blank"), 400);
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
              onClick={() => { setView("lijst"); setForm(maakLeegForm()); setRegels(LEEG_REGELS); setBewerkFactuur(null); }}
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
  });

  // ── Lijstweergave ───────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Facturen"
        subtitle={`${gefilterdeFacturen.length} facturen`}
        action={
          <button
            onClick={() => setView("nieuw")}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
          >
            <Plus size={14} /> Nieuwe factuur
          </button>
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
                className="px-4 py-2 text-xs font-semibold"
                style={{ backgroundColor: "#1d4ed8", color: "#ffffff", fontFamily: "var(--font-inter)" }}
              >
                Verstuur per mail
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
                        €{Number(f.verkoopprijs).toLocaleString("nl-NL")}
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
                              onClick={() => verstuurMail(f)}
                              className="px-4 py-2 text-xs font-semibold transition-all hover:opacity-80"
                              style={{ backgroundColor: "#1d4ed8", color: "#ffffff", fontFamily: "var(--font-inter)" }}
                            >
                              Verstuur per mail
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

// ── Cosignatie ──────────────────────────────────────────────────
type PlatformPrijzen = {
  marktplaats?: string;
  nederlandmobiel?: string;
  autoscout24?: string;
};

type Cosignatie = {
  id: string;
  datum: string;
  tijd: string;
  naam: string;
  email: string;
  telefoon: string;
  merk: string;
  model: string;
  bouwjaar: string;
  km: string;
  vraagprijs: string;
  opmerking: string;
  aantal_fotos: number;
  status: string;
  notitie: string;
  concurrent_prijs?: string;
  geaccepteerd_op?: string;
  platform_prijzen?: PlatformPrijzen;
};

const COSIG_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  nieuw:          { label: "Nieuw",          color: "#b45309", bg: "#fef3c7" },
  in_behandeling: { label: "In behandeling", color: "#1d4ed8", bg: "#dbeafe" },
  geaccepteerd:   { label: "Actief",         color: "#15803d", bg: "#dcfce7" },
  afgewezen:      { label: "Afgewezen",      color: "#b91c1c", bg: "#fee2e2" },
};

function parseDatum(datum: string): Date {
  if (!datum) return new Date();
  const parts = datum.split("-");
  if (parts.length === 3 && parts[0].length === 4) return new Date(datum);
  if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  return new Date(datum);
}

function dagenOpMarkt(c: Cosignatie): number {
  const start = c.geaccepteerd_op ? new Date(c.geaccepteerd_op) : parseDatum(c.datum);
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
}

function formatEur(v: string | number | undefined): string {
  if (!v) return "—";
  const n = typeof v === "string" ? parseInt(v) : v;
  return isNaN(n) ? "—" : `€${n.toLocaleString("nl-NL")}`;
}

const PLATFORMS: { key: keyof PlatformPrijzen; label: string; kleur: string }[] = [
  { key: "marktplaats",    label: "Marktplaats",     kleur: "#E4622A" },
  { key: "nederlandmobiel", label: "NederlandMobiel", kleur: "#005BBB" },
  { key: "autoscout24",   label: "AutoScout24",     kleur: "#F5831F" },
];

function getPlatformPrijzen(a: Cosignatie): PlatformPrijzen {
  if (!a.platform_prijzen) return {};
  if (typeof a.platform_prijzen === "string") {
    try { return JSON.parse(a.platform_prijzen); } catch { return {}; }
  }
  return a.platform_prijzen;
}

function marktGemiddelde(pp: PlatformPrijzen): number | null {
  const vals = Object.values(pp).map((v) => parseInt(v ?? "")).filter((n) => !isNaN(n) && n > 0);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}

function genereerKlantMail(a: Cosignatie): string {
  const datum = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  const voornaam = a.naam.split(" ")[0];
  const dagen = dagenOpMarkt(a);
  const pp = getPlatformPrijzen(a);
  const gem = marktGemiddelde(pp);
  const vp = parseInt(a.vraagprijs) || 0;
  const pct = gem && vp ? ((vp - gem) / gem) * 100 : null;

  const platformRegels = PLATFORMS
    .filter((p) => pp[p.key])
    .map((p) => `  ${p.label.padEnd(22)}${formatEur(pp[p.key])}`)
    .join("\n");

  const advies = pct === null ? ""
    : pct > 5
    ? `\nMARKTADVIES\nUw vraagprijs ligt ${pct.toFixed(1)}% boven het marktgemiddelde. Dit kan de verkooptijd verlengen. Overweeg een aanpassing richting ${gem ? formatEur(String(Math.round(gem))) : "het marktgemiddelde"} om sneller een koper te vinden.\n`
    : pct > 2
    ? `\nMARKTADVIES\nUw vraagprijs ligt licht boven het marktgemiddelde (+${pct.toFixed(1)}%). De auto is competitief geprijsd, maar een kleine aanpassing kan de interesse vergroten.\n`
    : pct >= -2
    ? `\nMARKTADVIES\nUw vraagprijs sluit perfect aan bij het marktgemiddelde. Dit is een sterke positie voor een snelle verkoop.\n`
    : `\nMARKTADVIES\nUw vraagprijs ligt onder het marktgemiddelde (${pct.toFixed(1)}%). Dit vergroot de kans op een snelle verkoop aanzienlijk.\n`;

  return [
    `Betreft: Wekelijkse update — ${a.merk} ${a.model} (${a.bouwjaar})`,
    `Datum: ${datum}`,
    "",
    `Beste ${voornaam},`,
    "",
    `Hierbij uw wekelijkse update over de ${a.merk} ${a.model} (${a.bouwjaar}) die momenteel via JG Mobility in consignatie staat.`,
    "",
    "─".repeat(48),
    "STATUS",
    "─".repeat(48),
    `De auto staat ${dagen} dag${dagen !== 1 ? "en" : ""} in consignatie bij JG Mobility.`,
    a.km ? `Kilometerstand: ${parseInt(a.km).toLocaleString("nl-NL")} km` : null,
    "",
    ...(gem || platformRegels ? [
      "─".repeat(48),
      "MARKTANALYSE",
      "─".repeat(48),
      `  Uw vraagprijs         ${formatEur(a.vraagprijs)}`,
      "",
      ...(platformRegels ? [`  Concurrentieprijzen:`, platformRegels, ""] : []),
      ...(gem ? [
        `  Marktgemiddelde       ${formatEur(String(gem))}`,
        pct !== null ? `  Uw positie            ${pct > 0 ? "+" : ""}${pct.toFixed(1)}% ${pct > 0 ? "boven" : "onder"} markt` : null,
      ].filter(Boolean) : []),
    ] : []),
    advies ? ["─".repeat(48), advies].join("\n") : null,
    "─".repeat(48),
    "",
    "Heeft u vragen of wilt u de vraagprijs aanpassen? Neem gerust contact met ons op.",
    "",
    "Met vriendelijke groet,",
    "JG Mobility",
    "info@jgmobility.nl",
    "www.jgmobility.nl",
  ].filter((r) => r !== null).join("\n");
}

function CosignatieContent() {
  const [aanvragen, setAanvragen] = useState<Cosignatie[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"actief" | "aanvragen">("actief");
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mailModalAuto, setMailModalAuto] = useState<Cosignatie | null>(null);
  const [mailKopiert, setMailKopiert] = useState(false);
  const [editPlatform, setEditPlatform] = useState<{ id: string; key: keyof PlatformPrijzen } | null>(null);
  const [editPlatformWaarde, setEditPlatformWaarde] = useState("");
  const [zoekendId, setZoekendId] = useState<string | null>(null);
  const [zoekFout, setZoekFout] = useState<string | null>(null);
  const [editField, setEditField] = useState<{ id: string; field: string; waarde: string } | null>(null);
  const [voorraadModal, setVoorraadModal] = useState(false);
  const [voorraadAutos, setVoorraadAutos] = useState<Auto[]>([]);
  const [selectedVoorraadId, setSelectedVoorraadId] = useState<number | null>(null);
  const [klantNaam, setKlantNaam] = useState("");
  const [klantEmail, setKlantEmail] = useState("");
  const [klantTel, setKlantTel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const laad = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/cosignaties");
    if (res.ok) setAanvragen(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { laad(); }, [laad]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/admin/cosignaties/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  };

  const updateStatus = async (id: string, status: string) => {
    setSaving(true);
    await patch(id, { status });
    setAanvragen((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    setSaving(false);
  };

  const updateNotitie = async (id: string, notitie: string) => {
    await patch(id, { notitie });
    setAanvragen((prev) => prev.map((a) => (a.id === id ? { ...a, notitie } : a)));
  };

  const savePlatformPrijs = async (id: string, key: keyof PlatformPrijzen, waarde: string) => {
    const auto = aanvragen.find((a) => a.id === id);
    if (!auto) return;
    const huidig = getPlatformPrijzen(auto);
    const nieuw: PlatformPrijzen = { ...huidig, [key]: waarde };
    await patch(id, { platform_prijzen: nieuw });
    setAanvragen((prev) => prev.map((a) => (a.id === id ? { ...a, platform_prijzen: nieuw } : a)));
    setEditPlatform(null);
  };

  const verwijder = async (id: string) => {
    if (!confirm("Aanvraag verwijderen?")) return;
    await fetch(`/api/admin/cosignaties/${id}`, { method: "DELETE" });
    setAanvragen((prev) => prev.filter((a) => a.id !== id));
    if (openId === id) setOpenId(null);
  };

  const zoekPrijzen = async (id: string) => {
    setZoekendId(id);
    setZoekFout(null);
    try {
      const res = await fetch(`/api/admin/cosignaties/${id}/zoek-prijzen`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setZoekFout(data.error ?? "Onbekende fout");
        return;
      }
      if (data.platform_prijzen) {
        setAanvragen((prev) =>
          prev.map((a) => a.id === id ? { ...a, platform_prijzen: data.platform_prijzen } : a)
        );
      }
    } catch {
      setZoekFout("Verbindingsfout, probeer opnieuw.");
    } finally {
      setZoekendId(null);
    }
  };

  const updateField = async (id: string, field: string, waarde: string) => {
    await patch(id, { [field]: waarde });
    setAanvragen((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: waarde } : a)));
    setEditField(null);
  };

  const openVoorraadModal = async () => {
    const res = await fetch("/api/admin/autos");
    if (res.ok) {
      const data: Auto[] = await res.json();
      setVoorraadAutos(data.filter((a) => !a.verkocht));
    }
    setSelectedVoorraadId(null);
    setKlantNaam("");
    setKlantEmail("");
    setKlantTel("");
    setVoorraadModal(true);
  };

  const voegToeUitVoorraad = async () => {
    const auto = voorraadAutos.find((a) => a.id === selectedVoorraadId);
    if (!auto) return;
    setSubmitting(true);
    await fetch("/api/admin/cosignaties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merk: auto.merk,
        model: auto.model,
        bouwjaar: String(auto.bouwjaar),
        km: String(auto.km),
        vraagprijs: String(auto.prijs),
        naam: klantNaam,
        email: klantEmail,
        telefoon: klantTel,
      }),
    });
    setSubmitting(false);
    setVoorraadModal(false);
    laad();
  };

  const actief = aanvragen.filter((a) => a.status === "geaccepteerd");
  const aanvragenLijst = aanvragen.filter((a) => a.status !== "geaccepteerd");
  const nieuweAanvragen = aanvragenLijst.filter((a) => a.status === "nieuw").length;
  const gemDagen = actief.length > 0 ? Math.round(actief.reduce((s, a) => s + dagenOpMarkt(a), 0) / actief.length) : 0;
  const totaleWaarde = actief.reduce((s, a) => s + (parseInt(a.vraagprijs) || 0), 0);

  const stats = [
    { label: "Actief in consignatie", value: String(actief.length), kleur: "#001337" },
    { label: "Nieuwe aanvragen", value: String(nieuweAanvragen), kleur: nieuweAanvragen > 0 ? "#b45309" : "#001337" },
    { label: "Gem. dagen op markt", value: actief.length ? `${gemDagen}d` : "—", kleur: "#001337" },
    { label: "Totale waarde actief", value: totaleWaarde > 0 ? formatEur(String(totaleWaarde)) : "—", kleur: "#001337" },
  ];

  return (
    <div>
      <PageHeader
        title="Cosignatie"
        subtitle={`${aanvragen.length} aanvragen · ${actief.length} actief`}
        action={
          <button
            onClick={openVoorraadModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-all hover:opacity-80 cursor-pointer"
            style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
          >
            <Plus size={12} /> Auto uit voorraad
          </button>
        }
      />

      {/* Voorraad modal */}
      {voorraadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={() => setVoorraadModal(false)}>
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col" style={{ backgroundColor: "#fff" }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ backgroundColor: "#001337" }}>
              <div>
                <p className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-playfair)" }}>Auto uit voorraad toevoegen</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-inter)" }}>Selecteer een auto en vul klantgegevens in</p>
              </div>
              <button onClick={() => setVoorraadModal(false)} style={{ color: "rgba(255,255,255,0.5)" }}>✕</button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              {/* Auto selectie */}
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Selecteer auto</p>
                <div className="flex flex-col gap-1.5">
                  {voorraadAutos.length === 0 ? (
                    <p className="text-xs py-6 text-center" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Geen beschikbare auto&apos;s in voorraad.</p>
                  ) : (
                    voorraadAutos.map((auto) => {
                      const selected = selectedVoorraadId === auto.id;
                      return (
                        <button
                          key={auto.id}
                          onClick={() => setSelectedVoorraadId(auto.id)}
                          className="flex items-center gap-3 px-4 py-3 text-left transition-all cursor-pointer"
                          style={{ border: `1px solid ${selected ? "#001337" : "rgba(0,19,55,0.1)"}`, backgroundColor: selected ? "rgba(0,19,55,0.04)" : "#fff" }}
                        >
                          <div className="w-3 h-3 rounded-full border-2 flex-shrink-0" style={{ borderColor: "#001337", backgroundColor: selected ? "#001337" : "transparent" }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                              {auto.merk} {auto.model} <span style={{ fontWeight: 400, color: "rgba(0,19,55,0.45)" }}>{auto.bouwjaar}</span>
                            </p>
                            <p className="text-xs" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>
                              {auto.km.toLocaleString("nl-NL")} km · {auto.brandstof}
                            </p>
                          </div>
                          <p className="text-sm font-bold flex-shrink-0" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                            €{auto.prijs.toLocaleString("nl-NL")}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Klantgegevens */}
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Klantgegevens (eigenaar)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Naam", value: klantNaam, set: setKlantNaam, type: "text", placeholder: "Volledige naam" },
                    { label: "E-mail", value: klantEmail, set: setKlantEmail, type: "email", placeholder: "e-mailadres" },
                    { label: "Telefoon", value: klantTel, set: setKlantTel, type: "tel", placeholder: "06-..." },
                  ].map(({ label, value, set, type, placeholder }) => (
                    <div key={label}>
                      <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{label}</label>
                      <input
                        type={type}
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-3 py-2 text-xs outline-none"
                        style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex gap-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(0,19,55,0.08)" }}>
              <button
                onClick={voegToeUitVoorraad}
                disabled={!selectedVoorraadId || submitting}
                className="flex-1 py-2.5 text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-40 cursor-pointer"
                style={{ backgroundColor: "#001337", color: "#fff", fontFamily: "var(--font-inter)" }}
              >
                {submitting ? "Bezig..." : "Toevoegen aan cosignatie"}
              </button>
              <button
                onClick={() => setVoorraadModal(false)}
                className="px-6 py-2.5 text-xs font-semibold transition-all hover:opacity-70 cursor-pointer"
                style={{ border: "1px solid rgba(0,19,55,0.2)", color: "#001337", fontFamily: "var(--font-inter)" }}
              >
                Annuleer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mail modal */}
      {mailModalAuto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={() => setMailModalAuto(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ backgroundColor: "#fff" }} onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ backgroundColor: "#001337" }}>
              <div>
                <p className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-playfair)" }}>Wekelijkse update — {mailModalAuto.merk} {mailModalAuto.model}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-inter)" }}>Aan: {mailModalAuto.naam} &lt;{mailModalAuto.email}&gt;</p>
              </div>
              <button onClick={() => setMailModalAuto(null)} style={{ color: "rgba(255,255,255,0.5)" }}>✕</button>
            </div>

            {/* Email preview */}
            <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "#f8f9fb" }}>
              <div style={{ backgroundColor: "#fff", border: "1px solid rgba(0,19,55,0.08)" }}>
                {/* Email top bar */}
                <div className="px-6 py-4" style={{ backgroundColor: "#001337" }}>
                  <p className="text-white text-sm font-bold" style={{ fontFamily: "var(--font-playfair)" }}>JG Mobility</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-inter)" }}>Wekelijks consignatie rapport</p>
                </div>

                {/* Email body */}
                <div className="px-6 py-5">
                  {(() => {
                    const pp = getPlatformPrijzen(mailModalAuto);
                    const gem = marktGemiddelde(pp);
                    const vp = parseInt(mailModalAuto.vraagprijs) || 0;
                    const pct = gem && vp ? ((vp - gem) / gem) * 100 : null;
                    const dagen = dagenOpMarkt(mailModalAuto);
                    const voornaam = mailModalAuto.naam.split(" ")[0];
                    const datum = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

                    return (
                      <>
                        <p className="text-xs mb-4" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{datum}</p>
                        <p className="text-sm mb-4" style={{ fontFamily: "var(--font-inter)", color: "#001337" }}>Beste {voornaam},</p>
                        <p className="text-sm mb-5" style={{ fontFamily: "var(--font-inter)", color: "rgba(0,19,55,0.7)", lineHeight: 1.7 }}>
                          Hierbij uw wekelijkse update over de <strong>{mailModalAuto.merk} {mailModalAuto.model} ({mailModalAuto.bouwjaar})</strong> die momenteel via JG Mobility in consignatie staat.
                        </p>

                        {/* Status block */}
                        <div className="mb-4 p-4" style={{ backgroundColor: "#f8f9fb", border: "1px solid rgba(0,19,55,0.07)" }}>
                          <p className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Status</p>
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="text-3xl font-bold leading-none" style={{ fontFamily: "var(--font-playfair)", color: dagen > 60 ? "#b91c1c" : dagen > 30 ? "#b45309" : "#001337" }}>{dagen}</p>
                              <p className="text-xs mt-1" style={{ fontFamily: "var(--font-inter)", color: "rgba(0,19,55,0.5)" }}>dag{dagen !== 1 ? "en" : ""} in consignatie</p>
                            </div>
                            {mailModalAuto.km && (
                              <div style={{ borderLeft: "1px solid rgba(0,19,55,0.1)", paddingLeft: "1rem" }}>
                                <p className="text-base font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{parseInt(mailModalAuto.km).toLocaleString("nl-NL")} km</p>
                                <p className="text-xs mt-1" style={{ fontFamily: "var(--font-inter)", color: "rgba(0,19,55,0.5)" }}>kilometerstand</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Marktanalyse block */}
                        <div className="mb-4 p-4" style={{ backgroundColor: "#f8f9fb", border: "1px solid rgba(0,19,55,0.07)" }}>
                          <p className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Marktanalyse</p>
                          <table className="w-full" style={{ fontFamily: "var(--font-inter)" }}>
                            <tbody>
                              <tr style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                                <td className="py-2 text-xs font-semibold" style={{ color: "#001337" }}>Uw vraagprijs</td>
                                <td className="py-2 text-sm font-bold text-right" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{formatEur(mailModalAuto.vraagprijs)}</td>
                              </tr>
                              {PLATFORMS.map((p) => {
                                const prijs = pp[p.key];
                                if (!prijs) return null;
                                return (
                                  <tr key={p.key} style={{ borderBottom: "1px solid rgba(0,19,55,0.04)" }}>
                                    <td className="py-1.5 text-xs flex items-center gap-1.5" style={{ color: "rgba(0,19,55,0.55)" }}>
                                      <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.kleur }} />
                                      {p.label}
                                    </td>
                                    <td className="py-1.5 text-xs font-semibold text-right" style={{ color: "rgba(0,19,55,0.7)" }}>{formatEur(prijs)}</td>
                                  </tr>
                                );
                              })}
                              {gem && (
                                <tr style={{ borderTop: "1px solid rgba(0,19,55,0.1)" }}>
                                  <td className="pt-2 text-xs font-bold" style={{ color: "#001337" }}>Marktgemiddelde</td>
                                  <td className="pt-2 text-sm font-bold text-right" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{formatEur(String(gem))}</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                          {pct !== null && (
                            <div className="mt-3 px-3 py-2 flex items-center gap-2" style={{ backgroundColor: pct > 2 ? "#fff7ed" : pct < -2 ? "#f0fdf4" : "#f0f9ff", border: `1px solid ${pct > 2 ? "#fed7aa" : pct < -2 ? "#bbf7d0" : "#bae6fd"}` }}>
                              <span className="text-base">{pct > 2 ? "⚠" : pct < -2 ? "✓" : "●"}</span>
                              <p className="text-xs" style={{ color: "rgba(0,19,55,0.75)", fontFamily: "var(--font-inter)", lineHeight: 1.5 }}>
                                {pct > 5 ? `Uw vraagprijs ligt ${pct.toFixed(1)}% boven het marktgemiddelde. Overweeg een aanpassing voor een snellere verkoop.`
                                  : pct > 2 ? `Uw vraagprijs ligt licht boven het marktgemiddelde (+${pct.toFixed(1)}%). De auto is competitief, maar een kleine aanpassing kan helpen.`
                                  : pct >= -2 ? "Uw vraagprijs sluit perfect aan bij de markt. Een sterke positie voor een vlotte verkoop."
                                  : `Uw vraagprijs ligt onder het marktgemiddelde. Dit vergroot de kans op snelle verkoop aanzienlijk.`}
                              </p>
                            </div>
                          )}
                        </div>

                        <p className="text-sm mb-5" style={{ fontFamily: "var(--font-inter)", color: "rgba(0,19,55,0.7)", lineHeight: 1.7 }}>
                          Heeft u vragen of wilt u de vraagprijs aanpassen? Neem gerust contact met ons op — we denken graag met u mee.
                        </p>

                        {/* Signature */}
                        <div className="pt-4" style={{ borderTop: "1px solid rgba(0,19,55,0.07)" }}>
                          <p className="text-sm font-bold mb-0.5" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>JG Mobility</p>
                          <p className="text-xs" style={{ fontFamily: "var(--font-inter)", color: "rgba(0,19,55,0.5)" }}>info@jgmobility.nl · www.jgmobility.nl</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 flex gap-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(0,19,55,0.08)" }}>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(genereerKlantMail(mailModalAuto));
                  setMailKopiert(true);
                  setTimeout(() => setMailKopiert(false), 2000);
                }}
                className="flex-1 py-2.5 text-xs font-semibold transition-all hover:opacity-80"
                style={{ backgroundColor: "#001337", color: "#fff", fontFamily: "var(--font-inter)" }}
              >
                {mailKopiert ? "Gekopieerd!" : "Kopieer als tekst"}
              </button>
              <a
                href={`mailto:${mailModalAuto.email}?subject=${encodeURIComponent(`Update ${mailModalAuto.merk} ${mailModalAuto.model} — ${new Date().toLocaleDateString("nl-NL")}`)}&body=${encodeURIComponent(genereerKlantMail(mailModalAuto))}`}
                className="flex-1 py-2.5 text-xs font-semibold text-center transition-all hover:opacity-80"
                style={{ border: "1px solid rgba(0,19,55,0.2)", color: "#001337", fontFamily: "var(--font-inter)" }}
              >
                Openen in mail
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 md:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {stats.map((s) => (
                <div key={s.label} className="p-4" style={{ backgroundColor: "#fff", border: "1px solid rgba(0,19,55,0.08)" }}>
                  <p className="text-2xl font-bold mb-0.5" style={{ fontFamily: "var(--font-playfair)", color: s.kleur }}>{s.value}</p>
                  <p className="text-[11px]" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 mb-6" style={{ borderBottom: "2px solid rgba(0,19,55,0.08)" }}>
              {(["actief", "aanvragen"] as const).map((t) => {
                const count = t === "actief" ? actief.length : aanvragenLijst.length;
                const isActive = tab === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="px-4 pb-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    style={{
                      fontFamily: "var(--font-inter)",
                      color: isActive ? "#001337" : "rgba(0,19,55,0.4)",
                      borderBottom: isActive ? "2px solid #001337" : "2px solid transparent",
                      marginBottom: "-2px",
                    }}
                  >
                    {t === "actief" ? "Actief in consignatie" : "Aanvragen"}
                    <span className="px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: isActive ? "#001337" : "rgba(0,19,55,0.08)", color: isActive ? "#fff" : "rgba(0,19,55,0.5)" }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ACTIEF TAB */}
            {tab === "actief" && (
              actief.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20" style={{ backgroundColor: "#fff", border: "1px solid rgba(0,19,55,0.07)" }}>
                  <Handshake size={36} style={{ color: "rgba(0,19,55,0.1)" }} />
                  <p className="text-base font-bold mt-4 mb-1" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Geen actieve consignaties</p>
                  <p className="text-xs" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Accepteer aanvragen om ze hier te zien.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {actief.map((a) => {
                    const pp = getPlatformPrijzen(a);
                    const gem = marktGemiddelde(pp);
                    const vp = parseInt(a.vraagprijs) || 0;
                    const pct = gem && vp ? ((vp - gem) / gem) * 100 : null;
                    const dagen = dagenOpMarkt(a);
                    const dagenKleur = dagen > 60 ? "#b91c1c" : dagen > 30 ? "#b45309" : "#15803d";
                    const dagenBg = dagen > 60 ? "#fff0f0" : dagen > 30 ? "#fffbeb" : "#f0fdf4";

                    return (
                      <div key={a.id} style={{ backgroundColor: "#fff", border: "1px solid rgba(0,19,55,0.1)", borderLeft: "4px solid #001337" }}>

                        {/* ── Header ── */}
                        <div className="flex items-start justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)" }}>
                          <div className="min-w-0 flex-1">
                            {/* Merk / model / bouwjaar — klik om te bewerken */}
                            <div className="flex items-baseline gap-1.5 flex-wrap mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                              {editField?.id === a.id && editField?.field === "merk" ? (
                                <input autoFocus value={editField.waarde}
                                  onChange={(e) => setEditField({ id: a.id, field: "merk", waarde: e.target.value })}
                                  onBlur={() => updateField(a.id, "merk", editField.waarde)}
                                  onKeyDown={(e) => { if (e.key === "Enter") updateField(a.id, "merk", editField.waarde); if (e.key === "Escape") setEditField(null); }}
                                  className="font-bold outline-none w-24 border-b" style={{ borderBottomColor: "#001337", background: "transparent", fontFamily: "var(--font-playfair)", color: "#001337", fontSize: "1.25rem" }} />
                              ) : (
                                <button onClick={() => setEditField({ id: a.id, field: "merk", waarde: a.merk })} className="font-bold cursor-pointer hover:opacity-60 transition-opacity">{a.merk}</button>
                              )}
                              {editField?.id === a.id && editField?.field === "model" ? (
                                <input autoFocus value={editField.waarde}
                                  onChange={(e) => setEditField({ id: a.id, field: "model", waarde: e.target.value })}
                                  onBlur={() => updateField(a.id, "model", editField.waarde)}
                                  onKeyDown={(e) => { if (e.key === "Enter") updateField(a.id, "model", editField.waarde); if (e.key === "Escape") setEditField(null); }}
                                  className="font-bold outline-none w-32 border-b" style={{ borderBottomColor: "#001337", background: "transparent", fontFamily: "var(--font-playfair)", color: "#001337", fontSize: "1.25rem" }} />
                              ) : (
                                <button onClick={() => setEditField({ id: a.id, field: "model", waarde: a.model })} className="font-bold cursor-pointer hover:opacity-60 transition-opacity">{a.model}</button>
                              )}
                              {editField?.id === a.id && editField?.field === "bouwjaar" ? (
                                <input autoFocus value={editField.waarde}
                                  onChange={(e) => setEditField({ id: a.id, field: "bouwjaar", waarde: e.target.value })}
                                  onBlur={() => updateField(a.id, "bouwjaar", editField.waarde)}
                                  onKeyDown={(e) => { if (e.key === "Enter") updateField(a.id, "bouwjaar", editField.waarde); if (e.key === "Escape") setEditField(null); }}
                                  className="font-normal outline-none w-16 border-b" style={{ borderBottomColor: "rgba(0,19,55,0.4)", background: "transparent", fontFamily: "var(--font-playfair)", color: "rgba(0,19,55,0.4)", fontSize: "1rem" }} />
                              ) : (
                                <button onClick={() => setEditField({ id: a.id, field: "bouwjaar", waarde: a.bouwjaar })} className="ml-1 font-normal text-base cursor-pointer hover:opacity-60 transition-opacity" style={{ color: "rgba(0,19,55,0.4)" }}>{a.bouwjaar}</button>
                              )}
                            </div>
                            {/* Naam / email / telefoon / km — klik om te bewerken */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)" }}>
                              {editField?.id === a.id && editField?.field === "naam" ? (
                                <input autoFocus value={editField.waarde}
                                  onChange={(e) => setEditField({ id: a.id, field: "naam", waarde: e.target.value })}
                                  onBlur={() => updateField(a.id, "naam", editField.waarde)}
                                  onKeyDown={(e) => { if (e.key === "Enter") updateField(a.id, "naam", editField.waarde); if (e.key === "Escape") setEditField(null); }}
                                  className="font-semibold outline-none w-40 border-b text-xs" style={{ borderBottomColor: "#001337", background: "transparent", color: "#001337", fontFamily: "var(--font-inter)" }} />
                              ) : (
                                <button onClick={() => setEditField({ id: a.id, field: "naam", waarde: a.naam })} className="font-semibold cursor-pointer hover:opacity-60 transition-opacity" style={{ color: "#001337" }}>{a.naam}</button>
                              )}
                              {editField?.id === a.id && editField?.field === "email" ? (
                                <input autoFocus value={editField.waarde} type="email"
                                  onChange={(e) => setEditField({ id: a.id, field: "email", waarde: e.target.value })}
                                  onBlur={() => updateField(a.id, "email", editField.waarde)}
                                  onKeyDown={(e) => { if (e.key === "Enter") updateField(a.id, "email", editField.waarde); if (e.key === "Escape") setEditField(null); }}
                                  className="outline-none w-52 border-b text-xs" style={{ borderBottomColor: "#001337", background: "transparent", color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)" }} />
                              ) : (
                                <button onClick={() => setEditField({ id: a.id, field: "email", waarde: a.email })} className="cursor-pointer hover:opacity-60 hover:underline transition-opacity">
                                  {a.email || <span style={{ color: "rgba(0,19,55,0.25)" }}>e-mail toevoegen</span>}
                                </button>
                              )}
                              {editField?.id === a.id && editField?.field === "telefoon" ? (
                                <input autoFocus value={editField.waarde} type="tel"
                                  onChange={(e) => setEditField({ id: a.id, field: "telefoon", waarde: e.target.value })}
                                  onBlur={() => updateField(a.id, "telefoon", editField.waarde)}
                                  onKeyDown={(e) => { if (e.key === "Enter") updateField(a.id, "telefoon", editField.waarde); if (e.key === "Escape") setEditField(null); }}
                                  className="outline-none w-32 border-b text-xs" style={{ borderBottomColor: "#001337", background: "transparent", color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)" }} />
                              ) : (
                                <button onClick={() => setEditField({ id: a.id, field: "telefoon", waarde: a.telefoon })} className="cursor-pointer hover:opacity-60 hover:underline transition-opacity">
                                  {a.telefoon || <span style={{ color: "rgba(0,19,55,0.25)" }}>telefoon toevoegen</span>}
                                </button>
                              )}
                              {editField?.id === a.id && editField?.field === "km" ? (
                                <input autoFocus value={editField.waarde} type="number"
                                  onChange={(e) => setEditField({ id: a.id, field: "km", waarde: e.target.value })}
                                  onBlur={() => updateField(a.id, "km", editField.waarde)}
                                  onKeyDown={(e) => { if (e.key === "Enter") updateField(a.id, "km", editField.waarde); if (e.key === "Escape") setEditField(null); }}
                                  className="outline-none w-24 border-b text-xs" style={{ borderBottomColor: "#001337", background: "transparent", color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)" }} />
                              ) : (
                                <button onClick={() => setEditField({ id: a.id, field: "km", waarde: a.km })} className="cursor-pointer hover:opacity-60 transition-opacity">
                                  {a.km ? `${parseInt(a.km).toLocaleString("nl-NL")} km` : <span style={{ color: "rgba(0,19,55,0.25)" }}>km toevoegen</span>}
                                </button>
                              )}
                              {a.aantal_fotos > 0 && <span>{a.aantal_fotos} foto&apos;s ontvangen</span>}
                            </div>
                          </div>
                          {/* Days on market */}
                          <div className="flex-shrink-0 ml-6 px-5 py-3 text-center" style={{ backgroundColor: dagenBg, border: `1px solid ${dagenKleur}40` }}>
                            <p className="text-4xl font-bold leading-none" style={{ fontFamily: "var(--font-playfair)", color: dagenKleur }}>{dagen}</p>
                            <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ fontFamily: "var(--font-inter)", color: dagenKleur }}>dag{dagen !== 1 ? "en" : ""} op markt</p>
                          </div>
                        </div>

                        {/* ── Metrics row ── */}
                        <div className="grid grid-cols-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)" }}>
                          <div className="px-6 py-4" style={{ borderRight: "1px solid rgba(0,19,55,0.06)" }}>
                            <p className="text-[10px] uppercase tracking-widest mb-2 font-semibold" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Vraagprijs eigenaar</p>
                            {editField?.id === a.id && editField?.field === "vraagprijs" ? (
                              <div className="flex items-baseline gap-1">
                                <span className="text-lg font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>€</span>
                                <input autoFocus value={editField.waarde} type="number"
                                  onChange={(e) => setEditField({ id: a.id, field: "vraagprijs", waarde: e.target.value })}
                                  onBlur={() => updateField(a.id, "vraagprijs", editField.waarde)}
                                  onKeyDown={(e) => { if (e.key === "Enter") updateField(a.id, "vraagprijs", editField.waarde); if (e.key === "Escape") setEditField(null); }}
                                  className="text-2xl font-bold outline-none w-28 border-b" style={{ borderBottomColor: "#001337", background: "transparent", fontFamily: "var(--font-playfair)", color: "#001337" }} />
                              </div>
                            ) : (
                              <button onClick={() => setEditField({ id: a.id, field: "vraagprijs", waarde: a.vraagprijs })} className="text-2xl font-bold cursor-pointer hover:opacity-60 transition-opacity text-left" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                                {formatEur(a.vraagprijs)}
                              </button>
                            )}
                          </div>
                          <div className="px-6 py-4" style={{ borderRight: "1px solid rgba(0,19,55,0.06)" }}>
                            <p className="text-[10px] uppercase tracking-widest mb-2 font-semibold" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Marktgemiddelde</p>
                            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{gem ? formatEur(String(gem)) : "—"}</p>
                            {gem && <p className="text-[10px] mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>o.b.v. {Object.values(pp).filter(Boolean).length} platform{Object.values(pp).filter(Boolean).length !== 1 ? "s" : ""}</p>}
                          </div>
                          <div className="px-6 py-4">
                            <p className="text-[10px] uppercase tracking-widest mb-2 font-semibold" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Marktpositie</p>
                            {pct !== null ? (
                              <>
                                <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: pct > 2 ? "#b91c1c" : pct < -2 ? "#15803d" : "#001337" }}>
                                  {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                                </p>
                                <p className="text-[10px] mt-0.5" style={{ fontFamily: "var(--font-inter)", color: "rgba(0,19,55,0.4)" }}>
                                  {pct > 2 ? "boven markt" : pct < -2 ? "onder markt" : "op markt"}
                                </p>
                              </>
                            ) : (
                              <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "rgba(0,19,55,0.15)" }}>—</p>
                            )}
                          </div>
                        </div>

                        {/* ── Platform prices ── */}
                        <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)" }}>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Concurrentieprijzen</p>
                            <button
                              type="button"
                              onClick={() => zoekPrijzen(a.id)}
                              disabled={zoekendId === a.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition-all hover:opacity-80 cursor-pointer disabled:opacity-50"
                              style={{ backgroundColor: "#001337", color: "#fff", fontFamily: "var(--font-inter)" }}
                            >
                              {zoekendId === a.id ? (
                                <>
                                  <span className="inline-block w-3 h-3 rounded-full border-2 animate-spin flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                                  Bezig met zoeken...
                                </>
                              ) : (
                                <>
                                  <RefreshCw size={11} />
                                  Zoek prijzen via AI
                                </>
                              )}
                            </button>
                          </div>
                          {zoekFout && zoekendId === null && (
                            <p className="text-[11px] mb-2 px-3 py-2" style={{ backgroundColor: "#fff0f0", border: "1px solid #fecaca", color: "#b91c1c", fontFamily: "var(--font-inter)" }}>
                              {zoekFout}
                            </p>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {PLATFORMS.map((plat) => {
                              const prijs = pp[plat.key];
                              const isEdit = editPlatform?.id === a.id && editPlatform?.key === plat.key;
                              return (
                                <div key={plat.key} className="flex items-center gap-3 px-4 py-3" style={{ border: "1px solid rgba(0,19,55,0.08)", backgroundColor: "rgba(0,19,55,0.015)" }}>
                                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: plat.kleur }} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold mb-0.5" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>{plat.label}</p>
                                    {isEdit ? (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs" style={{ color: "rgba(0,19,55,0.4)" }}>€</span>
                                        <input
                                          autoFocus
                                          type="number"
                                          value={editPlatformWaarde}
                                          onChange={(e) => setEditPlatformWaarde(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") savePlatformPrijs(a.id, plat.key, editPlatformWaarde);
                                            if (e.key === "Escape") setEditPlatform(null);
                                          }}
                                          className="w-20 text-sm font-bold outline-none"
                                          style={{ borderBottom: "1px solid #001337", color: "#001337", fontFamily: "var(--font-playfair)", background: "transparent" }}
                                        />
                                        <button
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => savePlatformPrijs(a.id, plat.key, editPlatformWaarde)}
                                          className="text-[10px] px-1.5 py-0.5 font-semibold"
                                          style={{ backgroundColor: "#001337", color: "#fff", fontFamily: "var(--font-inter)" }}
                                        >OK</button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => { setEditPlatform({ id: a.id, key: plat.key }); setEditPlatformWaarde(prijs ?? ""); }}
                                        className="text-sm font-bold text-left group flex items-center gap-1.5 cursor-pointer"
                                        style={{ fontFamily: "var(--font-playfair)", color: prijs ? "#001337" : "rgba(0,19,55,0.25)" }}
                                      >
                                        {prijs ? formatEur(prijs) : "Invullen"}
                                        <span className="text-[10px] opacity-0 group-hover:opacity-60 transition-opacity" style={{ fontFamily: "var(--font-inter)", color: "#001337" }}>✏</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* ── Notitie + actions ── */}
                        <div className="px-6 py-4 flex flex-col sm:flex-row gap-4">
                          <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-widest mb-1.5 font-semibold" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Interne notitie</p>
                            <textarea
                              defaultValue={a.notitie}
                              rows={2}
                              onBlur={(e) => { if (e.target.value !== a.notitie) updateNotitie(a.id, e.target.value); }}
                              placeholder="Voeg een interne notitie toe..."
                              className="w-full px-3 py-2 text-xs outline-none resize-none"
                              style={{ backgroundColor: "rgba(0,19,55,0.02)", border: "1px solid rgba(0,19,55,0.1)", color: "#001337", fontFamily: "var(--font-inter)", lineHeight: 1.7 }}
                            />
                          </div>
                          <div className="flex sm:flex-col gap-2 items-end sm:justify-center sm:pt-4 flex-shrink-0">
                            <button
                              onClick={() => { setMailModalAuto(a); setMailKopiert(false); }}
                              className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-80 cursor-pointer"
                              style={{ backgroundColor: "#001337", color: "#fff", fontFamily: "var(--font-inter)", whiteSpace: "nowrap" }}
                            >
                              <FileText size={12} />
                              Mail update
                            </button>
                            {a.telefoon && (
                              <a href={`tel:${a.telefoon}`} className="px-4 py-2 text-xs font-semibold text-center transition-all hover:opacity-80" style={{ border: "1px solid rgba(0,19,55,0.2)", color: "#001337", fontFamily: "var(--font-inter)", whiteSpace: "nowrap" }}>
                                Bel
                              </a>
                            )}
                            <button
                              onClick={() => updateStatus(a.id, "afgewezen")}
                              disabled={saving}
                              className="px-4 py-2 text-xs font-semibold transition-all hover:opacity-80 cursor-pointer"
                              style={{ border: "1px solid #fecaca", color: "#b91c1c", fontFamily: "var(--font-inter)", whiteSpace: "nowrap" }}
                            >
                              Deactiveer
                            </button>
                          </div>
                        </div>

                        {/* ── Klant opmerking ── */}
                        <div className="px-6 pb-4">
                          <p className="text-[10px] uppercase tracking-widest mb-1.5 font-semibold" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Opmerking klant</p>
                          <textarea
                            defaultValue={a.opmerking}
                            rows={2}
                            onBlur={(e) => { if (e.target.value !== a.opmerking) updateField(a.id, "opmerking", e.target.value); }}
                            placeholder="Opmerking van de klant..."
                            className="w-full px-3 py-2 text-xs outline-none resize-none"
                            style={{ backgroundColor: "rgba(0,19,55,0.02)", border: "1px solid rgba(0,19,55,0.1)", color: "#001337", fontFamily: "var(--font-inter)", lineHeight: 1.7 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* AANVRAGEN TAB */}
            {tab === "aanvragen" && (
              aanvragenLijst.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20" style={{ backgroundColor: "#fff", border: "1px solid rgba(0,19,55,0.07)" }}>
                  <Handshake size={36} style={{ color: "rgba(0,19,55,0.1)" }} />
                  <p className="text-base font-bold mt-4 mb-1" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Geen aanvragen</p>
                  <p className="text-xs" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Ingestuurde aanvragen verschijnen hier automatisch.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {aanvragenLijst.map((a) => {
                    const s = COSIG_STATUS[a.status] ?? COSIG_STATUS.nieuw;
                    const isOpen = openId === a.id;
                    return (
                      <div key={a.id} style={{ backgroundColor: "#fff", border: "1px solid rgba(0,19,55,0.08)" }}>
                        <button
                          onClick={() => setOpenId(isOpen ? null : a.id)}
                          className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50 cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                                {a.merk} {a.model} <span style={{ fontWeight: 400, color: "rgba(0,19,55,0.45)" }}>{a.bouwjaar}</span>
                              </p>
                              <span className="text-[10px] px-2 py-0.5 font-semibold" style={{ backgroundColor: s.bg, color: s.color, fontFamily: "var(--font-inter)" }}>{s.label}</span>
                            </div>
                            <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                              {a.naam} · {a.email}{a.telefoon ? ` · ${a.telefoon}` : ""}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {a.vraagprijs && <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{formatEur(a.vraagprijs)}</p>}
                            <p className="text-[10px]" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                              {a.datum}{a.aantal_fotos > 0 ? ` · ${a.aantal_fotos} foto's` : ""}
                            </p>
                          </div>
                          <span className="text-xs ml-2 flex-shrink-0" style={{ color: "rgba(0,19,55,0.3)" }}>{isOpen ? "▲" : "▼"}</span>
                        </button>

                        {isOpen && (
                          <div className="px-5 pb-5" style={{ borderTop: "1px solid rgba(0,19,55,0.06)" }}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                              <div>
                                <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Auto</p>
                                <table className="w-full text-xs" style={{ fontFamily: "var(--font-inter)" }}>
                                  <tbody>
                                    {[
                                      ["Merk & Model", `${a.merk} ${a.model}`],
                                      ["Bouwjaar", a.bouwjaar],
                                      ["Kilometerstand", a.km ? `${parseInt(a.km).toLocaleString("nl-NL")} km` : "—"],
                                      ["Vraagprijs", formatEur(a.vraagprijs)],
                                    ].map(([label, val]) => (
                                      <tr key={label}>
                                        <td className="py-1 pr-3" style={{ color: "rgba(0,19,55,0.45)", width: "110px" }}>{label}</td>
                                        <td className="py-1 font-semibold" style={{ color: "#001337" }}>{val}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {a.opmerking && (
                                  <div className="mt-3 p-3 text-xs" style={{ backgroundColor: "rgba(0,19,55,0.03)", border: "1px solid rgba(0,19,55,0.07)", color: "rgba(0,19,55,0.65)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
                                    {a.opmerking}
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Actie</p>
                                <div className="flex flex-wrap gap-2 mb-4">
                                  <button
                                    disabled={saving}
                                    onClick={() => { updateStatus(a.id, "geaccepteerd"); setTab("actief"); }}
                                    className="px-4 py-2 text-xs font-semibold transition-all hover:opacity-80 cursor-pointer"
                                    style={{ backgroundColor: "#001337", color: "#fff", fontFamily: "var(--font-inter)" }}
                                  >
                                    Accepteer & activeer
                                  </button>
                                  <button
                                    disabled={saving}
                                    onClick={() => updateStatus(a.id, "in_behandeling")}
                                    className="px-4 py-2 text-xs font-semibold transition-all hover:opacity-80 cursor-pointer"
                                    style={{ border: "1px solid rgba(0,19,55,0.2)", color: "#001337", fontFamily: "var(--font-inter)" }}
                                  >
                                    In behandeling
                                  </button>
                                  <button
                                    disabled={saving}
                                    onClick={() => updateStatus(a.id, "afgewezen")}
                                    className="px-4 py-2 text-xs font-semibold transition-all hover:opacity-80 cursor-pointer"
                                    style={{ border: "1px solid #fecaca", color: "#b91c1c", fontFamily: "var(--font-inter)" }}
                                  >
                                    Afwijzen
                                  </button>
                                </div>
                                <p className="text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Notitie</p>
                                <textarea
                                  defaultValue={a.notitie}
                                  rows={3}
                                  onBlur={(e) => updateNotitie(a.id, e.target.value)}
                                  placeholder="Interne notitie..."
                                  className="w-full px-3 py-2 text-xs outline-none resize-none"
                                  style={{ backgroundColor: "rgba(0,19,55,0.02)", border: "1px solid rgba(0,19,55,0.12)", color: "#001337", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}
                                />
                                <div className="flex justify-between items-center mt-3">
                                  <a
                                    href={`mailto:${a.email}`}
                                    className="text-xs font-semibold transition-all hover:opacity-70"
                                    style={{ backgroundColor: "#001337", color: "#ffffff", padding: "6px 14px", fontFamily: "var(--font-inter)" }}
                                  >
                                    Mail {a.naam.split(" ")[0]}
                                  </a>
                                  <button
                                    onClick={() => verwijder(a.id)}
                                    className="text-xs transition-all hover:opacity-70 cursor-pointer"
                                    style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}
                                  >
                                    Verwijder
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Social Media ────────────────────────────────────────────────
const FB_ICON = (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="#1877F2" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const IG_ICON = (
  <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
    <defs>
      <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#F58529"/>
        <stop offset="50%" stopColor="#DD2A7B"/>
        <stop offset="100%" stopColor="#8134AF"/>
      </linearGradient>
    </defs>
    <path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
);

function genereerSocialPost(a: Auto, platform: "facebook" | "instagram"): string {
  const km = a.km ? `${a.km.toLocaleString("nl-NL")} km` : null;
  const brandstof = a.brandstof ? a.brandstof.charAt(0).toUpperCase() + a.brandstof.slice(1) : null;
  const tag = (w: string) => `#${w.replace(/\s+/g, "").replace(/-/g, "")}`;

  if (platform === "facebook") {
    return [
      `🚗 ${a.merk} ${a.model} — ${a.bouwjaar}`,
      "",
      `Nieuw in onze showroom! De ${a.merk} ${a.model} uit ${a.bouwjaar} staat nu bij ons te koop.`,
      "",
      ...(km ? [`📍 Kilometerstand: ${km}`] : []),
      ...(brandstof ? [`⛽ Brandstof: ${brandstof}`] : []),
      `💶 Vraagprijs: €${a.prijs.toLocaleString("nl-NL")}`,
      "",
      "✅ Professioneel gecontroleerd",
      "✅ Rijklaar afgeleverd",
      "✅ Inruil mogelijk",
      "",
      "Interesse of een proefrit plannen? Stuur ons een bericht of bel direct!",
      "",
      "🌐 www.jgmobility.nl",
    ].filter((r) => r !== null).join("\n");
  }

  // Instagram (korter, meer hashtags)
  return [
    `🚗 ${a.merk} ${a.model} ${a.bouwjaar}`,
    ...(km ? [`📍 ${km}`] : []),
    `💶 €${a.prijs.toLocaleString("nl-NL")}`,
    "",
    "Nieuw aanbod! DM of bel voor info. Inruil mogelijk ✅",
    "",
    "🌐 www.jgmobility.nl",
    "",
    [
      tag("JGMobility"),
      tag(a.merk),
      tag(`${a.merk}${a.model}`),
      tag("AutoVerkoop"),
      tag("Tweedehands"),
      tag("Auto"),
      tag("Tweedehands"),
      tag("Nederland"),
      tag("CarForSale"),
      tag(String(a.bouwjaar)),
      ...(brandstof ? [tag(brandstof)] : []),
    ].join(" "),
  ].join("\n");
}

function SocialContent() {
  const [autos, setAutos] = useState<Auto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [platform, setPlatform] = useState<"facebook" | "instagram">("facebook");
  const [postTekst, setPostTekst] = useState("");
  const [kopiert, setKopiert] = useState(false);

  useEffect(() => {
    fetch("/api/admin/autos")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Auto[]) => {
        const beschikbaar = data.filter((a) => !a.verkocht && !a.gereserveerd);
        setAutos(beschikbaar);
        if (beschikbaar.length > 0) setSelectedId(beschikbaar[0].id);
      });
  }, []);

  useEffect(() => {
    const auto = autos.find((a) => a.id === selectedId);
    if (auto) setPostTekst(genereerSocialPost(auto, platform));
  }, [selectedId, platform, autos]);

  const selectedAuto = autos.find((a) => a.id === selectedId) ?? null;

  const KANALEN: {
    id: "facebook" | "instagram";
    naam: string;
    icon: React.ReactNode;
    kleur: string;
    bg: string;
    links: { label: string; url: string }[];
  }[] = [
    {
      id: "facebook",
      naam: "Facebook",
      icon: FB_ICON,
      kleur: "#1877F2",
      bg: "#e8f0fe",
      links: [
        { label: "Pagina beheren", url: "https://www.facebook.com/jgmobility" },
        { label: "Post plaatsen", url: "https://www.facebook.com/jgmobility/posts/create" },
        { label: "Advertenties", url: "https://www.facebook.com/adsmanager" },
        { label: "Statistieken", url: "https://www.facebook.com/jgmobility/insights" },
      ],
    },
    {
      id: "instagram",
      naam: "Instagram",
      icon: IG_ICON,
      kleur: "#C13584",
      bg: "#fce4f1",
      links: [
        { label: "Profiel bekijken", url: "https://www.instagram.com/jgmobility" },
        { label: "Post aanmaken", url: "https://www.instagram.com/create/style" },
        { label: "Statistieken", url: "https://www.instagram.com/jgmobility/insights" },
      ],
    },
  ];

  return (
    <div>
      <PageHeader title="Social Media" subtitle="Facebook & Instagram beheer" />
      <div className="p-4 md:p-8 flex flex-col gap-6">

        {/* Platform kanalen */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {KANALEN.map((k) => (
            <div key={k.id} style={{ backgroundColor: "#fff", border: "1px solid rgba(0,19,55,0.09)", borderTop: `3px solid ${k.kleur}` }}>
              <div className="px-5 pt-5 pb-4 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)" }}>
                {k.icon}
                <div>
                  <p className="text-base font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{k.naam}</p>
                  <p className="text-xs" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>jgmobility</p>
                </div>
                <div className="ml-auto">
                  <span className="text-[10px] px-2.5 py-1 font-semibold" style={{ backgroundColor: k.bg, color: k.kleur, fontFamily: "var(--font-inter)" }}>Actief</span>
                </div>
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Snelle acties</p>
                <div className="flex flex-wrap gap-2">
                  {k.links.map((l) => (
                    <a
                      key={l.label}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                      style={{ border: `1px solid ${k.kleur}40`, color: k.kleur, fontFamily: "var(--font-inter)", backgroundColor: k.bg }}
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Post generator */}
        <div style={{ backgroundColor: "#fff", border: "1px solid rgba(0,19,55,0.09)" }}>
          <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)", backgroundColor: "#001337" }}>
            <p className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-playfair)" }}>Post generator</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-inter)" }}>Selecteer een auto en platform — de tekst wordt automatisch aangemaakt</p>
          </div>

          <div className="p-6">
            {/* Controls row */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              {/* Auto selector */}
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Auto</p>
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm outline-none"
                  style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", backgroundColor: "#fff" }}
                >
                  {autos.length === 0 && <option value="">Geen auto's beschikbaar</option>}
                  {autos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.merk} {a.model} {a.bouwjaar} — €{a.prijs.toLocaleString("nl-NL")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Platform toggle */}
              <div className="flex-shrink-0">
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Platform</p>
                <div className="flex" style={{ border: "1px solid rgba(0,19,55,0.15)" }}>
                  {(["facebook", "instagram"] as const).map((p) => {
                    const k = KANALEN.find((kk) => kk.id === p)!;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPlatform(p)}
                        className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        style={{
                          backgroundColor: platform === p ? k.kleur : "#fff",
                          color: platform === p ? "#fff" : "rgba(0,19,55,0.5)",
                          fontFamily: "var(--font-inter)",
                        }}
                      >
                        {p === "facebook" ? "Facebook" : "Instagram"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Auto foto preview */}
            {selectedAuto && selectedAuto.fotos.length > 0 && (
              <div className="mb-4 flex items-center gap-3 p-3" style={{ backgroundColor: "rgba(0,19,55,0.02)", border: "1px solid rgba(0,19,55,0.07)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedAuto.fotos[0]}
                  alt={`${selectedAuto.merk} ${selectedAuto.model}`}
                  className="object-cover flex-shrink-0"
                  style={{ width: 72, height: 52 }}
                />
                <div>
                  <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                    {selectedAuto.merk} {selectedAuto.model} {selectedAuto.bouwjaar}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                    {selectedAuto.km ? `${selectedAuto.km.toLocaleString("nl-NL")} km · ` : ""}
                    €{selectedAuto.prijs.toLocaleString("nl-NL")}
                  </p>
                </div>
              </div>
            )}

            {/* Post tekst */}
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Post tekst (aanpasbaar)</p>
              <textarea
                value={postTekst}
                onChange={(e) => setPostTekst(e.target.value)}
                rows={12}
                className="w-full px-4 py-3 text-sm outline-none resize-none"
                style={{ border: "1px solid rgba(0,19,55,0.12)", color: "#001337", fontFamily: "var(--font-inter)", lineHeight: 1.7, backgroundColor: "rgba(0,19,55,0.01)" }}
              />
              <p className="text-[10px] mt-1 text-right" style={{ color: "rgba(0,19,55,0.3)", fontFamily: "var(--font-inter)" }}>
                {postTekst.length} tekens
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(postTekst);
                  setKopiert(true);
                  setTimeout(() => setKopiert(false), 2000);
                }}
                className="flex-1 py-2.5 text-xs font-semibold transition-all hover:opacity-80 cursor-pointer"
                style={{ backgroundColor: "#001337", color: "#fff", fontFamily: "var(--font-inter)" }}
              >
                {kopiert ? "Gekopieerd!" : "Kopieer post tekst"}
              </button>
              {(() => {
                const k = KANALEN.find((kk) => kk.id === platform)!;
                const postUrl = platform === "facebook"
                  ? `https://www.facebook.com/jgmobility/posts/create`
                  : `https://www.instagram.com/create/style`;
                return (
                  <a
                    href={postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 text-xs font-semibold text-center transition-all hover:opacity-80"
                    style={{ backgroundColor: k.kleur, color: "#fff", fontFamily: "var(--font-inter)" }}
                  >
                    Openen in {k.naam}
                  </a>
                );
              })()}
            </div>
            <p className="text-[11px] mt-3 text-center" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
              Kopieer de tekst eerst, open dan het platform en plak de tekst in je post.
            </p>
          </div>
        </div>

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
function CalculatorPanel() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);

  useEffect(() => {
    fetch("/api/admin/dossiers")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDossiers);
  }, []);

  const fmtK = (v: number) => v.toLocaleString("nl-NL", { maximumFractionDigits: 0 });

  const calcWinst = (d: Dossier): number | null => {
    const k = d.inkoop + d.kosten.reduce((s, kk) => s + (parseFloat(kk.bedrag) || 0), 0);
    if (d.verkoopprijs <= 0) return null;
    if (d.btw_type === "marge") {
      const m = d.verkoopprijs - k;
      return m > 0 ? Math.round((m - (m * 21) / 121) * 100) / 100 : m;
    }
    const ex = Math.round((d.verkoopprijs / 1.21) * 100) / 100;
    return Math.round((ex - k) * 100) / 100;
  };

  if (dossiers.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
          Nog geen dossiers — open de Calculator tab om te starten.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {dossiers.map((d) => {
        const w = calcWinst(d);
        return (
          <div
            key={d.id}
            className="flex items-center justify-between px-4 py-3"
            style={{ border: "1px solid rgba(0,19,55,0.07)", backgroundColor: "#fafbfc" }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
                {d.auto_naam || "Naamloos"}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                {d.inkoop > 0 ? ("Inkoop: €" + fmtK(d.inkoop)) : "Inkoop: —"}
                {" · "}
                {d.btw_type === "marge" ? "Marge" : "21% BTW"}
              </p>
            </div>
            <div className="flex-shrink-0 text-right ml-3">
              {w !== null ? (
                <p className="text-sm font-bold" style={{ color: w > 0 ? "#15803d" : w < 0 ? "#b91c1c" : "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>
                  {w > 0 ? "+" : ""}
                  {"€" + fmtK(Math.abs(w))}
                </p>
              ) : (
                <p className="text-[10px]" style={{ color: "rgba(0,19,55,0.3)", fontFamily: "var(--font-inter)" }}>Geen verkoop</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
        if (data.length > 0) openDossier(data[0]);
      });
  }, [openDossier]);

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

  // Periode filter
  const gefilterdeDossiers = dossiers.filter((d) => {
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
        {toonNieuw && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,19,55,0.45)" }}
            onClick={() => { setToonNieuw(false); setNieuwNaam(""); }}
          >
            <div
              className="w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
              style={{ backgroundColor: "#ffffff" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <p className="text-base font-bold mb-0.5" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                  Nieuw dossier
                </p>
                <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                  Voer de autonaam in om te beginnen
                </p>
              </div>
              <input
                autoFocus
                type="text"
                value={nieuwNaam}
                onChange={(e) => setNieuwNaam(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") maakNieuwDossier();
                  if (e.key === "Escape") { setToonNieuw(false); setNieuwNaam(""); }
                }}
                placeholder="bijv. Volkswagen Golf GTE (2019)"
                className="w-full px-3 py-2.5 text-sm"
                style={veld}
              />
              <div className="flex gap-2">
                <button
                  onClick={maakNieuwDossier}
                  className="flex-1 py-2.5 text-xs font-semibold transition-all hover:opacity-90"
                  style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
                >
                  Aanmaken
                </button>
                <button
                  onClick={() => { setToonNieuw(false); setNieuwNaam(""); }}
                  className="px-4 py-2.5 text-xs font-semibold transition-all hover:opacity-70"
                  style={{ border: "1px solid rgba(0,19,55,0.15)", color: "rgba(0,19,55,0.6)", fontFamily: "var(--font-inter)" }}
                >
                  Annuleer
                </button>
              </div>
            </div>
          </div>
        )}
        <PageHeader
          title="Marge Calculator"
          subtitle="Per auto bijhouden"
          action={
            <button
              onClick={() => { setToonNieuw(true); setNieuwNaam(""); }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
            >
              <Plus size={12} /> Nieuw dossier
            </button>
          }
        />
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
      {/* Modal: nieuw dossier */}
      {toonNieuw && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,19,55,0.45)" }}
          onClick={() => { setToonNieuw(false); setNieuwNaam(""); }}
        >
          <div
            className="w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
            style={{ backgroundColor: "#ffffff" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-base font-bold mb-0.5" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
                Nieuw dossier
              </p>
              <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                Voer de autonaam in om te beginnen
              </p>
            </div>
            <input
              autoFocus
              type="text"
              value={nieuwNaam}
              onChange={(e) => setNieuwNaam(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") maakNieuwDossier();
                if (e.key === "Escape") { setToonNieuw(false); setNieuwNaam(""); }
              }}
              placeholder="bijv. Volkswagen Golf GTE (2019)"
              className="w-full px-3 py-2.5 text-sm"
              style={veld}
            />
            <div className="flex gap-2">
              <button
                onClick={maakNieuwDossier}
                className="flex-1 py-2.5 text-xs font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
              >
                Aanmaken
              </button>
              <button
                onClick={() => { setToonNieuw(false); setNieuwNaam(""); }}
                className="px-4 py-2.5 text-xs font-semibold transition-all hover:opacity-70"
                style={{ border: "1px solid rgba(0,19,55,0.15)", color: "rgba(0,19,55,0.6)", fontFamily: "var(--font-inter)" }}
              >
                Annuleer
              </button>
            </div>
          </div>
        </div>
      )}

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
              onClick={() => { setToonNieuw(true); setNieuwNaam(""); }}
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
          style={{ width: "280px", borderRight: "1px solid rgba(0,19,55,0.08)", backgroundColor: "#f8f9fb" }}
        >
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
                <div className="flex-1 flex flex-col gap-4 lg:max-w-[480px]">
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

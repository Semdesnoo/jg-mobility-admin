"use client";

/**
 * Gedeeld ontwerpsysteem voor de pagina "Inkoop & Taxatie".
 *
 * Alle vier de tabbladen (Taxatietool, Marktoverzicht, Prestaties, Dossiers) bouwen
 * uitsluitend met deze primitieven, zodat ze als één instrument aanvoelen.
 * Stijl: redactioneel/navy — Playfair voor cijfers, Inter voor UI, hairlines,
 * rechte hoeken, uppercase microlabels.
 */

import type { CSSProperties, ReactNode } from "react";

// ── Tokens ────────────────────────────────────────────────────────
export const T = {
  navy: "#001337",
  ink: (a: number) => `rgba(0,19,55,${a})`,
  paper: "#ffffff",
  wash: "#f6f7f9",
  line: "rgba(0,19,55,0.07)",
  line2: "rgba(0,19,55,0.12)",
  groen: "#15803d",
  amber: "#b45309",
  rood: "#b91c1c",
  blauw: "#1d4ed8",
  paars: "#7c3aed",
  teal: "#0d9488",
  tintGroen: "#dcfce7",
  tintAmber: "#fef3c7",
  tintRood: "#fee2e2",
  tintBlauw: "#dbeafe",
  play: "var(--font-playfair)",
  inter: "var(--font-inter)",
  /** Hoogte van header (56) + tabbalk (46) — gebruikt voor sticky offsets. */
  chrome: 102,
} as const;

/** Cijfers: altijd Playfair met tabellarische cijfers zodat kolommen uitlijnen. */
export const num = (size: number, color: string = T.navy, weight = 700): CSSProperties => ({
  fontFamily: T.play,
  fontSize: size,
  fontWeight: weight,
  color,
  lineHeight: 1.05,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "-0.01em",
});

export const micro = (color: string = T.ink(0.4)): CSSProperties => ({
  fontFamily: T.inter,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color,
});

export const body = (size = 12.5, color: string = T.ink(0.65)): CSSProperties => ({
  fontFamily: T.inter,
  fontSize: size,
  color,
  lineHeight: 1.65,
});

// ── Formatters ────────────────────────────────────────────────────
export const fmt = (n: number) => `€ ${Math.round(n).toLocaleString("nl-NL")}`;
export const fmtKort = (n: number) =>
  Math.abs(n) >= 1000 ? `€ ${Math.round(n / 1000)}k` : `€ ${Math.round(n)}`;
export const fmtKm = (n: number) => `${Math.round(n).toLocaleString("nl-NL")} km`;
export const fmtGetal = (n: number) => Math.round(n).toLocaleString("nl-NL");

/** Kleur op een 0-10 schaal: hoog = goed. */
export const scoreKleur = (s: number, max = 10) => {
  const p = (s / max) * 10;
  return p >= 7 ? T.groen : p >= 5 ? T.amber : T.rood;
};

// ── Panel ─────────────────────────────────────────────────────────
export function Panel({
  title,
  icon,
  meta,
  actions,
  children,
  tone = "licht",
  flush = false,
  className = "",
  style,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  tone?: "licht" | "donker";
  /** Geen padding op de body — voor tabellen en lijsten. */
  flush?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const donker = tone === "donker";
  const rand = donker ? "rgba(255,255,255,0.10)" : T.line;
  return (
    <section
      className={`flex flex-col min-w-0 ${className}`}
      style={{ backgroundColor: donker ? T.navy : T.paper, border: `1px solid ${rand}`, ...style }}
    >
      {(title || actions) && (
        <header
          className="flex items-center gap-2.5 px-4 md:px-5"
          style={{
            minHeight: 44,
            borderBottom: `1px solid ${rand}`,
            backgroundColor: donker ? "rgba(255,255,255,0.03)" : "rgba(0,19,55,0.015)",
          }}
        >
          {icon}
          <h3
            className="truncate"
            style={{
              fontFamily: T.play,
              fontSize: 14,
              fontWeight: 700,
              color: donker ? "#ffffff" : T.navy,
            }}
          >
            {title}
          </h3>
          {meta && (
            <span className="truncate" style={{ ...micro(donker ? "rgba(255,255,255,0.4)" : T.ink(0.35)) }}>
              {meta}
            </span>
          )}
          {actions && <div className="ml-auto flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </header>
      )}
      <div className={flush ? "flex-1 min-w-0" : "flex-1 min-w-0 p-4 md:p-5"}>{children}</div>
    </section>
  );
}

/** Redactionele sectieregel: label, dan een hairline die de rest van de breedte vult. */
export function SectionRule({ label, right }: { label: string; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 w-full">
      <span style={{ ...micro(), letterSpacing: "0.18em", flexShrink: 0 }}>{label}</span>
      <span className="flex-1 h-px" style={{ backgroundColor: T.line2 }} />
      {right && (
        <span className="flex-shrink-0" style={{ fontFamily: T.inter, fontSize: 10, color: T.ink(0.4) }}>
          {right}
        </span>
      )}
    </div>
  );
}

// ── Stat ──────────────────────────────────────────────────────────
export function Stat({
  label,
  value,
  sub,
  accent,
  size = 26,
  tone = "licht",
  align = "left",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Kleuraccent: 3px balk links + kleurt de waarde. */
  accent?: string;
  size?: number;
  tone?: "licht" | "donker";
  align?: "left" | "center" | "right";
}) {
  const donker = tone === "donker";
  return (
    <div
      className="relative min-w-0 p-3.5 overflow-hidden"
      style={{
        backgroundColor: donker ? "rgba(255,255,255,0.06)" : "rgba(0,19,55,0.02)",
        border: `1px solid ${donker ? "rgba(255,255,255,0.08)" : T.line}`,
        textAlign: align,
      }}
    >
      {accent && (
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accent }} />
      )}
      <p className="mb-1.5 truncate" style={micro(donker ? "rgba(255,255,255,0.4)" : T.ink(0.4))}>
        {label}
      </p>
      <p style={num(size, donker ? "#ffffff" : accent ?? T.navy)}>{value}</p>
      {sub && (
        <p className="mt-1.5 truncate" style={{ fontFamily: T.inter, fontSize: 10, color: donker ? "rgba(255,255,255,0.35)" : T.ink(0.35) }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Meters ────────────────────────────────────────────────────────
export function Meter({
  value,
  max,
  color = T.navy,
  height = 6,
  track = "rgba(0,19,55,0.07)",
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
  track?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="w-full" style={{ height, backgroundColor: track }}>
      <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, transition: "width .35s ease" }} />
    </div>
  );
}

/** Score als 10 losse segmenten — leest sneller dan een doorlopende balk. */
export function Segments({ score, max = 10, color }: { score: number; max?: number; color?: string }) {
  const c = color ?? scoreKleur(score, max);
  return (
    <div className="flex items-center gap-1 w-full">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="flex-1"
          style={{ height: 7, backgroundColor: i < Math.round(score) ? c : "rgba(0,19,55,0.08)" }}
        />
      ))}
    </div>
  );
}

// ── Badges ────────────────────────────────────────────────────────
export function Pill({
  children,
  color = T.navy,
  bg,
  solid = false,
}: {
  children: ReactNode;
  color?: string;
  bg?: string;
  solid?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 whitespace-nowrap"
      style={{
        fontFamily: T.inter,
        fontSize: 10,
        fontWeight: 600,
        color: solid ? "#ffffff" : color,
        backgroundColor: solid ? color : bg ?? `${color}14`,
      }}
    >
      {children}
    </span>
  );
}

export function TrendBadge({ trend }: { trend: string }) {
  const map: Record<string, { icon: string; color: string; bg: string }> = {
    stijgend: { icon: "↑", color: T.groen, bg: T.tintGroen },
    stabiel: { icon: "→", color: T.blauw, bg: T.tintBlauw },
    dalend: { icon: "↓", color: T.rood, bg: T.tintRood },
  };
  const t = map[trend] ?? map.stabiel;
  return (
    <Pill color={t.color} bg={t.bg}>
      {t.icon} {trend}
    </Pill>
  );
}

export function ScoreRing({ score, size = 60, tone = "licht" }: { score: number; size?: number; tone?: "licht" | "donker" }) {
  const color = scoreKleur(score);
  const label = score >= 7 ? "Aantrekkelijk" : score >= 5 ? "Gemiddeld" : "Risicovol";
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          border: `3px solid ${color}`,
          ...num(size * 0.4, tone === "donker" ? "#ffffff" : color),
        }}
      >
        {score}
      </div>
      <p style={{ ...micro(color), fontSize: 9 }}>{label}</p>
    </div>
  );
}

// ── Formulier ─────────────────────────────────────────────────────
export function Field({
  label,
  hint,
  hintColor,
  children,
  suffix,
}: {
  label: string;
  hint?: ReactNode;
  hintColor?: string;
  children: ReactNode;
  suffix?: string;
}) {
  // Het geheel is één <label>, zodat klikken op het label of de hint het veld focust
  // zonder dat elke aanroeper een eigen id hoeft door te geven.
  return (
    <label className="block min-w-0">
      <span className="block mb-1.5" style={micro()}>
        {label}
      </span>
      <div className="relative">
        {children}
        {suffix && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ fontFamily: T.inter, fontSize: 11, color: T.ink(0.35) }}
          >
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p className="mt-1.5" style={{ fontFamily: T.inter, fontSize: 10.5, color: hintColor ?? T.ink(0.4), lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
    </label>
  );
}

export const inputStijl: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 13,
  fontFamily: T.inter,
  color: T.navy,
  backgroundColor: "#fafafa",
  border: `1px solid ${T.line2}`,
  outline: "none",
};

export function Btn({
  children,
  onClick,
  variant = "primair",
  size = "md",
  disabled,
  full,
  type = "button",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primair" | "ghost" | "ghostDonker" | "wit";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  full?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  const pad = size === "sm" ? "6px 10px" : size === "lg" ? "14px 20px" : "9px 16px";
  const fs = size === "sm" ? 11 : size === "lg" ? 12 : 12;
  const varianten: Record<string, CSSProperties> = {
    primair: { backgroundColor: T.navy, color: "#ffffff", border: `1px solid ${T.navy}` },
    ghost: { backgroundColor: "transparent", color: T.navy, border: `1px solid ${T.line2}` },
    ghostDonker: { backgroundColor: "transparent", color: "#ffffff", border: "1px solid rgba(255,255,255,0.3)" },
    wit: { backgroundColor: "#ffffff", color: T.navy, border: "1px solid #ffffff" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-2 transition-all hover:opacity-85 disabled:opacity-35 disabled:cursor-not-allowed ${full ? "w-full" : ""}`}
      style={{
        padding: pad,
        fontSize: fs,
        fontWeight: 600,
        fontFamily: T.inter,
        letterSpacing: size === "lg" ? "0.08em" : undefined,
        textTransform: size === "lg" ? "uppercase" : undefined,
        whiteSpace: "nowrap",
        ...varianten[variant],
      }}
    >
      {children}
    </button>
  );
}

/** Klikbare keuzechip (marge-presets, statusfilters, snelkosten). */
export function Chip({
  children,
  active,
  onClick,
  color = T.navy,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 transition-all hover:opacity-80"
      style={{
        fontFamily: T.inter,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
        color: active ? "#ffffff" : T.ink(0.5),
        backgroundColor: active ? color : "transparent",
        border: `1px solid ${active ? color : T.line2}`,
      }}
    >
      {children}
    </button>
  );
}

// ── Toestanden ────────────────────────────────────────────────────
export function Spinner({ size = 16, tone = "licht" }: { size?: number; tone?: "licht" | "donker" }) {
  return (
    <span
      className="inline-block rounded-full animate-spin flex-shrink-0"
      style={{
        width: size,
        height: size,
        border: `2px solid ${tone === "donker" ? "rgba(255,255,255,0.25)" : "rgba(0,19,55,0.12)"}`,
        borderTopColor: tone === "donker" ? "#ffffff" : T.navy,
      }}
    />
  );
}

export function Skeleton({ w = "100%", h = 12, className = "" }: { w?: number | string; h?: number; className?: string }) {
  return (
    <span
      className={`block animate-pulse ${className}`}
      style={{ width: w, height: h, backgroundColor: "rgba(0,19,55,0.06)" }}
    />
  );
}

export function Empty({
  icon,
  title,
  body: tekst,
  children,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-16"}`}>
      {icon}
      <p className="mt-3 mb-1.5" style={{ fontFamily: T.play, fontSize: compact ? 15 : 18, fontWeight: 700, color: T.navy }}>
        {title}
      </p>
      {tekst && (
        <p className="max-w-md" style={body(12.5, T.ink(0.42))}>
          {tekst}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function Foutmelding({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-start gap-2.5 px-4 py-3"
      style={{ backgroundColor: T.tintRood, border: "1px solid #fecaca" }}
    >
      <span style={{ color: T.rood, fontSize: 13, lineHeight: 1.3, flexShrink: 0 }}>●</span>
      <p style={{ fontFamily: T.inter, fontSize: 12.5, color: T.rood, lineHeight: 1.5 }}>{children}</p>
    </div>
  );
}

// ── Tabel ─────────────────────────────────────────────────────────
export function Th({
  children,
  align = "left",
  onClick,
  actief,
  width,
}: {
  children: ReactNode;
  align?: "left" | "center" | "right";
  onClick?: () => void;
  actief?: boolean;
  width?: number | string;
}) {
  return (
    <th
      onClick={onClick}
      style={{
        ...micro(actief ? T.navy : T.ink(0.4)),
        padding: "9px 16px",
        textAlign: align,
        whiteSpace: "nowrap",
        width,
        cursor: onClick ? "pointer" : undefined,
        userSelect: "none",
      }}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  sterk = false,
  cijfer = false,
  color,
}: {
  children: ReactNode;
  align?: "left" | "center" | "right";
  sterk?: boolean;
  /** Playfair + tabellarisch — voor bedragen. */
  cijfer?: boolean;
  color?: string;
}) {
  return (
    <td
      style={{
        padding: "9px 16px",
        textAlign: align,
        fontFamily: cijfer ? T.play : T.inter,
        fontSize: cijfer ? 13.5 : 12,
        fontWeight: sterk || cijfer ? 700 : 400,
        fontVariantNumeric: cijfer ? "tabular-nums" : undefined,
        color: color ?? (sterk || cijfer ? T.navy : T.ink(0.6)),
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

export function TabelWrap({ children }: { children: ReactNode }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>{children}</table>
    </div>
  );
}

export const rijStijl = (i: number): CSSProperties => ({
  backgroundColor: i % 2 === 0 ? "#ffffff" : "#fafbfc",
  borderBottom: `1px solid ${T.line}`,
});

/** Voettekst onder een panel — bronvermelding, disclaimers. */
export function PanelVoet({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 md:px-5 py-2.5" style={{ borderTop: `1px solid ${T.line}`, backgroundColor: "rgba(0,19,55,0.015)" }}>
      <p style={{ fontFamily: T.inter, fontSize: 10.5, color: T.ink(0.42), lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}

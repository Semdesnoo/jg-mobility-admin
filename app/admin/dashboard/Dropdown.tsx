"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

/**
 * Afgeronde keuzelijst die een gewone <select> vervangt.
 *
 * WAAROM DIT BESTAAT
 * Een native <select> tekent zijn open lijst zelf via het besturingssysteem. Die lijst is
 * met CSS niet af te ronden: border-radius, schaduw en kleuren worden genegeerd, en je
 * krijgt de kale blauwe balk van de browser. Wil je een afgeronde, in de huisstijl
 * passende dropdown, dan moet je hem zelf tekenen — dat doet dit component.
 *
 * Gedraagt zich als een select: `value` + `onChange(value)`, opties als {value,label}.
 * Sluit bij klik-buiten en Escape, en is toetsenbord-toegankelijk voor de basis.
 */
export type DropdownOptie = { value: string; label: string };

export default function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Kies…",
  disabled = false,
  className = "",
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOptie[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const vak = useRef<HTMLDivElement>(null);
  const gekozen = options.find((o) => o.value === value);

  // Klik-buiten en Escape sluiten de lijst — anders blijft hij openstaan.
  useEffect(() => {
    if (!open) return;
    const buiten = (e: MouseEvent) => {
      if (vak.current && !vak.current.contains(e.target as Node)) setOpen(false);
    };
    const ontsnap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", buiten);
    document.addEventListener("keydown", ontsnap);
    return () => {
      document.removeEventListener("mousedown", buiten);
      document.removeEventListener("keydown", ontsnap);
    };
  }, [open]);

  const basis: React.CSSProperties = {
    backgroundColor: "#ffffff",
    border: "1px solid rgba(0,19,55,0.15)",
    color: "#001337",
    fontFamily: "var(--font-inter)",
    borderRadius: "var(--radius-control, 10px)",
    ...style,
  };

  return (
    <div ref={vak} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 text-left text-sm outline-none transition-all disabled:opacity-50 ${className}`}
        style={{ ...basis, paddingRight: 36 }}
      >
        <span className="flex-1 min-w-0 truncate" style={{ color: gekozen ? "#001337" : "rgba(0,19,55,0.4)" }}>
          {gekozen?.label ?? placeholder}
        </span>
        <ChevronDown
          size={15}
          style={{
            position: "absolute",
            right: 12,
            color: "rgba(0,19,55,0.4)",
            transition: "transform 150ms ease",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-40 mt-1.5 max-h-72 overflow-auto jg-scroll p-1"
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid rgba(0,19,55,0.12)",
            borderRadius: "var(--radius-card, 14px)",
            boxShadow: "0 12px 32px -8px rgba(0,19,55,0.28)",
          }}
        >
          {options.map((o) => {
            const actief = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                style={{
                  fontFamily: "var(--font-inter)",
                  color: actief ? "#ffffff" : "#001337",
                  backgroundColor: actief ? "#1d4ed8" : "transparent",
                  borderRadius: "var(--radius-control, 10px)",
                  fontWeight: actief ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!actief) e.currentTarget.style.backgroundColor = "rgba(29,78,216,0.08)";
                }}
                onMouseLeave={(e) => {
                  if (!actief) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span className="flex-1 min-w-0 truncate">{o.label}</span>
                {actief && <Check size={14} style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

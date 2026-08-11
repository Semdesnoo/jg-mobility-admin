"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { T, inputStijl } from "./inkoop/ui";

/**
 * Nette dialoogvensters in plaats van de kale vensters van de browser.
 *
 * WAAROM
 * `confirm()` en `alert()` tonen een venster van het besturingssysteem: een grijze balk
 * met "dasboard-roan.vercel.app meldt het volgende", een andere letter, andere knoppen en
 * een OK-knop die er hetzelfde uitziet of je nu iets bevestigt of iets weggooit. Bij een
 * onomkeerbare handeling — een aanvraag verwijderen, een auto op verkocht zetten — is dat
 * precies het moment waarop het scherm rustig en duidelijk hoort te zijn.
 *
 * Ze blokkeren bovendien de hele pagina: lopende AI-opdrachten en verversingen staan stil
 * zolang zo'n venster openstaat.
 *
 * HOE
 * Eén provider bovenaan het beheerpaneel, en overal `const { vraag } = useDialoog()`.
 * De aanroep lijkt bewust op die van `confirm()`, alleen met await ervoor:
 *
 *   if (!(await vraag({ titel: "Aanvraag verwijderen?", gevaar: true }))) return;
 */

type Knopsoort = "gewoon" | "gevaar";

type Vraag = {
  titel: string;
  /** Toelichting eronder. Laat weg als de titel het al zegt. */
  tekst?: string;
  /** Tekst op de bevestigknop. Standaard "Ja". */
  bevestig?: string;
  /** Tekst op de annuleerknop. Standaard "Annuleren". */
  annuleer?: string;
  /** Onomkeerbaar? Dan wordt de knop rood en krijgt hij een prullenbak. */
  gevaar?: boolean;
};

type Melding = { titel: string; tekst?: string; sluit?: string };

type TekstVraag = {
  titel: string;
  tekst?: string;
  plaats?: string;
  beginwaarde?: string;
  bevestig?: string;
};

type Inhoud =
  | ({ soort: "vraag" } & Vraag)
  | ({ soort: "melding" } & Melding)
  | ({ soort: "tekst" } & TekstVraag);

type Open = { inhoud: Inhoud; klaar: (uitslag: boolean | string | null) => void };

const DialoogContext = createContext<{
  vraag: (v: Vraag) => Promise<boolean>;
  melden: (m: Melding) => Promise<void>;
  vraagTekst: (v: TekstVraag) => Promise<string | null>;
} | null>(null);

export function DialoogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);

  const toon = useCallback(
    (inhoud: Inhoud) =>
      new Promise<boolean | string | null>((klaar) => setOpen({ inhoud, klaar })),
    []
  );

  const vraag = useCallback(
    (v: Vraag) => toon({ soort: "vraag", ...v }).then((u) => u === true),
    [toon]
  );
  const melden = useCallback(
    (m: Melding) => toon({ soort: "melding", ...m }).then(() => undefined),
    [toon]
  );
  const vraagTekst = useCallback(
    (v: TekstVraag) => toon({ soort: "tekst", ...v }).then((u) => (typeof u === "string" ? u : null)),
    [toon]
  );

  const sluit = useCallback(
    (uitslag: boolean | string | null) => {
      setOpen((huidig) => {
        huidig?.klaar(uitslag);
        return null;
      });
    },
    []
  );

  return (
    <DialoogContext.Provider value={{ vraag, melden, vraagTekst }}>
      {children}
      {open && <Venster inhoud={open.inhoud} sluit={sluit} />}
    </DialoogContext.Provider>
  );
}

export function useDialoog() {
  const ctx = useContext(DialoogContext);
  if (!ctx) throw new Error("useDialoog moet binnen DialoogProvider gebruikt worden");
  return ctx;
}

function Venster({ inhoud, sluit }: { inhoud: Inhoud; sluit: (u: boolean | string | null) => void }) {
  const invoer = useRef<HTMLInputElement>(null);
  const bevestigKnop = useRef<HTMLButtonElement>(null);

  // Escape annuleert, Enter bevestigt. Dat kende het venster van de browser ook, en het
  // is precies wat je vingers al doen.
  useEffect(() => {
    const toets = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); sluit(inhoud.soort === "tekst" ? null : false); }
      if (e.key === "Enter" && inhoud.soort !== "tekst") { e.preventDefault(); sluit(true); }
    };
    document.addEventListener("keydown", toets);
    return () => document.removeEventListener("keydown", toets);
  }, [inhoud.soort, sluit]);

  // De achtergrond mag niet meescrollen; anders schuift de pagina eronder weg terwijl je
  // een vraag beantwoordt.
  useEffect(() => {
    const vorige = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = vorige; };
  }, []);

  useEffect(() => {
    // Bij een tekstvraag hoort de cursor in het veld te staan; bij een ja/nee-vraag op de
    // bevestigknop, zodat Enter en Tab meteen doen wat je verwacht.
    const t = requestAnimationFrame(() => {
      if (inhoud.soort === "tekst") invoer.current?.focus();
      else bevestigKnop.current?.focus();
    });
    return () => cancelAnimationFrame(t);
  }, [inhoud.soort]);

  const gevaar = inhoud.soort === "vraag" && !!inhoud.gevaar;
  const knopKleur: Knopsoort = gevaar ? "gevaar" : "gewoon";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,19,55,0.45)" }}
      // Naast klikken sluit de vraag zonder iets te doen — net als Escape. Bewust niet
      // "ja": wegklikken mag nooit hetzelfde betekenen als bevestigen.
      onMouseDown={(e) => { if (e.target === e.currentTarget) sluit(inhoud.soort === "tekst" ? null : false); }}
      role="dialog"
      aria-modal="true"
      aria-label={inhoud.titel}
    >
      <div
        className="w-full"
        style={{
          maxWidth: 430,
          backgroundColor: T.paper,
          border: `1px solid ${T.line2}`,
          boxShadow: "0 18px 50px rgba(0,19,55,0.22)",
        }}
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-1">
          {gevaar && (
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 30, height: 30, backgroundColor: T.tintRood, marginTop: 1 }}
            >
              <AlertTriangle size={15} color={T.rood} />
            </span>
          )}
          <div className="min-w-0">
            <p style={{ fontFamily: T.play, fontSize: 16, fontWeight: 700, color: T.navy, lineHeight: 1.35 }}>
              {inhoud.titel}
            </p>
            {inhoud.tekst && (
              <p
                className="mt-1.5"
                style={{ fontFamily: T.inter, fontSize: 12.5, lineHeight: 1.6, color: T.ink(0.6), whiteSpace: "pre-line" }}
              >
                {inhoud.tekst}
              </p>
            )}
          </div>
        </div>

        {inhoud.soort === "tekst" && (
          <div className="px-5 pt-3">
            <input
              ref={invoer}
              defaultValue={inhoud.beginwaarde ?? ""}
              placeholder={inhoud.plaats}
              style={inputStijl}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); sluit(e.currentTarget.value.trim() || null); }
              }}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 px-5 py-4 mt-3" style={{ borderTop: `1px solid ${T.line}` }}>
          {inhoud.soort !== "melding" && (
            <Knop onClick={() => sluit(inhoud.soort === "tekst" ? null : false)}>
              {inhoud.soort === "vraag" ? inhoud.annuleer ?? "Annuleren" : "Annuleren"}
            </Knop>
          )}
          <Knop
            ref={bevestigKnop}
            soort={knopKleur}
            hoofd
            onClick={() => {
              if (inhoud.soort === "tekst") sluit(invoer.current?.value.trim() || null);
              else sluit(true);
            }}
          >
            {gevaar && <Trash2 size={12} />}
            {inhoud.soort === "melding"
              ? inhoud.sluit ?? "Oké"
              : inhoud.soort === "tekst"
                ? inhoud.bevestig ?? "Opslaan"
                : inhoud.bevestig ?? "Ja"}
          </Knop>
        </div>
      </div>
    </div>
  );
}

/** Knoppen van het venster. Rood zodra iets niet terug te draaien is. */
function Knop({
  children, onClick, soort = "gewoon", hoofd = false, ref,
}: {
  children: ReactNode;
  onClick: () => void;
  soort?: Knopsoort;
  hoofd?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  const achtergrond = !hoofd ? "transparent" : soort === "gevaar" ? T.rood : T.navy;
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 transition-all hover:opacity-85"
      style={{
        padding: "8px 14px",
        fontFamily: T.inter,
        fontSize: 12.5,
        fontWeight: 600,
        color: hoofd ? "#ffffff" : T.ink(0.6),
        backgroundColor: achtergrond,
        border: `1px solid ${hoofd ? achtergrond : T.line2}`,
      }}
    >
      {children}
    </button>
  );
}

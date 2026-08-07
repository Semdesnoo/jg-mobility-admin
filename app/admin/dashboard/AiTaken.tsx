"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

/**
 * Lopende AI-opdrachten, los van het tabblad waar ze gestart zijn.
 *
 * WAAROM
 * De tabbladen worden bij het wisselen uit beeld gehaald én uit het geheugen
 * gegooid. Startte je een analyse en klikte je door naar een ander scherm, dan
 * verdween de opdracht met het tabblad mee: bij terugkomst stond je weer bij nul,
 * ook al had de server het werk allang gedaan.
 *
 * Deze laag zit bóven de tabbladen en blijft dus staan. De opdracht draait hier,
 * het antwoord wordt hier bewaard, en het tabblad haalt het op wanneer je
 * terugkomt — klaar of nog bezig.
 *
 * Wat dit NIET doet: een opdracht overleven als je de pagina ververst of de app
 * afsluit. Daar zou de server het werk zelfstandig voor moeten voortzetten, en dat
 * kan niet op Vercel: een functie stopt zodra hij zijn antwoord heeft gegeven.
 */

export type Taak<T = unknown> = {
  id: string;
  label: string;
  bezig: boolean;
  /** Voortgangstekst, bijvoorbeeld "Advertentie 3 van 8 controleren…". */
  stap: string;
  resultaat?: T;
  fout?: string;
  gestartOp: number;
  klaarOp?: number;
};

type Ctx = {
  taken: Record<string, Taak>;
  /** Start een opdracht. Draait er al één met dit id, dan gebeurt er niets. */
  start: <T>(id: string, label: string, fn: (stap: (t: string) => void) => Promise<T>) => void;
  lees: <T>(id: string) => Taak<T> | undefined;
  wis: (id: string) => void;
};

const AiTakenContext = createContext<Ctx | null>(null);

export function AiTakenProvider({ children }: { children: ReactNode }) {
  const [taken, setTaken] = useState<Record<string, Taak>>({});
  // Welke opdrachten net klaar zijn en nog even gemeld mogen worden. Als losse
  // toestand met een timer, want de klok uitlezen tijdens het tekenen van het
  // scherm geeft onvoorspelbare uitkomsten.
  const [netKlaar, setNetKlaar] = useState<string[]>([]);
  // Los bijhouden wat er draait: de statuswaarde in een closure kan verouderd zijn,
  // en dan zou een tweede klik dezelfde opdracht alsnog dubbel starten.
  const draaiend = useRef<Set<string>>(new Set());

  const meldKlaar = useCallback((id: string) => {
    setNetKlaar((v) => (v.includes(id) ? v : [...v, id]));
    setTimeout(() => setNetKlaar((v) => v.filter((x) => x !== id)), 60000);
  }, []);

  const zetStap = useCallback((id: string, stap: string) => {
    setTaken((v) => (v[id] ? { ...v, [id]: { ...v[id], stap } } : v));
  }, []);

  const start = useCallback(
    <T,>(id: string, label: string, fn: (stap: (t: string) => void) => Promise<T>) => {
      if (draaiend.current.has(id)) return;
      draaiend.current.add(id);

      setTaken((v) => ({
        ...v,
        [id]: { id, label, bezig: true, stap: "", gestartOp: Date.now() },
      }));

      fn((t) => zetStap(id, t))
        .then((resultaat) => {
          setTaken((v) => ({
            ...v,
            [id]: { ...(v[id] ?? { id, label, gestartOp: Date.now() }), id, label, bezig: false, stap: "", resultaat, klaarOp: Date.now() },
          }));
        })
        .catch((e: unknown) => {
          setTaken((v) => ({
            ...v,
            [id]: {
              ...(v[id] ?? { id, label, gestartOp: Date.now() }),
              id,
              label,
              bezig: false,
              stap: "",
              fout: e instanceof Error ? e.message : String(e),
              klaarOp: Date.now(),
            },
          }));
        })
        .finally(() => {
          draaiend.current.delete(id);
          meldKlaar(id);
        });
    },
    [zetStap, meldKlaar]
  );

  const lees = useCallback(
    <T,>(id: string) => taken[id] as Taak<T> | undefined,
    [taken]
  );

  const wis = useCallback((id: string) => {
    setTaken((v) => {
      const n = { ...v };
      delete n[id];
      return n;
    });
  }, []);

  return (
    <AiTakenContext.Provider value={{ taken, start, lees, wis }}>
      {children}
      <TakenBalk taken={taken} netKlaar={netKlaar} />
    </AiTakenContext.Provider>
  );
}

export function useAiTaken(): Ctx {
  const ctx = useContext(AiTakenContext);
  if (!ctx) throw new Error("useAiTaken moet binnen AiTakenProvider gebruikt worden");
  return ctx;
}

/** Handige haak voor één opdracht. */
export function useAiTaak<T>(id: string) {
  const { start, lees, wis } = useAiTaken();
  return {
    taak: lees<T>(id),
    start: (label: string, fn: (stap: (t: string) => void) => Promise<T>) => start<T>(id, label, fn),
    wis: () => wis(id),
  };
}

/**
 * Melding onderin: wat draait er nu, en wat is er klaargekomen terwijl je elders
 * was. Zo weet je dat doorklikken veilig is en zie je bij terugkomst dat er iets
 * op je ligt te wachten.
 */
function TakenBalk({ taken, netKlaar }: { taken: Record<string, Taak>; netKlaar: string[] }) {
  const lijst = Object.values(taken);
  const bezig = lijst.filter((t) => t.bezig);
  const klaar = lijst.filter((t) => !t.bezig && netKlaar.includes(t.id));

  if (bezig.length === 0 && klaar.length === 0) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 flex flex-col gap-1.5"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)", zIndex: 9998, maxWidth: "calc(100vw - 32px)" }}
    >
      {bezig.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2.5 px-4 py-2.5"
          style={{ backgroundColor: "#001337", color: "#ffffff", boxShadow: "0 6px 24px rgba(0,19,55,0.28)" }}
        >
          <span
            className="inline-block rounded-full animate-spin flex-shrink-0"
            style={{
              width: 13,
              height: 13,
              border: "2px solid rgba(255,255,255,0.25)",
              borderTopColor: "#ffffff",
            }}
          />
          <span style={{ fontFamily: "var(--font-inter)", fontSize: 12.5 }}>
            {t.label}
            {t.stap ? ` — ${t.stap}` : "…"}
          </span>
        </div>
      ))}
      {bezig.length === 0 &&
        klaar.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2.5 px-4 py-2.5"
            style={{
              backgroundColor: t.fout ? "#fee2e2" : "#dcfce7",
              color: t.fout ? "#b91c1c" : "#15803d",
              boxShadow: "0 6px 24px rgba(0,19,55,0.18)",
            }}
          >
            <span style={{ fontFamily: "var(--font-inter)", fontSize: 12.5, fontWeight: 600 }}>
              {t.fout ? `${t.label} — mislukt` : `${t.label} — klaar`}
            </span>
          </div>
        ))}
    </div>
  );
}

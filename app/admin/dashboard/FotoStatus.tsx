"use client";

import { useEffect, useState } from "react";
import { ImageOff, RefreshCw, ExternalLink } from "lucide-react";

/**
 * Melding als de foto-opslag hapert.
 *
 * WAAROM
 * Toen de opslag geblokkeerd raakte, zag je in het beheer én op de website kapotte
 * plaatjes en verder niets. Niets vertelde dat de foto's er nog gewoon zijn, dat het niet
 * aan de auto's ligt, en dat het buiten dit dashboard opgelost moet worden. Zonder dat
 * verhaal ga je zoeken op de verkeerde plek.
 *
 * De melding controleert het zelf en verdwijnt vanzelf zodra de opslag weer levert. Er
 * staat geen knop op om iets te "repareren", want er valt hier niets te repareren — wel
 * waar je dan wél moet zijn.
 */

type Status = { ok: boolean; reden: string; extern: number; aantalAutos: number } | null;

export default function FotoStatus() {
  const [status, setStatus] = useState<Status>(null);
  const [bezig, setBezig] = useState(false);

  const controleer = async () => {
    setBezig(true);
    try {
      const res = await fetch("/api/admin/fotos/status", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } catch {
      /* Lukt de controle niet, dan zwijgt de melding — een storing over een storing helpt niemand. */
    } finally {
      setBezig(false);
    }
  };

  useEffect(() => {
    fetch("/api/admin/fotos/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, []);

  if (!status || status.ok) return null;

  return (
    <div
      className="mx-4 md:mx-8 mt-4 px-4 py-3.5 flex items-start gap-3"
      style={{ backgroundColor: "#fef3c7", border: "1px solid #fde68a" }}
    >
      <ImageOff size={16} style={{ color: "#b45309", flexShrink: 0, marginTop: 2 }} />
      <div className="min-w-0 flex-1">
        <p
          className="text-[13px] font-bold"
          style={{ color: "#92400e", fontFamily: "var(--font-inter)" }}
        >
          De foto&apos;s worden niet geleverd — {status.extern} foto&apos;s van {status.aantalAutos}{" "}
          {status.aantalAutos === 1 ? "auto" : "auto's"}, ook op de website
        </p>
        <p
          className="text-[12px] mt-1"
          style={{ color: "#92400e", fontFamily: "var(--font-inter)", lineHeight: 1.55 }}
        >
          {status.reden}{" "}De foto&apos;s zijn niet weg en de auto&apos;s kloppen gewoon; ze worden alleen
          niet uitgeleverd. Op de website staat er zolang een net vlak met de merkletters in plaats van
          een kapot plaatje.
        </p>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <a
            href="https://vercel.com/dashboard/stores"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold transition-all hover:opacity-80"
            style={{ backgroundColor: "#b45309", color: "#ffffff", fontFamily: "var(--font-inter)" }}
          >
            <ExternalLink size={11} /> Open de opslag bij Vercel
          </a>
          <button
            type="button"
            onClick={controleer}
            disabled={bezig}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold transition-all hover:opacity-70 disabled:opacity-40"
            style={{ color: "#92400e", fontFamily: "var(--font-inter)" }}
          >
            <RefreshCw size={11} className={bezig ? "animate-spin" : ""} />
            {bezig ? "Controleren…" : "Opnieuw controleren"}
          </button>
        </div>
      </div>
    </div>
  );
}

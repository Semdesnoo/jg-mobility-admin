"use client";

import { useEffect, useState } from "react";

/**
 * Zorgt dat het beheerpaneel als geïnstalleerde app zichzelf bijwerkt.
 *
 * Drie dingen gebeuren hier:
 *  1. De service worker wordt geregistreerd (die haalt pagina's netwerk-eerst op).
 *  2. Bij elke keer dat je de app opent of terugkeert wordt gecontroleerd of er een
 *     nieuwe versie klaarstaat — een geïnstalleerde app wordt zelden herladen, dus
 *     zonder deze controle kan hij dagen achterlopen.
 *  3. Staat er een nieuwe versie klaar, dan verschijnt er een balkje. Je vernieuwt op
 *     jouw moment; er wordt niets onder je handen weggetrokken terwijl je een bericht
 *     zit te typen.
 *
 * De registratie-URL krijgt het build-nummer mee. Zonder dat zou de browser het
 * sw.js-bestand als ongewijzigd kunnen beschouwen en nooit naar een update kijken.
 */

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

export default function AppBijwerken() {
  const [klaar, setKlaar] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let registratie: ServiceWorkerRegistration | null = null;
    let afgebroken = false;

    const letOpNieuweVersie = (reg: ServiceWorkerRegistration) => {
      // Staat er al eentje te wachten (app was dicht tijdens de vorige deploy)?
      if (reg.waiting && navigator.serviceWorker.controller) setKlaar(reg);

      reg.addEventListener("updatefound", () => {
        const nieuw = reg.installing;
        if (!nieuw) return;
        nieuw.addEventListener("statechange", () => {
          // 'installed' mét een bestaande controller betekent: dit is een update,
          // geen eerste installatie. Bij een eerste installatie is er niets te melden.
          if (nieuw.state === "installed" && navigator.serviceWorker.controller && !afgebroken) {
            setKlaar(reg);
          }
        });
      });
    };

    navigator.serviceWorker
      .register(`/sw.js?build=${encodeURIComponent(BUILD)}`)
      .then((reg) => {
        if (afgebroken) return;
        registratie = reg;
        letOpNieuweVersie(reg);
      })
      .catch(() => {
        /* Geen service worker beschikbaar (bijv. privémodus) — de app werkt gewoon door. */
      });

    // Zodra de nieuwe versie het overneemt, één keer herladen zodat je hem echt ziet.
    let herladen = false;
    const bijOvername = () => {
      if (herladen) return;
      herladen = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", bijOvername);

    // Terug in de app? Even kijken of er iets nieuws is.
    const bijTerugkeer = () => {
      if (document.visibilityState === "visible") registratie?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", bijTerugkeer);
    window.addEventListener("focus", bijTerugkeer);

    return () => {
      afgebroken = true;
      navigator.serviceWorker.removeEventListener("controllerchange", bijOvername);
      document.removeEventListener("visibilitychange", bijTerugkeer);
      window.removeEventListener("focus", bijTerugkeer);
    };
  }, []);

  if (!klaar) return null;

  return (
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5"
      style={{
        // Boven de systeembalk van iOS uit blijven.
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        zIndex: 9999,
        backgroundColor: "#001337",
        color: "#ffffff",
        boxShadow: "0 6px 24px rgba(0,19,55,0.28)",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      <span style={{ fontFamily: "var(--font-inter)", fontSize: 12.5, whiteSpace: "nowrap" }}>
        Nieuwe versie beschikbaar
      </span>
      <button
        type="button"
        onClick={() => {
          // De wachtende versie mag het overnemen; controllerchange herlaadt daarna.
          klaar.waiting?.postMessage("activeer-nu");
          // Neemt hij binnen twee seconden niet over, dan herladen we zelf.
          setTimeout(() => window.location.reload(), 2000);
        }}
        className="transition-all hover:opacity-80"
        style={{
          fontFamily: "var(--font-inter)",
          fontSize: 12,
          fontWeight: 600,
          padding: "5px 12px",
          backgroundColor: "#ffffff",
          color: "#001337",
          whiteSpace: "nowrap",
        }}
      >
        Vernieuwen
      </button>
    </div>
  );
}

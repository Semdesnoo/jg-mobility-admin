"use client";

import { useEffect, useRef } from "react";

/**
 * Scrollt zacht naar een paneel zodra het verschijnt.
 *
 * Zonder dit klap je een formulier open dat buiten beeld staat en moet je zelf
 * gaan zoeken waar het gebleven is. `block: "start"` met wat marge zet het net
 * onder de vaste kop.
 *
 * Respecteert `prefers-reduced-motion`: wie bewegingsanimaties uit heeft staan
 * krijgt een directe sprong in plaats van een vloeiende.
 */
export function useScrollNaar<T extends HTMLElement>(actief: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!actief || !ref.current) return;
    const minderBeweging = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Eén frame wachten zodat het paneel echt in de DOM staat en zijn hoogte heeft.
    const t = setTimeout(() => {
      ref.current?.scrollIntoView({
        behavior: minderBeweging ? "auto" : "smooth",
        block: "start",
      });
    }, 60);
    return () => clearTimeout(t);
  }, [actief]);

  return ref;
}

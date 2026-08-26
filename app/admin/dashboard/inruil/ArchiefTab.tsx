"use client";

import { useMemo, useState } from "react";
import { Archive, ChevronRight, Trash2, ArrowLeftRight } from "lucide-react";
import { T, num, klein, body, fmt, fmtKm, Btn, Empty, inputStijl } from "../inkoop/ui";
import { useDialoog } from "../Dialoog";
import ArchiefDetail from "./ArchiefDetail";
import type { InruilArchiefRij } from "./types";

/**
 * Terugkijken: wat is er wanneer voorgerekend, en aan wie.
 *
 * Geordend per kwartaal, net als het analyse-archief van de taxatietool, zodat het
 * dashboard op dat punt één gewoonte heeft en niet twee.
 *
 * Klik je op een regel, dan gaat hij helemaal open op een eigen pagina — met alle
 * bedragen, de voertuiggegevens en het aanbod waar de waarde destijds op rustte. Hier
 * stond eerst een uitklapper onder de regel, maar dat werd een propvol vakje waarin je
 * juist niet kon lezen wat er die dag was afgesproken, laat staan iets aanpassen.
 */

function datumTijd(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return (
    d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function InruilArchiefTab({
  rijen,
  onOpen,
  onBijgewerkt,
  onVerwijderd,
  onNieuw,
}: {
  /** Null zolang de lijst nog geladen wordt. */
  rijen: InruilArchiefRij[] | null;
  /** Deze inruil terugzetten in de rekenmachine. */
  onOpen: (r: InruilArchiefRij) => void;
  /** Op de detailpagina is er iets aangepast. */
  onBijgewerkt: (r: InruilArchiefRij) => void;
  onVerwijderd: (id: string) => void;
  onNieuw: () => void;
}) {
  const { vraag } = useDialoog();
  const [openId, setOpenId] = useState<string | null>(null);
  const [zoek, setZoek] = useState("");

  const gevonden = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    if (!z) return rijen ?? [];
    return (rijen ?? []).filter((r) =>
      `${r.klant} ${r.kenteken} ${r.merk} ${r.model} ${r.auto_naam}`.toLowerCase().includes(z)
    );
  }, [rijen, zoek]);

  // Per kwartaal, nieuwste bovenaan.
  const groepen = useMemo(() => {
    const map = new Map<string, { jaar: number; kwartaal: number; label: string; items: InruilArchiefRij[] }>();
    for (const r of gevonden) {
      const key = `${r.jaar}-Q${r.kwartaal}`;
      if (!map.has(key)) {
        map.set(key, { jaar: r.jaar, kwartaal: r.kwartaal, label: `${r.jaar} · Q${r.kwartaal}`, items: [] });
      }
      map.get(key)!.items.push(r);
    }
    for (const g of map.values()) g.items.sort((a, b) => (a.aangemaakt < b.aangemaakt ? 1 : -1));
    return [...map.values()].sort((a, b) => b.jaar - a.jaar || b.kwartaal - a.kwartaal);
  }, [gevonden]);

  const verwijder = async (r: InruilArchiefRij) => {
    const wat = [r.merk, r.model].filter(Boolean).join(" ") || "deze inruil";
    const akkoord = await vraag({
      titel: `Inruil van ${wat} verwijderen?`,
      tekst:
        [r.klant, r.kenteken ? r.kenteken.toUpperCase() : "", `bewaard op ${datumTijd(r.aangemaakt)}`]
          .filter(Boolean)
          .join(" · ") +
        "\n\nDe bedragen die je die dag hebt voorgerekend verdwijnen mee. Dit is niet ongedaan te maken.",
      bevestig: "Verwijderen",
      gevaar: true,
    });
    if (!akkoord) return;
    await fetch(`/api/admin/inruil/archief/${r.id}`, { method: "DELETE" });
    onVerwijderd(r.id);
  };

  // ── De pagina van één inruil ──
  // De regel komt uit de lijst en niet uit een kopie, zodat een wijziging op de
  // detailpagina meteen ook in de lijst erachter klopt.
  const geopend = openId ? (rijen ?? []).find((r) => r.id === openId) ?? null : null;
  if (geopend) {
    return (
      <ArchiefDetail
        key={geopend.id}
        rij={geopend}
        onTerug={() => setOpenId(null)}
        onBijgewerkt={onBijgewerkt}
        onVerwijderd={(id) => {
          setOpenId(null);
          onVerwijderd(id);
        }}
        onTerugzetten={onOpen}
      />
    );
  }

  if (rijen === null) {
    return (
      <div className="flex flex-col gap-2 py-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse" style={{ height: 56, backgroundColor: "rgba(0,19,55,0.05)" }} />
        ))}
      </div>
    );
  }

  if (rijen.length === 0) {
    return (
      <div style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}>
        <Empty
          icon={<Archive size={30} style={{ color: T.ink(0.15) }} />}
          title="Nog niets bewaard"
          body="Elke inruil die je doorrekent komt hier vanzelf te staan, geordend per kwartaal. Zo kun je later terugzien wat je die dag hebt voorgerekend — en wat de auto van die klant toen waard was."
        >
          <Btn onClick={onNieuw}>
            <ArrowLeftRight size={12} /> Naar de rekenmachine
          </Btn>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 style={{ fontFamily: T.play, fontWeight: 700, fontSize: 17, color: T.navy }}>Inruilarchief</h3>
          <p style={body(11.5, T.ink(0.45))}>
            {rijen.length} bewaarde inruil{rijen.length === 1 ? "" : "en"}
            {zoek.trim() && ` — ${gevonden.length} gevonden`} · klik een regel open om alles te zien
          </p>
        </div>
        <div className="ml-auto" style={{ minWidth: 200 }}>
          <input
            type="text"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek op klant of kenteken…"
            style={inputStijl}
          />
        </div>
      </div>

      {groepen.length === 0 && (
        <p className="py-6 text-center" style={klein()}>
          Niets gevonden voor &ldquo;{zoek}&rdquo;.
        </p>
      )}

      {groepen.map((g) => (
        <div key={g.label} style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}>
          <div
            className="px-4 md:px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
            style={{ borderBottom: `1px solid ${T.line}`, backgroundColor: "rgba(0,19,55,0.02)" }}
          >
            <span style={{ fontFamily: T.play, fontWeight: 700, fontSize: 15, color: T.navy }}>{g.label}</span>
            <span style={{ fontFamily: T.inter, fontSize: 11, color: T.ink(0.45) }}>
              {g.items.length} inruil{g.items.length === 1 ? "" : "en"}
            </span>
          </div>

          {g.items.map((r) => {
            const uit = r.verschil < 0;
            const zijnAuto = [r.merk, r.model].filter(Boolean).join(" ") || "Onbekende auto";
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 sm:gap-4 flex-wrap px-4 md:px-5"
                style={{ borderTop: `1px solid ${T.line}` }}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left py-3 transition-all hover:opacity-70"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate"
                      style={{ fontFamily: T.inter, fontWeight: 700, fontSize: 13.5, color: T.navy }}
                    >
                      {r.klant ? `${r.klant} — ` : ""}
                      {zijnAuto}
                      {r.auto_naam ? ` tegen ${r.auto_naam}` : ""}
                    </span>
                    <span className="block truncate" style={{ fontFamily: T.inter, fontSize: 11, color: T.ink(0.42) }}>
                      {[
                        r.kenteken ? r.kenteken.toUpperCase() : null,
                        r.bouwjaar || null,
                        r.km ? fmtKm(r.km) : null,
                        datumTijd(r.aangemaakt),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>

                  <span className="text-right flex-shrink-0" style={{ minWidth: 116 }}>
                    <span className="block" style={num(18, uit ? T.amber : T.navy)}>
                      {fmt(Math.abs(r.verschil))}
                    </span>
                    <span className="block" style={{ fontFamily: T.inter, fontSize: 9.5, color: T.ink(0.4) }}>
                      {uit ? "wij betaalden uit" : "klant betaalde bij"}
                    </span>
                  </span>

                  <ChevronRight size={16} style={{ color: T.ink(0.3), flexShrink: 0 }} />
                </button>

                <button
                  type="button"
                  onClick={() => verwijder(r)}
                  aria-label="Verwijderen"
                  className="px-2 py-1 transition-all hover:opacity-70 flex-shrink-0"
                  style={{ border: "1px solid rgba(185,28,28,0.25)", color: T.rood }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

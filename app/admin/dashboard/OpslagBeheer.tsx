"use client";

import { useEffect, useState } from "react";
import { HardDrive, Trash2, Car, RefreshCw } from "lucide-react";
import { useDialoog } from "./Dialoog";

/**
 * Hoeveel ruimte de foto's innemen, en wat eruit kan.
 *
 * WAAROM
 * De opslag liep vol en het eerste signaal was dat de foto's van de website verdwenen.
 * Een voorraad die groeit is geen probleem; niet kunnen zien dát hij groeit wel. Hier
 * staat wat erin zit, verdeeld over wat er nog toe doet en wat er alleen maar ligt.
 *
 * De twee opruimknoppen vragen eerst wat ze zouden doen en verwijderen pas na een
 * bevestiging met exacte aantallen. Verwijderen kan niet ongedaan gemaakt worden, dus je
 * hoort van tevoren te weten hoeveel en waarvan.
 */

type Groep = { aantal: number; bytes: number };
type Opslag = {
  bereikbaar: boolean;
  fout?: string;
  compleet?: boolean;
  totaal?: { aantal: number; bytes: number };
  limiet_bytes?: number;
  groepen?: { voorraad: Groep; verkocht: Groep; wezen: Groep; recent: Groep };
  onverkleind?: Groep;
  te_verwijderen_bij_verkocht?: number;
  houden_bij_verkocht?: number;
  wees_rijptijd_dagen?: number;
};

const mb = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : `${Math.round(b / 1024 / 1024)} MB`);

export default function OpslagBeheer() {
  const { vraag, melden } = useDialoog();
  const [d, setD] = useState<Opslag | null>(null);
  const [bezig, setBezig] = useState<string | null>(null);

  const laad = async () => {
    try {
      const res = await fetch("/api/admin/fotos/opslag", { cache: "no-store" });
      if (res.ok) setD(await res.json());
    } catch {
      /* stil: een melding over een mislukte meting helpt niemand */
    }
  };

  useEffect(() => {
    fetch("/api/admin/fotos/opslag", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => x && setD(x))
      .catch(() => {});
  }, []);

  // Niets te melden zolang de opslag onbereikbaar is: dáár gaat de melding erboven al over.
  if (!d || !d.bereikbaar || !d.groepen || !d.totaal) return null;

  const limiet = d.limiet_bytes ?? 1024 ** 3;
  const pct = Math.min(100, Math.round((d.totaal.bytes / limiet) * 100));
  const kleur = pct >= 85 ? "#b91c1c" : pct >= 60 ? "#b45309" : "#15803d";

  const ruimOp = async (soort: "wezen" | "verkocht") => {
    setBezig(soort);
    try {
      // Eerst kijken wat het zou doen. Pas daarna, en pas na een uitdrukkelijk ja.
      const voorstel = await fetch("/api/admin/fotos/opslag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soort }),
      }).then((r) => r.json());

      if (voorstel.error) {
        await melden({ titel: "Opruimen lukte niet", tekst: voorstel.error });
        return;
      }
      if (!voorstel.aantal) {
        await melden({
          titel: "Er valt niets op te ruimen",
          tekst:
            soort === "wezen"
              ? "Er liggen geen foto's die nergens meer bij horen."
              : "Geen enkele verkochte auto heeft meer foto's dan nodig.",
        });
        return;
      }

      const akkoord = await vraag({
        titel:
          soort === "wezen"
            ? `${voorstel.aantal} losse foto's verwijderen?`
            : `${voorstel.aantal} foto's van verkochte auto's verwijderen?`,
        tekst:
          soort === "wezen"
            ? `Deze bestanden horen bij geen enkele auto meer — overblijfsels van vervangen foto's en verwijderde auto's. Ze zijn minstens ${d.wees_rijptijd_dagen} dagen oud, dus een upload van vandaag zit er niet tussen. Dit maakt ${mb(voorstel.bytes ?? 0)} vrij.\n\nDit is niet ongedaan te maken.`
            : `Van elke verkochte auto blijven de eerste ${d.houden_bij_verkocht} foto's staan; de rest gaat weg. Die auto's blijven met foto op de website staan, alleen zonder de hele reeks.\n\n${(voorstel.autos ?? [])
                .slice(0, 6)
                .map((a: { naam: string; van: number; naar: number }) => `${a.naam}: ${a.van} → ${a.naar}`)
                .join("\n")}${(voorstel.autos?.length ?? 0) > 6 ? `\n… en nog ${voorstel.autos.length - 6}` : ""}\n\nDit is niet ongedaan te maken.`,
        bevestig: "Verwijderen",
        gevaar: true,
      });
      if (!akkoord) return;

      const uit = await fetch("/api/admin/fotos/opslag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soort, bevestigd: true }),
      }).then((r) => r.json());

      await laad();
      await melden({
        titel: uit.klaar === false ? "Deels opgeruimd" : "Opgeruimd",
        tekst:
          uit.klaar === false
            ? `${uit.verwijderd} foto's verwijderd. Er waren er meer dan in één ronde passen — druk nog een keer om verder te gaan.`
            : `${uit.verwijderd} foto's verwijderd.`,
      });
    } catch (e) {
      await melden({ titel: "Opruimen lukte niet", tekst: e instanceof Error ? e.message : String(e) });
    } finally {
      setBezig(null);
    }
  };

  const rijen: { label: string; groep: Groep; toon: string }[] = [
    { label: "Auto's op voorraad", groep: d.groepen.voorraad, toon: "#001337" },
    { label: "Verkochte auto's", groep: d.groepen.verkocht, toon: "#b45309" },
    { label: "Hoort nergens meer bij", groep: d.groepen.wezen, toon: "#b91c1c" },
    { label: "Net geüpload", groep: d.groepen.recent, toon: "rgba(0,19,55,0.35)" },
  ];

  return (
    <div className="mx-4 md:mx-8 mt-4" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.08)" }}>
      <div
        className="px-4 md:px-5 py-3 flex items-center gap-2.5"
        style={{ borderBottom: "1px solid rgba(0,19,55,0.07)", backgroundColor: "rgba(0,19,55,0.015)" }}
      >
        <HardDrive size={14} style={{ color: "rgba(0,19,55,0.4)" }} />
        <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
          Foto-opslag
        </h3>
        <span className="text-[11px]" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
          {d.totaal.aantal} foto&apos;s · {mb(d.totaal.bytes)}
        </span>
        <button
          type="button"
          onClick={laad}
          className="ml-auto p-1.5 transition-all hover:opacity-60"
          aria-label="Opnieuw meten"
        >
          <RefreshCw size={12} style={{ color: "rgba(0,19,55,0.4)" }} />
        </button>
      </div>

      <div className="p-4 md:p-5">
        {/* De meter */}
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}
          >
            Gebruikt van het gratis pakket
          </span>
          <span
            className="text-sm font-bold"
            style={{ color: kleur, fontFamily: "var(--font-playfair)", fontVariantNumeric: "tabular-nums" }}
          >
            {pct}% · {mb(d.totaal.bytes)} van {mb(limiet)}
          </span>
        </div>
        <div style={{ height: 8, backgroundColor: "rgba(0,19,55,0.07)" }}>
          <div style={{ width: `${pct}%`, height: "100%", backgroundColor: kleur, transition: "width .4s ease" }} />
        </div>

        {/* Waar het in zit */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {rijen.map((r) => (
            <div key={r.label} className="p-3" style={{ backgroundColor: "rgba(0,19,55,0.02)", border: "1px solid rgba(0,19,55,0.06)" }}>
              <p
                className="text-[9px] font-bold uppercase tracking-wider truncate"
                style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}
              >
                {r.label}
              </p>
              <p className="mt-1 text-lg font-bold" style={{ color: r.toon, fontFamily: "var(--font-playfair)" }}>
                {mb(r.groep.bytes)}
              </p>
              <p className="text-[10px]" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                {r.groep.aantal} foto&apos;s
              </p>
            </div>
          ))}
        </div>

        {d.onverkleind && d.onverkleind.aantal > 0 && (
          <p className="mt-3 text-[11.5px]" style={{ color: "rgba(0,19,55,0.6)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
            <strong>{d.onverkleind.aantal} foto&apos;s</strong> staan nog op volledige grootte, samen{" "}
            {mb(d.onverkleind.bytes)}. Verkleinen brengt dat terug naar ongeveer een tiende — dat is de
            grootste winst die hier te halen valt, en de knop ervoor staat hierboven.
          </p>
        )}

        {/* Opruimen */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <button
            type="button"
            onClick={() => ruimOp("wezen")}
            disabled={bezig !== null || d.groepen.wezen.aantal === 0}
            className="inline-flex items-center gap-2 px-3 py-2 text-[11.5px] font-semibold transition-all hover:opacity-85 disabled:opacity-35"
            style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
          >
            <Trash2 size={12} />
            {bezig === "wezen" ? "Bezig…" : `Ruim ${d.groepen.wezen.aantal} losse foto's op`}
          </button>
          <button
            type="button"
            onClick={() => ruimOp("verkocht")}
            disabled={bezig !== null || !d.te_verwijderen_bij_verkocht}
            className="inline-flex items-center gap-2 px-3 py-2 text-[11.5px] font-semibold transition-all hover:opacity-85 disabled:opacity-35"
            style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
          >
            <Car size={12} />
            {bezig === "verkocht"
              ? "Bezig…"
              : `Verkochte auto's terug naar ${d.houden_bij_verkocht} foto's (${d.te_verwijderen_bij_verkocht ?? 0})`}
          </button>
        </div>

        <p className="mt-3 text-[10.5px]" style={{ color: "rgba(0,19,55,0.42)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
          Losse foto&apos;s zijn bestanden waar geen enkele auto meer naar verwijst — wat er overblijft als
          je een foto vervangt of een auto verwijdert. Er wordt nooit iets weggegooid waar nog een auto aan
          hangt, en een bestand moet minstens {d.wees_rijptijd_dagen} dagen oud zijn. Allebei de knoppen
          laten eerst zien wat ze zouden doen.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart2, Check, Clock, Gauge, History, Info, Plus, RotateCcw, Search, X,
} from "lucide-react";
import {
  T, num, micro, body, fmt, fmtGetal, fmtKm, scoreKleur,
  Panel, SectionRule, Meter, Segments, Pill, TrendBadge, ScoreRing,
  Field, inputStijl, Btn, Chip, Spinner, Foutmelding, PanelVoet,
  Th, Td, TabelWrap, rijStijl,
} from "./ui";
import { berekenKoerslijst, weging } from "./koerslijst";
import type { InkoopDossier, PrestatiesData, RdwData, TaxatieResultaat, Vergelijkbaar } from "./types";

type TabId = "taxatie" | "markt" | "prestaties" | "dossiers";

/**
 * Wat de marktscan doet. Dit is bewust een beschrijving en géén afvinklijst:
 * de API meldt geen tussenstand, dus we weten niet welk platform op welk moment
 * klaar is. Een tijdgestuurde reeks vinkjes zou status verzinnen.
 */
const SCAN_OMVAT = [
  "Vergelijkbaar aanbod op Marktplaats, AutoScout24 en Gaspedaal",
  "Filteren op bouwjaar, uitvoering en kilometerstand",
  "Prijsspreiding en marktgemiddelde bepalen",
  "Wegen tegen de koerslijst en het inkoopadvies opstellen",
];

const KOSTEN_PRESETS = [
  { label: "Poetsen", bedrag: 250 },
  { label: "Klein onderhoud", bedrag: 500 },
  { label: "Banden / APK", bedrag: 1000 },
  { label: "Schadeherstel", bedrag: 1500 },
];

const MARGE_PRESETS = [8, 10, 12, 15, 20];

export default function TaxatieTab({
  dossiers,
  prestaties,
  onOpgeslagen,
  onTab,
}: {
  dossiers: InkoopDossier[] | null;
  prestaties: PrestatiesData | null;
  onOpgeslagen: () => Promise<void> | void;
  onTab: (tab: TabId) => void;
}) {
  const [kenteken, setKenteken] = useState("");
  const [rdw, setRdw] = useState<RdwData | null>(null);
  const [rdwLaden, setRdwLaden] = useState(false);
  const [rdwFout, setRdwFout] = useState<string | null>(null);
  const [km, setKm] = useState("");
  const [marge, setMarge] = useState(10);
  const [kosten, setKosten] = useState(0);
  const [posten, setPosten] = useState<{ id: number; label: string; bedrag: number }[]>([]);
  const [laden, setLaden] = useState(false);
  const [scanStap, setScanStap] = useState(0);
  const [resultaat, setResultaat] = useState<TaxatieResultaat | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [opgeslagen, setOpgeslagen] = useState(false);
  const [sorteer, setSorteer] = useState<{ kolom: "prijs" | "km" | "bouwjaar"; op: boolean }>({ kolom: "prijs", op: true });

  const kmNum = parseInt(km.replace(/\D/g, "")) || 0;
  const preview = useMemo(
    () => berekenKoerslijst(rdw?.bouwjaar, rdw?.catalogusprijs, kmNum),
    [rdw?.bouwjaar, rdw?.catalogusprijs, kmNum]
  );

  // Verstreken tijd tijdens de scan. Een eerlijke maat: we weten hoe lang het duurt,
  // niet hoe ver het is. De teller start bij 0 in analyseer().
  useEffect(() => {
    if (!laden) return;
    const t = setInterval(() => setScanStap((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [laden]);

  const rdwOpzoeken = async (raw: string) => {
    const k = raw.trim();
    if (!k) return;
    setRdwLaden(true);
    setRdwFout(null);
    setRdw(null);
    setResultaat(null);
    try {
      const res = await fetch(`/api/admin/rdw-lookup?kenteken=${encodeURIComponent(k)}`);
      if (res.ok) {
        const d = await res.json();
        if (d.merk) setRdw(d);
        else setRdwFout("Kenteken niet gevonden in het RDW-register");
      } else {
        setRdwFout("RDW-opzoeking mislukt");
      }
    } catch {
      setRdwFout("RDW-opzoeking mislukt");
    }
    setRdwLaden(false);
  };

  const analyseer = async () => {
    if (!rdw) return;
    setLaden(true);
    setScanStap(0);
    setFout(null);
    setResultaat(null);
    try {
      const res = await fetch("/api/admin/inkoop/taxeer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merk: rdw.merk, model: rdw.model, bouwjaar: rdw.bouwjaar,
          // Genormaliseerd naar cijfers: de server doet parseInt, en die maakt van
          // "125.000" anders 125 — wat de hele waardebepaling zou vertekenen.
          km: String(kmNum), brandstof: rdw.brandstof, vermogen: rdw.vermogen, bodytype: rdw.bodytype,
          catalogusprijs: rdw.catalogusprijs,
          gewenste_marge: marge,
          geschatte_kosten: kosten,
        }),
      });
      if (res.ok) {
        const uit: TaxatieResultaat = await res.json();
        setResultaat(uit);
        // Elke analyse gaat automatisch het archief in (per kwartaal bewaard), zodat
        // je altijd terug kunt naar wat de tool op dat moment adviseerde. Fire-and-
        // forget: mislukt het archiveren, dan mag dat de taxatie niet blokkeren.
        fetch("/api/admin/inkoop/archief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kenteken, merk: rdw.merk, model: rdw.model, bouwjaar: rdw.bouwjaar,
            km: kmNum, marge, kosten,
            max_inkoop: uit.berekening.max_inkoop,
            verwachte_verkoop: uit.berekening.verwachte_verkoop,
            betrouwbaarheid: uit.markt.betrouwbaarheid ?? "",
            resultaat: uit,
          }),
        }).catch(() => {});
      } else {
        const d = await res.json().catch(() => ({}));
        setFout(d.error ?? "Analyse mislukt");
      }
    } catch {
      setFout("Analyse mislukt — controleer de verbinding");
    }
    setLaden(false);
  };

  const slaOp = async () => {
    if (!rdw || !resultaat) return;
    await fetch("/api/admin/inkoop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kenteken, merk: rdw.merk, model: rdw.model, bouwjaar: String(rdw.bouwjaar),
        // Alleen cijfers opslaan — "125.000" of "125 000" moet als 125000 in de database komen,
        // anders leest de Dossiers-tab er 125 van.
        km: String(kmNum), kleur: rdw.kleur, brandstof: rdw.brandstof,
        aanbod_prijs: resultaat.markt.gemiddelde_prijs,
        bod_prijs: resultaat.berekening.max_inkoop,
        status: "nieuw",
        notitie:
          `Markt: gemiddeld ${fmt(resultaat.markt.gemiddelde_prijs)}, ${resultaat.markt.aantal_aanbod} stuks aanbod. ` +
          `Max inkoop ${fmt(resultaat.berekening.max_inkoop)} bij ${marge}% marge en ${fmt(kosten)} kosten.`,
      }),
    });
    setOpgeslagen(true);
    await onOpgeslagen();
    setTimeout(() => setOpgeslagen(false), 3000);
  };

  const reset = () => {
    setResultaat(null); setRdw(null); setKenteken(""); setKm("");
    setFout(null); setRdwFout(null); setKosten(0); setPosten([]);
  };

  const voegKostenToe = (label: string, bedrag: number) => {
    setPosten((p) => [...p, { id: Date.now() + Math.random(), label, bedrag }]);
    setKosten((k) => k + bedrag);
  };

  const verwijderPost = (id: number, bedrag: number) => {
    setPosten((p) => p.filter((x) => x.id !== id));
    setKosten((k) => Math.max(0, k - bedrag));
  };

  const b = resultaat?.berekening;
  const m = resultaat?.markt;

  // ── De waardeketen ──────────────────────────────────────────────
  const catalogus = preview?.catalogus ?? b?.catalogusprijs ?? 0;
  const koerslijst = preview?.koerslijst ?? b?.koerslijst_waarde ?? 0;
  const marktWaarde = b?.markt_waarde ?? 0;
  const verkoop = b?.verwachte_verkoop ?? 0;
  const maxInkoop = b?.max_inkoop ?? 0;
  const schaal = Math.max(catalogus, verkoop, marktWaarde, koerslijst, 1);
  const w = weging(m?.aantal_gevonden ?? 0, marktWaarde > 0, koerslijst > 0);

  type Schakel = {
    nr: string; titel: string; uitleg: string;
    bedrag: number | null; van: number; tot: number;
    kleur: string; chip?: { tekst: string; kleur: string };
    subtotaal?: boolean;
    /** Waar deze schakel op wacht — de eerste vier hangen aan de RDW-kant, de rest aan de scan. */
    wachtOp?: string;
  };

  // De koerslijst-schakels wachten op het kenteken en de stand, niet op de marktscan.
  const wachtRdw = !rdw
    ? "wacht op kenteken"
    : !rdw.catalogusprijs
      ? "geen nieuwprijs bekend in het RDW"
      : kmNum === 0
        ? "wacht op kilometerstand"
        : undefined;

  const keten: Schakel[] = [
    {
      wachtOp: wachtRdw, nr: "01", titel: "Nieuwprijs", uitleg: "Catalogusprijs bij aflevering · bron RDW",
      bedrag: catalogus || null, van: 0, tot: catalogus, kleur: T.ink(0.45),
    },
    {
      wachtOp: wachtRdw, nr: "02", titel: "Afschrijving",
      uitleg: preview ? `${preview.leeftijd} jaar oud · gemiddelde afschrijvingscurve` : "Afschrijving naar leeftijd",
      bedrag: preview ? -preview.afschrijving : null,
      van: preview?.naAfschrijving ?? 0, tot: catalogus, kleur: T.rood,
      chip: preview ? { tekst: `−${preview.afschrijvingPct}%`, kleur: T.rood } : undefined,
    },
    {
      wachtOp: wachtRdw, nr: "03", titel: "Kilometercorrectie",
      uitleg: preview && kmNum > 0
        ? `${fmtKm(kmNum)} tegenover ${fmtKm(preview.verwachtKm)} verwacht`
        : "Correctie op de stand ten opzichte van het gemiddelde",
      bedrag: preview && kmNum > 0 ? preview.kmCorrectie : null,
      van: Math.min(preview?.naAfschrijving ?? 0, preview?.koerslijst ?? 0),
      tot: Math.max(preview?.naAfschrijving ?? 0, preview?.koerslijst ?? 0),
      kleur: (preview?.kmCorrectie ?? 0) >= 0 ? T.groen : T.rood,
      chip: preview && kmNum > 0
        ? { tekst: `${preview.kmAfwijkingPct > 0 ? "+" : ""}${preview.kmAfwijkingPct}% km`, kleur: preview.kmAfwijkingPct <= 0 ? T.groen : T.amber }
        : undefined,
    },
    {
      wachtOp: wachtRdw, nr: "04", titel: "Koerslijstwaarde", uitleg: "JG koerslijst — nieuwprijs, afschrijving en kilometerstand",
      bedrag: koerslijst || null, van: 0, tot: koerslijst, kleur: T.paars, subtotaal: true,
    },
    {
      wachtOp: "wacht op marktdata", nr: "05", titel: "Live marktwaarde",
      uitleg: m
        ? `${m.aantal_gevonden ?? m.vergelijkbare?.length ?? 0} advertenties · spreiding ${fmt(m.min_prijs)} – ${fmt(m.max_prijs)}`
        : "Gemiddelde van werkelijk gevonden advertenties",
      bedrag: marktWaarde || null, van: 0, tot: marktWaarde, kleur: T.teal,
    },
    {
      wachtOp: "wacht op marktdata", nr: "06", titel: "Geadviseerde verkoopprijs",
      uitleg: b
        ? `Gewogen: ${Math.round(w.koerslijst * 100)}% koerslijst · ${Math.round(w.markt * 100)}% live markt`
        : "Gewogen combinatie van koerslijst en live markt",
      bedrag: verkoop || null, van: 0, tot: verkoop, kleur: T.navy, subtotaal: true,
    },
    {
      wachtOp: "wacht op marktdata", nr: "07", titel: "Marge en kosten",
      uitleg: `− ${marge}% gewenste marge · − ${fmt(kosten)} geschatte kosten`,
      bedrag: b ? -(verkoop - maxInkoop) : null,
      van: maxInkoop, tot: verkoop, kleur: T.rood,
    },
  ];

  const klaarVoorAnalyse = !!rdw && kmNum > 0;

  // Voorlopig bod: zodra de koerslijst rond is kan de max inkoop al berekend worden,
  // puur op RDW-nieuwprijs en afschrijving. De marktscan verfijnt dat later — maar de
  // dealer heeft aan de stoeprand meteen een verdedigbaar getal in plaats van "€ —".
  const voorlopigBod = !b && preview && kmNum > 0
    ? Math.max(0, Math.round(preview.koerslijst * (1 - marge / 100) - kosten))
    : 0;
  const toonBod = maxInkoop > 0 ? maxInkoop : voorlopigBod;
  const isVoorlopig = maxInkoop === 0 && voorlopigBod > 0;
  const eigenMerk = rdw && prestaties
    ? prestaties.merk_stats.find((s) => s.merk.toUpperCase() === rdw.merk.toUpperCase())
    : undefined;

  const advertenties: Vergelijkbaar[] = useMemo(() => {
    const lijst = [...(m?.vergelijkbare ?? [])];
    const { kolom, op } = sorteer;
    lijst.sort((x, y) => {
      const a = kolom === "prijs" ? x.prijs : kolom === "km" ? x.km ?? 0 : x.bouwjaar ?? 0;
      const c = kolom === "prijs" ? y.prijs : kolom === "km" ? y.km ?? 0 : y.bouwjaar ?? 0;
      return op ? a - c : c - a;
    });
    return lijst;
  }, [m?.vergelijkbare, sorteer]);

  const sorteerOp = (kolom: "prijs" | "km" | "bouwjaar") =>
    setSorteer((s) => ({ kolom, op: s.kolom === kolom ? !s.op : true }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* ══ RAIL ══════════════════════════════════════════════════ */}
      <aside
        className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4 self-start lg:sticky"
        style={{ top: T.chrome + 16 }}
      >
        {/* Stap 1 — voertuig */}
        <Panel title="Stap 1 · Voertuig" icon={<Search size={13} style={{ color: T.ink(0.35) }} />}>
          <div className="relative">
            <span
              className="absolute left-0 top-0 bottom-0 flex items-center justify-center"
              style={{ width: 22, backgroundColor: T.blauw }}
            >
              <span style={{ ...micro("#ffffff"), fontSize: 7, writingMode: "vertical-rl" }}>NL</span>
            </span>
            <input
              type="text"
              value={kenteken}
              placeholder="AB-123-C"
              onChange={(e) => setKenteken(e.target.value.toUpperCase())}
              onBlur={(e) => rdwOpzoeken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && rdwOpzoeken(kenteken)}
              style={{
                ...inputStijl,
                height: 50,
                paddingLeft: 34,
                paddingRight: 34,
                textAlign: "center",
                fontFamily: T.play,
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "0.1em",
                backgroundColor: "#fdfdfd",
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {rdwLaden ? <Spinner size={15} /> : rdw ? <Check size={16} style={{ color: T.groen }} /> : null}
            </span>
          </div>

          <p className="mt-2" style={{ fontFamily: T.inter, fontSize: 10.5, color: rdwFout ? T.rood : T.ink(0.4) }}>
            {rdwFout
              ? rdwFout
              : rdwLaden
                ? "RDW-register raadplegen…"
                : rdw
                  ? "Voertuiggegevens opgehaald"
                  : "Voer een kenteken in — de gegevens komen automatisch uit het RDW"}
          </p>

          {rdw && (
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${T.line}` }}>
              <p style={{ fontFamily: T.play, fontSize: 17, fontWeight: 700, color: T.navy }}>
                {rdw.merk} {rdw.model}
              </p>
              <p className="mt-0.5 mb-3" style={{ fontFamily: T.inter, fontSize: 11, color: T.ink(0.45) }}>
                {[rdw.bouwjaar, rdw.brandstof, rdw.bodytype, rdw.kleur].filter(Boolean).join(" · ")}
              </p>
              <dl className="flex flex-col">
                {([
                  ["Vermogen", rdw.vermogen],
                  ["APK tot", rdw.apk],
                  ["Nieuwprijs", rdw.catalogusprijs ? fmt(rdw.catalogusprijs) : "onbekend"],
                ] as [string, string][])
                  .filter(([, v]) => v)
                  .map(([l, v], i) => (
                    <div
                      key={l}
                      className="flex items-baseline justify-between gap-3 py-1.5"
                      style={{
                        borderTop: i > 0 ? `1px solid ${T.line}` : undefined,
                        backgroundColor: l === "Nieuwprijs" ? "rgba(124,58,237,0.05)" : undefined,
                        paddingLeft: l === "Nieuwprijs" ? 6 : 0,
                        borderLeft: l === "Nieuwprijs" ? `2px solid ${T.paars}` : undefined,
                      }}
                    >
                      <dt style={micro()}>{l}</dt>
                      <dd style={{ fontFamily: T.inter, fontSize: 11.5, fontWeight: 600, color: T.navy }}>{v}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}
        </Panel>

        {/* Stap 2 — stand en marge */}
        <Panel title="Stap 2 · Stand, marge en kosten" icon={<Gauge size={13} style={{ color: T.ink(0.35) }} />}>
          <div className="flex flex-col gap-4">
            <Field
              label="Kilometerstand"
              suffix="km"
              hint={
                preview && kmNum > 0
                  ? `≈ ${fmtGetal(preview.kmPerJaar)} km per jaar — ${
                      preview.kmAfwijkingPct <= -15 ? "duidelijk onder gemiddeld"
                      : preview.kmAfwijkingPct <= 5 ? "rond het gemiddelde"
                      : preview.kmAfwijkingPct <= 25 ? "bovengemiddeld"
                      : "fors bovengemiddeld"
                    }`
                  : "Zelf invullen — de stand staat niet in het RDW-register"
              }
              hintColor={
                preview && kmNum > 0
                  ? preview.kmAfwijkingPct <= 5 ? T.groen : preview.kmAfwijkingPct <= 25 ? T.amber : T.rood
                  : T.amber
              }
            >
              <input
                type="text"
                inputMode="numeric"
                value={km}
                placeholder="85000"
                onChange={(e) => setKm(e.target.value)}
                style={{ ...inputStijl, paddingRight: 34, fontFamily: T.play, fontSize: 16, fontWeight: 700 }}
              />
            </Field>

            <div>
              <p className="mb-1.5" style={micro()}>Gewenste marge</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {MARGE_PRESETS.map((p) => (
                  <Chip key={p} active={marge === p} onClick={() => setMarge(p)}>
                    {p}%
                  </Chip>
                ))}
                <input
                  type="number"
                  value={marge}
                  min={1}
                  max={60}
                  onChange={(e) => setMarge(Math.max(1, Math.min(60, Number(e.target.value) || 0)))}
                  style={{ ...inputStijl, width: 62, padding: "5px 8px", fontFamily: T.play, fontWeight: 700, textAlign: "center" }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p style={micro()}>Geschatte kosten</p>
                {kosten > 0 && (
                  <button
                    type="button"
                    onClick={() => { setKosten(0); setPosten([]); }}
                    className="flex items-center gap-1 transition-all hover:opacity-60"
                    style={{ fontFamily: T.inter, fontSize: 10, color: T.ink(0.4) }}
                  >
                    <RotateCcw size={9} /> wissen
                  </button>
                )}
              </div>
              <input
                type="number"
                value={kosten}
                step={50}
                min={0}
                onChange={(e) => setKosten(Math.max(0, Number(e.target.value) || 0))}
                style={{ ...inputStijl, fontFamily: T.play, fontSize: 15, fontWeight: 700 }}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {KOSTEN_PRESETS.map((p) => (
                  <Chip key={p.label} onClick={() => voegKostenToe(p.label, p.bedrag)}>
                    <Plus size={9} /> {p.label} {p.bedrag}
                  </Chip>
                ))}
              </div>
              {posten.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {posten.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => verwijderPost(p.id, p.bedrag)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 transition-all hover:opacity-60"
                      style={{ fontFamily: T.inter, fontSize: 10, color: T.navy, backgroundColor: "rgba(0,19,55,0.06)" }}
                    >
                      {p.label} {fmt(p.bedrag)} <X size={9} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Btn variant="primair" size="lg" full disabled={!klaarVoorAnalyse || laden} onClick={analyseer}>
              {laden ? <><Spinner size={14} tone="donker" /> Markt analyseren…</> : <><BarChart2 size={15} /> Analyseer markt</>}
            </Btn>
            <p className="-mt-2" style={{ fontFamily: T.inter, fontSize: 10, color: T.ink(0.35), lineHeight: 1.5 }}>
              {klaarVoorAnalyse
                ? "Doorzoekt Marktplaats, AutoScout24 en Gaspedaal · 20-45 seconden"
                : !rdw ? "Vul eerst een kenteken in" : "Vul de kilometerstand in om te kunnen analyseren"}
            </p>
          </div>
        </Panel>

        {/* Rail-voet — houdt de onderkant gevuld met echte context */}
        <Panel
          title="Laatste taxaties"
          icon={<History size={13} style={{ color: T.ink(0.35) }} />}
          meta={dossiers ? `${dossiers.length} totaal` : undefined}
          flush
        >
          {dossiers === null ? (
            <div className="p-4 flex flex-col gap-2">
              {[0, 1, 2].map((i) => <div key={i} className="animate-pulse" style={{ height: 14, backgroundColor: "rgba(0,19,55,0.06)" }} />)}
            </div>
          ) : dossiers.length === 0 ? (
            <p className="p-4" style={body(11.5, T.ink(0.4))}>
              Nog geen opgeslagen taxaties. Zodra u een analyse opslaat verschijnt die hier.
            </p>
          ) : (
            <div className="flex flex-col">
              {dossiers.slice(0, 5).map((d, i) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onTab("dossiers")}
                  className="flex items-center justify-between gap-2 px-4 py-2 text-left transition-all hover:bg-gray-50"
                  style={{ borderTop: i > 0 ? `1px solid ${T.line}` : undefined }}
                >
                  <span className="min-w-0">
                    <span className="block truncate" style={{ fontFamily: T.inter, fontSize: 11.5, fontWeight: 600, color: T.navy }}>
                      {d.merk} {d.model}
                    </span>
                    <span className="block truncate" style={{ fontFamily: T.inter, fontSize: 9.5, color: T.ink(0.35) }}>
                      {d.kenteken || d.datum}
                    </span>
                  </span>
                  {d.bod_prijs > 0 && <span style={num(13)}>{fmt(d.bod_prijs)}</span>}
                </button>
              ))}
            </div>
          )}
        </Panel>
      </aside>

      {/* ══ CANVAS ════════════════════════════════════════════════ */}
      <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-4 min-w-0">
        {fout && <Foutmelding>{fout}</Foutmelding>}

        {/* ── Uitslagbalk ── */}
        <div style={{ backgroundColor: T.navy, border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex flex-col xl:flex-row xl:items-stretch">
            <div className="flex-1 min-w-0 p-5 md:p-6">
              <div className="flex items-center gap-2.5 flex-wrap">
                <p style={micro("rgba(255,255,255,0.45)")}>Maximale inkoopprijs</p>
                {isVoorlopig && (
                  <Pill color="#fbbf24" bg="rgba(251,191,36,0.16)">voorlopig · koerslijst</Pill>
                )}
              </div>
              <p className="mt-2" style={num(toonBod > 0 ? 54 : 44, toonBod > 0 ? (isVoorlopig ? "rgba(255,255,255,0.82)" : "#ffffff") : "rgba(255,255,255,0.22)")}>
                {toonBod > 0 ? fmt(toonBod) : "€ —"}
              </p>
              <p className="mt-2.5" style={{ fontFamily: T.inter, fontSize: 11.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                {b
                  ? `Bij ${b.gewenste_marge}% marge en ${fmt(b.geschatte_kosten)} kosten · verwachte verkoop ${fmt(b.verwachte_verkoop)}`
                  : isVoorlopig
                    ? `Alleen op basis van de koerslijst, bij ${marge}% marge en ${fmt(kosten)} kosten. De marktscan verfijnt dit met het werkelijke aanbod.`
                    : rdw
                      ? `${rdw.merk} ${rdw.model} ${rdw.bouwjaar} — vul de kilometerstand in voor een eerste bod`
                      : "Het bedrag dat u maximaal kunt bieden om uw marge te halen"}
              </p>

              {/* Voortgang naar een compleet advies */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-4">
                {[
                  { label: "Kenteken / RDW", klaar: !!rdw },
                  { label: "Kilometerstand", klaar: kmNum > 0 },
                  { label: "Marktdata", klaar: !!b, bezig: laden },
                ].map((s) => (
                  <span key={s.label} className="inline-flex items-center gap-1.5">
                    {s.bezig ? (
                      <Spinner size={10} tone="donker" />
                    ) : (
                      <span
                        className="inline-flex items-center justify-center rounded-full"
                        style={{
                          width: 12, height: 12,
                          border: `1.5px solid ${s.klaar ? "#4ade80" : "rgba(255,255,255,0.3)"}`,
                          backgroundColor: s.klaar ? "#4ade80" : "transparent",
                        }}
                      >
                        {s.klaar && <Check size={8} strokeWidth={4} style={{ color: T.navy }} />}
                      </span>
                    )}
                    <span style={{ fontFamily: T.inter, fontSize: 10.5, color: s.klaar ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.4)" }}>
                      {s.label}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* Kerncijfers */}
            {/* Kolomvullend: elke tegel groeit mee, anders schijnt de scheidingskleur
                van de container boven en onder de tegels door. */}
            <div
              className="grid grid-cols-3 xl:flex xl:flex-col gap-px xl:w-52 flex-shrink-0"
              style={{ borderTop: "1px solid rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              {[
                { l: "Verwachte verkoop", v: b ? fmt(b.verwachte_verkoop) : "—" },
                { l: "Geschatte marge", v: b ? `${b.geschatte_marge > 0 ? "+" : ""}${fmt(b.geschatte_marge)}` : "—", kleur: b ? (b.geschatte_marge > 0 ? "#4ade80" : "#f87171") : undefined },
                { l: "Betrouwbaarheid", v: m?.betrouwbaarheid ?? "—" },
              ].map((k) => (
                <div key={k.l} className="px-4 py-3 flex-1 flex flex-col justify-center" style={{ backgroundColor: T.navy }}>
                  <p style={{ ...micro("rgba(255,255,255,0.4)"), fontSize: 8.5 }}>{k.l}</p>
                  <p className="mt-1" style={num(16, k.kleur ?? "#ffffff")}>{k.v}</p>
                </div>
              ))}
            </div>

            {/* Score en acties */}
            <div
              className="flex xl:flex-col items-center justify-between xl:justify-center gap-4 p-5 flex-shrink-0"
              style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
            >
              {b ? (
                <ScoreRing score={b.aantrekkelijkheid} tone="donker" />
              ) : (
                <div
                  className="flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ width: 60, height: 60, border: "3px solid rgba(255,255,255,0.15)", ...num(24, "rgba(255,255,255,0.2)") }}
                >
                  ?
                </div>
              )}
              <div className="flex flex-col gap-2 w-full xl:w-40">
                <Btn variant="wit" size="sm" full disabled={!b} onClick={slaOp}>
                  {opgeslagen ? <><Check size={12} /> Opgeslagen</> : <><Plus size={12} /> Opslaan als dossier</>}
                </Btn>
                <Btn variant="ghostDonker" size="sm" full onClick={reset} disabled={!rdw && !resultaat}>
                  Nieuwe taxatie
                </Btn>
              </div>
            </div>
          </div>
        </div>

        {/* ── De waardeketen ── */}
        <Panel
          title="De waardeketen"
          meta={b?.bron ? `bron: ${b.bron}` : preview ? "koerslijst berekend · wacht op marktdata" : "wacht op kenteken"}
          flush
        >
          <div className="relative px-4 md:px-6 py-5">
            {/* Verticale ruggengraat */}
            <span
              className="absolute"
              style={{ left: 22, top: 30, bottom: 30, width: 1, backgroundColor: T.line2 }}
            />
            <div className="flex flex-col">
              {keten.map((s) => {
                const wacht = s.bedrag === null;
                const breedte = Math.max(0, ((s.tot - s.van) / schaal) * 100);
                const offset = Math.max(0, (s.van / schaal) * 100);
                return (
                  <div
                    key={s.nr}
                    className="grid items-center gap-3 py-2.5"
                    style={{
                      gridTemplateColumns: "36px minmax(0,1fr) 150px",
                      opacity: wacht ? 0.38 : 1,
                      borderTop: s.subtotaal ? `1px solid ${T.line2}` : undefined,
                    }}
                  >
                    {/* Marker */}
                    <div className="relative flex items-center">
                      <span
                        className="relative z-10 flex items-center justify-center"
                        style={{
                          width: 22, height: 22,
                          backgroundColor: s.subtotaal ? T.navy : T.paper,
                          border: `1px solid ${s.subtotaal ? T.navy : T.line2}`,
                          ...num(9, s.subtotaal ? "#ffffff" : T.ink(0.45)),
                        }}
                      >
                        {s.nr}
                      </span>
                    </div>

                    {/* Titel en balk */}
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span style={{ fontFamily: T.inter, fontSize: 12, fontWeight: s.subtotaal ? 700 : 600, color: T.navy }}>
                          {s.titel}
                        </span>
                        {s.chip && <Pill color={s.chip.kleur}>{s.chip.tekst}</Pill>}
                        {wacht && s.wachtOp && (
                          <span style={{ fontFamily: T.inter, fontSize: 9.5, color: T.ink(0.4) }}>{s.wachtOp}</span>
                        )}
                      </div>
                      <p className="truncate mt-0.5 mb-1.5" style={{ fontFamily: T.inter, fontSize: 10.5, color: T.ink(0.42) }}>
                        {s.uitleg}
                      </p>
                      <div className="relative w-full" style={{ height: 8, backgroundColor: "rgba(0,19,55,0.04)" }}>
                        {!wacht && (
                          <span
                            className="absolute top-0 bottom-0"
                            style={{ left: `${offset}%`, width: `${breedte}%`, backgroundColor: s.kleur, transition: "all .4s ease" }}
                          />
                        )}
                        {/* Weging zichtbaar maken op de geadviseerde verkoopprijs */}
                        {s.nr === "06" && !wacht && w.markt > 0 && w.koerslijst > 0 && (
                          <span
                            className="absolute top-0 bottom-0"
                            style={{ left: `${offset}%`, width: `${breedte * w.koerslijst}%`, backgroundColor: T.paars, opacity: 0.85 }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Bedrag */}
                    <div className="text-right">
                      <p style={num(19, s.bedrag != null && s.bedrag < 0 ? T.rood : T.navy)}>
                        {s.bedrag == null ? "—" : `${s.bedrag < 0 ? "− " : ""}${fmt(Math.abs(s.bedrag))}`}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Eindpunt */}
              <div
                className="grid items-center gap-3 mt-2 pt-3"
                style={{ gridTemplateColumns: "36px minmax(0,1fr) 150px", borderTop: `2px solid ${T.navy}` }}
              >
                <span />
                <span className="flex items-baseline gap-2 flex-wrap">
                  <span style={{ fontFamily: T.inter, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.navy }}>
                    Maximale inkoopprijs
                  </span>
                  {isVoorlopig && <Pill color={T.amber}>voorlopig</Pill>}
                </span>
                <p className="text-right" style={num(28, toonBod > 0 ? (isVoorlopig ? T.ink(0.55) : T.navy) : T.ink(0.2))}>
                  {toonBod > 0 ? fmt(toonBod) : "—"}
                </p>
              </div>
            </div>
          </div>
          <PanelVoet>
            De koerslijstwaarde komt uit de RDW-nieuwprijs met een afschrijvings- en kilometercorrectie; de live
            marktwaarde uit de daadwerkelijk gevonden advertenties. De geadviseerde verkoopprijs is een gewogen
            combinatie — bij weinig advertenties weegt de koerslijst zwaarder.
          </PanelVoet>
        </Panel>

        {/* ── Tijdens de scan: voortgang, zodat het canvas nooit stilstaat ── */}
        {laden && (
          <Panel
            title="Marktscan loopt"
            icon={<Spinner size={13} />}
            meta={`${scanStap} sec verstreken · duurt 20-45 sec`}
          >
            <p className="mb-3" style={body(12, T.ink(0.55))}>
              De koerslijst hierboven is al berekend. De scan zoekt nu het werkelijke aanbod erbij:
            </p>
            <ul className="flex flex-col gap-1.5">
              {SCAN_OMVAT.map((s) => (
                <li key={s} className="flex items-start gap-2.5">
                  <Clock size={12} style={{ color: T.ink(0.3), flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontFamily: T.inter, fontSize: 11.5, color: T.ink(0.55) }}>{s}</span>
                </li>
              ))}
            </ul>
            {/* Onbepaalde voortgang: de API meldt geen tussenstand, dus tonen we verstreken
                tijd tegen de verwachte duur in plaats van een verzonnen percentage. */}
            <div className="mt-4">
              <Meter value={Math.min(scanStap, 45)} max={45} color={T.navy} height={3} />
            </div>
            {scanStap > 45 && (
              <p className="mt-2" style={{ fontFamily: T.inter, fontSize: 10.5, color: T.amber }}>
                Dit duurt langer dan gebruikelijk — nog even geduld.
              </p>
            )}
          </Panel>
        )}

        {/* ── Marktbeeld (na analyse) ── */}
        {m && b && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <Panel
              title="Marktprijzen"
              actions={<TrendBadge trend={m.prijs_trend} />}
              className="xl:col-span-5"
            >
              <p style={num(30)}>{fmt(m.gemiddelde_prijs)}</p>
              <p className="mt-1 mb-5" style={body(11.5, T.ink(0.42))}>gemiddelde vraagprijs online</p>

              {/* Prijsspreiding met markeringen */}
              <div className="mb-5">
                <div className="flex justify-between mb-1.5" style={{ fontFamily: T.inter, fontSize: 10, color: T.ink(0.4) }}>
                  <span>Min {fmt(m.min_prijs)}</span>
                  <span>Max {fmt(m.max_prijs)}</span>
                </div>
                <Spreiding
                  min={m.min_prijs}
                  max={m.max_prijs}
                  advertenties={m.vergelijkbare ?? []}
                  markeringen={[
                    { waarde: b.max_inkoop, label: "max inkoop", kleur: T.navy },
                    { waarde: b.verwachte_verkoop, label: "advies verkoop", kleur: T.groen },
                  ]}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                {([
                  ["Marktplaats.nl", m.marktplaats_gemiddeld],
                  ["AutoScout24.nl", m.autoscout_gemiddeld],
                ] as [string, number | undefined][])
                  .filter(([, v]) => v)
                  .map(([platform, prijs]) => (
                    <div
                      key={platform}
                      className="flex items-center justify-between px-3 py-2"
                      style={{ backgroundColor: "rgba(0,19,55,0.02)", border: `1px solid ${T.line}` }}
                    >
                      <span style={{ fontFamily: T.inter, fontSize: 11.5, color: T.ink(0.55) }}>{platform}</span>
                      <span style={num(13)}>{fmt(Number(prijs))}</span>
                    </div>
                  ))}
              </div>
            </Panel>

            <Panel title="Marktanalyse" className="xl:col-span-4">
              <div className="flex flex-col gap-5">
                <div>
                  <p className="mb-1.5" style={micro()}>Aanbod online</p>
                  <p style={num(28)}>
                    {m.aantal_aanbod}
                    <span style={{ fontFamily: T.inter, fontSize: 12, fontWeight: 400, color: T.ink(0.4), marginLeft: 6 }}>stuks</span>
                  </p>
                  <div className="mt-2">
                    <Meter
                      value={Math.min(m.aantal_aanbod, 100)}
                      max={100}
                      color={m.aantal_aanbod > 60 ? T.rood : m.aantal_aanbod > 30 ? T.amber : T.groen}
                    />
                  </div>
                  <p className="mt-1.5" style={{ fontFamily: T.inter, fontSize: 10, color: T.ink(0.4) }}>
                    {m.aantal_aanbod > 60
                      ? "Groot aanbod — sterk concurrerend"
                      : m.aantal_aanbod > 30
                        ? "Gemiddeld aanbod"
                        : "Beperkt aanbod — gunstig voor verkoop"}
                  </p>
                </div>

                <div>
                  <p className="mb-2" style={micro()}>Populariteit</p>
                  <Segments score={m.vraag_score} />
                  <p className="mt-1.5" style={{ fontFamily: T.inter, fontSize: 10, color: T.ink(0.4) }}>
                    {m.vraag_score}/10 vraagscore
                  </p>
                </div>

                <div>
                  <p className="mb-2" style={micro()}>Berekening</p>
                  <table style={{ width: "100%", fontFamily: T.inter, fontSize: 11.5 }}>
                    <tbody>
                      {([
                        ["Geadviseerde verkoop", fmt(b.verwachte_verkoop), false],
                        ["Gewenste marge", `${b.gewenste_marge}%`, false],
                        ["Geschatte kosten", `− ${fmt(b.geschatte_kosten)}`, false],
                        ["Max inkoopprijs", fmt(b.max_inkoop), true],
                      ] as [string, string, boolean][]).map(([l, v, sterk]) => (
                        <tr key={l} style={{ borderTop: sterk ? `1px solid ${T.line2}` : undefined }}>
                          <td className="py-1.5" style={{ color: sterk ? T.navy : T.ink(0.5), fontWeight: sterk ? 700 : 400 }}>{l}</td>
                          <td
                            className="py-1.5 text-right"
                            style={sterk ? num(14) : { fontFamily: T.inter, fontWeight: 600, color: T.ink(0.7) }}
                          >
                            {v}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>

            <Panel title="Advies" className="xl:col-span-3">
              <div style={{ borderLeft: `2px solid ${T.navy}`, paddingLeft: 12 }}>
                <p style={{ fontFamily: T.play, fontSize: 14, lineHeight: 1.7, color: T.navy }}>{m.advies}</p>
              </div>
              <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: `1px solid ${T.line}` }}>
                {m.betrouwbaarheid && (
                  <div className="flex items-center justify-between">
                    <span style={micro()}>Betrouwbaarheid</span>
                    <Pill
                      color={m.betrouwbaarheid === "hoog" ? T.groen : m.betrouwbaarheid === "midden" ? T.amber : T.rood}
                    >
                      {m.betrouwbaarheid}
                    </Pill>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span style={micro()}>Advertenties gebruikt</span>
                  <span style={num(13)}>{m.aantal_gevonden ?? m.vergelijkbare?.length ?? 0}</span>
                </div>
                {eigenMerk && (
                  <div className="flex items-center justify-between">
                    <span style={micro()}>{rdw?.merk} bij JG</span>
                    <span style={{ fontFamily: T.inter, fontSize: 11, fontWeight: 600, color: scoreKleur(eigenMerk.verkoopPercentage, 100) }}>
                      {eigenMerk.verkocht}/{eigenMerk.totaal} verkocht · {eigenMerk.verkoopPercentage}%
                    </span>
                  </div>
                )}
              </div>
            </Panel>
          </div>
        )}

        {/* ── Bewijs: de gevonden advertenties ── */}
        {m && advertenties.length > 0 && (
          <Panel
            title="Het bewijs — gevonden advertenties"
            meta={`${m.aantal_gevonden ?? advertenties.length} advertenties`}
            flush
          >
            <TabelWrap>
              <thead>
                <tr style={{ borderBottom: `1.5px solid ${T.line2}` }}>
                  <Th>Advertentie</Th>
                  <Th align="center" onClick={() => sorteerOp("bouwjaar")} actief={sorteer.kolom === "bouwjaar"}>Bouwjaar</Th>
                  <Th align="center" onClick={() => sorteerOp("km")} actief={sorteer.kolom === "km"}>Km</Th>
                  <Th align="center">Platform</Th>
                  <Th align="right" onClick={() => sorteerOp("prijs")} actief={sorteer.kolom === "prijs"}>Vraagprijs</Th>
                  <Th align="right">Δ t.o.v. gem.</Th>
                </tr>
              </thead>
              <tbody>
                {advertenties.map((v, i) => {
                  const delta = m.gemiddelde_prijs > 0 ? Math.round(((v.prijs - m.gemiddelde_prijs) / m.gemiddelde_prijs) * 100) : 0;
                  const uitschieter = Math.abs(delta) > 25;
                  return (
                    <tr
                      key={`${v.titel}-${i}`}
                      style={{ ...rijStijl(i), borderLeft: uitschieter ? `2px solid ${T.amber}` : "2px solid transparent" }}
                      title={uitschieter ? "Uitschieter — wijkt meer dan 25% van het gemiddelde af" : undefined}
                    >
                      <Td sterk>{v.titel}</Td>
                      <Td align="center">{v.bouwjaar ?? "—"}</Td>
                      <Td align="center">{v.km != null ? fmtKm(v.km) : "—"}</Td>
                      <Td align="center">{v.platform ?? "—"}</Td>
                      <Td align="right" cijfer>{fmt(v.prijs)}</Td>
                      <Td align="right" color={delta > 0 ? T.rood : T.groen}>
                        {delta > 0 ? "+" : ""}{delta}%
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TabelWrap>
            <PanelVoet>
              Dit zijn de werkelijk online gevonden advertenties waarop de taxatie is gebaseerd. Controleer ze zelf
              voor volledige zekerheid — staat, opties, historie en regio beïnvloeden de prijs. Rijen met een oranje
              rand wijken meer dan 25% van het gemiddelde af.
            </PanelVoet>
          </Panel>
        )}

        {/* ── Lege staat: leg de methode uit in plaats van wit te blijven ── */}
        {!m && !laden && (
          <>
            <SectionRule label="Zo werkt de taxatie" right="JG koerslijst · versie 2" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  Icon: Search,
                  titel: "1 · RDW-nieuwprijs",
                  tekst:
                    "Het kenteken levert merk, model, bouwjaar, brandstof en — belangrijk — de catalogusprijs waarmee de auto ooit is afgeleverd. Dat is het startpunt van de hele keten.",
                },
                {
                  Icon: Gauge,
                  titel: "2 · JG koerslijst",
                  tekst:
                    "Op die nieuwprijs gaat de Nederlandse afschrijvingscurve, gevolgd door een correctie voor de kilometerstand ten opzichte van de ruim 14.000 km per jaar die gemiddeld is. Dit rekenen we direct uit.",
                },
                {
                  Icon: BarChart2,
                  titel: "3 · Live marktscan",
                  tekst:
                    "Vervolgens zoeken we het werkelijke aanbod op Marktplaats, AutoScout24 en Gaspedaal. Hoe meer vergelijkbare advertenties er zijn, hoe zwaarder de live markt weegt ten opzichte van de koerslijst.",
                },
              ].map(({ Icon, titel, tekst }) => (
                <Panel key={titel}>
                  <Icon size={18} style={{ color: T.ink(0.3) }} />
                  <p className="mt-3 mb-1.5" style={{ fontFamily: T.play, fontSize: 15, fontWeight: 700, color: T.navy }}>
                    {titel}
                  </p>
                  <p style={body(12, T.ink(0.5))}>{tekst}</p>
                </Panel>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              {/* Eigen prestatiecontext — echte data, ook zonder taxatie */}
              <Panel
                title={rdw ? `${rdw.merk} bij JG Mobility` : "Uw beste merken"}
                icon={<Info size={13} style={{ color: T.ink(0.35) }} />}
                meta="uit eigen verkoopdata"
                className="xl:col-span-7"
              >
                {!prestaties ? (
                  <div className="flex flex-col gap-2">
                    {[0, 1, 2].map((i) => <div key={i} className="animate-pulse" style={{ height: 16, backgroundColor: "rgba(0,19,55,0.06)" }} />)}
                  </div>
                ) : prestaties.merk_stats.length === 0 ? (
                  <p style={body(12, T.ink(0.45))}>
                    Nog geen verkoopdata. Zodra er auto&apos;s als verkocht zijn gemarkeerd verschijnt hier hoe elk
                    merk het bij u doet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {(eigenMerk ? [eigenMerk] : [...prestaties.merk_stats].sort((a, c) => c.verkocht - a.verkocht).slice(0, 5)).map((s) => (
                      <div key={s.merk}>
                        <div className="flex items-center justify-between mb-1">
                          <span style={{ fontFamily: T.play, fontSize: 13.5, fontWeight: 700, color: T.navy }}>{s.merk}</span>
                          <span style={{ fontFamily: T.inter, fontSize: 10.5, color: T.ink(0.45) }}>
                            {s.verkocht} verkocht · {s.beschikbaar} op voorraad · gem. {fmt(s.gemPrijs)}
                          </span>
                        </div>
                        <Meter value={s.verkoopPercentage} max={100} color={scoreKleur(s.verkoopPercentage, 100)} />
                      </div>
                    ))}
                    <p className="mt-1" style={{ fontFamily: T.inter, fontSize: 10.5, color: T.ink(0.4) }}>
                      {eigenMerk
                        ? `U verkocht ${eigenMerk.verkocht} van de ${eigenMerk.totaal} ${eigenMerk.merk}'s die u had — dat is uw eigen doorloop op dit merk.`
                        : "Vul een kenteken in om te zien hoe dat merk het bij u doet."}
                    </p>
                  </div>
                )}
              </Panel>

              {/* Snelle sprong naar de andere tabbladen */}
              <Panel title="Verder kijken" className="xl:col-span-5">
                <div className="flex flex-col gap-2.5">
                  {([
                    { tab: "markt" as const, titel: "Marktoverzicht", tekst: "Welke modellen zijn nu hot en welke kunt u beter laten staan." },
                    { tab: "prestaties" as const, titel: "Prestaties", tekst: "Wat verkoopt er bij u, per merk, brandstof en prijssegment." },
                    { tab: "dossiers" as const, titel: "Dossiers", tekst: "Lopende inkooptrajecten opvolgen van nieuw tot akkoord." },
                  ]).map((k) => (
                    <button
                      key={k.tab}
                      type="button"
                      onClick={() => onTab(k.tab)}
                      className="text-left px-3.5 py-3 transition-all hover:bg-gray-50"
                      style={{ border: `1px solid ${T.line}` }}
                    >
                      <p style={{ fontFamily: T.play, fontSize: 13.5, fontWeight: 700, color: T.navy }}>{k.titel}</p>
                      <p className="mt-0.5" style={body(11.5, T.ink(0.45))}>{k.tekst}</p>
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          </>
        )}

        {/* Colofon */}
        <div className="flex items-center justify-between gap-4 flex-wrap pt-1">
          <p style={{ fontFamily: T.inter, fontSize: 10, color: T.ink(0.35) }}>
            Bronnen: RDW open data · Marktplaats · AutoScout24 · Gaspedaal · JG koerslijst
          </p>
          {b?.bron && (
            <p style={{ fontFamily: T.inter, fontSize: 10, color: T.ink(0.35) }}>
              Waardebepaling op basis van: {b.bron}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Prijsspreiding: één streepje per gevonden advertentie plus gemarkeerde referentiepunten. */
function Spreiding({
  min,
  max,
  advertenties,
  markeringen,
}: {
  min: number;
  max: number;
  advertenties: Vergelijkbaar[];
  markeringen: { waarde: number; label: string; kleur: string }[];
}) {
  const bereik = max - min || 1;
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - min) / bereik) * 100));

  return (
    <div className="relative" style={{ paddingTop: 18, paddingBottom: 20 }}>
      <div className="relative w-full" style={{ height: 10, backgroundColor: "rgba(0,19,55,0.06)" }}>
        {advertenties.map((a, i) => (
          <span
            key={`${a.titel}-${i}`}
            className="absolute top-0 bottom-0"
            style={{ left: `${pos(a.prijs)}%`, width: 1.5, backgroundColor: T.ink(0.4) }}
            title={`${a.titel} — ${fmt(a.prijs)}`}
          />
        ))}
        {markeringen
          .filter((mk) => mk.waarde > 0)
          .map((mk, i) => (
            <span key={mk.label} className="absolute" style={{ left: `${pos(mk.waarde)}%`, top: -18, bottom: -20, width: 0 }}>
              <span className="absolute" style={{ top: 18, bottom: 20, width: 2, backgroundColor: mk.kleur, marginLeft: -1 }} />
              <span
                className="absolute whitespace-nowrap"
                style={{
                  ...micro(mk.kleur),
                  fontSize: 8.5,
                  top: i === 0 ? 0 : undefined,
                  bottom: i === 0 ? undefined : 0,
                  left: pos(mk.waarde) > 60 ? undefined : 4,
                  right: pos(mk.waarde) > 60 ? 4 : undefined,
                }}
              >
                {mk.label}
              </span>
            </span>
          ))}
      </div>
    </div>
  );
}

"use client";

/**
 * Tabblad "Marktoverzicht" — live puls van de Nederlandse occasionmarkt.
 *
 * Gedrag is identiek aan de vorige versie (één POST naar /api/admin/inkoop/markt),
 * alleen de opmaak is herbouwd op het gedeelde ontwerpsysteem uit ./ui.
 */

import { useState } from "react";
import {
  Flame,
  Search,
  RefreshCw,
  Globe,
  TrendingUp,
  TrendingDown,
  Compass,
  Lightbulb,
  Radar,
} from "lucide-react";

import type { MarktOverzicht } from "./types";
import {
  T,
  num,
  micro,
  body,
  fmt,
  scoreKleur,
  Panel,
  SectionRule,
  Meter,
  Pill,
  TrendBadge,
  Chip,
  Btn,
  Spinner,
  Skeleton,
  Foutmelding,
  Th,
  Td,
  TabelWrap,
  rijStijl,
  PanelVoet,
  inputStijl,
} from "./ui";

// ── Hulpjes ───────────────────────────────────────────────────────
const tempLabel = (s: number) =>
  s >= 8 ? "Hete markt" : s >= 6 ? "Warme markt" : s >= 4 ? "Neutrale markt" : "Koude markt";

/** Relatieve tijd in het Nederlands, zonder externe dependency. */
function relatieveTijd(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "zojuist";
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return "zojuist";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min geleden`;
  const uur = Math.round(min / 60);
  if (uur < 24) return `${uur} uur geleden`;
  return new Date(iso).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
}

const VOORBEELDEN = [
  "Toyota SUV onder € 20.000",
  "BMW benzine 2018-2020",
  "Elektrisch onder € 25.000",
  "Compacte gezinsauto's",
  "Bestelwagens",
  "Youngtimers",
];

/**
 * De route parseert onbewerkte AI-JSON, dus velden kunnen ontbreken of tekst zijn.
 * Alles wat we in een berekening, een balkbreedte of een kleurschaal stoppen wordt hier
 * één keer naar een echt getal gedwongen — anders belandt er NaN in de opmaak.
 */
function normaliseer(d: MarktOverzicht): MarktOverzicht {
  const getal = (v: unknown) => Number(v) || 0;
  return {
    ...d,
    markt_temperatuur: getal(d.markt_temperatuur),
    hot_modellen: (d.hot_modellen ?? []).map((m) => ({
      ...m,
      rang: getal(m.rang),
      gem_prijs: getal(m.gem_prijs),
      aanbod_score: getal(m.aanbod_score),
      vraag_score: getal(m.vraag_score),
    })),
    trending_segmenten: (d.trending_segmenten ?? []).map((s) => ({ ...s, score: getal(s.score) })),
    te_vermijden: d.te_vermijden ?? [],
    inzichten: d.inzichten ?? [],
  };
}

// ── Component ─────────────────────────────────────────────────────
export default function MarktTab() {
  const [data, setData] = useState<MarktOverzicht | null>(null);
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [zoekterm, setZoekterm] = useState("");

  const analyseer = async (type: "puls" | "zoek") => {
    if (type === "zoek" && !zoekterm.trim()) return;
    setLaden(true);
    setFout(null);
    try {
      const res = await fetch("/api/admin/inkoop/markt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, zoekterm: zoekterm.trim() }),
      });
      if (res.ok) {
        const uit = normaliseer((await res.json()) as MarktOverzicht);
        setData(uit);
        // Elke marktanalyse gaat automatisch het archief in (per kwartaal), net als
        // de taxaties. Fire-and-forget zodat een mislukte archivering de analyse
        // niet in de weg zit.
        fetch("/api/admin/inkoop/markt-archief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: uit.type,
            zoekterm: uit.zoekterm ?? "",
            samenvatting: uit.samenvatting ?? "",
            markt_temperatuur: uit.markt_temperatuur ?? 0,
            resultaat: uit,
          }),
        }).catch(() => {});
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setFout(d.error ?? "Analyse mislukt");
      }
    } catch {
      setFout("Analyse mislukt — controleer de verbinding");
    } finally {
      setLaden(false);
    }
  };

  const live = data?.live !== false;

  // ── Commandobalk ────────────────────────────────────────────────
  const commandobalk = (
    <div
      className="flex flex-col lg:flex-row lg:items-center gap-3 px-4 md:px-5 py-3"
      style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}
    >
      <div className="flex items-center gap-2 flex-shrink-0">
        <Btn onClick={() => analyseer("puls")} disabled={laden}>
          {laden ? <Spinner size={13} tone="donker" /> : <Flame size={14} />}
          Analyseer markt nu
        </Btn>
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0" style={{ maxWidth: 420 }}>
        <input
          type="text"
          value={zoekterm}
          onChange={(e) => setZoekterm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") analyseer("zoek");
          }}
          placeholder="Merk, model of segment — bijv. Toyota SUV onder € 20.000"
          style={{ ...inputStijl, padding: "8px 11px", fontSize: 12 }}
        />
        <Btn variant="ghost" onClick={() => analyseer("zoek")} disabled={laden || !zoekterm.trim()}>
          <Search size={13} />
          Analyseer
        </Btn>
      </div>

      {data && (
        <div className="flex items-center gap-3 lg:ml-auto flex-wrap">
          <Pill
            color={live ? T.groen : T.amber}
            bg={live ? T.tintGroen : T.tintAmber}
          >
            ● {live ? "Live data" : "Kennis-schatting"}
          </Pill>
          <span style={{ fontFamily: T.inter, fontSize: 10.5, color: T.ink(0.4) }}>
            {relatieveTijd(data.gegenereerd_op)}
          </span>
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => analyseer(data.type === "zoek" ? "zoek" : "puls")}
            disabled={laden}
            title="Analyse opnieuw uitvoeren"
          >
            <RefreshCw size={11} className={laden ? "animate-spin" : ""} />
            Ververs
          </Btn>
        </div>
      )}
    </div>
  );

  // ── Laadstaat: zelfde vorm als het resultaat ────────────────────
  const laadstaat = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-12">
        <Panel tone="donker">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8 flex flex-col gap-2.5">
              <Skeleton w={260} h={20} />
              <Skeleton w="92%" h={11} />
              <Skeleton w="86%" h={11} />
              <Skeleton w="64%" h={11} />
              <p className="mt-2 flex items-center gap-2" style={{ fontFamily: T.inter, fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>
                <Spinner size={13} tone="donker" />
                Claude zoekt nu live op Marktplaats, AutoScout24 en AutoWeek — dit duurt 25 tot 45 seconden.
              </p>
            </div>
            <div className="lg:col-span-4 flex flex-col gap-2.5 lg:items-end">
              <div className="animate-pulse" style={{ ...num(56, "rgba(255,255,255,0.25)") }}>
                0,0
              </div>
              <div className="w-full" style={{ maxWidth: 220 }}>
                <Meter value={3} max={10} color="rgba(255,255,255,0.25)" height={6} track="rgba(255,255,255,0.10)" />
              </div>
              <p style={micro("rgba(255,255,255,0.35)")}>Markttemperatuur bepalen…</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="lg:col-span-12 xl:col-span-8">
        <Panel title="Hot inkoopkansen" icon={<Flame size={14} style={{ color: T.amber }} />} flush>
          <div className="flex flex-col">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 md:px-5 py-3.5" style={rijStijl(i)}>
                <Skeleton w={28} h={28} />
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <Skeleton w="42%" h={12} />
                  <Skeleton w="72%" h={9} />
                </div>
                <Skeleton w={70} h={12} />
                <Skeleton w={60} h={12} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="lg:col-span-12 xl:col-span-4 flex flex-col gap-4">
        <Panel title="Trending segmenten" icon={<TrendingUp size={14} style={{ color: T.groen }} />}>
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton w="55%" h={11} />
                <Skeleton h={6} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Te vermijden" icon={<TrendingDown size={14} style={{ color: T.rood }} />}>
          <div className="flex flex-col gap-3.5">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton w="48%" h={11} />
                <Skeleton w="80%" h={9} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );

  // ── Lege staat: uitleg die het scherm vult ──────────────────────
  const legeStaat = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="1 · Marktpuls" icon={<Globe size={14} style={{ color: T.navy }} />}>
          <p style={body(12.5, T.ink(0.6))}>
            De brede scan van de hele Nederlandse occasionmarkt. Claude zoekt live in het actuele
            aanbod en levert vier dingen op:
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {[
              ["Hot modellen", "de merken en modellen waar nu meer vraag dan aanbod is — uw inkoopkansen."],
              ["Te vermijden", "modellen die te lang op stal blijven staan of waar de prijs onderuit gaat."],
              ["Trending segmenten", "welke carrosserie- en brandstofsegmenten in beweging zijn."],
              ["Marktinzichten", "losse observaties die u meeneemt naar de inkoop of veiling."],
            ].map(([kop, tekst]) => (
              <li key={kop} className="flex items-start gap-2.5">
                <span
                  className="flex-shrink-0 mt-1"
                  style={{ width: 5, height: 5, backgroundColor: T.navy }}
                />
                <span style={body(11.5, T.ink(0.55))}>
                  <strong style={{ color: T.navy, fontWeight: 600 }}>{kop}</strong> — {tekst}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Btn onClick={() => analyseer("puls")} disabled={laden} full>
              <Flame size={14} />
              Analyseer markt nu
            </Btn>
          </div>
        </Panel>

        <Panel title="2 · Specifieke analyse" icon={<Search size={14} style={{ color: T.navy }} />}>
          <p style={body(12.5, T.ink(0.6))}>
            Wilt u niet de hele markt maar één hoek ervan? Typ een merk, model, segment, bouwjaar of
            prijsklasse in de zoekbalk hierboven. U krijgt dezelfde opbouw terug, maar dan volledig
            toegespitst op uw vraag.
          </p>
          <div className="mt-4">
            <SectionRule label="Voorbeelden — klik om over te nemen" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {VOORBEELDEN.map((v) => (
              <Chip key={v} active={zoekterm === v} onClick={() => setZoekterm(v)}>
                {v}
              </Chip>
            ))}
          </div>
          <p className="mt-4" style={body(11, T.ink(0.42))}>
            Hoe concreter de vraag, hoe scherper het antwoord. Noem gerust bouwjaren, brandstof,
            transmissie of een prijsplafond.
          </p>
        </Panel>

        <Panel title="3 · Zo leest u het" icon={<Compass size={14} style={{ color: T.navy }} />}>
          <div className="flex flex-col gap-3.5">
            <div>
              <p style={micro(T.ink(0.45))}>Aanbod-score</p>
              <p className="mt-1" style={body(11.5, T.ink(0.58))}>
                Hoeveel exemplaren er nu te koop staan, op een schaal van 1 tot 10.{" "}
                <strong style={{ color: T.navy, fontWeight: 600 }}>Laag is gunstig</strong> — weinig
                concurrentie in de etalage.
              </p>
            </div>
            <div>
              <p style={micro(T.ink(0.45))}>Vraag-score</p>
              <p className="mt-1" style={body(11.5, T.ink(0.58))}>
                Hoe hard er naar het model gezocht wordt.{" "}
                <strong style={{ color: T.navy, fontWeight: 600 }}>Hoog is gunstig</strong> — snellere
                doorloop en meer ruimte in de prijs.
              </p>
            </div>
            <div>
              <p style={micro(T.ink(0.45))}>Kans</p>
              <p className="mt-1" style={body(11.5, T.ink(0.58))}>
                Vraag min aanbod, teruggerekend naar een cijfer van 1 tot 10. Vanaf 7 groen: kopen
                waar u kunt. Onder de 5 rood: alleen bij een scherpe inkoop.
              </p>
            </div>
            <div>
              <p style={micro(T.ink(0.45))}>Markttemperatuur</p>
              <p className="mt-1" style={body(11.5, T.ink(0.58))}>
                Het klimaat van de hele markt. 8 of hoger is een hete markt (snel handelen, prijzen
                lopen op), onder de 4 een koude markt (voorzichtig inkopen, langere standtijd).
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel flush>
        <div className="flex flex-col md:flex-row md:items-center gap-4 px-4 md:px-5 py-4">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <Radar size={16} style={{ color: T.ink(0.3) }} />
            <span style={micro(T.ink(0.45))}>Bronnen</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {["Marktplaats", "AutoScout24", "AutoWeek"].map((b) => (
              <Pill key={b} color={T.navy}>
                {b}
              </Pill>
            ))}
          </div>
          <p className="md:ml-auto" style={body(11, T.ink(0.42))}>
            Elke analyse zoekt live en duurt ongeveer 25 tot 45 seconden. Laat het scherm open staan.
          </p>
        </div>
      </Panel>
    </div>
  );

  // ── Resultaat ───────────────────────────────────────────────────
  const resultaat = (d: MarktOverzicht) => {
    // De route parseert onbewerkte AI-JSON; ontbreekt de temperatuur, dan niet NaN tonen.
    const temp = Number(d.markt_temperatuur) || 0;
    const tempKleur = scoreKleur(temp);
    const hot = d.hot_modellen ?? [];
    const vermijden = d.te_vermijden ?? [];
    const segmenten = d.trending_segmenten ?? [];
    const inzichten = d.inzichten ?? [];

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* HERO */}
        <div className="lg:col-span-12">
          <Panel tone="donker">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              <div className="lg:col-span-8 min-w-0">
                <p style={{ fontFamily: T.play, fontSize: 22, fontWeight: 700, color: "#ffffff" }}>
                  {d.type === "zoek" ? `Analyse: ${d.zoekterm ?? zoekterm}` : "Marktpuls Nederland"}
                </p>
                <p
                  className="mt-3"
                  style={{
                    fontFamily: T.inter,
                    fontSize: 13.5,
                    lineHeight: 1.7,
                    color: "rgba(255,255,255,0.75)",
                    maxWidth: "75ch",
                  }}
                >
                  {d.samenvatting}
                </p>
                <div className="mt-5 grid grid-cols-3 gap-3" style={{ maxWidth: 460 }}>
                  {[
                    { label: "Hot modellen", waarde: hot.length },
                    { label: "Te vermijden", waarde: vermijden.length },
                    { label: "Segmenten", waarde: segmenten.length },
                  ].map((k) => (
                    <div
                      key={k.label}
                      className="px-3 py-2.5"
                      style={{ border: "1px solid rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.04)" }}
                    >
                      <p style={num(20, "#ffffff")}>{k.waarde}</p>
                      <p className="mt-1.5 truncate" style={micro("rgba(255,255,255,0.4)")}>
                        {k.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col justify-center lg:items-end">
                <p style={micro("rgba(255,255,255,0.4)")}>Markttemperatuur</p>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span style={num(56, "#ffffff")}>{temp}</span>
                  <span style={{ fontFamily: T.play, fontSize: 20, color: "rgba(255,255,255,0.4)" }}>/10</span>
                </div>
                <div className="mt-3 w-full" style={{ maxWidth: 240 }}>
                  <Meter value={temp} max={10} color="#ffffff" height={6} track="rgba(255,255,255,0.14)" />
                </div>
                <p className="mt-2.5" style={{ ...micro(tempKleur), letterSpacing: "0.16em" }}>
                  {tempLabel(temp)}
                </p>
              </div>
            </div>
          </Panel>
        </div>

        {/* HOT INKOOPKANSEN */}
        <div className="lg:col-span-12 xl:col-span-8 min-w-0">
          <Panel
            title="Hot inkoopkansen"
            icon={<Flame size={14} style={{ color: T.amber }} />}
            meta={`${hot.length} modellen`}
            flush
          >
            {hot.length === 0 ? (
              <p className="p-4 md:p-5" style={body(12, T.ink(0.45))}>
                Deze analyse leverde geen concrete inkoopkansen op. Probeer een bredere zoekterm of
                draai de volledige marktpuls.
              </p>
            ) : (
              <TabelWrap>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.line2}` }}>
                    <Th width={44}>#</Th>
                    <Th width="42%">Merk &amp; model</Th>
                    <Th>Trend</Th>
                    <Th align="right">Gem. prijs</Th>
                    <Th width={110}>Aanbod</Th>
                    <Th width={110}>Vraag</Th>
                    <Th align="right">Kans</Th>
                  </tr>
                </thead>
                <tbody>
                  {hot.map((m, i) => {
                    const kans = Math.round((m.vraag_score - m.aanbod_score + 10) / 2);
                    const kansKleur = scoreKleur(kans);
                    const top = m.rang <= 3;
                    return (
                      <tr key={`${m.merk}-${m.model}-${m.rang}`} style={rijStijl(i)}>
                        <Td>
                          <span
                            className="inline-flex items-center justify-center"
                            style={{
                              width: 24,
                              height: 24,
                              backgroundColor: top ? T.navy : "rgba(0,19,55,0.06)",
                              ...num(12, top ? "#ffffff" : T.navy),
                            }}
                          >
                            {m.rang}
                          </span>
                        </Td>
                        <td style={{ padding: "9px 16px", verticalAlign: "top" }}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span style={{ fontFamily: T.play, fontSize: 13.5, fontWeight: 700, color: T.navy }}>
                              {m.merk} {m.model}
                            </span>
                            {m.segment && <Pill color={T.navy}>{m.segment}</Pill>}
                          </div>
                          {m.advies && (
                            <p
                              className="mt-1"
                              style={{
                                fontFamily: T.inter,
                                fontSize: 11,
                                lineHeight: 1.5,
                                color: T.ink(0.5),
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {m.advies}
                            </p>
                          )}
                        </td>
                        <Td>
                          <TrendBadge trend={m.trend} />
                        </Td>
                        <Td align="right" cijfer>
                          {fmt(m.gem_prijs)}
                        </Td>
                        <Td>
                          <span className="block" style={{ ...micro(T.ink(0.4)), fontSize: 9 }}>
                            {m.aanbod_score}/10
                          </span>
                          <div className="mt-1" style={{ width: 84 }}>
                            <Meter value={m.aanbod_score} max={10} color={T.ink(0.35)} height={4} />
                          </div>
                        </Td>
                        <Td>
                          <span className="block" style={{ ...micro(T.ink(0.4)), fontSize: 9 }}>
                            {m.vraag_score}/10
                          </span>
                          <div className="mt-1" style={{ width: 84 }}>
                            <Meter value={m.vraag_score} max={10} color={scoreKleur(m.vraag_score)} height={4} />
                          </div>
                        </Td>
                        <Td align="right">
                          <Pill color={kansKleur}>{kans}/10</Pill>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TabelWrap>
            )}
            <PanelVoet>
              Kans = (vraag − aanbod + 10) ÷ 2. Laag aanbod bij hoge vraag geeft de beste
              inkooppositie. Prijzen zijn gemiddelde vraagprijzen uit het actuele aanbod.
            </PanelVoet>
          </Panel>
        </div>

        {/* CONTEXT */}
        <div className="lg:col-span-12 xl:col-span-4 flex flex-col gap-4 min-w-0">
          <Panel
            title="Trending segmenten"
            icon={<TrendingUp size={14} style={{ color: T.groen }} />}
            meta={`${segmenten.length}`}
          >
            {segmenten.length === 0 ? (
              <p style={body(12, T.ink(0.45))}>Geen segmenten met een duidelijke beweging gevonden.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {segmenten.map((s, i) => (
                  <div key={`${s.naam}-${i}`}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="truncate"
                          style={{ fontFamily: T.inter, fontSize: 12.5, fontWeight: 600, color: T.navy }}
                        >
                          {s.naam}
                        </span>
                        <TrendBadge trend={s.trend} />
                      </div>
                      <span style={num(14, scoreKleur(s.score))}>{s.score}/10</span>
                    </div>
                    <Meter value={s.score} max={10} color={scoreKleur(s.score)} height={5} />
                    {s.reden && (
                      <p className="mt-1.5" style={body(11, T.ink(0.45))}>
                        {s.reden}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Te vermijden"
            icon={<TrendingDown size={14} style={{ color: T.rood }} />}
            meta={`${vermijden.length}`}
          >
            {vermijden.length === 0 ? (
              <p style={body(12, T.ink(0.45))}>
                Geen modellen die op dit moment uitgesproken afgeraden worden.
              </p>
            ) : (
              <div className="flex flex-col gap-3.5">
                {vermijden.map((t, i) => (
                  <div key={`${t.merk}-${t.model}-${i}`} className="flex items-start gap-2.5">
                    <span
                      className="flex-shrink-0 rounded-full"
                      style={{ width: 6, height: 6, marginTop: 6, backgroundColor: T.rood }}
                    />
                    <div className="min-w-0">
                      <p style={{ fontFamily: T.inter, fontSize: 12.5, fontWeight: 600, color: T.navy }}>
                        {t.merk} {t.model}
                      </p>
                      <p className="mt-0.5" style={body(11, T.ink(0.5))}>
                        {t.reden}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* INZICHTEN */}
        {inzichten.length > 0 && (
          <div className="lg:col-span-12">
            <Panel title="Marktinzichten" icon={<Lightbulb size={14} style={{ color: T.navy }} />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {inzichten.map((inzicht, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3.5"
                    style={{ backgroundColor: "rgba(0,19,55,0.02)", border: `1px solid ${T.line}` }}
                  >
                    <span
                      className="flex-shrink-0 flex items-center justify-center"
                      style={{ width: 22, height: 22, backgroundColor: T.navy, ...num(11, "#ffffff") }}
                    >
                      {i + 1}
                    </span>
                    <p style={body(12, T.ink(0.68))}>{inzicht}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {commandobalk}
      {fout && <Foutmelding>{fout}</Foutmelding>}
      {laden ? laadstaat : data ? resultaat(data) : legeStaat}
    </div>
  );
}

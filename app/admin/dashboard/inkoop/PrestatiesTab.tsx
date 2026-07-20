"use client";

/**
 * Tabblad "Prestaties" — hoe presteert JG Mobility zelf.
 * Leest uitsluitend uit de gedeelde PrestatiesData die de shell ophaalt.
 */

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Award, TrendingUp, Coins, Fuel, BarChart3 } from "lucide-react";
import {
  T,
  num,
  micro,
  body,
  fmt,
  fmtKort,
  fmtGetal,
  Panel,
  SectionRule,
  Stat,
  Meter,
  Skeleton,
  Th,
  Td,
  TabelWrap,
  rijStijl,
  PanelVoet,
} from "./ui";
import type { PrestatiesData } from "./types";

const MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

const GRAFIEK_H = 150;

type SorteerKolom = "merk" | "totaal" | "verkocht" | "beschikbaar" | "gemPrijs" | "verkoopPercentage";

/**
 * num() uit ui.tsx leidt zijn kleurparameter af als het letterlijke token "#001337"
 * (gevolg van `as const`). Deze wrapper stelt dezelfde Playfair-cijferstijl samen
 * met een vrij te kiezen kleur — geen eigen tokens, alleen compositie.
 */
const cijferStijl = (size: number, color: string, weight = 700): CSSProperties => ({
  ...num(size),
  color,
  fontWeight: weight,
});

const pctKleur = (p: number) => (p >= 70 ? T.groen : p >= 40 ? T.amber : T.rood);
const pctKleurZacht = (p: number) => (p >= 60 ? T.groen : p >= 30 ? T.amber : T.ink(0.35));

/** De 12 maandsleutels (YYYY-MM) tot en met de huidige maand. */
function maandSleutels(nu: Date): string[] {
  const uit: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
    uit.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return uit;
}

// ── Skeleton ──────────────────────────────────────────────────────
function Laadweergave() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-12 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="p-3.5" style={{ backgroundColor: "rgba(0,19,55,0.02)", border: `1px solid ${T.line}` }}>
            <Skeleton w="60%" h={9} className="mb-3" />
            <Skeleton w="75%" h={22} />
            <Skeleton w="45%" h={8} className="mt-3" />
          </div>
        ))}
      </div>

      <div className="lg:col-span-12 xl:col-span-8 flex flex-col">
        <Panel className="flex-1" title="Verkopen per maand" icon={<TrendingUp size={14} style={{ color: T.navy }} />}>
          <div className="flex items-end gap-1" style={{ height: GRAFIEK_H }}>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="flex-1">
                <Skeleton h={30 + ((i * 37) % 110)} />
              </div>
            ))}
          </div>
          <div className="flex gap-1 mt-2">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="flex-1">
                <Skeleton h={8} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="lg:col-span-12 xl:col-span-4 flex flex-col">
        <Panel className="flex-1" title="Marge per dossier" icon={<Coins size={14} style={{ color: T.navy }} />}>
          <Skeleton w="50%" h={30} className="mb-4" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i}>
                <Skeleton h={11} className="mb-1.5" />
                <Skeleton h={4} w="70%" />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="lg:col-span-12 xl:col-span-6 flex flex-col">
        <Panel className="flex-1" title="Merk prestaties" icon={<Award size={14} style={{ color: T.navy }} />}>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} h={72} />
            ))}
          </div>
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} h={14} />
            ))}
          </div>
        </Panel>
      </div>

      <div className="lg:col-span-12 xl:col-span-6 flex flex-col">
        <Panel className="flex-1" title="Brandstof & prijssegment" icon={<Fuel size={14} style={{ color: T.navy }} />}>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i}>
                <Skeleton h={11} className="mb-1.5" />
                <Skeleton h={6} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ── Hoofdcomponent ────────────────────────────────────────────────
export default function PrestatiesTab({ data }: { data: PrestatiesData | null }) {
  const [sorteerOp, setSorteerOp] = useState<SorteerKolom>("verkocht");
  const [oplopend, setOplopend] = useState(false);
  const [hoverMaand, setHoverMaand] = useState<string | null>(null);

  const merkStats = useMemo(() => data?.merk_stats ?? [], [data]);

  const gesorteerdeMerken = useMemo(() => {
    const rijen = [...merkStats];
    rijen.sort((a, b) => {
      const richting = oplopend ? 1 : -1;
      if (sorteerOp === "merk") return a.merk.localeCompare(b.merk, "nl") * richting;
      return (a[sorteerOp] - b[sorteerOp]) * richting;
    });
    return rijen;
  }, [merkStats, sorteerOp, oplopend]);

  if (!data) return <Laadweergave />;

  const { kpis, brandstof_stats, segment_stats, verkopen_per_maand, marge_dossiers } = data;

  // ── Maandgrafiek ────────────────────────────────────────────────
  const nu = new Date();
  const maanden12 = maandSleutels(nu);
  const huidigeSleutel = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}`;
  const maandRijen = maanden12.map((sleutel) => ({
    sleutel,
    count: verkopen_per_maand[sleutel]?.count ?? 0,
    omzet: verkopen_per_maand[sleutel]?.omzet ?? 0,
    maandNr: parseInt(sleutel.split("-")[1], 10),
    huidig: sleutel === huidigeSleutel,
  }));
  const maxMaand = Math.max(...maandRijen.map((m) => m.count), 1);
  const totaal12 = maandRijen.reduce((s, m) => s + m.count, 0);
  const omzet12 = maandRijen.reduce((s, m) => s + m.omzet, 0);
  const gemMaand = totaal12 / 12;
  const geenMaanddata = totaal12 === 0;

  // ── Marges ──────────────────────────────────────────────────────
  const alleMarges = [...marge_dossiers.top, ...marge_dossiers.slecht];
  // top[] en slecht[] kunnen elkaar overlappen bij weinig dossiers — tel elk dossier één keer.
  const uniekeMarges = new Set(alleMarges.map((d) => d.id)).size;
  const topIds = new Set(marge_dossiers.top.map((d) => d.id));
  const slechtUniek = marge_dossiers.slecht.filter((d) => !topIds.has(d.id));
  const maxMarge = Math.max(...alleMarges.map((d) => Math.abs(d.netto_marge)), 1);
  const geenMarges = alleMarges.length === 0;

  // ── Merken ──────────────────────────────────────────────────────
  const beste3 = [...merkStats]
    .sort((a, b) => b.verkocht * 2 + b.verkoopPercentage - (a.verkocht * 2 + a.verkoopPercentage))
    .slice(0, 3);

  const sorteer = (kolom: SorteerKolom) => {
    if (kolom === sorteerOp) setOplopend((v) => !v);
    else {
      setSorteerOp(kolom);
      setOplopend(kolom === "merk");
    }
  };

  const pijl = (kolom: SorteerKolom) => (sorteerOp === kolom ? (oplopend ? " ↑" : " ↓") : "");

  const margeRij = (
    d: { id: number; auto_naam: string; netto_marge: number },
    positief: boolean,
  ) => {
    const kleur = d.netto_marge < 0 ? T.rood : d.netto_marge === 0 ? T.ink(0.45) : positief ? T.groen : T.amber;
    const teken = d.netto_marge > 0 ? "+ " : d.netto_marge < 0 ? "− " : "";
    return (
      <div key={d.id} className="py-1.5" style={{ borderBottom: `1px solid ${T.line}` }}>
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="truncate min-w-0" style={{ fontFamily: T.inter, fontSize: 12, color: T.navy }}>
            {d.auto_naam}
          </span>
          <span className="flex-shrink-0" style={cijferStijl(13.5, kleur)}>
            {teken}
            {fmt(Math.abs(d.netto_marge))}
          </span>
        </div>
        <Meter value={Math.abs(d.netto_marge)} max={maxMarge} color={kleur} height={3} />
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* ── KPI-strip ── */}
      <div className="lg:col-span-12 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat
          label={"Verkochte auto's"}
          value={fmtGetal(kpis.totaal_verkocht)}
          sub="totaal ooit"
          accent={T.navy}
        />
        <Stat
          label="In voorraad"
          value={fmtGetal(kpis.actieve_voorraad)}
          sub={`${fmt(kpis.voorraad_waarde)} waarde`}
          accent={T.blauw}
        />
        <Stat
          label="Voorraadwaarde"
          value={fmtKort(kpis.voorraad_waarde)}
          sub="actuele vraagprijzen"
          accent={T.teal}
        />
        <Stat
          label="Gem. verkoopprijs"
          value={kpis.gem_verkoop_prijs > 0 ? fmt(kpis.gem_verkoop_prijs) : "—"}
          sub={"over verkochte auto's"}
          accent={T.paars}
        />
        <Stat
          label="Gem. nettomarge"
          value={kpis.gem_marge !== null ? fmt(kpis.gem_marge) : "—"}
          sub="per afgerond dossier"
          accent={kpis.gem_marge !== null && kpis.gem_marge > 0 ? T.groen : T.amber}
        />
        <Stat
          label="Inkoopdossiers"
          value={fmtGetal(kpis.totaal_dossiers)}
          sub="aangemaakt in totaal"
          accent={T.amber}
        />
      </div>

      {/* ── Verkopen per maand ── */}
      <div className="lg:col-span-12 xl:col-span-8 flex flex-col">
        <Panel
          className="flex-1"
          title="Verkopen per maand"
          icon={<TrendingUp size={14} style={{ color: T.navy }} />}
          meta={`${fmtGetal(totaal12)} verkocht · ${fmtKort(omzet12)} omzet · 12 maanden`}
        >
          <div className="flex flex-col h-full">
          <div className="flex items-stretch gap-3 flex-1 min-h-0">
            {/* Y-as */}
            <div
              className="hidden sm:flex flex-col justify-between flex-shrink-0"
              style={{ minHeight: GRAFIEK_H, ...micro(T.ink(0.3)) }}
            >
              <span>{fmtGetal(maxMaand)}</span>
              <span>{fmtGetal(Math.round(maxMaand / 2))}</span>
              <span>0</span>
            </div>

            <div className="flex-1 min-w-0 flex flex-col">
              <div
                className="relative flex items-end gap-1 flex-1"
                style={{ minHeight: GRAFIEK_H, borderBottom: `1px solid ${T.line2}` }}
              >
                {/* Gemiddeldelijn */}
                {!geenMaanddata && (
                  <span
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{
                      bottom: `${Math.min(100, (gemMaand / maxMaand) * 100)}%`,
                      height: 1,
                      backgroundColor: T.ink(0.16),
                    }}
                  />
                )}

                {geenMaanddata && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
                    <p style={{ fontFamily: T.play, fontSize: 14, fontWeight: 700, color: T.navy }}>
                      Nog geen verkoopdata met datum
                    </p>
                    <p className="mt-1" style={body(11.5, T.ink(0.4))}>
                      Zet auto&apos;s op &apos;Verkocht&apos; in de voorraad — daarna vult deze grafiek zich
                      vanzelf met aantallen en omzet per maand.
                    </p>
                  </div>
                )}

                {maandRijen.map((m) => {
                  const hoogte = m.count > 0 ? Math.max((m.count / maxMaand) * 100, 3) : 0;
                  const actief = hoverMaand === m.sleutel;
                  return (
                    <div
                      key={m.sleutel}
                      className="relative flex-1 h-full flex items-end min-w-0"
                      onMouseEnter={() => setHoverMaand(m.sleutel)}
                      onMouseLeave={() => setHoverMaand(null)}
                    >
                      {actief && m.count > 0 && (
                        <div
                          className="absolute left-1/2 -translate-x-1/2 px-2 py-1 z-10 pointer-events-none"
                          style={{
                            bottom: `calc(${hoogte}% + 6px)`,
                            backgroundColor: T.navy,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span style={{ ...cijferStijl(12, "#ffffff") }}>{fmtGetal(m.count)}</span>
                          <span
                            style={{ fontFamily: T.inter, fontSize: 10, color: "rgba(255,255,255,0.65)", marginLeft: 5 }}
                          >
                            {fmtKort(m.omzet)}
                          </span>
                        </div>
                      )}
                      <div
                        className="w-full transition-all"
                        style={{
                          height: `${hoogte}%`,
                          minHeight: m.count > 0 ? 2 : 0,
                          backgroundColor: m.huidig ? T.navy : actief ? T.ink(0.35) : T.ink(0.18),
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-1 mt-1.5">
                {maandRijen.map((m) => (
                  <span
                    key={m.sleutel}
                    className="flex-1 text-center truncate"
                    style={{ ...micro(m.huidig ? T.navy : T.ink(0.3)), fontSize: 8.5, letterSpacing: "0.08em" }}
                  >
                    {MAANDEN[m.maandNr - 1]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {!geenMaanddata && (
            <div className="mt-4">
              <SectionRule
                label="Gemiddeld per maand"
                right={`${gemMaand.toFixed(1)} auto's · ${fmtKort(omzet12 / 12)} omzet`}
              />
            </div>
          )}
          </div>
        </Panel>
      </div>

      {/* ── Marge per dossier ── */}
      <div className="lg:col-span-12 xl:col-span-4 flex flex-col">
        <Panel
          className="flex-1"
          title="Marge per dossier"
          icon={<Coins size={14} style={{ color: T.navy }} />}
          meta={`${uniekeMarges} dossiers met prijzen`}
        >
          <div className="pb-4 mb-4" style={{ borderBottom: `1px solid ${T.line}` }}>
            <p style={micro()}>Gemiddelde nettomarge</p>
            <p className="mt-1.5" style={cijferStijl(34, marge_dossiers.gem !== null && marge_dossiers.gem > 0 ? T.groen : T.navy)}>
              {marge_dossiers.gem !== null ? fmt(marge_dossiers.gem) : "—"}
            </p>
          </div>

          {geenMarges ? (
            <div className="py-4">
              <p style={{ fontFamily: T.play, fontSize: 15, fontWeight: 700, color: T.navy }}>
                Nog geen marges berekend
              </p>
              <p className="mt-1.5" style={body(12, T.ink(0.45))}>
                Een marge ontstaat zodra een inkoopdossier zowel een ingevulde inkoopprijs als een
                verkoopprijs heeft. Vul die twee velden in bij een dossier en dit paneel toont
                automatisch de beste en de zwakste dossiers, met de gemiddelde nettomarge erboven.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {marge_dossiers.top.length > 0 && (
                <div>
                  <SectionRule label="Beste marges" right={`${marge_dossiers.top.length}`} />
                  <div className="mt-2">{marge_dossiers.top.map((d) => margeRij(d, true))}</div>
                </div>
              )}
              {/* Bij weinig dossiers geeft de API dezelfde rijen terug in top[] én slecht[].
                  Hetzelfde dossier onder "beste" én "laagste" tonen is misleidend, dus
                  laten we alleen de dossiers over die niet al bij de beste marges staan. */}
              {slechtUniek.length > 0 && (
                <div>
                  <SectionRule label="Laagste marges" right={`${slechtUniek.length}`} />
                  <div className="mt-2">{slechtUniek.map((d) => margeRij(d, false))}</div>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Merk prestaties ── */}
      <div className="lg:col-span-12 xl:col-span-6 flex flex-col">
        <Panel
          className="flex-1"
          title="Merk prestaties"
          icon={<Award size={14} style={{ color: T.navy }} />}
          meta={`${merkStats.length} merken · klik een kolomkop om te sorteren`}
          flush
        >
          {merkStats.length === 0 ? (
            <div className="p-4 md:p-5">
              <p style={{ fontFamily: T.play, fontSize: 15, fontWeight: 700, color: T.navy }}>
                Nog geen merkdata
              </p>
              <p className="mt-1.5" style={body(12, T.ink(0.45))}>
                Zodra er auto&apos;s in de voorraad staan, rekent dit paneel per merk uit hoeveel er
                verkocht zijn, hoeveel er nog staan en welk deel van de instroom daadwerkelijk
                doorverkocht wordt. Zo zie je in één oogopslag welke merken jouw geld verdienen.
              </p>
            </div>
          ) : (
            <>
              {/* Podium */}
              <div className="grid grid-cols-3 gap-px p-4 md:p-5 pb-0">
                {beste3.map((m, i) => (
                  <div
                    key={m.merk}
                    className="p-3 min-w-0"
                    style={{
                      backgroundColor: i === 0 ? T.navy : "rgba(0,19,55,0.02)",
                      border: `1px solid ${i === 0 ? T.navy : T.line}`,
                    }}
                  >
                    <p style={{ ...micro(i === 0 ? "rgba(255,255,255,0.45)" : T.ink(0.35)) }}>#{i + 1}</p>
                    <p className="mt-1 truncate" style={cijferStijl(16, i === 0 ? "#ffffff" : T.navy)}>
                      {m.merk}
                    </p>
                    <p
                      className="mt-1.5 truncate"
                      style={{
                        fontFamily: T.inter,
                        fontSize: 10.5,
                        color: i === 0 ? "rgba(255,255,255,0.6)" : T.ink(0.45),
                      }}
                    >
                      {m.verkocht}× verkocht · {m.verkoopPercentage}%
                    </p>
                  </div>
                ))}
              </div>

              <div className="px-4 md:px-5 pt-4">
                <SectionRule label="Alle merken" right={`${merkStats.length} totaal`} />
              </div>

              <TabelWrap>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.line2}` }}>
                    <Th onClick={() => sorteer("merk")} actief={sorteerOp === "merk"}>
                      Merk{pijl("merk")}
                    </Th>
                    <Th align="right" onClick={() => sorteer("totaal")} actief={sorteerOp === "totaal"}>
                      Totaal{pijl("totaal")}
                    </Th>
                    <Th align="right" onClick={() => sorteer("verkocht")} actief={sorteerOp === "verkocht"}>
                      Verkocht{pijl("verkocht")}
                    </Th>
                    <Th align="right" onClick={() => sorteer("beschikbaar")} actief={sorteerOp === "beschikbaar"}>
                      Beschikbaar{pijl("beschikbaar")}
                    </Th>
                    <Th align="right" onClick={() => sorteer("gemPrijs")} actief={sorteerOp === "gemPrijs"}>
                      Gem. prijs{pijl("gemPrijs")}
                    </Th>
                    <Th
                      align="right"
                      onClick={() => sorteer("verkoopPercentage")}
                      actief={sorteerOp === "verkoopPercentage"}
                      width={170}
                    >
                      Verkoop %{pijl("verkoopPercentage")}
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {gesorteerdeMerken.map((m, i) => (
                    <tr key={m.merk} style={rijStijl(i)}>
                      <Td sterk>{m.merk}</Td>
                      <Td align="right" cijfer>
                        {fmtGetal(m.totaal)}
                      </Td>
                      <Td align="right" cijfer>
                        {fmtGetal(m.verkocht)}
                      </Td>
                      <Td align="right" cijfer color={T.ink(0.5)}>
                        {fmtGetal(m.beschikbaar)}
                      </Td>
                      <Td align="right" cijfer>
                        {m.gemPrijs > 0 ? fmt(m.gemPrijs) : "—"}
                      </Td>
                      <Td align="right">
                        <div className="flex items-center gap-2 justify-end">
                          <div style={{ width: 74, flexShrink: 0 }}>
                            <Meter
                              value={m.verkoopPercentage}
                              max={100}
                              color={pctKleur(m.verkoopPercentage)}
                              height={5}
                            />
                          </div>
                          <span style={{ ...cijferStijl(13, pctKleur(m.verkoopPercentage)), width: 40, textAlign: "right" }}>
                            {m.verkoopPercentage}%
                          </span>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TabelWrap>
              <PanelVoet>
                Verkoop % = aandeel van alle ooit ingekochte auto&apos;s van dat merk dat inmiddels
                verkocht is. Groen vanaf 70%, amber vanaf 40%.
              </PanelVoet>
            </>
          )}
        </Panel>
      </div>

      {/* ── Brandstof + prijssegment ── */}
      <div className="lg:col-span-12 xl:col-span-6 flex flex-col">
        <Panel
          className="flex-1"
          title="Brandstof & prijssegment"
          icon={<BarChart3 size={14} style={{ color: T.navy }} />}
          meta="waar loopt de doorstroom het snelst"
        >
          {/* Per brandstof */}
          <SectionRule label="Per brandstof" right={`${brandstof_stats.length} soorten`} />
          <div className="mt-3 mb-5 flex flex-col">
            {brandstof_stats.length === 0 ? (
              <p style={body(12, T.ink(0.45))}>
                Nog geen brandstofverdeling. Zodra auto&apos;s een brandstoftype hebben, zie je hier
                per soort hoeveel er verkocht is en hoeveel er nog staat.
              </p>
            ) : (
              brandstof_stats.map((b) => (
                <div key={b.brandstof} className="py-2" style={{ borderBottom: `1px solid ${T.line}` }}>
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <span className="truncate" style={{ fontFamily: T.inter, fontSize: 12, color: T.navy }}>
                      {b.brandstof}
                    </span>
                    <span className="flex items-baseline gap-2 flex-shrink-0">
                      <span style={{ fontFamily: T.inter, fontSize: 10.5, color: T.ink(0.4) }}>
                        {b.verkocht}v · {b.beschikbaar}b · {b.totaal} totaal
                      </span>
                      <span style={cijferStijl(13, pctKleurZacht(b.verkoopPercentage))}>{b.verkoopPercentage}%</span>
                    </span>
                  </div>
                  <Meter
                    value={b.verkoopPercentage}
                    max={100}
                    color={pctKleurZacht(b.verkoopPercentage)}
                    height={5}
                  />
                </div>
              ))
            )}
          </div>

          {/* Per prijssegment */}
          <SectionRule label="Per prijssegment" right={`${segment_stats.length} segmenten`} />
          <div className="mt-3 flex flex-col">
            {segment_stats.length === 0 ? (
              <p style={body(12, T.ink(0.45))}>
                Nog geen segmentverdeling. Auto&apos;s worden automatisch in prijsklassen ingedeeld
                zodra ze een vraagprijs hebben.
              </p>
            ) : (
              segment_stats.map((s) => (
                <div key={s.label} className="py-2" style={{ borderBottom: `1px solid ${T.line}` }}>
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <span className="truncate" style={{ fontFamily: T.inter, fontSize: 12, color: T.navy }}>
                      {s.label}
                    </span>
                    <span className="flex items-baseline gap-2 flex-shrink-0">
                      <span style={{ fontFamily: T.inter, fontSize: 10.5, color: T.ink(0.4) }}>
                        {s.verkocht}v · {s.beschikbaar}b · {s.totaal} totaal
                      </span>
                      <span style={cijferStijl(13, pctKleurZacht(s.verkoopPercentage))}>{s.verkoopPercentage}%</span>
                    </span>
                  </div>
                  <Meter
                    value={s.verkoopPercentage}
                    max={100}
                    color={pctKleurZacht(s.verkoopPercentage)}
                    height={5}
                  />
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

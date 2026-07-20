"use client";

/**
 * Tabblad "Dossiers" — opgeslagen inkooptrajecten.
 *
 * Vervangt de oude accordeon door een volledige-breedte werkbank:
 * toolbar (filter / zoek / sortering), overzichtsstrip, dichte tabel met
 * uitklapbare detailregel waarin het dossier direct bewerkt kan worden.
 */

import { useMemo, useState } from "react";
import { Search, Plus, ChevronDown, ChevronRight, Trash2, Check, FolderOpen } from "lucide-react";
import {
  T,
  num,
  micro,
  body,
  fmt,
  fmtGetal,
  fmtKm,
  Panel,
  SectionRule,
  Stat,
  Pill,
  Field,
  inputStijl,
  Btn,
  Chip,
  Spinner,
  Skeleton,
  Foutmelding,
  Th,
  Td,
  TabelWrap,
  rijStijl,
  PanelVoet,
} from "./ui";
import { STATUS_LABELS } from "./types";
import type { InkoopDossier } from "./types";

type StatusFilter = "alle" | "nieuw" | "in_onderhandeling" | "akkoord" | "afgewezen";
type Sortering = "nieuwste" | "bod" | "merk";

type Bewerk = {
  bod_prijs: string;
  aankoopprijs: string;
  naam: string;
  telefoon: string;
  email: string;
  notitie: string;
};

const STATUS_VOLGORDE: Exclude<StatusFilter, "alle">[] = [
  "nieuw",
  "in_onderhandeling",
  "akkoord",
  "afgewezen",
];

const STATUS_UITLEG: Record<string, string> = {
  nieuw: "Net getaxeerd en opgeslagen. Er is nog geen contact geweest met de aanbieder.",
  in_onderhandeling: "Er loopt een gesprek over de prijs. Bod is uitgebracht of wordt besproken.",
  akkoord: "De deal is rond. Vul de werkelijke aankoopprijs in voor de margeberekening.",
  afgewezen: "Afgeketst of niet interessant. Telt niet mee in de openstaande bodwaarde.",
};

const nr = (v: number | string) => {
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Kilometerstand komt als vrije tekst binnen ("125.000", "125000 km").
 * Alleen cijfers tellen — een punt is hier een duizendtalscheiding, geen decimaal.
 */
const kmNr = (v: string) => parseInt(String(v).replace(/\D/g, ""), 10) || 0;

const statusInfo = (s: string) => STATUS_LABELS[s] ?? { label: s || "Onbekend", color: T.navy, bg: T.wash };

export default function DossiersTab({
  dossiers,
  herlaad,
  onNieuweTaxatie,
}: {
  dossiers: InkoopDossier[] | null;
  herlaad: () => Promise<void> | void;
  onNieuweTaxatie: () => void;
}) {
  const [filter, setFilter] = useState<StatusFilter>("alle");
  const [zoek, setZoek] = useState("");
  const [sortering, setSortering] = useState<Sortering>("nieuwste");
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<Bewerk | null>(null);
  const [bezig, setBezig] = useState(false);
  const [opgeslagenId, setOpgeslagenId] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  // ── Afgeleide cijfers ───────────────────────────────────────────
  const tellers = useMemo(() => {
    const t: Record<string, number> = { alle: dossiers?.length ?? 0 };
    for (const s of STATUS_VOLGORDE) t[s] = dossiers?.filter((d) => d.status === s).length ?? 0;
    return t;
  }, [dossiers]);

  const bodwaarde = useMemo(
    () =>
      (dossiers ?? [])
        .filter((d) => d.status !== "afgewezen")
        .reduce((som, d) => som + nr(d.bod_prijs), 0),
    [dossiers],
  );

  const zichtbaar = useMemo(() => {
    if (!dossiers) return [];
    const q = zoek.trim().toLowerCase();
    const lijst = dossiers
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => (filter === "alle" ? true : d.status === filter))
      .filter(({ d }) => {
        if (!q) return true;
        return [d.merk, d.model, d.kenteken, d.naam]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      });

    if (sortering === "bod") lijst.sort((a, b) => nr(b.d.bod_prijs) - nr(a.d.bod_prijs));
    else if (sortering === "merk")
      lijst.sort((a, b) =>
        `${a.d.merk} ${a.d.model}`.localeCompare(`${b.d.merk} ${b.d.model}`, "nl"),
      );
    else lijst.sort((a, b) => a.i - b.i); // API levert al op datum aflopend

    return lijst.map(({ d }) => d);
  }, [dossiers, filter, zoek, sortering]);

  // ── Acties ──────────────────────────────────────────────────────
  /** Geeft true terug bij succes, zodat de aanroeper weet of hij "Opgeslagen" mag tonen. */
  const patch = async (id: string, data: Record<string, string | number>) => {
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch(`/api/admin/inkoop/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        setFout("Opslaan is niet gelukt. De wijziging is niet doorgevoerd — probeer het opnieuw.");
        return false;
      }
      await herlaad();
      return true;
    } catch {
      setFout("Geen verbinding met de server. De wijziging is niet opgeslagen.");
      return false;
    } finally {
      setBezig(false);
    }
  };

  const wijzigStatus = async (id: string, status: string) => {
    await patch(id, { status });
  };

  const verwijder = async (id: string) => {
    if (!confirm("Dossier verwijderen?")) return;
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch(`/api/admin/inkoop/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setFout("Verwijderen is niet gelukt. Het dossier staat er nog.");
        return;
      }
      if (openId === id) {
        setOpenId(null);
        setForm(null);
      }
      await herlaad();
    } catch {
      setFout("Geen verbinding met de server. Het dossier is niet verwijderd.");
    } finally {
      setBezig(false);
    }
  };

  const klapUit = (d: InkoopDossier) => {
    if (openId === d.id) {
      setOpenId(null);
      setForm(null);
      return;
    }
    setOpenId(d.id);
    setOpgeslagenId(null);
    setFout(null);
    setForm({
      bod_prijs: String(nr(d.bod_prijs) || ""),
      aankoopprijs: String(nr(d.aankoopprijs) || ""),
      naam: d.naam ?? "",
      telefoon: d.telefoon ?? "",
      email: d.email ?? "",
      notitie: d.notitie ?? "",
    });
  };

  const bewaar = async (d: InkoopDossier) => {
    if (!form) return;
    const wijziging: Record<string, string | number> = {};
    if (nr(form.bod_prijs) !== nr(d.bod_prijs)) wijziging.bod_prijs = nr(form.bod_prijs);
    if (nr(form.aankoopprijs) !== nr(d.aankoopprijs)) wijziging.aankoopprijs = nr(form.aankoopprijs);
    if (form.naam !== (d.naam ?? "")) wijziging.naam = form.naam;
    if (form.telefoon !== (d.telefoon ?? "")) wijziging.telefoon = form.telefoon;
    if (form.email !== (d.email ?? "")) wijziging.email = form.email;
    if (form.notitie !== (d.notitie ?? "")) wijziging.notitie = form.notitie;

    if (Object.keys(wijziging).length === 0) {
      setOpgeslagenId(d.id);
      return;
    }
    const gelukt = await patch(d.id, wijziging);
    if (gelukt) setOpgeslagenId(d.id);
  };

  const zetVeld = (sleutel: keyof Bewerk, waarde: string) => {
    setForm((f) => (f ? { ...f, [sleutel]: waarde } : f));
    setOpgeslagenId(null);
    setFout(null);
  };

  // ── Laden ───────────────────────────────────────────────────────
  if (dossiers === null) {
    return (
      <div className="flex flex-col gap-4">
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-3"
          style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}
        >
          {[70, 60, 120, 80, 90].map((w, i) => (
            <Skeleton key={i} w={w} h={26} />
          ))}
          <span className="ml-auto flex items-center gap-3">
            <Skeleton w={220} h={30} />
            <Skeleton w={130} h={30} />
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="p-3.5" style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}>
              <Skeleton w={80} h={9} />
              <span className="block mt-2.5">
                <Skeleton w={110} h={24} />
              </span>
              <span className="block mt-2.5">
                <Skeleton w={60} h={9} />
              </span>
            </div>
          ))}
        </div>

        <Panel title="Dossiers" meta="Laden" flush>
          <div>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-6 px-4"
                style={{ ...rijStijl(i), height: 52 }}
              >
                <Skeleton w={70} h={11} />
                <Skeleton w={200} h={11} />
                <Skeleton w={70} h={11} />
                <Skeleton w={80} h={11} />
                <Skeleton w={80} h={11} />
                <span className="hidden lg:block">
                  <Skeleton w={140} h={11} />
                </span>
                <span className="ml-auto">
                  <Skeleton w={90} h={16} />
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  // ── Leeg ────────────────────────────────────────────────────────
  if (dossiers.length === 0) {
    const stappen = [
      {
        titel: "Taxeer een kenteken",
        tekst:
          "Open de Taxatietool, vul kenteken en kilometerstand in en laat de markt- en koerslijstwaarde berekenen.",
      },
      {
        titel: "Sla de taxatie op als dossier",
        tekst:
          "Voeg het maximale bod, de contactgegevens van de aanbieder en een notitie toe. Het dossier verschijnt hier.",
      },
      {
        titel: "Volg het traject",
        tekst:
          "Werk de status bij van nieuw naar in onderhandeling naar akkoord, en vul bij aankoop de werkelijke prijs in.",
      },
    ];

    return (
      <Panel
        title="Nog geen inkoopdossiers"
        icon={<FolderOpen size={14} style={{ color: T.ink(0.4) }} />}
        meta="Zo werkt het"
        actions={<Btn onClick={onNieuweTaxatie}>Ga naar de Taxatietool</Btn>}
      >
        <p className="max-w-3xl mb-6" style={body(13)}>
          Een dossier is een opgeslagen taxatie met contactgegevens en een status. Zo houdt u elk lopend
          inkooptraject bij elkaar: wat de markt vraagt, wat u maximaal wilt bieden en waar het gesprek staat.
        </p>

        <SectionRule label="In drie stappen" right="Van kenteken naar aankoop" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4 mb-8">
          {stappen.map((s, i) => (
            <div
              key={s.titel}
              className="p-4"
              style={{ backgroundColor: "rgba(0,19,55,0.02)", border: `1px solid ${T.line}` }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 26, height: 26, backgroundColor: T.navy, ...num(12), color: "#ffffff" }}
                >
                  {i + 1}
                </span>
                <p style={{ fontFamily: T.play, fontSize: 14, fontWeight: 700, color: T.navy }}>{s.titel}</p>
              </div>
              <p style={body(12.5)}>{s.tekst}</p>
            </div>
          ))}
        </div>

        <SectionRule label="De vier statussen" right="Kleurcodering in de tabel" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
          {STATUS_VOLGORDE.map((s) => {
            const info = statusInfo(s);
            return (
              <div
                key={s}
                className="p-4"
                style={{ backgroundColor: T.paper, border: `1px solid ${T.line}`, borderLeft: `3px solid ${info.color}` }}
              >
                <Pill color={info.color} bg={info.bg}>
                  {info.label}
                </Pill>
                <p className="mt-2.5" style={body(12)}>
                  {STATUS_UITLEG[s]}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-8">
          <Btn onClick={onNieuweTaxatie} size="lg">
            <Plus size={13} /> Nieuwe taxatie starten
          </Btn>
        </div>
      </Panel>
    );
  }

  // ── Gevuld ──────────────────────────────────────────────────────
  const open = tellers.nieuw + tellers.in_onderhandeling;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar ── */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3"
        style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={filter === "alle"} onClick={() => setFilter("alle")}>
            Alle <span style={{ opacity: 0.6 }}>{tellers.alle}</span>
          </Chip>
          {STATUS_VOLGORDE.map((s) => {
            const info = statusInfo(s);
            return (
              <Chip key={s} active={filter === s} onClick={() => setFilter(s)} color={info.color}>
                {info.label} <span style={{ opacity: 0.6 }}>{tellers[s]}</span>
              </Chip>
            );
          })}
        </div>

        <span className="hidden xl:block" style={{ width: 1, height: 18, backgroundColor: T.line2 }} />

        <div className="flex items-center gap-1.5">
          <span style={micro()}>Sorteer</span>
          <Chip active={sortering === "nieuwste"} onClick={() => setSortering("nieuwste")}>
            Nieuwste
          </Chip>
          <Chip active={sortering === "bod"} onClick={() => setSortering("bod")}>
            Hoogste bod
          </Chip>
          <Chip active={sortering === "merk"} onClick={() => setSortering("merk")}>
            Merk
          </Chip>
        </div>

        <div className="flex items-center gap-2.5 ml-auto w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none" style={{ minWidth: 200 }}>
            <Search
              size={13}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.ink(0.3) }}
            />
            <input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek merk, model, kenteken of naam"
              style={{ ...inputStijl, padding: "7px 12px 7px 30px", fontSize: 12 }}
            />
          </div>
          <Btn onClick={onNieuweTaxatie}>
            <Plus size={13} /> Nieuwe taxatie
          </Btn>
        </div>
      </div>

      {fout && <Foutmelding>{fout}</Foutmelding>}

      {/* ── Overzichtsstrip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Totaal dossiers" value={fmtGetal(tellers.alle)} sub="Alle opgeslagen trajecten" />
        <Stat
          label="Open"
          value={fmtGetal(open)}
          sub="Nieuw en in onderhandeling"
          accent={T.blauw}
        />
        <Stat label="Akkoord" value={fmtGetal(tellers.akkoord)} sub="Deal rond" accent={T.groen} />
        <Stat
          label="Totale bodwaarde"
          value={fmt(bodwaarde)}
          sub="Som van alle biedingen, afgewezen niet meegerekend"
          accent={T.navy}
        />
      </div>

      {/* ── Tabel ── */}
      <Panel
        title="Inkoopdossiers"
        icon={<FolderOpen size={14} style={{ color: T.ink(0.4) }} />}
        meta={`${zichtbaar.length} van ${tellers.alle}`}
        actions={bezig ? <Spinner size={14} /> : undefined}
        flush
      >
        {zichtbaar.length === 0 ? (
          <div className="px-4 md:px-5 py-12 text-center">
            <p style={{ fontFamily: T.play, fontSize: 15, fontWeight: 700, color: T.navy }}>
              Geen dossiers in deze selectie
            </p>
            <p className="mt-1.5 mx-auto max-w-md" style={body(12.5)}>
              Er zijn wel {tellers.alle} dossiers, maar geen enkele voldoet aan het huidige filter of de zoekterm.
              Kies &quot;Alle&quot; of wis het zoekveld om alles terug te zien.
            </p>
            <div className="mt-4 inline-flex gap-2">
              <Btn
                variant="ghost"
                onClick={() => {
                  setFilter("alle");
                  setZoek("");
                }}
              >
                Filters wissen
              </Btn>
              <Btn onClick={onNieuweTaxatie}>
                <Plus size={13} /> Nieuwe taxatie
              </Btn>
            </div>
          </div>
        ) : (
          <TabelWrap>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.line2}` }}>
                <Th width={100}>Datum</Th>
                <Th>Auto</Th>
                <Th align="right" width={110}>
                  Km
                </Th>
                <Th align="right" width={120}>
                  Marktprijs
                </Th>
                <Th align="right" width={120}>
                  Max bod
                </Th>
                <Th align="right" width={120}>
                  Aankoop
                </Th>
                <Th width={190}>Contact</Th>
                <Th width={150}>Status</Th>
                <Th align="center" width={44}>
                  {""}
                </Th>
              </tr>
            </thead>
            <tbody>
              {zichtbaar.map((d, i) => {
                const isOpen = openId === d.id;
                const info = statusInfo(d.status);
                const aankoop = nr(d.aankoopprijs);
                return [
                  <tr
                    key={d.id}
                    onClick={() => klapUit(d)}
                    className="cursor-pointer transition-colors hover:bg-[rgba(0,19,55,0.03)]"
                    style={{
                      ...rijStijl(i),
                      backgroundColor: isOpen ? "rgba(0,19,55,0.045)" : rijStijl(i).backgroundColor,
                      borderLeft: `3px solid ${isOpen ? T.navy : "transparent"}`,
                    }}
                  >
                    <Td>{d.datum || "—"}</Td>
                    <Td>
                      <span style={{ ...num(13.5), display: "block" }}>
                        {[d.merk, d.model].filter(Boolean).join(" ") || "Onbekend"}
                        {d.bouwjaar ? ` ${d.bouwjaar}` : ""}
                      </span>
                      <span style={{ ...micro(T.ink(0.35)), display: "block", marginTop: 3 }}>
                        {d.kenteken || "Geen kenteken"}
                      </span>
                    </Td>
                    <Td align="right" cijfer>
                      {kmNr(d.km) ? fmtGetal(kmNr(d.km)) : "—"}
                    </Td>
                    <Td align="right" cijfer>
                      {nr(d.aanbod_prijs) ? fmt(nr(d.aanbod_prijs)) : "—"}
                    </Td>
                    <Td align="right" cijfer color={nr(d.bod_prijs) ? T.navy : T.ink(0.3)}>
                      {nr(d.bod_prijs) ? fmt(nr(d.bod_prijs)) : "—"}
                    </Td>
                    <Td align="right" cijfer color={aankoop ? T.groen : T.ink(0.3)}>
                      {aankoop ? fmt(aankoop) : "—"}
                    </Td>
                    <Td>
                      <span style={{ display: "block", color: T.navy, fontWeight: 600 }}>
                        {d.naam || "Onbekend"}
                      </span>
                      <span style={{ ...micro(T.ink(0.35)), display: "block", marginTop: 3 }}>
                        {d.telefoon || "Geen nummer"}
                      </span>
                    </Td>
                    <Td>
                      <Pill color={info.color} bg={info.bg}>
                        {info.label}
                      </Pill>
                    </Td>
                    <Td align="center">
                      {isOpen ? (
                        <ChevronDown size={14} style={{ color: T.navy, display: "inline" }} />
                      ) : (
                        <ChevronRight size={14} style={{ color: T.ink(0.3), display: "inline" }} />
                      )}
                    </Td>
                  </tr>,

                  isOpen && form ? (
                    <tr key={`${d.id}-detail`} style={{ borderBottom: `1px solid ${T.line2}` }}>
                      <td colSpan={9} style={{ padding: 0, backgroundColor: T.wash }}>
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 md:p-5">
                          {/* Links: alle gegevens */}
                          <div className="lg:col-span-5 min-w-0">
                            <SectionRule label="Dossiergegevens" right={`ID ${d.id.slice(0, 8)}`} />
                            <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5 mt-3.5">
                              {[
                                ["Kenteken", d.kenteken || "—"],
                                ["Bouwjaar", d.bouwjaar || "—"],
                                ["Kilometerstand", kmNr(d.km) ? fmtKm(kmNr(d.km)) : "—"],
                                ["Kleur", d.kleur || "—"],
                                ["VIN", d.vin || "—"],
                                ["Datum", d.datum || "—"],
                                ["Marktprijs", nr(d.aanbod_prijs) ? fmt(nr(d.aanbod_prijs)) : "—"],
                                ["Max bod", nr(d.bod_prijs) ? fmt(nr(d.bod_prijs)) : "—"],
                                ["Aankoopprijs", aankoop ? fmt(aankoop) : "—"],
                                ["E-mail", d.email || "—"],
                              ].map(([label, waarde]) => (
                                <div key={label} className="min-w-0">
                                  <dt style={micro()}>{label}</dt>
                                  <dd
                                    className="truncate"
                                    style={{
                                      fontFamily: T.inter,
                                      fontSize: 12.5,
                                      fontWeight: 600,
                                      color: T.navy,
                                      marginTop: 2,
                                    }}
                                    title={waarde}
                                  >
                                    {waarde}
                                  </dd>
                                </div>
                              ))}
                            </dl>

                            <div className="mt-4">
                              <SectionRule label="Notitie" />
                              <div
                                className="mt-2.5 px-3.5 py-3"
                                style={{
                                  backgroundColor: T.paper,
                                  border: `1px solid ${T.line}`,
                                  borderLeft: `3px solid ${T.line2}`,
                                }}
                              >
                                <p style={body(12.5, d.notitie ? T.ink(0.7) : T.ink(0.35))}>
                                  {d.notitie || "Geen notitie vastgelegd bij dit dossier."}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Midden: bewerken */}
                          <div className="lg:col-span-4 min-w-0">
                            <SectionRule
                              label="Bewerken"
                              right={opgeslagenId === d.id ? "Opgeslagen" : undefined}
                            />
                            <div className="grid grid-cols-2 gap-3 mt-3.5">
                              <Field label="Max bod (€)">
                                <input
                                  type="number"
                                  value={form.bod_prijs}
                                  onChange={(e) => zetVeld("bod_prijs", e.target.value)}
                                  style={inputStijl}
                                />
                              </Field>
                              <Field label="Aankoopprijs (€)">
                                <input
                                  type="number"
                                  value={form.aankoopprijs}
                                  onChange={(e) => zetVeld("aankoopprijs", e.target.value)}
                                  style={inputStijl}
                                />
                              </Field>
                              <div className="col-span-2">
                                <Field label="Naam aanbieder">
                                  <input
                                    value={form.naam}
                                    onChange={(e) => zetVeld("naam", e.target.value)}
                                    style={inputStijl}
                                  />
                                </Field>
                              </div>
                              <Field label="Telefoon">
                                <input
                                  value={form.telefoon}
                                  onChange={(e) => zetVeld("telefoon", e.target.value)}
                                  style={inputStijl}
                                />
                              </Field>
                              <Field label="E-mail">
                                <input
                                  value={form.email}
                                  onChange={(e) => zetVeld("email", e.target.value)}
                                  style={inputStijl}
                                />
                              </Field>
                              <div className="col-span-2">
                                <Field label="Notitie" hint="Afspraken, staat van de auto, vervolgstappen.">
                                  <textarea
                                    value={form.notitie}
                                    onChange={(e) => zetVeld("notitie", e.target.value)}
                                    rows={3}
                                    style={{ ...inputStijl, resize: "vertical", lineHeight: 1.6 }}
                                  />
                                </Field>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 mt-3.5">
                              <Btn onClick={() => bewaar(d)} disabled={bezig}>
                                {bezig ? <Spinner size={12} tone="donker" /> : <Check size={13} />} Opslaan
                              </Btn>
                              {opgeslagenId === d.id && !bezig && (
                                <span
                                  className="inline-flex items-center gap-1.5"
                                  style={{ fontFamily: T.inter, fontSize: 11.5, fontWeight: 600, color: T.groen }}
                                >
                                  <Check size={13} /> Opgeslagen
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Rechts: status en verwijderen */}
                          <div className="lg:col-span-3 min-w-0">
                            <SectionRule label="Status" />
                            <div className="flex flex-wrap gap-1.5 mt-3.5">
                              {STATUS_VOLGORDE.map((s) => {
                                const si = statusInfo(s);
                                return (
                                  <Chip
                                    key={s}
                                    active={d.status === s}
                                    color={si.color}
                                    onClick={() => wijzigStatus(d.id, s)}
                                  >
                                    {si.label}
                                  </Chip>
                                );
                              })}
                            </div>
                            <p className="mt-3" style={body(11.5)}>
                              {STATUS_UITLEG[d.status] ?? "Kies een status om het traject te volgen."}
                            </p>

                            <div className="mt-5">
                              <SectionRule label="Gevarenzone" />
                              <p className="mt-2.5 mb-2.5" style={body(11.5)}>
                                Verwijderen kan niet ongedaan worden gemaakt. Zet een afgeketste deal liever op
                                &quot;Afgewezen&quot;, dan blijft de historie bewaard.
                              </p>
                              <button
                                type="button"
                                onClick={() => verwijder(d.id)}
                                disabled={bezig}
                                className="inline-flex items-center justify-center gap-2 transition-all hover:opacity-85 disabled:opacity-35"
                                style={{
                                  padding: "9px 16px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  fontFamily: T.inter,
                                  color: T.rood,
                                  backgroundColor: "transparent",
                                  border: `1px solid ${T.rood}`,
                                }}
                              >
                                <Trash2 size={13} /> Dossier verwijderen
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </TabelWrap>
        )}

        <PanelVoet>
          Klik op een regel om het dossier te openen, gegevens bij te werken en de status te wijzigen.
          Bedragen zijn inkoopbedragen inclusief eventuele marge-afspraken; de totale bodwaarde telt afgewezen
          dossiers niet mee.
        </PanelVoet>
      </Panel>
    </div>
  );
}

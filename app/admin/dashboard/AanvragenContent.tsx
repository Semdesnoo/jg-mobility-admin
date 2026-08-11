"use client";

import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Plus, Trash2, Check, Phone, Mail, MessageCircle, Store,
  Globe, Calculator, Sparkles, Copy, Car, CalendarDays, Users, AtSign, ExternalLink, Search,
  Pencil,
  ChevronDown,
  Archive,
} from "lucide-react";
import {
  T, micro, body, klein, Panel, Btn, Field, inputStijl,
  Spinner, Empty, Foutmelding, Pill, PanelVoet,
} from "./inkoop/ui";
import { useAiTaak } from "./AiTaken";
import { useDialoog } from "./Dialoog";

/**
 * Dagoverzicht van aanvragen.
 *
 * WAAROM DIT SCHERM BESTAAT
 * Vragen komen binnen via de mail, WhatsApp, Instagram, de telefoon en aan de balie, en
 * verdwijnen daarna in vijf verschillende postvakken. Wat er overblijft is het gevoel dat
 * je iemand vergeten bent, zonder te kunnen nagaan wie.
 *
 * TWEE MANIEREN OM NAAR DEZELFDE LIJST TE KIJKEN
 * Per dag zie je wat er binnenkwam en wat er nog ligt. Per auto zie je wie er allemaal
 * achter dezelfde auto aan zitten, wat ze boden en wat ze willen inruilen. Dat tweede is
 * het punt: bel je iemand over de Golf, dan wil je weten dat er nog drie anderen wachten
 * en wat de hoogste bood. Op datum sorteren verspreidt die vier mensen over een week.
 */

type Aanvraag = {
  id: string;
  naam: string; telefoon: string; email: string;
  bron: string; interesse: string; budget: string; notitie: string;
  status: string; aangemaakt: string;
  gmail_message_id: string | null;
  onderwerp: string; kenteken: string;
  auto_id: number | null; auto_naam: string; bod: string; ons_bod: string; inruil: string;
  advertentie_titel: string; advertentie_url: string; bericht: string;
  antwoord: string; antwoord_verstuurd_op: string | null; afgehandeld_op: string | null;
};

type Auto = { id: number; merk?: string; model?: string; kenteken?: string; prijs?: number; verkocht?: boolean };

/**
 * Hoe een kanaal eruitziet. Welke kanalen er BESTAAN komt van de server mee — deze tabel
 * gaat alleen over label, pictogram en kleur. Zet iemand er later een kanaal bij in
 * aanvragen-db.ts, dan verschijnt dat vanzelf in de keuzelijst; het krijgt dan de neutrale
 * weergave hieronder tot er een eigen regel voor is.
 */
const KANAAL: Record<string, { label: string; Icon: typeof Mail; kleur: string }> = {
  mail: { label: "Mail", Icon: Mail, kleur: "#2563eb" },
  whatsapp: { label: "WhatsApp", Icon: MessageCircle, kleur: "#16a34a" },
  instagram: { label: "Instagram", Icon: AtSign, kleur: "#c026d3" },
  telefoon: { label: "Telefoon", Icon: Phone, kleur: "#0891b2" },
  balie: { label: "Balie", Icon: Store, kleur: "#b45309" },
  website: { label: "Website", Icon: Globe, kleur: "#4f46e5" },
  marktplaats: { label: "Marktplaats", Icon: Globe, kleur: "#ea580c" },
  autoscout: { label: "AutoScout24", Icon: Globe, kleur: "#eab308" },
  overig: { label: "Overig", Icon: Globe, kleur: T.ink(0.4) },
};

const STATUS: Record<string, { label: string; kleur: string }> = {
  nieuw: { label: "Nieuw", kleur: T.amber },
  contact_gehad: { label: "Contact gehad", kleur: T.blauw },
  afspraak: { label: "Afspraak", kleur: "#7c3aed" },
  deal: { label: "Deal", kleur: T.groen },
  verloren: { label: "Verloren", kleur: T.rood },
};

/** Alle filtervelden even hoog: de padding bepaalt de hoogte, niet een vaste maat. */
const FILTER_VELD = { ...inputStijl, padding: "7px 10px", fontSize: 12.5 } as const;

/**
 * Eén knop uit een keuze. Aan elkaar vast betekent "kies er één"; losse chips zouden
 * lezen als schakelaars die allemaal tegelijk aan kunnen staan.
 */
function Segment({
  actief, onClick, children, omrand = false,
}: {
  actief: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Los van een groep? Dan heeft hij zijn eigen rand nodig. */
  omrand?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 transition-all hover:opacity-80 whitespace-nowrap"
      style={{
        padding: "7px 11px",
        fontFamily: T.inter,
        fontSize: 12,
        fontWeight: 600,
        color: actief ? "#ffffff" : T.ink(0.55),
        backgroundColor: actief ? T.navy : "transparent",
        border: omrand ? `1px solid ${actief ? T.navy : T.line2}` : "none",
      }}
    >
      {children}
    </button>
  );
}

/**
 * Keuzelijst met een pictogram of een kleurstip per regel.
 *
 * Een gewone `<select>` kan dat niet: de browser tekent de opties zelf en negeert alles
 * wat je erin zet behalve tekst. Voor het kanaal wil je het merkje van WhatsApp of
 * Instagram zien, en voor de status meteen aan de kleur zien of iets goed of slecht
 * afliep — dat leest sneller dan het woord.
 */
function Keuzelijst({
  waarde, opties, leegLabel, onKies, breedte,
}: {
  waarde: string;
  opties: { id: string; label: string; kleur?: string; Icon?: typeof Mail }[];
  /** Regel bovenaan die "geen filter" betekent. Weglaten maakt kiezen verplicht. */
  leegLabel?: string;
  onKies: (id: string) => void;
  /** Vaste breedte in de filterbalk; weglaten laat hem het veld vullen. */
  breedte?: number;
}) {
  const [open, setOpen] = useState(false);
  const vak = useRef<HTMLDivElement>(null);
  const gekozen = opties.find((o) => o.id === waarde);

  // Klik ergens anders sluit de lijst. Zonder dit blijft hij openstaan zodra je hem
  // ergens naast aanklikt, en dan liggen er twee lijsten over het scherm.
  useEffect(() => {
    if (!open) return;
    const buiten = (e: MouseEvent) => {
      if (vak.current && !vak.current.contains(e.target as Node)) setOpen(false);
    };
    const ontsnap = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", buiten);
    document.addEventListener("keydown", ontsnap);
    return () => {
      document.removeEventListener("mousedown", buiten);
      document.removeEventListener("keydown", ontsnap);
    };
  }, [open]);

  return (
    <div ref={vak} className="relative" style={{ width: breedte ?? "100%" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left"
        style={{ ...FILTER_VELD, paddingRight: 24 }}
      >
        {gekozen?.Icon && <gekozen.Icon size={12} color={gekozen.kleur ?? T.ink(0.5)} style={{ flexShrink: 0 }} />}
        {gekozen && !gekozen.Icon && gekozen.kleur && (
          <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, backgroundColor: gekozen.kleur }} />
        )}
        <span className="flex-1 min-w-0 truncate" style={{ color: gekozen ? T.navy : T.ink(0.45) }}>
          {gekozen?.label ?? leegLabel ?? "Kies…"}
        </span>
        <ChevronDown size={12} color={T.ink(0.35)} style={{ position: "absolute", right: 8, flexShrink: 0 }} />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-auto"
          style={{ backgroundColor: T.paper, border: `1px solid ${T.line2}`, boxShadow: "0 10px 30px rgba(0,19,55,0.14)" }}
        >
          {leegLabel && (
            <Regelkeuze actief={!waarde} onClick={() => { onKies(""); setOpen(false); }}>
              <span style={{ color: T.ink(0.45) }}>{leegLabel}</span>
            </Regelkeuze>
          )}
          {opties.map((o) => (
            <Regelkeuze key={o.id} actief={o.id === waarde} onClick={() => { onKies(o.id); setOpen(false); }}>
              {o.Icon ? (
                <o.Icon size={13} color={o.kleur ?? T.ink(0.5)} style={{ flexShrink: 0 }} />
              ) : (
                <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, backgroundColor: o.kleur ?? T.ink(0.3) }} />
              )}
              <span className="truncate" style={{ color: o.kleur && !o.Icon ? o.kleur : T.navy, fontWeight: o.kleur && !o.Icon ? 600 : 400 }}>
                {o.label}
              </span>
            </Regelkeuze>
          ))}
        </div>
      )}
    </div>
  );
}

function Regelkeuze({
  children, actief, onClick,
}: { children: ReactNode; actief: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 w-full px-2.5 py-2 text-left transition-all hover:bg-[rgba(0,19,55,0.04)]"
      style={{
        fontFamily: T.inter,
        fontSize: 12.5,
        backgroundColor: actief ? "rgba(0,19,55,0.05)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

/** "vandaag" / "gisteren" / "maandag 10 augustus" — een datum die je zonder rekenen leest. */
function dagKop(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Onbekende datum";
  const vandaag = new Date();
  const dag = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  if (dag(d) === dag(vandaag)) return "Vandaag";
  const gisteren = new Date(vandaag);
  gisteren.setDate(gisteren.getDate() - 1);
  if (dag(d) === dag(gisteren)) return "Gisteren";
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}

const tijd = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
};

export default function AanvragenContent({
  onNaarTaxatie,
}: {
  /** Doorsturen naar de taxatietool met dit kenteken al ingevuld. */
  onNaarTaxatie?: (kenteken: string) => void;
}) {
  const [aanvragen, setAanvragen] = useState<Aanvraag[] | null>(null);
  const [autos, setAutos] = useState<Auto[]>([]);
  const [kanalen, setKanalen] = useState<string[]>(Object.keys(KANAAL));
  const [fout, setFout] = useState("");
  const [blad, setBlad] = useState<"dag" | "auto">("dag");
  const [weergave, setWeergave] = useState<"open" | "archief">("open");
  const [zoek, setZoek] = useState("");
  // De bewerkstand staat hier en niet in het detailpaneel, zodat de knop in de balk
  // bovenaan kan staan in plaats van op een eigen regel boven de kolommen.
  const [bewerken, setBewerken] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [kanaalFilter, setKanaalFilter] = useState("");
  const [nieuw, setNieuw] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/aanvragen")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setAanvragen(Array.isArray(d?.aanvragen) ? d.aanvragen : []);
        if (Array.isArray(d?.kanalen) && d.kanalen.length) setKanalen(d.kanalen);
      })
      .catch(() => setAanvragen([]));
    fetch("/api/admin/autos")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAutos(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const herlaad = async () => {
    const r = await fetch("/api/admin/aanvragen").catch(() => null);
    if (!r?.ok) return;
    const d = await r.json().catch(() => null);
    if (Array.isArray(d?.aanvragen)) setAanvragen(d.aanvragen);
  };

  const zichtbaar = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    return (aanvragen ?? []).filter((a) => {
      // Open en archief zijn twee gescheiden lijsten. Alles door elkaar tonen maakt van
      // het dagoverzicht juist weer een hooiberg.
      if (weergave === "open" ? !!a.afgehandeld_op : !a.afgehandeld_op) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (kanaalFilter && a.bron !== kanaalFilter) return false;
      if (!term) return true;
      // Zoeken over alles waar je het aan zou herkennen: de persoon, zijn auto, onze auto,
      // en wat hij letterlijk zei. Dat laatste is vaak het enige wat je nog weet.
      return [
        a.naam, a.telefoon, a.email, a.onderwerp, a.interesse,
        a.advertentie_titel, a.auto_naam, a.kenteken, a.bericht, a.notitie,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [aanvragen, weergave, zoek, statusFilter, kanaalFilter]);

  // Per dag, nieuwste dag eerst. De volgorde binnen een dag komt uit de API (nieuwste eerst).
  const perDag = useMemo(() => {
    const m = new Map<string, Aanvraag[]>();
    for (const a of zichtbaar) {
      const k = (a.aangemaakt || "").slice(0, 10);
      (m.get(k) ?? m.set(k, []).get(k)!).push(a);
    }
    return [...m.entries()].sort((x, y) => (x[0] < y[0] ? 1 : -1));
  }, [zichtbaar]);

  // Per auto, drukste eerst. Zonder koppeling valt hij terug op kenteken of onderwerp,
  // want een aanvraag die nergens te vinden is, is erger dan een groep van één.
  const perAuto = useMemo(() => {
    const m = new Map<string, { naam: string; rijen: Aanvraag[] }>();
    for (const a of zichtbaar) {
      const naam = a.auto_naam || a.kenteken || a.interesse || "Zonder auto";
      const k = a.auto_id != null ? `id:${a.auto_id}` : `n:${naam.toLowerCase()}`;
      const g = m.get(k) ?? { naam, rijen: [] };
      g.rijen.push(a);
      m.set(k, g);
    }
    return [...m.values()].sort((x, y) => y.rijen.length - x.rijen.length);
  }, [zichtbaar]);

  const openAanvraag = useMemo(() => {
    const aangewezen = (aanvragen ?? []).find((a) => a.id === open);
    // Niets aangewezen? Dan de bovenste uit de lijst. Anders rendert de rechterkolom
    // niets en staat de halve pagina leeg terwijl er gewoon werk ligt.
    return aangewezen ?? zichtbaar[0] ?? null;
  }, [aanvragen, open, zichtbaar]);

  const nogTeDoen = (aanvragen ?? []).filter((a) => !a.afgehandeld_op).length;
  const inArchief = (aanvragen ?? []).filter((a) => a.afgehandeld_op).length;
  const vandaag = perDag[0]?.[0] === new Date().toISOString().slice(0, 10) ? perDag[0][1].length : 0;

  return (
    <div className="px-4 md:px-6 py-4 md:py-5 w-full">
      {fout && <div className="mb-4"><Foutmelding>{fout}</Foutmelding></div>}

      {/* Eén balk in plaats van losse chips van verschillende breedte.
          Geen vaste hoogte op de velden: die botst met de padding van het standaardveld
          en knipt de tekst onderaan af. De padding bepaalt de hoogte, dan zijn ze
          vanzelf allemaal even hoog. */}
      <div
        className="flex flex-wrap items-center gap-2 px-3 py-2.5 mb-4"
        style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}
      >
        {/* Twee knoppen die aan elkaar vast zitten lezen als één keuze; twee losse
            chips lezen als twee dingen die allebei aan kunnen staan. */}
        <div className="flex" style={{ border: `1px solid ${T.line2}` }}>
          <Segment actief={blad === "dag"} onClick={() => setBlad("dag")}>
            <CalendarDays size={11} /> Per dag
          </Segment>
          <Segment actief={blad === "auto"} onClick={() => setBlad("auto")}>
            <Car size={11} /> Per auto
          </Segment>
        </div>

        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search
            size={13}
            color={T.ink(0.3)}
            style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          />
          <input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek op naam, auto, kenteken of wat hij zei…"
            style={{ ...FILTER_VELD, paddingLeft: 28 }}
          />
        </div>

        <Keuzelijst
          waarde={statusFilter}
          leegLabel="Elke status"
          breedte={148}
          onKies={setStatusFilter}
          opties={Object.entries(STATUS).map(([id, st]) => ({ id, label: st.label, kleur: st.kleur }))}
        />

        <Keuzelijst
          waarde={kanaalFilter}
          leegLabel="Elk kanaal"
          breedte={148}
          onKies={setKanaalFilter}
          opties={kanalen.map((id) => ({
            id,
            label: KANAAL[id]?.label ?? id,
            kleur: KANAAL[id]?.kleur,
            Icon: KANAAL[id]?.Icon,
          }))}
        />

        {/* Twee lijsten die elkaar uitsluiten, net als Per dag en Per auto. Wat je
            afvinkt gaat naar het archief en blijft daar staan; terughalen kan altijd. */}
        <div className="flex" style={{ border: `1px solid ${T.line2}` }}>
          <Segment actief={weergave === "open"} onClick={() => { setWeergave("open"); setOpen(null); }}>
            Open · {nogTeDoen}
          </Segment>
          <Segment actief={weergave === "archief"} onClick={() => { setWeergave("archief"); setOpen(null); }}>
            <Archive size={11} /> Archief · {inArchief}
          </Segment>
        </div>

        {(zoek || statusFilter || kanaalFilter) && (
          <button
            type="button"
            onClick={() => { setZoek(""); setStatusFilter(""); setKanaalFilter(""); }}
            className="transition-all hover:opacity-70"
            style={{ ...klein(T.ink(0.45)), textDecoration: "underline" }}
          >
            wis filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:inline" style={klein()}>
            {zichtbaar.length === (aanvragen ?? []).length
              ? `${zichtbaar.length} ${zichtbaar.length === 1 ? "aanvraag" : "aanvragen"}`
              : `${zichtbaar.length} van ${(aanvragen ?? []).length}`}
            {vandaag > 0 && ` · ${vandaag} vandaag`}
          </span>
          {openAanvraag && (
            <button
              type="button"
              onClick={() => setBewerken((v) => !v)}
              className="flex items-center gap-1.5 transition-all hover:opacity-80 whitespace-nowrap"
              style={{
                padding: "7px 11px",
                fontFamily: T.inter,
                fontSize: 12,
                fontWeight: 600,
                color: bewerken ? "#ffffff" : T.ink(0.55),
                backgroundColor: bewerken ? T.navy : "transparent",
                border: `1px solid ${bewerken ? T.navy : T.line2}`,
              }}
            >
              {bewerken ? <Check size={12} /> : <Pencil size={12} />}
              {bewerken ? "Klaar" : "Bewerken"}
            </button>
          )}
          <Btn size="sm" onClick={() => setNieuw((v) => !v)}>
            <Plus size={12} /> Nieuwe aanvraag
          </Btn>
        </div>
      </div>

      {nieuw && (
        <div className="mb-4">
          <NieuweAanvraag
            autos={autos}
            kanalen={kanalen}
            onKlaar={async () => { setNieuw(false); await herlaad(); }}
            onFout={setFout}
          />
        </div>
      )}

      {aanvragen === null ? (
        <div className="flex justify-center py-16"><Spinner size={22} /></div>
      ) : zichtbaar.length === 0 ? (
        // Onderscheid maken tussen "er is niets" en "je filters laten niets door" — anders
        // ga je een aanvraag zoeken die er gewoon is.
        <Empty
          icon={<Users size={30} color={T.ink(0.2)} />}
          title={
            weergave === "archief" && !zoek && !statusFilter && !kanaalFilter
              ? "Archief is leeg"
              : (aanvragen ?? []).length === 0
                ? "Nog niets vastgelegd"
                : "Niets dat hieraan voldoet"
          }
          body={
            weergave === "archief" && !zoek && !statusFilter && !kanaalFilter
              ? "Wat je afvinkt als afgehandeld komt hier terecht. Het blijft bewaard en je kunt het altijd terughalen."
              : (aanvragen ?? []).length === 0
                ? "Zet met de knop hierboven een aanvraag erbij, of klik bij een mail in het E-mail-tabblad op “Zet in overzicht”."
                : `Er ${(aanvragen ?? []).length === 1 ? "staat 1 aanvraag" : `staan ${(aanvragen ?? []).length} aanvragen`} in deze lijst, maar geen enkele voldoet aan deze filters. Zet ze uit met “wis filters”.`
          }
        />
      ) : (
        <div className="flex flex-col xl:flex-row gap-4 items-start">
          {/* De lijst in een eigen paneel. Stond hij los, dan begon de eerste kaart onder
              een dagkopje terwijl de panelen ernaast bovenaan begonnen — dat scheelde net
              genoeg om scheef te ogen. Met een eigen kop staan alle vier de blokken op
              dezelfde hoogte. */}
          <div className="w-full xl:w-[340px] xl:flex-none">
            <Panel
              title={`${weergave === "archief" ? "Archief" : ""}${weergave === "archief" ? " · " : ""}${blad === "dag" ? "Per dag" : "Per auto"}`.trim()}
              meta={`${zichtbaar.length}`}
            >
            <div className="flex flex-col gap-4">
            {blad === "dag"
              ? perDag.map(([datum, rijen]) => (
                  <div key={datum}>
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span style={{ ...micro(), fontSize: 9 }}>{dagKop(rijen[0].aangemaakt)}</span>
                      <span style={klein(T.ink(0.3))}>{rijen.length}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {rijen.map((a) => (
                        <Regel key={a.id} a={a} actief={a.id === openAanvraag?.id} onClick={() => setOpen(a.id)} />
                      ))}
                    </div>
                  </div>
                ))
              : perAuto.map((g) => (
                  <div key={g.naam + g.rijen[0].id}>
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span style={{ ...micro(), fontSize: 9 }}>{g.naam}</span>
                      <span style={klein(g.rijen.length > 1 ? T.groen : T.ink(0.3))}>
                        {g.rijen.length} {g.rijen.length === 1 ? "reactie" : "reacties"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {g.rijen.map((a) => (
                        <Regel key={a.id} a={a} actief={a.id === openAanvraag?.id} onClick={() => setOpen(a.id)} toonAuto={false} />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
            </Panel>
          </div>

          <div className="w-full xl:flex-1 xl:min-w-0">
            {openAanvraag ? (
              <Detail
                key={openAanvraag.id}
                a={openAanvraag}
                autos={autos}
                anderen={zichtbaar.filter(
                  (x) =>
                    x.id !== openAanvraag.id &&
                    ((openAanvraag.auto_id != null && x.auto_id === openAanvraag.auto_id) ||
                      (!!openAanvraag.auto_naam && x.auto_naam === openAanvraag.auto_naam))
                )}
                herlaad={herlaad}
                onFout={setFout}
                onSluit={() => setOpen(null)}
                onNaarTaxatie={onNaarTaxatie}
                bewerken={bewerken}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/** Eén regel in de lijst. Alles wat je nodig hebt om te beslissen of je hem opent. */
function Regel({
  a, actief, onClick, toonAuto = true,
}: { a: Aanvraag; actief: boolean; onClick: () => void; toonAuto?: boolean }) {
  const k = KANAAL[a.bron] ?? KANAAL.overig;
  const st = STATUS[a.status] ?? STATUS.nieuw;
  // Waaraan herken je deze aanvraag in één oogopslag? Aan de auto, niet aan de naam.
  // Stond hier eerder alleen het onderwerp, en dat is bij een handmatige aanvraag leeg —
  // dan las de hele regel als "Thomas Dyne, streepje".
  const kop = a.advertentie_titel || a.auto_naam || a.kenteken || a.onderwerp || a.interesse;
  const feiten = [
    !toonAuto || !kop ? a.onderwerp || a.interesse : "",
    a.bod ? `bood ${a.bod}` : "",
    a.ons_bod ? `wij ${a.ons_bod}` : "",
    a.inruil ? `inruil ${a.inruil}` : "",
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-stretch text-left transition-all hover:opacity-85 w-full"
      style={{
        backgroundColor: actief ? T.navy : T.paper,
        border: `1px solid ${actief ? T.navy : T.line}`,
        borderLeft: `3px solid ${a.afgehandeld_op ? T.ink(0.2) : k.kleur}`,
        opacity: a.afgehandeld_op ? 0.55 : 1,
      }}
    >
      <span className="flex items-center justify-center flex-shrink-0" style={{ width: 34 }}>
        <k.Icon size={14} color={actief ? "rgba(255,255,255,0.7)" : k.kleur} />
      </span>
      <span className="flex-1 min-w-0" style={{ padding: "9px 10px 9px 0" }}>
        <span className="flex items-baseline gap-2">
          <span
            className="flex-1 min-w-0 truncate"
            style={{ fontFamily: T.play, fontSize: 13.5, fontWeight: 700, color: actief ? "#ffffff" : T.navy }}
          >
            {a.naam || a.email || a.telefoon || "Naamloos"}
          </span>
          <span style={{ ...klein(actief ? "rgba(255,255,255,0.55)" : T.ink(0.35)), flexShrink: 0 }}>
            {tijd(a.aangemaakt)}
          </span>
        </span>
        {kop && (
          <span
            className="block truncate mt-0.5"
            style={body(11.5, actief ? "rgba(255,255,255,0.7)" : T.ink(0.6))}
          >
            {kop}
          </span>
        )}
        {a.bericht && (
          <span
            className="block truncate mt-0.5"
            style={{ ...klein(actief ? "rgba(255,255,255,0.5)" : T.ink(0.45)), fontStyle: "italic" }}
          >
            &ldquo;{a.bericht}&rdquo;
          </span>
        )}
        {a.afgehandeld_op && (
          <span className="block truncate mt-0.5" style={klein(actief ? "rgba(255,255,255,0.5)" : T.groen)}>
            afgehandeld op {new Date(a.afgehandeld_op).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
          </span>
        )}
        {feiten.length > 0 && (
          <span
            className="block truncate mt-0.5"
            style={klein(actief ? "rgba(255,255,255,0.5)" : T.ink(0.4))}
          >
            {feiten.join(" · ")}
          </span>
        )}
      </span>
      <span className="flex items-center pr-2.5 flex-shrink-0">
        <Pill color={actief ? "rgba(255,255,255,0.6)" : st.kleur}>{st.label}</Pill>
      </span>
    </button>
  );
}

/** Handmatig een aanvraag vastleggen — Instagram, WhatsApp, telefoon of aan de balie. */
function NieuweAanvraag({
  autos, kanalen, onKlaar, onFout,
}: {
  autos: Auto[];
  /** Welke kanalen de server accepteert. Zo lopen scherm en database nooit uit de pas. */
  kanalen: string[];
  onKlaar: () => Promise<void>;
  onFout: (s: string) => void;
}) {
  const leeg = {
    naam: "", telefoon: "", email: "", bron: "whatsapp",
    onderwerp: "", autoId: "", bod: "", onsBod: "", inruil: "", notitie: "",
    advertentieTitel: "", advertentieUrl: "", bericht: "",
  };
  const [f, setF] = useState(leeg);
  const [bezig, setBezig] = useState(false);
  const zet = (k: keyof typeof leeg, v: string) => setF((p) => ({ ...p, [k]: v }));

  const bewaar = async () => {
    if (bezig) return;
    if (!f.naam.trim() && !f.telefoon.trim() && !f.email.trim() && !f.onderwerp.trim()) {
      onFout("Vul minstens een naam, telefoonnummer, e-mailadres of onderwerp in.");
      return;
    }
    setBezig(true);
    onFout("");
    try {
      const auto = autos.find((x) => String(x.id) === f.autoId);
      const res = await fetch("/api/admin/aanvragen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          autoId: auto ? auto.id : null,
          autoNaam: auto ? `${auto.merk ?? ""} ${auto.model ?? ""}`.trim() : "",
          kenteken: auto?.kenteken ?? "",
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { onFout(d.error || "Opslaan mislukt"); return; }
      setF(leeg);
      await onKlaar();
    } catch (e) {
      onFout(e instanceof Error ? e.message : String(e));
    } finally {
      setBezig(false);
    }
  };

  return (
    <Panel title="Nieuwe aanvraag">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Naam">
          <input style={inputStijl} value={f.naam} onChange={(e) => zet("naam", e.target.value)} placeholder="Jan de Vries" />
        </Field>
        <Field label="Telefoon">
          <input style={inputStijl} value={f.telefoon} onChange={(e) => zet("telefoon", e.target.value)} placeholder="06 12345678" />
        </Field>
        <Field label="E-mail">
          <input style={inputStijl} value={f.email} onChange={(e) => zet("email", e.target.value)} placeholder="jan@voorbeeld.nl" />
        </Field>
        <Field label="Waar kwam het binnen">
          <select style={inputStijl} value={f.bron} onChange={(e) => zet("bron", e.target.value)}>
            {kanalen.map((w) => (
              <option key={w} value={w}>{KANAAL[w]?.label ?? w}</option>
            ))}
          </select>
        </Field>
        <Field label="Over welke auto">
          <select style={inputStijl} value={f.autoId} onChange={(e) => zet("autoId", e.target.value)}>
            <option value="">— geen / andere auto —</option>
            {autos.filter((x) => !x.verkocht).map((x) => (
              <option key={x.id} value={String(x.id)}>
                {`${x.merk ?? ""} ${x.model ?? ""}`.trim()}{x.kenteken ? ` · ${x.kenteken}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Waar gaat het over">
          <input style={inputStijl} value={f.onderwerp} onChange={(e) => zet("onderwerp", e.target.value)} placeholder="Vraagt of de prijs kan zakken" />
        </Field>
        <Field label="Wat bood hij">
          <input style={inputStijl} value={f.bod} onChange={(e) => zet("bod", e.target.value)} placeholder="17.500" />
        </Field>
        <Field label="Wat wij bieden">
          <input style={inputStijl} value={f.onsBod} onChange={(e) => zet("onsBod", e.target.value)} placeholder="18.000" />
        </Field>
        <Field label="Wil inruilen">
          <input style={inputStijl} value={f.inruil} onChange={(e) => zet("inruil", e.target.value)} placeholder="Polo 2014, 160.000 km" />
        </Field>
        <Field label="Notitie">
          <input style={inputStijl} value={f.notitie} onChange={(e) => zet("notitie", e.target.value)} placeholder="Belt maandag terug" />
        </Field>
        <Field label="Auto uit zijn advertentie">
          <input style={inputStijl} value={f.advertentieTitel} onChange={(e) => zet("advertentieTitel", e.target.value)} placeholder="Mercedes-Benz CLA 250 uit 2020" />
        </Field>
        <Field label="Link naar zijn advertentie">
          <input style={inputStijl} value={f.advertentieUrl} onChange={(e) => zet("advertentieUrl", e.target.value)} placeholder="https://www.marktplaats.nl/v/..." />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Wat hij zei">
          <textarea
            style={{ ...inputStijl, minHeight: 70, resize: "vertical", lineHeight: 1.55 }}
            value={f.bericht} onChange={(e) => zet("bericht", e.target.value)}
            placeholder="Plak hier zijn bericht, in zijn eigen woorden."
          />
        </Field>
      </div>
      <div className="flex justify-end mt-3">
        <Btn onClick={bewaar} disabled={bezig}>
          {bezig ? <Spinner size={12} /> : <Check size={12} />} Vastleggen
        </Btn>
      </div>
    </Panel>
  );
}

/**
 * Eén bewerkbaar veld dat opslaat zodra je eruit klikt.
 *
 * ONBEHEERD, EN DAT IS HET HELE PUNT
 * Hier stond eerst een kopie van elke waarde in de state van het paneel. Die kopie werd
 * één keer gevuld bij het openen en daarna nooit meer bijgewerkt. Verandert er dan iets
 * aan de serverkant — de antwoordknop zet "Re: " voor het onderwerp, de autokeuze zet een
 * ander kenteken — dan liep die kopie achter. En omdat er bij het verlaten van het veld
 * werd vergeleken met de NIEUWE serverwaarde, schreef één keer erin klikken en weer
 * wegklikken de oude waarde er stilzwijgend overheen. Zonder dat je iets typte.
 *
 * Nu leest het veld rechtstreeks wat er staat. `key={huidig}` laat het opnieuw beginnen
 * zodra de opgeslagen waarde verandert, dus wat je ziet is wat er in de database staat.
 * Typen blijft gewoon behouden: `huidig` verandert niet terwijl jij aan het typen bent.
 *
 * Alles is aanpasbaar, ook wat de AI uit een mail haalde: dat is een gok, en aan de balie
 * typ je niet meteen alles goed.
 */
function Bewerk({
  label, huidig, veld, patch, bewerken, plaats, regels,
}: {
  label: string;
  /** Wat er nu in de database staat. Tevens de beginwaarde van het veld. */
  huidig: string;
  veld: string;
  patch: (velden: Record<string, unknown>) => Promise<boolean>;
  /** Staat het potlood aan? Zo niet, dan lees je alleen. */
  bewerken: boolean;
  plaats?: string;
  regels?: number;
}) {
  const bewaar = (w: string) => {
    if (w !== huidig) patch({ [veld]: w });
  };

  // Leesstand.
  //
  // Waarom dit de uitlijning oplost: je ziet nooit twee soorten velden tegelijk. Staat het
  // potlood uit, dan is ELK veld deze alinea; staat het aan, dan is elk veld een
  // invoervak. Binnen één stand zijn ze dus allemaal even hoog, en daardoor staan de rijen
  // in de drie kolommen op dezelfde hoogte. Eerder liepen ze uiteen doordat de ene kolom
  // twee velden naast elkaar zette en de andere er één.
  if (!bewerken) {
    return (
      <Field label={label}>
        <p
          style={{
            padding: "9px 12px",
            border: "1px solid transparent",
            fontFamily: T.inter,
            fontSize: 13,
            lineHeight: 1.5,
            color: huidig ? T.navy : T.ink(0.3),
            minHeight: regels ? regels * 20 + 18 : undefined,
            whiteSpace: regels ? "pre-wrap" : undefined,
            overflowWrap: "anywhere",
          }}
        >
          {huidig || "—"}
        </p>
      </Field>
    );
  }

  return (
    <Field label={label}>
      {regels ? (
        <textarea
          key={huidig}
          defaultValue={huidig}
          placeholder={plaats}
          onBlur={(e) => bewaar(e.target.value)}
          style={{ ...inputStijl, minHeight: regels * 20, resize: "vertical", lineHeight: 1.55 }}
        />
      ) : (
        <input
          key={huidig}
          defaultValue={huidig}
          placeholder={plaats}
          onBlur={(e) => bewaar(e.target.value)}
          style={inputStijl}
        />
      )}
    </Field>
  );
}

/** Alles over één aanvraag, plus wie er nog meer achter dezelfde auto aan zit. */
function Detail({
  a, autos, anderen, herlaad, onFout, onSluit, onNaarTaxatie, bewerken,
}: {
  a: Aanvraag;
  autos: Auto[];
  anderen: Aanvraag[];
  herlaad: () => Promise<void>;
  onFout: (s: string) => void;
  onSluit: () => void;
  onNaarTaxatie?: (kenteken: string) => void;
  /** Staat het potlood in de balk bovenaan aan? Dan gaan alle velden open. */
  bewerken: boolean;
}) {
  // Lokaal bewerken zonder dat een herlaadactie je aanpassing overschrijft. Het component
  // krijgt key={a.id}, dus bij een andere aanvraag begint het opnieuw.
  // Alleen het antwoord houdt eigen state: dat wordt door de AI-opdracht gezet en moet
  // meteen zichtbaar zijn, ook voordat de lijst opnieuw is opgehaald.
  const [antwoord, setAntwoord] = useState(a.antwoord);
  const [gekopieerd, setGekopieerd] = useState(false);
  const [bezig, setBezig] = useState(false);

  const { vraag } = useDialoog();
  const { taak, start } = useAiTaak<{ id: string }>("aanvraag-antwoord");

  const patch = async (velden: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/aanvragen/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(velden),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      onFout(d.error || "Opslaan mislukt");
      return false;
    }
    await herlaad();
    return true;
  };

  const schrijfAntwoord = () => {
    if (taak?.bezig) return;
    onFout("");
    start(`Antwoord voor ${a.naam || "klant"}`, async (stap) => {
      stap("Antwoord schrijven");
      const res = await fetch(`/api/admin/aanvragen/${a.id}/antwoord`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Antwoord schrijven mislukt");
      setAntwoord(d.bericht ?? "");
      await herlaad();
      return { id: a.id };
    });
  };

  const k = KANAAL[a.bron] ?? KANAAL.overig;
  const auto = autos.find((x) => x.id === a.auto_id);
  const kenteken = a.kenteken || auto?.kenteken || "";

  return (
    <div className="flex flex-col gap-3">
      {/* Twee kolommen in plaats van een stapel. Als alles onder elkaar staat is dit
          paneel drie schermen hoog en scrol je langs contactgegevens heen op weg naar de
          deal -- terwijl er ruimte zat naast staat. Onder 1024px valt het vanzelf terug
          op een stapel, want dan is naast elkaar onleesbaar smal. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
      <div className="flex flex-col gap-3 h-full">
      {/* Waar het over gaat. Bovenaan, want dit is waaraan je de aanvraag herkent —
          niet aan de naam. */}
      <Panel
        title="De advertentie"
        className="flex-1"
        actions={<span style={{ ...micro(k.kleur), fontSize: 9 }}>{k.label}</span>}
      >
        <div className="flex flex-col h-full">
        {a.advertentie_url && (
          <a
            href={a.advertentie_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 mb-2.5 hover:opacity-70 transition-all"
            style={{ ...body(12, T.navy), textDecoration: "underline", overflowWrap: "anywhere" }}
          >
            <ExternalLink size={12} style={{ flexShrink: 0 }} />
            {a.advertentie_titel || a.advertentie_url}
          </a>
        )}
        <div className="grid grid-cols-1 gap-2">
          <Bewerk patch={patch} bewerken={bewerken} label="Auto uit zijn advertentie"
            huidig={a.advertentie_titel} veld="advertentie_titel"
            plaats="Mercedes-Benz CLA 250 224pk 7G-DCT 2020 Zwart" />
          <Bewerk patch={patch} bewerken={bewerken} label="Link naar de advertentie"
            huidig={a.advertentie_url} veld="advertentie_url"
            plaats="https://www.marktplaats.nl/v/..." />
        </div>

        <div className="mt-3 flex-1 flex flex-col">
          <p className="mb-1" style={{ ...micro(), fontSize: 9 }}>Wat hij zei</p>
          {bewerken ? (
            <textarea
              key={a.bericht}
              defaultValue={a.bericht}
              onBlur={(e) => e.target.value !== a.bericht && patch({ bericht: e.target.value })}
              placeholder="Zijn eigen woorden — plak hier het bericht dat hij stuurde."
              className="flex-1"
              style={{
                ...inputStijl,
                minHeight: 96,
                resize: "vertical",
                fontSize: 12.5,
                lineHeight: 1.7,
                backgroundColor: "rgba(0,19,55,0.025)",
                borderLeft: `3px solid ${T.navy}`,
              }}
            />
          ) : (
            <p
              className="flex-1"
              style={{
                padding: "9px 12px",
                minHeight: 96,
                fontFamily: T.inter,
                fontSize: 12.5,
                lineHeight: 1.7,
                color: a.bericht ? T.navy : T.ink(0.3),
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                backgroundColor: "rgba(0,19,55,0.025)",
                borderLeft: `3px solid ${T.navy}`,
              }}
            >
              {a.bericht || "Nog niets vastgelegd van wat hij zei."}
            </p>
          )}
        </div>
        </div>
      </Panel>

      </div>

      {/* Eigen kolom: op een breed scherm staan advertentie, deal en contact naast
          elkaar. Onder 1536px schuift deze onder de eerste, onder 1024px wordt het
          een stapel. */}
      <div className="flex flex-col gap-3 h-full">
      {/* De handel: waar het over gaat bij ons, wat hij bood, wat hij inruilt. */}
      <Panel title="De deal" className="flex-1">
        <div className="grid grid-cols-1 gap-2">
          <Field label="Onze auto waar hij op reageert">
            {bewerken ? (
            <select
              style={inputStijl}
              value={a.auto_id != null ? String(a.auto_id) : ""}
              onChange={(e) => {
                const gekozenAuto = autos.find((x) => String(x.id) === e.target.value);
                // auto_id MOET mee. Zonder dat sprong de keuzelijst na het herladen
                // terug naar "geen auto" (de waarde komt uit a.auto_id) en bleef de
                // aanvraag in het tabblad Per auto onder de vórige auto hangen — met de
                // naam van de nieuwe erbij. Een rij die zichzelf tegenspreekt.
                patch({
                  auto_id: gekozenAuto ? gekozenAuto.id : null,
                  auto_naam: gekozenAuto ? `${gekozenAuto.merk ?? ""} ${gekozenAuto.model ?? ""}`.trim() : "",
                  kenteken: gekozenAuto?.kenteken ?? "",
                });
              }}
            >
              <option value="">— geen / andere auto —</option>
              {autos.map((x) => (
                <option key={x.id} value={String(x.id)}>
                  {`${x.merk ?? ""} ${x.model ?? ""}`.trim()}{x.kenteken ? ` · ${x.kenteken}` : ""}
                </option>
              ))}
            </select>
            ) : (
              <p style={{ padding: "9px 12px", border: "1px solid transparent", fontFamily: T.inter, fontSize: 13, color: a.auto_naam ? T.navy : T.ink(0.3) }}>
                {a.auto_naam || "—"}
              </p>
            )}
          </Field>
          <Bewerk patch={patch} bewerken={bewerken} label="Waar het over gaat"
            huidig={a.interesse} veld="interesse" plaats="Vraagt of de prijs kan zakken" />
          <Bewerk patch={patch} bewerken={bewerken} label="Wat hij vraagt of bood" huidig={a.bod} veld="bod" plaats="—" />
          {/* Onze kant van hetzelfde gesprek. Stond er niet, terwijl dit het getal is
              waar je hem op terugbelt. Vrije tekst met opzet: een bod is vaak
              "18.000, of 19.500 in consignatie" en niet één bedrag. */}
          <Bewerk patch={patch} bewerken={bewerken} label="Wat wij bieden" huidig={a.ons_bod}
            veld="ons_bod" plaats="18.000 — of 19.500 in consignatie" />
          <Bewerk patch={patch} bewerken={bewerken} label="Wil inruilen" huidig={a.inruil} veld="inruil" plaats="—" />
          <Bewerk patch={patch} bewerken={bewerken} label="Kenteken" huidig={a.kenteken} veld="kenteken" plaats="AB-123-C" />
        </div>

        <div className="mt-2.5">
          <Bewerk patch={patch} bewerken={bewerken} label="Notitie" huidig={a.notitie}
            veld="notitie" regels={2} plaats="Belt maandag terug" />
        </div>

        {/* Kleur per status, ook als hij niet gekozen is: het stipje vertelt je wat je
            kiest voordat je erop klikt. */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {Object.entries(STATUS).map(([w, st]) => {
            const aan = a.status === w;
            return (
              <button
                key={w}
                type="button"
                onClick={() => patch({ status: w })}
                className="flex items-center gap-1.5 transition-all hover:opacity-80"
                style={{
                  padding: "5px 10px",
                  fontFamily: T.inter,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: aan ? "#ffffff" : st.kleur,
                  backgroundColor: aan ? st.kleur : "transparent",
                  border: `1px solid ${aan ? st.kleur : T.line2}`,
                }}
              >
                <span
                  className="rounded-full flex-shrink-0"
                  style={{ width: 7, height: 7, backgroundColor: aan ? "#ffffff" : st.kleur }}
                />
                {st.label}
              </button>
            );
          })}
        </div>
      </Panel>
      </div>

      {/* Derde kolom: wie het is, wie er nog meer wacht, en wat je nu doet. */}
      <div className="flex flex-col gap-3 h-full">
      {/* Wie het is. */}
      <Panel title="Contact">
        <div className="flex flex-wrap gap-3 mb-2.5">
          {a.telefoon && (
            <a href={`tel:${a.telefoon}`} style={{ ...klein(T.navy), textDecoration: "underline" }}>
              Bellen
            </a>
          )}
          {a.telefoon && (
            <a
              href={`https://wa.me/${a.telefoon.replace(/\D/g, "").replace(/^0/, "31")}`}
              target="_blank" rel="noopener noreferrer"
              style={{ ...klein(T.groen), textDecoration: "underline" }}
            >
              WhatsApp
            </a>
          )}
          {a.email && (
            <a href={`mailto:${a.email}`} style={{ ...klein(T.navy), textDecoration: "underline" }}>
              Mailen
            </a>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2">
          <Bewerk patch={patch} bewerken={bewerken} label="Naam" huidig={a.naam} veld="naam" plaats="—" />
          <Bewerk patch={patch} bewerken={bewerken} label="Telefoon" huidig={a.telefoon} veld="telefoon" plaats="06 …" />
          <Bewerk patch={patch} bewerken={bewerken} label="E-mail" huidig={a.email} veld="email" plaats="—" />
          <Field label="Waar kwam het binnen">
            {bewerken ? (
              <Keuzelijst
                waarde={a.bron}
                onKies={(w) => patch({ bron: w })}
                opties={Object.entries(KANAAL).map(([id, k]) => ({
                  id, label: k.label, kleur: k.kleur, Icon: k.Icon,
                }))}
              />
            ) : (
              <p style={{ padding: "9px 12px", border: "1px solid transparent", fontFamily: T.inter, fontSize: 13, color: T.navy }}>
                {KANAAL[a.bron]?.label ?? a.bron}
              </p>
            )}
          </Field>
        </div>
      </Panel>


      {/* Wie er nog meer achter dezelfde auto aan zit. Dit is waarom dit scherm bestaat:
          bel je er een, dan wil je de rest ernaast hebben staan. */}
      {anderen.length > 0 && (
        <Panel title={`Nog ${anderen.length} ${anderen.length === 1 ? "reactie" : "reacties"} op deze auto`}>
          <div className="flex flex-col gap-1.5">
            {anderen.map((x) => (
              <div
                key={x.id}
                className="flex items-baseline justify-between gap-3 px-2.5 py-2"
                style={{ backgroundColor: "rgba(0,19,55,0.02)", border: `1px solid ${T.line}` }}
              >
                <span className="min-w-0 truncate" style={body(11.5, T.navy)}>
                  {x.naam || x.email || x.telefoon || "Naamloos"}
                </span>
                <span style={{ ...klein(), flexShrink: 0 }}>
                  {[x.bod ? `bood ${x.bod}` : "", x.inruil ? "inruil" : ""].filter(Boolean).join(" · ") || tijd(x.aangemaakt)}
                </span>
              </div>
            ))}
          </div>
          <PanelVoet>
            Zelfde auto, andere mensen. Handig voor je belt: wie bood er meer, en wie wacht er al langer.
          </PanelVoet>
        </Panel>
      )}

      {/* Doorpakken: taxeren of een antwoord laten schrijven. */}
      <Panel title="Wat nu" className="flex-1">
        <div className="flex flex-col gap-2">
          {kenteken && onNaarTaxatie && (
            <Btn variant="ghost" size="sm" full onClick={() => onNaarTaxatie(kenteken)}>
              <Calculator size={12} /> Taxeer {kenteken}
            </Btn>
          )}
          <Btn size="sm" full onClick={schrijfAntwoord} disabled={!!taak?.bezig}>
            <Sparkles size={12} /> {taak?.bezig ? "Bezig…" : antwoord ? "Opnieuw schrijven" : "Schrijf een antwoord"}
          </Btn>

          {antwoord && (
            <>
              <textarea
                value={antwoord}
                onChange={(e) => setAntwoord(e.target.value)}
                onBlur={() => antwoord !== a.antwoord && patch({ antwoord })}
                style={{ ...inputStijl, minHeight: 220, resize: "vertical", lineHeight: 1.6, whiteSpace: "pre-wrap" }}
              />
              <p style={klein()}>
                Lees hem na en pas aan wat er niet klopt. Wat hier staat wordt opgeslagen zodra je
                buiten het veld klikt.
              </p>
              <div className="flex gap-2">
                <Btn
                  variant="ghost" size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(antwoord).catch(() => null);
                    setGekopieerd(true);
                    setTimeout(() => setGekopieerd(false), 2000);
                  }}
                >
                  {gekopieerd ? <Check size={12} /> : <Copy size={12} />} {gekopieerd ? "Gekopieerd" : "Kopieer"}
                </Btn>
                {a.email && (
                  <a
                    href={`mailto:${a.email}?subject=${encodeURIComponent(a.onderwerp || "Uw vraag")}&body=${encodeURIComponent(antwoord)}`}
                    style={{ textDecoration: "none" }}
                  >
                    <Btn variant="ghost" size="sm"><Mail size={12} /> Open in mail</Btn>
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </Panel>

      </div>
      </div>

      <div className="flex gap-2">
        <Btn
          variant={a.afgehandeld_op ? "ghost" : "primair"}
          size="sm"
          disabled={bezig}
          onClick={async () => {
            // Afhandelen haalt hem uit je dagoverzicht, dus even bevestigen. Terughalen
            // vragen we niet: dat zet alleen iets terug en is nooit een vergissing die pijn
            // doet.
            if (
              !a.afgehandeld_op &&
              !(await vraag({
                titel: "Deze aanvraag afhandelen?",
                tekst: `${a.naam || "Deze aanvraag"} verdwijnt uit je openstaande lijst en komt in het archief. Daar kun je hem altijd terughalen.`,
                bevestig: "Afhandelen",
              }))
            ) {
              return;
            }
            setBezig(true);
            await patch({ afgehandeld: !a.afgehandeld_op });
            setBezig(false);
          }}
        >
          <Check size={12} /> {a.afgehandeld_op ? "Terughalen uit archief" : "Afgehandeld"}
        </Btn>
        <Btn
          variant="ghost" size="sm"
          onClick={async () => {
            const wie = a.naam || a.email || a.telefoon;
            const waarover = a.advertentie_titel || a.auto_naam || kenteken;
            if (
              !(await vraag({
                titel: wie ? `Aanvraag van ${wie} verwijderen?` : "Aanvraag verwijderen?",
                tekst: `${waarover ? `Het gaat over ${waarover}. ` : ""}Zijn bericht, de notitie en het geschreven antwoord gaan mee. Dit is niet terug te draaien.`,
                bevestig: "Verwijderen",
                gevaar: true,
              }))
            ) return;
            const res = await fetch(`/api/admin/aanvragen/${a.id}`, { method: "DELETE" });
            if (!res.ok) { onFout("Verwijderen mislukt"); return; }
            onSluit();
            await herlaad();
          }}
        >
          <Trash2 size={12} /> Verwijderen
        </Btn>
      </div>
    </div>
  );
}

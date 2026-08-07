"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Radar,
  Users,
  ShieldOff,
  Search,
  ExternalLink,
  Mail,
  Phone,
  Copy,
  Check,
  Send,
  Sparkles,
  Trash2,
  Handshake,
  MessageSquare,
  Plus,
  RefreshCw,
  Zap,
  ScrollText,
  GraduationCap,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  T,
  micro,
  num,
  body,
  Panel,
  Stat,
  Pill,
  Btn,
  Chip,
  Field,
  inputStijl,
  Spinner,
  Skeleton,
  Empty,
  Foutmelding,
  PanelVoet,
  Segments,
} from "./inkoop/ui";

type Status = "nieuw" | "goedgekeurd" | "verstuurd" | "gereageerd" | "cosignatie" | "afgewezen";

type Lead = {
  id: string;
  bron: string;
  advertentie_url: string;
  titel: string;
  merk: string;
  model: string;
  bouwjaar: string;
  km: string;
  brandstof: string;
  vraagprijs: number;
  plaats: string;
  naam: string;
  telefoon: string;
  email: string;
  particulier_score: number;
  kans_score: number;
  motivatie: string;
  onderwerp: string;
  bericht_mail: string;
  bericht_kort: string;
  status: Status;
  verstuurd_op: string | null;
  verstuurd_via: string;
  notitie: string;
  zoekopdracht: string;
  gevonden_op: string;
};

type Blokkade = { waarde: string; soort: string; reden: string; aangemaakt: string };

type Autopilot = {
  aan: boolean;
  maxPerDag: number;
  minKans: number;
  minParticulier: number;
  vandaagVerstuurd: number;
  resterendVandaag: number;
  klaarVoorVerzending: number;
};

type LogRegel = {
  id: string;
  lead_id: string;
  kanaal: string;
  ontvanger: string;
  onderwerp: string;
  inhoud: string;
  advertentie_url: string;
  verstuurd_op: string;
  merk: string | null;
  model: string | null;
  bouwjaar: string | null;
  lead_status: string | null;
};

type TabId = "zoeken" | "leads" | "nakijken" | "blokkade";

const TABS: { id: TabId; label: string; Icon: typeof Radar; context: string }[] = [
  { id: "zoeken", label: "Radar", Icon: Radar, context: "Particuliere verkopers zoeken" },
  { id: "leads", label: "Verkopers", Icon: Users, context: "Beoordelen, schrijven, versturen" },
  { id: "nakijken", label: "Nakijken", Icon: ScrollText, context: "Wat is er verstuurd, en wat leert de AI ervan" },
  { id: "blokkade", label: "Blokkadelijst", Icon: ShieldOff, context: "Nooit meer benaderen" },
];

const STATUS_LABEL: Record<Status, { label: string; kleur: string }> = {
  nieuw: { label: "Nieuw", kleur: T.blauw },
  goedgekeurd: { label: "Klaar om te sturen", kleur: T.amber },
  verstuurd: { label: "Verstuurd", kleur: T.teal },
  gereageerd: { label: "Reactie ontvangen", kleur: T.groen },
  cosignatie: { label: "In consignatie", kleur: T.paars },
  afgewezen: { label: "Afgewezen", kleur: T.ink(0.4) },
};

const VOORBEELDEN = [
  "Volkswagen Polo of Golf, 2016-2020, particulier, Zuid-Holland",
  "SUV automaat onder €20.000 particulier aangeboden regio Rotterdam",
  "Diesel stationwagen 2015-2019 particulier Zuid-Holland",
];

export default function VerkopersContent() {
  const [tab, setTab] = useState<TabId>("zoeken");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [blokkade, setBlokkade] = useState<Blokkade[] | null>(null);
  const [fout, setFout] = useState("");

  const laadLeads = useCallback(async () => {
    const res = await fetch("/api/admin/verkopers");
    setLeads(res.ok ? await res.json() : []);
  }, []);

  const laadBlokkade = useCallback(async () => {
    const res = await fetch("/api/admin/verkopers/blokkade");
    setBlokkade(res.ok ? await res.json() : []);
  }, []);

  useEffect(() => {
    fetch("/api/admin/verkopers")
      .then((r) => (r.ok ? r.json() : []))
      .then(setLeads)
      .catch(() => setLeads([]));
    fetch("/api/admin/verkopers/blokkade")
      .then((r) => (r.ok ? r.json() : []))
      .then(setBlokkade)
      .catch(() => setBlokkade([]));
  }, []);

  const tellers = useMemo(() => {
    const l = leads ?? [];
    return {
      nieuw: l.filter((x) => x.status === "nieuw").length,
      klaar: l.filter((x) => x.status === "goedgekeurd").length,
      verstuurd: l.filter((x) => x.status === "verstuurd").length,
      reacties: l.filter((x) => x.status === "gereageerd").length,
      consignatie: l.filter((x) => x.status === "cosignatie").length,
    };
  }, [leads]);

  const actieveTab = TABS.find((t) => t.id === tab)!;

  const kerncijfers = [
    { label: "Nieuw", waarde: leads === null ? "—" : String(tellers.nieuw), onClick: () => setTab("leads") },
    { label: "Te sturen", waarde: leads === null ? "—" : String(tellers.klaar), onClick: () => setTab("leads") },
    { label: "Reacties", waarde: leads === null ? "—" : String(tellers.reacties), onClick: () => setTab("leads") },
  ];

  return (
    <div style={{ backgroundColor: T.wash, minHeight: "100%" }}>
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 xl:px-8"
        style={{ height: 56, backgroundColor: T.paper, borderBottom: `1px solid ${T.line2}` }}
      >
        <h2
          className="min-w-0 truncate text-[17px] sm:text-[19px]"
          style={{ fontFamily: T.play, fontWeight: 700, color: T.navy }}
        >
          Verkopersradar
        </h2>
        <span className="hidden md:block flex-shrink-0" style={{ width: 1, height: 16, backgroundColor: T.line2 }} />
        <p className="hidden md:block min-w-0 truncate" style={micro(T.ink(0.35))}>
          {actieveTab.context}
        </p>
        <div className="ml-auto flex items-stretch gap-0 flex-shrink-0">
          {kerncijfers.map((k, i) => (
            <button
              key={k.label}
              type="button"
              onClick={k.onClick}
              className={`${i > 0 ? "hidden sm:flex" : "flex"} flex-col items-end justify-center px-3 md:px-4 transition-all hover:opacity-60`}
              style={{ borderLeft: i > 0 ? `1px solid ${T.line}` : undefined }}
            >
              <span style={{ ...micro(T.ink(0.32)), fontSize: 8.5 }}>{k.label}</span>
              <span style={num(15)}>{k.waarde}</span>
            </button>
          ))}
        </div>
      </header>

      <nav
        className="sticky z-30 flex items-center px-2 md:px-4 xl:px-6 overflow-x-auto"
        style={{ top: 56, height: 46, backgroundColor: T.paper, borderBottom: `1px solid ${T.line2}` }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const actief = tab === id;
          const teller = id === "leads" ? leads?.length : id === "blokkade" ? blokkade?.length : undefined;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className="flex items-center gap-2 px-3 md:px-4 transition-all flex-shrink-0"
              style={{
                height: 45,
                fontFamily: T.inter,
                fontSize: 12.5,
                fontWeight: 600,
                whiteSpace: "nowrap",
                color: actief ? T.navy : T.ink(0.38),
                borderBottom: `2px solid ${actief ? T.navy : "transparent"}`,
              }}
            >
              <Icon size={13} />
              {label}
              {teller != null && teller > 0 && (
                <span style={{ ...micro(actief ? T.ink(0.45) : T.ink(0.28)), fontSize: 9 }}>{teller}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-4 md:px-6 xl:px-8 py-4 md:py-6" style={{ maxWidth: 1800, margin: "0 auto" }}>
        {fout && (
          <div className="mb-4">
            <Foutmelding>{fout}</Foutmelding>
          </div>
        )}
        {tab === "zoeken" && (
          <ZoekTab
            herlaad={laadLeads}
            gaNaarLeads={() => setTab("leads")}
            onFout={setFout}
            tellers={tellers}
          />
        )}
        {tab === "leads" && (
          <LeadsTab leads={leads} herlaad={laadLeads} herlaadBlokkade={laadBlokkade} onFout={setFout} />
        )}
        {tab === "nakijken" && <NakijkenTab onFout={setFout} />}
        {tab === "blokkade" && <BlokkadeTab lijst={blokkade} herlaad={laadBlokkade} onFout={setFout} />}
      </div>
    </div>
  );
}

// ── Tab: zoeken ───────────────────────────────────────────────────
function ZoekTab({
  herlaad,
  gaNaarLeads,
  onFout,
  tellers,
}: {
  herlaad: () => Promise<void>;
  gaNaarLeads: () => void;
  onFout: (s: string) => void;
  tellers: { nieuw: number; klaar: number; verstuurd: number; reacties: number; consignatie: number };
}) {
  const [zoekopdracht, setZoekopdracht] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fase, setFase] = useState("");
  const [auto, setAuto] = useState<Autopilot | null>(null);
  const [autoLog, setAutoLog] = useState<string[]>([]);

  const laadAutopilot = useCallback(async () => {
    const res = await fetch("/api/admin/verkopers/autopilot");
    if (res.ok) setAuto(await res.json());
  }, []);

  useEffect(() => {
    fetch("/api/admin/verkopers/autopilot")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAuto(d))
      .catch(() => {});
  }, []);

  /**
   * Draait de autopilot tot er niets meer te versturen is. De server verwerkt per
   * aanroep een kleine partij (anders loopt hij tegen de time-out van Vercel aan),
   * dus we roepen hem herhaald aan. De ronde-teller is een noodrem tegen doorrazen.
   */
  const draaiAutopilot = async (): Promise<number> => {
    let totaal = 0;
    for (let ronde = 0; ronde < 15; ronde++) {
      setFase(`Automatisch versturen — ronde ${ronde + 1}…`);
      const res = await fetch("/api/admin/verkopers/autopilot", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        onFout(d.error || "Automatisch versturen mislukt");
        break;
      }
      if (Array.isArray(d.meldingen) && d.meldingen.length) {
        setAutoLog((vorig) => [...vorig, ...d.meldingen]);
      }
      totaal += d.verstuurd ?? 0;
      await herlaad();
      if (d.uit || d.klaar || (d.verstuurd ?? 0) === 0) break;
    }
    await laadAutopilot();
    return totaal;
  };

  const alleenVersturen = async () => {
    if (bezig) return;
    setBezig(true);
    setAutoLog([]);
    onFout("");
    try {
      await draaiAutopilot();
    } catch (e) {
      onFout(String(e));
    } finally {
      setBezig(false);
      setFase("");
    }
  };
  const [resultaat, setResultaat] = useState<{
    toegevoegd: number;
    overgeslagen: number;
    gecontroleerd: number;
    afgevallen: number;
    automatischVerstuurd: number;
    toelichting: string;
  } | null>(null);

  const zoek = async () => {
    if (!zoekopdracht.trim() || bezig) return;
    setBezig(true);
    setResultaat(null);
    onFout("");
    try {
      // Fase 1 — snel advertentielinks verzamelen.
      setFase("Zoeken naar advertenties…");
      const res = await fetch("/api/admin/verkopers/zoek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoekopdracht }),
      });
      const data = await res.json();
      if (!res.ok) {
        onFout(data.error || "Zoeken mislukt");
        return;
      }

      // Fase 2 — elke gevonden advertentie apart openen en uitlezen. Eén verzoek per
      // advertentie, want alles in één keer past niet binnen de time-out van Vercel.
      const ids: string[] = Array.isArray(data.nieuwe_ids) ? data.nieuwe_ids : [];
      let afgevallen = 0;
      for (let i = 0; i < ids.length; i++) {
        setFase(`Advertentie ${i + 1} van ${ids.length} controleren…`);
        try {
          const vr = await fetch(`/api/admin/verkopers/${ids[i]}/verrijk`, { method: "POST" });
          const vd = await vr.json().catch(() => ({}));
          if (vd?.handelaar || vd?.geblokkeerd || vd?.bereikbaar === false) afgevallen++;
        } catch {
          /* één mislukte advertentie mag de rest niet blokkeren */
        }
        await herlaad();
      }

      // Fase 3 — staat de autopilot aan, dan gaan de berichten hier meteen de deur uit.
      let automatischVerstuurd = 0;
      if (auto?.aan) automatischVerstuurd = await draaiAutopilot();

      setResultaat({
        toegevoegd: Math.max(0, ids.length - afgevallen),
        overgeslagen: data.overgeslagen ?? 0,
        gecontroleerd: ids.length,
        afgevallen,
        automatischVerstuurd,
        toelichting: data.toelichting ?? "",
      });
    } catch (e) {
      onFout(String(e));
    } finally {
      setBezig(false);
      setFase("");
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-5">
      <div className="xl:col-span-2 flex flex-col gap-4 md:gap-5">
        <Panel title="Zoek particuliere verkopers" icon={<Search size={14} color={T.navy} />}>
          <div className="flex flex-col gap-3">
            <Field
              label="Wat zoek je?"
              hint="Hoe specifieker, hoe beter: noem merk, bouwjaren, prijsklasse en regio."
            >
              <textarea
                value={zoekopdracht}
                onChange={(e) => setZoekopdracht(e.target.value)}
                rows={3}
                placeholder="bijv. Volkswagen Polo 2016-2020 particulier aangeboden in Zuid-Holland"
                style={{ ...inputStijl, resize: "vertical", lineHeight: 1.6 }}
              />
            </Field>

            <div className="flex flex-wrap gap-1.5">
              {VOORBEELDEN.map((v) => (
                <Chip key={v} onClick={() => setZoekopdracht(v)}>
                  {v}
                </Chip>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Btn onClick={zoek} disabled={bezig || zoekopdracht.trim().length < 3} size="lg">
                {bezig ? <Spinner size={13} tone="donker" /> : <Radar size={13} />}
                {bezig ? "Aan het zoeken…" : "Zoek verkopers"}
              </Btn>
              {bezig && (
                <span style={body(11.5, T.ink(0.45))}>
                  {fase} De AI zoekt live en opent daarna elke advertentie apart. Reken op een
                  halve tot anderhalve minuut.
                </span>
              )}
            </div>
          </div>
        </Panel>

        {resultaat && (
          <Panel title="Resultaat" icon={<Check size={14} color={T.groen} />}>
            <div className="grid grid-cols-3 gap-2.5 mb-3">
              <Stat label="Bruikbare verkopers" value={resultaat.toegevoegd} accent={T.groen} size={22} />
              <Stat label="Advertenties bekeken" value={resultaat.gecontroleerd} size={22} />
              <Stat
                label="Afgevallen"
                value={resultaat.afgevallen + resultaat.overgeslagen}
                size={22}
                sub="handelaar, al bekend of niet leesbaar"
              />
            </div>
            {resultaat.automatischVerstuurd > 0 && (
              <div
                className="mb-3 px-3.5 py-2.5"
                style={{ backgroundColor: T.tintGroen, borderLeft: `3px solid ${T.groen}` }}
              >
                <p style={body(12.5, T.ink(0.7))}>
                  De autopilot heeft {resultaat.automatischVerstuurd} bericht
                  {resultaat.automatischVerstuurd === 1 ? "" : "en"} verstuurd.
                </p>
              </div>
            )}
            {resultaat.toelichting && <p style={body(12.5)}>{resultaat.toelichting}</p>}
            {resultaat.toegevoegd === 0 ? (
              <p className="mt-2" style={body(12, T.ink(0.5))}>
                Niets bruikbaars gevonden. Advertentiesites zijn wisselend doorzoekbaar — probeer één
                merk met één regio, of plak een advertentie die je zelf vond handmatig in bij Verkopers.
              </p>
            ) : (
              <div className="mt-3">
                <Btn onClick={gaNaarLeads}>
                  <Users size={12} /> Bekijk de {resultaat.toegevoegd} verkoper
                  {resultaat.toegevoegd === 1 ? "" : "s"}
                </Btn>
              </div>
            )}
          </Panel>
        )}

        {autoLog.length > 0 && (
          <Panel title="Wat de autopilot deed" icon={<Zap size={14} color={T.navy} />} flush>
            <div className="flex flex-col">
              {autoLog.map((regel, i) => (
                <div
                  key={i}
                  className="px-4 md:px-5 py-2"
                  style={{
                    borderTop: i === 0 ? undefined : `1px solid ${T.line}`,
                    backgroundColor: i % 2 === 0 ? T.paper : "#fafbfc",
                  }}
                >
                  <span style={body(12, T.ink(0.65))}>{regel}</span>
                </div>
              ))}
            </div>
            <PanelVoet>Alles wat verstuurd is, staat ook vast in het verzendlog.</PanelVoet>
          </Panel>
        )}
      </div>

      <div className="flex flex-col gap-4 md:gap-5">
        <AutopilotPaneel
          auto={auto}
          bezig={bezig}
          onOpslaan={async (velden) => {
            const res = await fetch("/api/admin/verkopers/autopilot", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(velden),
            });
            if (res.ok) await laadAutopilot();
            else onFout("Instelling opslaan mislukt");
          }}
          onNuVersturen={alleenVersturen}
        />

        <Panel title="Zo werkt het" tone="donker">
          <ol className="flex flex-col gap-3" style={{ counterReset: "stap" }}>
            {[
              "De AI zoekt live naar advertenties van particulieren en beoordeelt per advertentie hoe kansrijk die is.",
              "Jij bekijkt de lijst en keurt goed wat je wilt benaderen.",
              "De AI schrijft een persoonlijk bericht over díe auto — jij leest het na en past aan.",
              "Jij drukt op versturen. Nooit automatisch: elk bericht gaat pas weg als jij erop klikt.",
            ].map((tekst, i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  className="flex-shrink-0 flex items-center justify-center rounded-full"
                  style={{
                    width: 20,
                    height: 20,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    ...num(11, "#ffffff"),
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontFamily: T.inter, fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
                  {tekst}
                </span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Lopende trajecten">
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="Verstuurd" value={tellers.verstuurd} size={22} accent={T.teal} />
            <Stat label="Reacties" value={tellers.reacties} size={22} accent={T.groen} />
            <Stat label="Nog te sturen" value={tellers.klaar} size={22} accent={T.amber} />
            <Stat label="In consignatie" value={tellers.consignatie} size={22} accent={T.paars} />
          </div>
        </Panel>

        <Panel title="Spelregels" icon={<ShieldOff size={14} color={T.navy} />}>
          <p style={body(12)}>
            Je benadert mensen over de auto die ze zélf openbaar te koop hebben gezet. Dat mag — mits het bericht
            over díe auto gaat en jij het handmatig verstuurt.
          </p>
          <p className="mt-2.5" style={body(12)}>
            Wat niet mag: massaal ongevraagde reclame mailen naar particulieren. Daarom stuurt dit systeem nooit
            zelf, en gaat elke &quot;geen interesse&quot; direct op de blokkadelijst.
          </p>
        </Panel>
      </div>
    </div>
  );
}

// ── Autopilot ─────────────────────────────────────────────────────
function AutopilotPaneel({
  auto,
  bezig,
  onOpslaan,
  onNuVersturen,
}: {
  auto: Autopilot | null;
  bezig: boolean;
  onOpslaan: (velden: Record<string, unknown>) => Promise<void>;
  onNuVersturen: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (!auto) {
    return (
      <Panel title="Autopilot" icon={<Zap size={14} color={T.navy} />}>
        <Skeleton h={40} />
      </Panel>
    );
  }

  return (
    <Panel
      title="Autopilot"
      icon={<Zap size={14} color={auto.aan ? T.groen : T.ink(0.35)} />}
      actions={
        <Pill color={auto.aan ? T.groen : T.ink(0.4)} solid={auto.aan}>
          {auto.aan ? "Aan" : "Uit"}
        </Pill>
      }
    >
      <p style={body(12.5)}>
        {auto.aan
          ? "Na elke zoekopdracht schrijft en verstuurt de AI zelf, zonder tussenkomst. Alleen verkopers die door alle controles komen."
          : "Zet dit aan om de AI zelf te laten versturen. Nu schrijft hij het bericht en druk jij op verzenden."}
      </p>

      <div className="grid grid-cols-3 gap-2.5 my-3">
        <Stat label="Klaar om te sturen" value={auto.klaarVoorVerzending} size={20} accent={T.amber} />
        <Stat label="Vandaag verstuurd" value={auto.vandaagVerstuurd} size={20} />
        <Stat label="Nog ruimte" value={auto.resterendVandaag} size={20} accent={T.groen} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Btn
          variant={auto.aan ? "ghost" : "primair"}
          onClick={() => onOpslaan({ aan: !auto.aan })}
          disabled={bezig}
        >
          <Zap size={12} /> {auto.aan ? "Zet autopilot uit" : "Zet autopilot aan"}
        </Btn>
        {auto.aan && auto.klaarVoorVerzending > 0 && (
          <Btn variant="ghost" onClick={onNuVersturen} disabled={bezig}>
            {bezig ? <Spinner size={12} /> : <Send size={12} />} Nu versturen
          </Btn>
        )}
        <Btn variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Verberg grenzen" : "Grenzen instellen"}
        </Btn>
      </div>

      {open && (
        <div className="flex flex-col gap-3 mt-4 pt-4" style={{ borderTop: `1px solid ${T.line}` }}>
          <Field label="Maximaal per dag" hint="Telt ook mee wat je zelf handmatig verstuurt.">
            <input
              type="number"
              min={1}
              max={50}
              defaultValue={auto.maxPerDag}
              onBlur={(e) => onOpslaan({ maxPerDag: Number(e.target.value) })}
              style={inputStijl}
            />
          </Field>
          <Field
            label="Minimale zekerheid particulier (1-10)"
            hint="Lager dan dit en de autopilot laat de lead staan. Handelaren vallen sowieso af."
          >
            <input
              type="number"
              min={1}
              max={10}
              defaultValue={auto.minParticulier}
              onBlur={(e) => onOpslaan({ minParticulier: Number(e.target.value) })}
              style={inputStijl}
            />
          </Field>
          <Field label="Minimale kansscore (1-10)" hint="Hoe kansrijk de lead moet zijn om automatisch te mailen.">
            <input
              type="number"
              min={0}
              max={10}
              defaultValue={auto.minKans}
              onBlur={(e) => onOpslaan({ minKans: Number(e.target.value) })}
              style={inputStijl}
            />
          </Field>
        </div>
      )}

      <PanelVoet>
        De autopilot mailt alleen als de advertentie echt is uitgelezen, het adres de controle haalt,
        de verkoper niet geblokkeerd is en er nog niet eerder een bericht is gegaan. Elke verzending
        krijgt een afmeldregel.
      </PanelVoet>
    </Panel>
  );
}

// ── Tab: leads ────────────────────────────────────────────────────
const FILTERS: { id: "alle" | Status; label: string }[] = [
  { id: "alle", label: "Alles" },
  { id: "nieuw", label: "Nieuw" },
  { id: "goedgekeurd", label: "Klaar om te sturen" },
  { id: "verstuurd", label: "Verstuurd" },
  { id: "gereageerd", label: "Reactie" },
  { id: "cosignatie", label: "Consignatie" },
];

function LeadsTab({
  leads,
  herlaad,
  herlaadBlokkade,
  onFout,
}: {
  leads: Lead[] | null;
  herlaad: () => Promise<void>;
  herlaadBlokkade: () => Promise<void>;
  onFout: (s: string) => void;
}) {
  const [filter, setFilter] = useState<"alle" | Status>("alle");
  const [gekozenId, setGekozenId] = useState<string | null>(null);

  const zichtbaar = useMemo(
    () => (leads ?? []).filter((l) => filter === "alle" || l.status === filter),
    [leads, filter]
  );

  const gekozen = useMemo(
    () => (leads ?? []).find((l) => l.id === gekozenId) ?? null,
    [leads, gekozenId]
  );

  if (leads === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={22} />
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <Empty
        icon={<Radar size={30} color={T.ink(0.2)} />}
        title="Nog geen verkopers gevonden"
        body="Ga naar het tabblad Radar en doe je eerste zoekopdracht."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const aantal = f.id === "alle" ? leads.length : leads.filter((l) => l.status === f.id).length;
          return (
            <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} {aantal > 0 && <span style={{ opacity: 0.6 }}>{aantal}</span>}
            </Chip>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-5">
        <div className="xl:col-span-2 flex flex-col gap-2">
          {zichtbaar.length === 0 && (
            <Empty compact title="Niets in dit filter" body="Kies een ander filter." />
          )}
          {zichtbaar.map((lead) => (
            <LeadKaart
              key={lead.id}
              lead={lead}
              actief={lead.id === gekozenId}
              onClick={() => setGekozenId(lead.id)}
            />
          ))}
        </div>

        <div className="xl:col-span-3">
          {gekozen ? (
            <LeadDetail
              key={gekozen.id}
              lead={gekozen}
              herlaad={herlaad}
              herlaadBlokkade={herlaadBlokkade}
              onFout={onFout}
              onVerwijderd={() => setGekozenId(null)}
            />
          ) : (
            <Panel>
              <Empty
                icon={<Users size={26} color={T.ink(0.2)} />}
                title="Kies een verkoper"
                body="Klik links op een advertentie om het bericht te schrijven en te versturen."
                compact
              />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function LeadKaart({ lead, actief, onClick }: { lead: Lead; actief: boolean; onClick: () => void }) {
  const st = STATUS_LABEL[lead.status];
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left w-full transition-all hover:opacity-85"
      style={{
        backgroundColor: actief ? "rgba(0,19,55,0.035)" : T.paper,
        border: `1px solid ${actief ? T.navy : T.line}`,
        padding: "12px 14px",
      }}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <span className="flex-1 min-w-0 truncate" style={{ fontFamily: T.play, fontSize: 14, fontWeight: 700, color: T.navy }}>
          {lead.merk} {lead.model}
        </span>
        <Pill color={st.kleur}>{st.label}</Pill>
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-2" style={body(11.5, T.ink(0.5))}>
        {lead.bouwjaar && <span>{lead.bouwjaar}</span>}
        {lead.km && <span>{Number(lead.km).toLocaleString("nl-NL")} km</span>}
        {lead.vraagprijs > 0 && (
          <span style={{ color: T.navy, fontWeight: 600 }}>€ {lead.vraagprijs.toLocaleString("nl-NL")}</span>
        )}
        {lead.plaats && <span>· {lead.plaats}</span>}
      </div>
      <div className="flex items-center gap-2">
        <span style={{ ...micro(T.ink(0.32)), fontSize: 8.5, flexShrink: 0 }}>Kans</span>
        <div className="flex-1 min-w-0">
          <Segments score={lead.kans_score} />
        </div>
        <span style={num(11, T.ink(0.5))}>{lead.kans_score}</span>
      </div>
    </button>
  );
}

// ── Detail: bericht schrijven en versturen ────────────────────────
function LeadDetail({
  lead,
  herlaad,
  herlaadBlokkade,
  onFout,
  onVerwijderd,
}: {
  lead: Lead;
  herlaad: () => Promise<void>;
  herlaadBlokkade: () => Promise<void>;
  onFout: (s: string) => void;
  onVerwijderd: () => void;
}) {
  const [onderwerp, setOnderwerp] = useState(lead.onderwerp);
  const [berichtMail, setBerichtMail] = useState(lead.bericht_mail);
  const [berichtKort, setBerichtKort] = useState(lead.bericht_kort);
  const [email, setEmail] = useState(lead.email);
  const [schrijft, setSchrijft] = useState(false);
  const [verstuurt, setVerstuurt] = useState(false);
  const [verrijkt, setVerrijkt] = useState(false);
  const [gekopieerd, setGekopieerd] = useState(false);

  // Geen useEffect die de velden uit de lead terugzet: dit component krijgt een
  // key={lead.id} van de lijst, dus bij het wisselen van verkoper wordt het opnieuw
  // opgebouwd en initialiseren de useStates zichzelf. Zou je hier alsnog synchroniseren,
  // dan overschrijft elke herlaadactie de tekst die je net zelf hebt aangepast.

  const alVerstuurd = lead.status === "verstuurd" || lead.status === "gereageerd" || lead.status === "cosignatie";
  const st = STATUS_LABEL[lead.status];

  const verrijkOpnieuw = async () => {
    if (verrijkt) return;
    setVerrijkt(true);
    onFout("");
    try {
      const res = await fetch(`/api/admin/verkopers/${lead.id}/verrijk`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        onFout(d.error || "Advertentie uitlezen mislukt");
        return;
      }
      if (d.handelaar) onFout("Dit blijkt een handelaar te zijn — de lead is verwijderd.");
      if (d.bereikbaar === false) onFout("De advertentie kon niet worden geopend (mogelijk verwijderd).");
      if (d.handelaar || d.geblokkeerd) onVerwijderd();
      await herlaad();
    } catch (e) {
      onFout(String(e));
    } finally {
      setVerrijkt(false);
    }
  };

  const schrijfBericht = async () => {
    setSchrijft(true);
    onFout("");
    try {
      const res = await fetch(`/api/admin/verkopers/${lead.id}/bericht`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        onFout(data.error || "Bericht schrijven mislukt");
        return;
      }
      setOnderwerp(data.onderwerp);
      setBerichtMail(data.bericht_mail);
      setBerichtKort(data.bericht_kort);
      await patch({ status: "goedgekeurd" });
    } catch (e) {
      onFout(String(e));
    } finally {
      setSchrijft(false);
    }
  };

  const patch = async (velden: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/verkopers/${lead.id}`, {
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

  const verstuurMail = async () => {
    if (verstuurt) return;
    setVerstuurt(true);
    onFout("");
    try {
      // Bewaar eerst de bewerkte tekst, verstuur daarna precies wat er staat.
      await patch({ onderwerp, bericht_mail: berichtMail, email });
      const res = await fetch(`/api/admin/verkopers/${lead.id}/verstuur`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onderwerp, bericht: berichtMail }),
      });
      const data = await res.json();
      if (!res.ok) {
        onFout(data.error || "Versturen mislukt");
        return;
      }
      await herlaad();
    } catch (e) {
      onFout(String(e));
    } finally {
      setVerstuurt(false);
    }
  };

  const kopieerKort = async () => {
    try {
      await navigator.clipboard.writeText(berichtKort || berichtMail);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2000);
    } catch {
      onFout("Kopiëren naar klembord lukte niet");
    }
  };

  const geenInteresse = async () => {
    if (!confirm("Deze verkoper op de blokkadelijst zetten en uit de lijst verwijderen?")) return;
    const res = await fetch(`/api/admin/verkopers/${lead.id}?blokkeer=1`, { method: "DELETE" });
    if (!res.ok) {
      onFout("Verwijderen mislukt");
      return;
    }
    onVerwijderd();
    await herlaad();
    await herlaadBlokkade();
  };

  const naarCosignatie = async () => {
    const res = await fetch(`/api/admin/verkopers/${lead.id}/naar-cosignatie`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      onFout(data.error || "Omzetten mislukt");
      return;
    }
    await herlaad();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Auto en advertentie */}
      <Panel
        title={`${lead.merk} ${lead.model}`}
        meta={lead.bron}
        actions={<Pill color={st.kleur} solid>{st.label}</Pill>}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          <Stat label="Bouwjaar" value={lead.bouwjaar || "—"} size={18} />
          <Stat label="Km-stand" value={lead.km ? Number(lead.km).toLocaleString("nl-NL") : "—"} size={18} />
          <Stat
            label="Vraagprijs"
            value={lead.vraagprijs ? `€ ${lead.vraagprijs.toLocaleString("nl-NL")}` : "—"}
            size={18}
            accent={T.navy}
          />
          <Stat label="Plaats" value={lead.plaats || "—"} size={15} />
        </div>

        {lead.motivatie && (
          <div className="mb-3 px-3.5 py-2.5" style={{ backgroundColor: "rgba(0,19,55,0.025)", borderLeft: `3px solid ${T.navy}` }}>
            <p style={{ ...micro(T.ink(0.35)), marginBottom: 4 }}>Wat de AI opviel</p>
            <p style={body(12.5)}>{lead.motivatie}</p>
          </div>
        )}

        {lead.notitie && (
          <div
            className="mb-3 px-3.5 py-2.5"
            style={{ backgroundColor: T.tintAmber, borderLeft: `3px solid ${T.amber}` }}
          >
            <p style={{ ...micro(T.amber), marginBottom: 4 }}>Let op</p>
            <p style={body(12.5, T.ink(0.7))}>{lead.notitie}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <a href={lead.advertentie_url} target="_blank" rel="noopener noreferrer">
            <Btn variant="ghost" size="sm">
              <ExternalLink size={12} /> Bekijk advertentie
            </Btn>
          </a>
          {!alVerstuurd && (
            <Btn variant="ghost" size="sm" onClick={verrijkOpnieuw} disabled={verrijkt}>
              {verrijkt ? <Spinner size={11} /> : <RefreshCw size={11} />}
              {lead.particulier_score === 0 ? "Lees advertentie uit" : "Opnieuw uitlezen"}
            </Btn>
          )}
          {lead.telefoon && (
            <a href={`tel:${lead.telefoon}`}>
              <Btn variant="ghost" size="sm">
                <Phone size={12} /> {lead.telefoon}
              </Btn>
            </a>
          )}
          <span className="ml-auto flex items-center gap-1.5" style={{ ...micro(T.ink(0.3)), fontSize: 8.5 }}>
            Particulier {lead.particulier_score}/10 · Kans {lead.kans_score}/10
          </span>
        </div>
      </Panel>

      {/* Bericht */}
      <Panel
        title="Bericht"
        icon={<Sparkles size={14} color={T.navy} />}
        actions={
          !alVerstuurd && (
            <Btn variant="ghost" size="sm" onClick={schrijfBericht} disabled={schrijft}>
              {schrijft ? <Spinner size={11} /> : <Sparkles size={11} />}
              {berichtMail ? "Opnieuw schrijven" : "Schrijf bericht"}
            </Btn>
          )
        }
      >
        {!berichtMail && !schrijft && (
          <Empty
            compact
            icon={<MessageSquare size={24} color={T.ink(0.2)} />}
            title="Nog geen bericht"
            body="Laat de AI een persoonlijk bericht over deze auto schrijven. Je kunt het daarna zelf aanpassen."
          />
        )}
        {schrijft && (
          <div className="flex items-center justify-center gap-2.5 py-10">
            <Spinner size={16} />
            <span style={body(12.5)}>De AI schrijft een bericht over deze auto…</span>
          </div>
        )}

        {berichtMail && !schrijft && (
          <div className="flex flex-col gap-3">
            <Field label="Onderwerp">
              <input
                value={onderwerp}
                onChange={(e) => setOnderwerp(e.target.value)}
                disabled={alVerstuurd}
                style={inputStijl}
              />
            </Field>

            <Field label="E-mailbericht" hint="Pas gerust aan — dit is precies wat verstuurd wordt.">
              <textarea
                value={berichtMail}
                onChange={(e) => setBerichtMail(e.target.value)}
                rows={12}
                disabled={alVerstuurd}
                style={{ ...inputStijl, resize: "vertical", lineHeight: 1.7 }}
              />
            </Field>

            {berichtKort && (
              <Field
                label={`Kort bericht voor ${lead.bron || "het platform"}`}
                hint="Voor de berichtenbox van de advertentiesite — plak dit daar handmatig in."
              >
                <textarea
                  value={berichtKort}
                  onChange={(e) => setBerichtKort(e.target.value)}
                  rows={5}
                  style={{ ...inputStijl, resize: "vertical", lineHeight: 1.7 }}
                />
              </Field>
            )}
          </div>
        )}
      </Panel>

      {/* Versturen */}
      {berichtMail && !alVerstuurd && (
        <Panel title="Versturen" icon={<Send size={14} color={T.navy} />}>
          <div className="flex flex-col gap-3">
            <Field
              label="E-mailadres verkoper"
              hint={
                email
                  ? "De mail gaat vanaf info@jgmobility.nl; antwoorden komen in je gewone inbox."
                  : "Niet bekend uit de advertentie. Vul in als je het hebt, of gebruik hieronder de berichtenbox van het platform."
              }
            >
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nog niet bekend"
                style={inputStijl}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-2">
              <Btn onClick={verstuurMail} disabled={!email || verstuurt}>
                {verstuurt ? <Spinner size={12} tone="donker" /> : <Mail size={12} />}
                {verstuurt ? "Versturen…" : "Verstuur mail"}
              </Btn>

              <Btn variant="ghost" onClick={kopieerKort}>
                {gekopieerd ? <Check size={12} /> : <Copy size={12} />}
                {gekopieerd ? "Gekopieerd" : "Kopieer kort bericht"}
              </Btn>

              <Btn
                variant="ghost"
                onClick={() => patch({ handmatig_verstuurd_via: "platform" })}
                title="Gebruik dit nadat je het bericht zelf in de berichtenbox van het platform hebt geplaatst"
              >
                <Check size={12} /> Zelf verstuurd
              </Btn>

              <Btn variant="ghost" onClick={geenInteresse} title="Op blokkadelijst en verwijderen">
                <Trash2 size={12} /> Geen interesse
              </Btn>
            </div>
          </div>
          <div className="mt-1" />
        </Panel>
      )}

      {alVerstuurd && (
        <Panel title="Vervolg">
          <div className="flex flex-wrap items-center gap-2">
            {lead.verstuurd_op && (
              <span style={body(12, T.ink(0.5))}>
                Verstuurd op {new Date(lead.verstuurd_op).toLocaleDateString("nl-NL")} via {lead.verstuurd_via || "mail"}.
              </span>
            )}
            <div className="w-full" />
            {lead.status === "verstuurd" && (
              <Btn variant="ghost" onClick={() => patch({ status: "gereageerd" })}>
                <MessageSquare size={12} /> Reactie ontvangen
              </Btn>
            )}
            {lead.status !== "cosignatie" && (
              <Btn onClick={naarCosignatie}>
                <Handshake size={12} /> Zet om naar consignatie
              </Btn>
            )}
            {lead.status === "cosignatie" && (
              <span style={body(12.5, T.groen)}>
                Staat als consignatiedossier in het tabblad Cosignatie.
              </span>
            )}
            <Btn variant="ghost" onClick={geenInteresse}>
              <Trash2 size={12} /> Geen interesse
            </Btn>
          </div>
        </Panel>
      )}

      <PanelVoet>
        Elk bericht gaat over de auto die deze verkoper zelf openbaar te koop heeft gezet, en wordt pas verstuurd
        als jij erop klikt. Wat je verstuurt wordt vastgelegd; een &quot;geen interesse&quot; belandt op de
        blokkadelijst.
      </PanelVoet>
    </div>
  );
}

// ── Tab: nakijken en bijsturen ────────────────────────────────────
function NakijkenTab({ onFout }: { onFout: (s: string) => void }) {
  const [log, setLog] = useState<LogRegel[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [aanwijzingen, setAanwijzingen] = useState("");
  const [opgeslagen, setOpgeslagen] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    fetch("/api/admin/verkopers/log")
      .then((r) => (r.ok ? r.json() : []))
      .then(setLog)
      .catch(() => setLog([]));
    fetch("/api/admin/verkopers/aanwijzingen")
      .then((r) => (r.ok ? r.json() : { aanwijzingen: "" }))
      .then((d) => {
        setAanwijzingen(d.aanwijzingen ?? "");
        setOpgeslagen(d.aanwijzingen ?? "");
      })
      .catch(() => {});
  }, []);

  const bewaar = async () => {
    setBezig(true);
    onFout("");
    try {
      const res = await fetch("/api/admin/verkopers/aanwijzingen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aanwijzingen }),
      });
      const d = await res.json();
      if (!res.ok) {
        onFout(d.error || "Opslaan mislukt");
        return;
      }
      setOpgeslagen(d.aanwijzingen ?? aanwijzingen);
    } finally {
      setBezig(false);
    }
  };

  const gewijzigd = opgeslagen !== null && aanwijzingen !== opgeslagen;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-5">
      <div className="xl:col-span-3">
        <Panel
          title="Verzendlog"
          icon={<ScrollText size={14} color={T.navy} />}
          meta={log ? `${log.length} bericht${log.length === 1 ? "" : "en"}` : ""}
          flush
        >
          {log === null && (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          )}
          {log?.length === 0 && (
            <Empty
              compact
              icon={<ScrollText size={24} color={T.ink(0.2)} />}
              title="Nog niets verstuurd"
              body="Zodra er een bericht uitgaat — door jou of door de autopilot — staat het hier woordelijk in."
            />
          )}
          {log && log.length > 0 && (
            <div className="flex flex-col">
              {log.map((r, i) => {
                const uit = open !== r.id;
                const auto = `${r.merk ?? ""} ${r.model ?? ""}`.trim();
                return (
                  <div
                    key={r.id}
                    style={{
                      borderTop: i === 0 ? undefined : `1px solid ${T.line}`,
                      backgroundColor: uit && i % 2 !== 0 ? "#fafbfc" : T.paper,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpen(uit ? r.id : null)}
                      className="w-full flex items-center gap-2.5 px-4 md:px-5 py-2.5 text-left transition-all hover:opacity-70"
                    >
                      {uit ? (
                        <ChevronRight size={13} color={T.ink(0.35)} />
                      ) : (
                        <ChevronDown size={13} color={T.navy} />
                      )}
                      <span
                        className="flex-1 min-w-0 truncate"
                        style={{ fontFamily: T.inter, fontSize: 12.5, fontWeight: 600, color: T.navy }}
                      >
                        {auto || r.onderwerp || "Bericht"}
                      </span>
                      <span className="hidden sm:block truncate" style={body(11, T.ink(0.42))}>
                        {r.ontvanger}
                      </span>
                      <Pill color={r.kanaal === "mail" ? T.teal : T.blauw}>{r.kanaal}</Pill>
                      <span className="flex-shrink-0" style={{ ...micro(T.ink(0.3)), fontSize: 8.5 }}>
                        {new Date(r.verstuurd_op).toLocaleDateString("nl-NL")}
                      </span>
                    </button>

                    {!uit && (
                      <div className="px-4 md:px-5 pb-4" style={{ backgroundColor: "rgba(0,19,55,0.015)" }}>
                        <p style={{ ...micro(T.ink(0.35)), marginBottom: 6 }}>Onderwerp</p>
                        <p className="mb-3" style={body(12.5, T.navy)}>
                          {r.onderwerp || "—"}
                        </p>
                        <p style={{ ...micro(T.ink(0.35)), marginBottom: 6 }}>Verstuurde tekst</p>
                        <pre
                          className="overflow-x-auto"
                          style={{
                            fontFamily: T.inter,
                            fontSize: 12,
                            color: T.ink(0.7),
                            lineHeight: 1.7,
                            whiteSpace: "pre-wrap",
                            margin: 0,
                          }}
                        >
                          {r.inhoud}
                        </pre>
                        {r.advertentie_url && (
                          <div className="mt-3">
                            <a href={r.advertentie_url} target="_blank" rel="noopener noreferrer">
                              <Btn variant="ghost" size="sm">
                                <ExternalLink size={11} /> Bekijk de advertentie
                              </Btn>
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <PanelVoet>
            Dit log blijft staan als een lead wordt verwijderd — het is je verantwoording van wat er
            naar wie is gegaan.
          </PanelVoet>
        </Panel>
      </div>

      <div className="xl:col-span-2 flex flex-col gap-4">
        <Panel
          title="Wat de AI van jou moet leren"
          icon={<GraduationCap size={14} color={T.navy} />}
          actions={gewijzigd ? <Pill color={T.amber}>niet opgeslagen</Pill> : undefined}
        >
          <p className="mb-3" style={body(12.5)}>
            Zie je in het log iets wat je anders wilt? Schrijf het hier op. De AI krijgt dit mee bij
            élk bericht dat hij schrijft, en jouw regel gaat vóór de standaardtekst.
          </p>
          <Field label="Jouw aanwijzingen">
            <textarea
              value={aanwijzingen}
              onChange={(e) => setAanwijzingen(e.target.value)}
              rows={10}
              placeholder={
                "Bijvoorbeeld:\n" +
                "- Noem altijd dat we al 15 jaar in Barendrecht zitten.\n" +
                "- Houd het korter, maximaal vijf zinnen.\n" +
                "- Bied bij auto's onder €4.000 geen consignatie aan, alleen inkoop.\n" +
                "- Begin nooit met 'Hallo,' maar met 'Goedemiddag,'."
              }
              style={{ ...inputStijl, resize: "vertical", lineHeight: 1.7 }}
            />
          </Field>
          <div className="flex items-center gap-2 mt-3">
            <Btn onClick={bewaar} disabled={bezig || !gewijzigd}>
              {bezig ? <Spinner size={12} tone="donker" /> : <Check size={12} />} Opslaan
            </Btn>
            {gewijzigd && (
              <Btn variant="ghost" onClick={() => setAanwijzingen(opgeslagen ?? "")}>
                Ongedaan maken
              </Btn>
            )}
          </div>
          <PanelVoet>
            Geldt voor de autopilot én voor berichten die je zelf laat schrijven. Al verstuurde
            berichten veranderen er niet meer van.
          </PanelVoet>
        </Panel>
      </div>
    </div>
  );
}

// ── Tab: blokkadelijst ────────────────────────────────────────────
function BlokkadeTab({
  lijst,
  herlaad,
  onFout,
}: {
  lijst: Blokkade[] | null;
  herlaad: () => Promise<void>;
  onFout: (s: string) => void;
}) {
  const [waarde, setWaarde] = useState("");
  const [bezig, setBezig] = useState(false);

  const voegToe = async () => {
    if (!waarde.trim() || bezig) return;
    setBezig(true);
    onFout("");
    try {
      const res = await fetch("/api/admin/verkopers/blokkade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waarde, reden: "Handmatig geblokkeerd" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        onFout(d.error || "Toevoegen mislukt");
        return;
      }
      setWaarde("");
      await herlaad();
    } finally {
      setBezig(false);
    }
  };

  const verwijder = async (w: string) => {
    const res = await fetch(`/api/admin/verkopers/blokkade?waarde=${encodeURIComponent(w)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      onFout("Verwijderen mislukt");
      return;
    }
    await herlaad();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-5">
      <div className="xl:col-span-2">
        <Panel title="Nooit meer benaderen" icon={<ShieldOff size={14} color={T.navy} />} flush>
          {lijst === null && (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          )}
          {lijst?.length === 0 && (
            <Empty
              compact
              icon={<ShieldOff size={24} color={T.ink(0.2)} />}
              title="Lijst is leeg"
              body="Zodra je bij een verkoper op 'Geen interesse' klikt, komt die hier te staan."
            />
          )}
          {lijst && lijst.length > 0 && (
            <div className="flex flex-col">
              {lijst.map((b, i) => (
                <div
                  key={b.waarde}
                  className="flex items-center gap-3 px-4 md:px-5 py-2.5"
                  style={{
                    borderTop: i === 0 ? undefined : `1px solid ${T.line}`,
                    backgroundColor: i % 2 === 0 ? T.paper : "#fafbfc",
                  }}
                >
                  {b.soort === "email" ? (
                    <Mail size={13} color={T.ink(0.35)} />
                  ) : (
                    <Phone size={13} color={T.ink(0.35)} />
                  )}
                  <span className="flex-1 min-w-0 truncate" style={{ fontFamily: T.inter, fontSize: 12.5, color: T.navy }}>
                    {b.waarde}
                  </span>
                  <span className="hidden sm:block truncate" style={body(11, T.ink(0.4))}>
                    {b.reden}
                  </span>
                  <button
                    type="button"
                    onClick={() => verwijder(b.waarde)}
                    className="flex-shrink-0 transition-all hover:opacity-60"
                    title="Van de blokkadelijst halen"
                  >
                    <Trash2 size={13} color={T.ink(0.35)} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <PanelVoet>
            De blokkadelijst wordt gecontroleerd bij het zoeken én opnieuw vlak voor elke verzending.
          </PanelVoet>
        </Panel>
      </div>

      <Panel title="Handmatig toevoegen" icon={<Plus size={14} color={T.navy} />}>
        <Field label="E-mailadres of telefoonnummer" hint="Bijvoorbeeld na een telefonisch verzoek om niet meer gebeld te worden.">
          <input
            value={waarde}
            onChange={(e) => setWaarde(e.target.value)}
            placeholder="naam@voorbeeld.nl of 0612345678"
            style={inputStijl}
          />
        </Field>
        <div className="mt-3">
          <Btn onClick={voegToe} disabled={bezig || !waarde.trim()} full>
            {bezig ? <Spinner size={12} tone="donker" /> : <ShieldOff size={12} />} Blokkeren
          </Btn>
        </div>
      </Panel>
    </div>
  );
}

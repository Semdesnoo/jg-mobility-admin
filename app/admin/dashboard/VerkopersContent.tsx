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
  // Onder een eigen naam: `Infinity` is ook een ingebouwde waarde in JavaScript, en
  // die wil je in dit bestand niet overschaduwen.
  Infinity as Oneindig,
  Square,
  ScrollText,
  GraduationCap,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import VerkopersCriteria, { type Criteria as ZoekCriteria } from "./VerkopersCriteria";
import { useAiTaak } from "./AiTaken";

/** Wat een zoekronde oplevert. Wordt bewaard in de takenlaag, zodat het er nog
 *  staat als je tussendoor naar een ander tabblad bent geweest. */
type ZoekResultaat = {
  toegevoegd: number;
  overgeslagen: number;
  gecontroleerd: number;
  afgevallen: number;
  /** Advertenties die niet te openen waren. Die blijven in de lijst staan, met een
   *  aantekening — ze zijn dus niet afgevallen. */
  nietUitgelezen?: number;
  automatischVerstuurd: number;
  toelichting: string;
  merken?: string[];
  autoLog: string[];
};
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
  { id: "leads", label: "Verkopers", Icon: Users, context: "Bekijk de advertentie, gooi weg of zet klaar" },
  { id: "nakijken", label: "Nakijken", Icon: ScrollText, context: "Bericht schrijven en versturen" },
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

export default function VerkopersContent() {
  const [tab, setTab] = useState<TabId>("zoeken");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [blokkade, setBlokkade] = useState<Blokkade[] | null>(null);
  const [fout, setFout] = useState("");
  // Welke verkoper openstaat op het tabblad Nakijken. Hier in de schil, zodat het
  // tabblad Verkopers er eentje kan aanwijzen bij het doorzetten.
  const [nakijkId, setNakijkId] = useState<string | null>(null);

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
    { label: "Te sturen", waarde: leads === null ? "—" : String(tellers.klaar), onClick: () => setTab("nakijken") },
    // Reacties staan bij Verkopers onder het filter "Reactie", niet in de wachtrij.
    { label: "Reacties", waarde: leads === null ? "—" : String(tellers.reacties), onClick: () => setTab("leads") },
  ];

  /** Zet een verkoper klaar op het tabblad Nakijken en spring er desgewenst heen. */
  const naarNakijken = (id: string, spring: boolean) => {
    setNakijkId(id);
    if (spring) setTab("nakijken");
  };

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
          const teller =
            id === "leads"
              ? leads?.filter((l) => l.status !== "goedgekeurd").length
              : id === "nakijken"
                ? leads?.filter((l) => l.status === "goedgekeurd").length
                : id === "blokkade"
                  ? blokkade?.length
                  : undefined;
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
          <LeadsTab
            leads={leads}
            herlaad={laadLeads}
            herlaadBlokkade={laadBlokkade}
            onFout={setFout}
            naarNakijken={naarNakijken}
            aantalKlaar={tellers.klaar}
          />
        )}
        {tab === "nakijken" && (
          <NakijkenTab
            leads={leads}
            herlaad={laadLeads}
            herlaadBlokkade={laadBlokkade}
            onFout={setFout}
            gekozenId={nakijkId}
            setGekozenId={setNakijkId}
          />
        )}
        {tab === "blokkade" && <BlokkadeTab lijst={blokkade} herlaad={laadBlokkade} onFout={setFout} />}
      </div>
    </div>
  );
}

// ── Tab: zoeken ───────────────────────────────────────────────────
/**
 * Hoeveel keer er per klik gezocht wordt. De server geeft elke ronde een ander stel
 * merken mee, dus meer rondes = een bredere vangst. Drie is een afweging: één ronde
 * duurt tot bijna een minuut, en langer dan een paar minuten wachten is niet fijn —
 * al kun je ondertussen gewoon doorwerken, de ronde loopt in de achtergrond door.
 */
const ZOEKRONDES = 3;

/** Hoeveel advertenties er tegelijk worden uitgelezen. Elk verzoek is een eigen
 *  functie op Vercel, dus dit mag; hoger dan dit gaat de advertentiesite merken. */
const TEGELIJK = 3;

/**
 * Doorzoeken stopt als zóveel rondes achter elkaar niets nieuws opleveren.
 *
 * Eén lege ronde zegt weinig: de merken wisselen per ronde, dus je kunt net een
 * groepje treffen waar toevallig niets van te koop staat. Drie op rij betekent dat
 * de vijver binnen jouw zoekgrenzen echt leeg is.
 */
const DROOG_NA = 3;

/** Noodrem tegen eindeloos doorrazen als er om wat voor reden dan ook steeds nieuwe
 *  URL's blijven komen. Elke ronde kost een AI-aanroep, dus dit moet een dak hebben. */
const MAX_RONDES = 60;

/**
 * De stopvlag van het doorzoeken, bewust buiten React.
 *
 * De zoektocht draait in de takenlaag en loopt door als je naar een ander scherm
 * gaat. Kom je terug, dan is dit paneel opnieuw opgebouwd en is elke `useRef` van
 * daarvoor weg — een stopknop die op zo'n ref leunt zou dan niets meer doen. Deze
 * ene gedeelde doos overleeft dat.
 */
const doorzoekVlag = { stop: false };

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
  const [criteria, setCriteria] = useState<ZoekCriteria | null>(null);
  const [auto, setAuto] = useState<Autopilot | null>(null);

  // De zoekronde draait in de takenlaag boven de tabbladen. Daardoor loopt hij
  // door als je naar een ander scherm klikt, en staat het antwoord er nog als je
  // terugkomt.
  const { taak, start } = useAiTaak<ZoekResultaat>("verkopers-zoek");
  const bezig = taak?.bezig ?? false;
  const fase = taak?.stap ?? "";
  const resultaat = taak?.bezig ? null : (taak?.resultaat ?? null);
  const autoLog = resultaat?.autoLog ?? [];
  // Uit het etiket van de lopende taak, niet uit een eigen toestand: dit paneel kan
  // opnieuw zijn opgebouwd terwijl de zoektocht al draaide.
  const doorlopend = taak?.label === "Doorlopend zoeken";

  // Of jij om stoppen hebt gevraagd. Alleen voor de knop; de zoektocht zelf leest de
  // gedeelde vlag, want die overleeft het opnieuw opbouwen van dit paneel.
  const [stopGevraagd, setStopGevraagd] = useState(false);

  /** Vraagt de lopende zoektocht om na deze ronde te stoppen. Midden in een ronde
   *  afbreken kan niet netjes — een halve uitleesronde levert leads zonder scores op. */
  const stopZoeken = () => {
    doorzoekVlag.stop = true;
    setStopGevraagd(true);
  };

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
  const draaiAutopilot = async (
    stap: (t: string) => void,
    log: string[]
  ): Promise<number> => {
    let totaal = 0;
    for (let ronde = 0; ronde < 15; ronde++) {
      stap(`Automatisch versturen — ronde ${ronde + 1}`);
      const res = await fetch("/api/admin/verkopers/autopilot", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        log.push(d.error || "Automatisch versturen mislukt");
        break;
      }
      if (Array.isArray(d.meldingen) && d.meldingen.length) log.push(...d.meldingen);
      totaal += d.verstuurd ?? 0;
      await herlaad();
      if (d.uit || d.klaar || (d.verstuurd ?? 0) === 0) break;
    }
    await laadAutopilot();
    return totaal;
  };

  const alleenVersturen = () => {
    if (bezig) return;
    onFout("");
    start("Berichten versturen", async (stap) => {
      const log: string[] = [];
      const aantal = await draaiAutopilot(stap, log);
      return {
        toegevoegd: 0,
        overgeslagen: 0,
        gecontroleerd: 0,
        afgevallen: 0,
        automatischVerstuurd: aantal,
        toelichting: "",
        autoLog: log,
      };
    });
  };

  /** Wat één zoekronde plus het uitlezen ervan oplevert. */
  type RondeOogst = {
    gevonden: number;
    weg: number;
    mislukt: number;
    overgeslagen: number;
    merken: string[];
    toelichting: string;
    fout: string;
  };

  /**
   * Eén ronde: zoeken naar advertentielinks, en die daarna openen en uitlezen.
   *
   * Het uitlezen zit hier bewust in dezelfde ronde. Doe je eerst álle zoekrondes en
   * pas daarna het uitlezen, dan zie je bij doorzoeken uren niets in je lijst staan.
   * Nu groeit de lijst gestaag mee terwijl hij doorwerkt.
   */
  const eenRonde = async (
    stap: (t: string) => void,
    label: string
  ): Promise<RondeOogst> => {
    const oogst: RondeOogst = {
      gevonden: 0, weg: 0, mislukt: 0, overgeslagen: 0, merken: [], toelichting: "", fout: "",
    };

    stap(`${label} — zoeken`);
    let ids: string[] = [];
    try {
      const res = await fetch("/api/admin/verkopers/zoek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        oogst.fout = data.error || "Zoeken mislukt";
        return oogst;
      }
      ids = Array.isArray(data.nieuwe_ids) ? data.nieuwe_ids : [];
      oogst.gevonden = ids.length;
      oogst.overgeslagen = data.overgeslagen ?? 0;
      if (Array.isArray(data.merken)) oogst.merken = data.merken;
      if (data.toelichting) oogst.toelichting = data.toelichting;
    } catch (e) {
      oogst.fout = String(e);
      return oogst;
    }

    if (ids.length === 0) return oogst;

    // Elke advertentie apart openen — samen past het niet binnen de tijd die Vercel
    // per verzoek geeft — maar wel een paar tegelijk. Strikt achter elkaar duurde
    // dertig advertenties een kwartier.
    //
    // Weggevallen = de lead bestaat niet meer: handelaar of geblokkeerd. Een
    // advertentie die niet te openen was blijft wél in de lijst staan, met een
    // aantekening, en telt dus niet als afgevallen.
    let gedaan = 0;
    const wachtrij = [...ids];

    const werker = async () => {
      for (;;) {
        const id = wachtrij.shift();
        if (!id) return;
        try {
          const vr = await fetch(`/api/admin/verkopers/${id}/verrijk`, { method: "POST" });
          const vd = await vr.json().catch(() => ({}));
          if (!vr.ok) oogst.mislukt++;
          else if (vd?.handelaar || vd?.geblokkeerd) oogst.weg++;
          else if (vd?.bereikbaar === false) oogst.mislukt++;
        } catch {
          /* één mislukte advertentie mag de rest niet blokkeren */
          oogst.mislukt++;
        }
        gedaan++;
        stap(`${label} — advertentie ${gedaan} van ${ids.length} uitlezen`);
      }
    };

    await Promise.all(Array.from({ length: Math.min(TEGELIJK, ids.length) }, werker));
    await herlaad();
    return oogst;
  };

  /** Telt de oogst van een ronde op bij de lopende totalen. */
  const tel = (
    totaal: { ids: number; weg: number; mislukt: number; overgeslagen: number },
    o: RondeOogst
  ) => {
    totaal.ids += o.gevonden;
    totaal.weg += o.weg;
    totaal.mislukt += o.mislukt;
    totaal.overgeslagen += o.overgeslagen;
  };

  const zoek = () => {
    if (bezig) return;
    onFout("");
    doorzoekVlag.stop = false;
    setStopGevraagd(false);
    const autopilotAan = auto?.aan ?? false;

    start("Verkopers zoeken", async (stap) => {
      const log: string[] = [];
      const totaal = { ids: 0, weg: 0, mislukt: 0, overgeslagen: 0 };
      const merken: string[] = [];
      let toelichting = "";
      let laatsteFout = "";

      for (let ronde = 1; ronde <= ZOEKRONDES; ronde++) {
        if (doorzoekVlag.stop) break;
        const o = await eenRonde(stap, `Ronde ${ronde} van ${ZOEKRONDES}`);
        tel(totaal, o);
        merken.push(...o.merken);
        if (o.toelichting) toelichting = o.toelichting;
        if (o.fout) laatsteFout = o.fout;
        log.push(
          o.fout ? `Ronde ${ronde}: ${o.fout}` : `Ronde ${ronde}: ${o.gevonden} nieuwe advertenties`
        );
      }

      // Alleen een échte storing is een fout. Rondes die netjes verliepen maar alleen
      // al bekende advertenties opleverden zijn een normale uitkomst — daar hoort geen
      // rode melding bij, en de autopilot hieronder moet gewoon nog draaien.
      if (totaal.ids === 0 && laatsteFout) throw new Error(laatsteFout);

      const automatischVerstuurd = autopilotAan ? await draaiAutopilot(stap, log) : 0;

      return {
        toegevoegd: Math.max(0, totaal.ids - totaal.weg),
        overgeslagen: totaal.overgeslagen,
        gecontroleerd: totaal.ids,
        afgevallen: totaal.weg,
        nietUitgelezen: totaal.mislukt,
        automatischVerstuurd,
        toelichting,
        merken: [...new Set(merken)],
        autoLog: log,
      };
    });
  };

  /**
   * Blijven zoeken tot de vijver leeg is.
   *
   * Hij draait ronde na ronde door — elke ronde met andere merken — en stopt vanzelf
   * zodra er drie keer achter elkaar niets nieuws meer bij komt. Dat is het teken dat
   * hij binnen jouw zoekgrenzen alles heeft gehad. Je kunt hem op elk moment zelf
   * stoppen, en ondertussen gewoon doorwerken: de lijst bij Verkopers groeit mee.
   */
  const blijfZoeken = () => {
    if (bezig) return;
    onFout("");
    doorzoekVlag.stop = false;
    setStopGevraagd(false);
    const autopilotAan = auto?.aan ?? false;

    start("Doorlopend zoeken", async (stap) => {
      const log: string[] = [];
      const totaal = { ids: 0, weg: 0, mislukt: 0, overgeslagen: 0 };
      const merken: string[] = [];
      let laatsteFout = "";
      let droog = 0;
      let ronde = 0;
      let reden = "";

      while (ronde < MAX_RONDES) {
        if (doorzoekVlag.stop) {
          reden = "Gestopt door jou.";
          break;
        }
        ronde++;

        const bruikbaar = totaal.ids - totaal.weg;
        const o = await eenRonde(stap, `Ronde ${ronde} · ${bruikbaar} verkopers`);
        tel(totaal, o);
        merken.push(...o.merken);
        // De toelichting per ronde slaan we hier niet op: aan het eind zegt de reden
        // waaróm hij stopte je meer dan wat de laatste ronde toevallig opmerkte.

        if (o.fout) {
          laatsteFout = o.fout;
          log.push(`Ronde ${ronde}: ${o.fout}`);
          // Een storing telt mee als lege ronde. Blijft de sleutel geweigerd worden,
          // dan stopt hij zo vanzelf in plaats van zestig keer hetzelfde te proberen.
          droog++;
        } else if (o.gevonden === 0) {
          droog++;
          log.push(`Ronde ${ronde}: niets nieuws (${droog}× op rij)`);
        } else {
          droog = 0;
          log.push(`Ronde ${ronde}: ${o.gevonden} nieuwe advertenties`);
        }

        if (droog >= DROOG_NA) {
          reden = laatsteFout
            ? `Gestopt na ${DROOG_NA} rondes zonder resultaat. Laatste melding: ${laatsteFout}`
            : `Klaar — ${DROOG_NA} rondes achter elkaar niets nieuws. Binnen deze zoekgrenzen is alles gehad.`;
          break;
        }
      }

      if (!reden) reden = `Gestopt bij de grens van ${MAX_RONDES} rondes.`;
      log.push(reden);

      if (totaal.ids === 0 && laatsteFout) throw new Error(laatsteFout);

      const automatischVerstuurd = autopilotAan ? await draaiAutopilot(stap, log) : 0;

      return {
        toegevoegd: Math.max(0, totaal.ids - totaal.weg),
        overgeslagen: totaal.overgeslagen,
        gecontroleerd: totaal.ids,
        afgevallen: totaal.weg,
        nietUitgelezen: totaal.mislukt,
        automatischVerstuurd,
        toelichting: reden,
        merken: [...new Set(merken)],
        autoLog: log,
      };
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-5">
      <div className="xl:col-span-2 flex flex-col gap-4 md:gap-5">
        <Panel title="Zoek particuliere verkopers" icon={<Search size={14} color={T.navy} />}>
          <div className="flex flex-col gap-3">
            <p style={body(12.5)}>
              De zoekgrenzen hieronder bepalen wat er gezocht wordt. Je hoeft niets in te typen —
              <strong style={{ color: T.navy }}> alle merken doen mee</strong>, zolang het maar een
              particulier is.
            </p>

            {criteria && (
              <div className="flex flex-wrap gap-1.5">
                <Pill color={T.navy}>
                  {criteria.straalKm} km rond {criteria.vertrekpunt.naam.split(",")[0]}
                </Pill>
                <Pill color={T.teal}>
                  {criteria.brandstof.length ? criteria.brandstof.join(", ") : "alle brandstoffen"}
                </Pill>
                <Pill color={T.amber}>
                  {criteria.prijsMin || criteria.prijsMax
                    ? `€ ${(criteria.prijsMin || 0).toLocaleString("nl-NL")} – ${
                        criteria.prijsMax ? `€ ${criteria.prijsMax.toLocaleString("nl-NL")}` : "∞"
                      }`
                    : "elke prijs"}
                </Pill>
                <Pill color={T.ink(0.45)}>Nederland</Pill>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {bezig ? (
                <>
                  <Btn onClick={stopZoeken} variant="ghost" size="lg" disabled={stopGevraagd}>
                    <Square size={12} /> {stopGevraagd ? "Stopt na deze ronde…" : "Stop met zoeken"}
                  </Btn>
                  <span className="flex items-center gap-2" style={body(12, T.navy)}>
                    <Spinner size={13} />
                    {fase || (doorlopend ? "Doorlopend zoeken…" : "Aan het zoeken…")}
                  </span>
                </>
              ) : (
                <>
                  <Btn onClick={blijfZoeken} size="lg">
                    <Oneindig size={14} /> Blijf zoeken
                  </Btn>
                  <Btn onClick={zoek} variant="ghost" size="lg">
                    <Radar size={13} /> Eén ronde
                  </Btn>
                </>
              )}
            </div>

            <p style={body(11.5, T.ink(0.45))}>
              {bezig ? (
                doorlopend ? (
                  <>
                    Hij blijft rondes draaien met steeds andere merken, en stopt vanzelf als er{" "}
                    {DROOG_NA} keer op rij niets nieuws meer bij komt. De lijst bij Verkopers groeit
                    ondertussen mee — je kunt daar gewoon al beginnen met beoordelen.
                  </>
                ) : (
                  <>
                    {ZOEKRONDES} rondes achter elkaar, en elke gevonden advertentie wordt apart
                    geopend. Reken op een paar minuten. Je kunt gerust doorklikken; hij gaat door.
                  </>
                )
              ) : (
                <>
                  <strong style={{ color: T.navy }}>Blijf zoeken</strong> gaat net zo lang door tot
                  hij alle particulieren binnen deze grenzen heeft gehad — dat duurt lang, maar je
                  kunt ondertussen doorwerken en op elk moment stoppen.{" "}
                  <strong style={{ color: T.navy }}>Eén ronde</strong> is een snelle greep van een
                  paar minuten.
                </>
              )}
            </p>
          </div>
        </Panel>

        {taak?.fout && !taak.bezig && (
          <Foutmelding>{taak.fout}</Foutmelding>
        )}

        <VerkopersCriteria onFout={onFout} onGewijzigd={setCriteria} />

        {resultaat && (
          <Panel title="Resultaat" icon={<Check size={14} color={T.groen} />}>
            <div className="grid grid-cols-3 gap-2.5 mb-3">
              <Stat label="Bruikbare verkopers" value={resultaat.toegevoegd} accent={T.groen} size={22} />
              <Stat label="Advertenties bekeken" value={resultaat.gecontroleerd} size={22} />
              <Stat
                label="Afgevallen"
                value={resultaat.afgevallen + resultaat.overgeslagen}
                size={22}
                sub="handelaar of al bekend"
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
            {resultaat.merken && resultaat.merken.length > 0 && (
              <p className="mb-2" style={body(12, T.ink(0.5))}>
                Deze keer gezocht op: {resultaat.merken.join(", ")}. Een volgende keer pakt hij andere
                merken, tot de hele lijst is geweest.
              </p>
            )}
            {(resultaat.nietUitgelezen ?? 0) > 0 && (
              <p className="mb-2" style={body(12, T.amber)}>
                {resultaat.nietUitgelezen} advertentie
                {resultaat.nietUitgelezen === 1 ? " kon" : "s konden"} niet worden uitgelezen. Die
                {resultaat.nietUitgelezen === 1 ? " staat" : " staan"} wel in de lijst — probeer het daar
                nog eens met de knop naast de kaart.
              </p>
            )}
            {resultaat.toelichting && <p style={body(12.5)}>{resultaat.toelichting}</p>}
            {resultaat.toegevoegd === 0 ? (
              <p className="mt-2" style={body(12, T.ink(0.5))}>
                Niets bruikbaars gevonden. Advertentiesites zijn wisselend doorzoekbaar — druk gerust
                nog eens op zoeken, dan pakt hij andere merken. Helpt dat niet, zet de actieradius dan
                ruimer of verbreed de prijsklasse.
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
              "Bij Verkopers klik je op een kaart om de advertentie te bekijken. Prullenbak = weg en geblokkeerd, vinkje = klaarzetten.",
              "Wat je afvinkt staat bij Nakijken. Daar schrijft de AI het bericht over díe auto en lees jij het na.",
              "Jij drukt op versturen. Nooit automatisch: wat jij hebt afgevinkt gaat pas weg als je erop klikt.",
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
            Wat niet mag: massaal ongevraagde reclame mailen naar particulieren. Daarom gaat elke prullenbak direct
            naar de blokkadelijst, en raakt de autopilot niet aan wat jij hebt afgevinkt — dat wacht op Nakijken
            tot jij op versturen drukt.
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
          ? "Na elke zoekopdracht schrijft en verstuurt de AI zelf, zonder tussenkomst. Alleen nieuwe verkopers die door alle controles komen."
          : "Zet dit aan om de AI zelf te laten versturen bij nieuwe vondsten."}
      </p>
      <p className="mt-1.5" style={body(11.5, T.ink(0.45))}>
        Wat jij met het vinkje hebt klaargezet blijft hier buiten — dat wacht op Nakijken tot jij op
        versturen drukt.
      </p>

      <div className="grid grid-cols-3 gap-2.5 my-3">
        <Stat label="Autopilot pakt op" value={auto.klaarVoorVerzending} size={20} accent={T.amber} />
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
/**
 * Het tabblad Verkopers is de sorteertafel.
 *
 * Alles wat de radar heeft gevonden staat hier in één lijst. Op een rij klikken
 * opent de advertentie zelf — dat is wat je wilt zien om te beoordelen of het de
 * moeite waard is. Daarna kies je één van twee dingen: weg ermee, of doorzetten.
 *
 * Wat je doorzet komt op het tabblad Nakijken te staan; daar wordt het bericht
 * geschreven en verstuurd. Goedgekeurde verkopers verdwijnen dus uit deze lijst,
 * zodat je hier altijd alleen ziet wat nog beoordeeld moet worden.
 */
const FILTERS: { id: "alle" | Status; label: string }[] = [
  { id: "alle", label: "Alles" },
  { id: "nieuw", label: "Nieuw" },
  { id: "verstuurd", label: "Verstuurd" },
  { id: "gereageerd", label: "Reactie" },
  { id: "cosignatie", label: "Consignatie" },
];

function LeadsTab({
  leads,
  herlaad,
  herlaadBlokkade,
  onFout,
  naarNakijken,
  aantalKlaar,
}: {
  leads: Lead[] | null;
  herlaad: () => Promise<void>;
  herlaadBlokkade: () => Promise<void>;
  onFout: (s: string) => void;
  naarNakijken: (id: string, spring: boolean) => void;
  aantalKlaar: number;
}) {
  const [filter, setFilter] = useState<"alle" | Status>("alle");
  // Welke rijen op dit moment een knop verwerken. Per lead, zodat de rest
  // aanklikbaar blijft terwijl er eentje bezig is.
  const [bezig, setBezig] = useState<Record<string, "weg" | "klaar" | "lezen">>({});

  // Goedgekeurde verkopers wachten op het tabblad Nakijken; die horen hier niet meer.
  const teBeoordelen = useMemo(
    () => (leads ?? []).filter((l) => l.status !== "goedgekeurd"),
    [leads]
  );

  const zichtbaar = useMemo(
    () => teBeoordelen.filter((l) => filter === "alle" || l.status === filter),
    [teBeoordelen, filter]
  );

  const zetBezig = (id: string, wat: "weg" | "klaar" | "lezen" | null) =>
    setBezig((v) => {
      const n = { ...v };
      if (wat) n[id] = wat;
      else delete n[id];
      return n;
    });

  /** Advertentie (opnieuw) openen en uitlezen. Nodig als dat tijdens de zoekronde
   *  misging: zonder scores weet je niets van deze verkoper en laat de autopilot hem staan. */
  const leesUit = async (lead: Lead) => {
    zetBezig(lead.id, "lezen");
    onFout("");
    try {
      const res = await fetch(`/api/admin/verkopers/${lead.id}/verrijk`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) onFout(d.error || "Advertentie uitlezen mislukt");
      else if (d.handelaar) onFout("Dit blijkt een handelaar te zijn — de lead is verwijderd.");
      else if (d.bereikbaar === false) onFout("De advertentie kon niet worden geopend (mogelijk verwijderd).");
      await herlaad();
    } catch (e) {
      onFout(String(e));
    } finally {
      zetBezig(lead.id, null);
    }
  };

  const verwijder = async (lead: Lead) => {
    const wie = `${lead.merk} ${lead.model}`.trim() || "deze advertentie";
    if (!confirm(`${wie} weggooien en de verkoper op de blokkadelijst zetten?\n\nZo komt hij bij een volgende zoekronde niet opnieuw naar boven.`)) return;
    zetBezig(lead.id, "weg");
    onFout("");
    try {
      const res = await fetch(`/api/admin/verkopers/${lead.id}?blokkeer=1`, { method: "DELETE" });
      if (!res.ok) {
        onFout("Verwijderen mislukt");
        return;
      }
      await herlaad();
      await herlaadBlokkade();
    } catch (e) {
      onFout(String(e));
    } finally {
      zetBezig(lead.id, null);
    }
  };

  const zetKlaar = async (lead: Lead) => {
    zetBezig(lead.id, "klaar");
    onFout("");
    try {
      const res = await fetch(`/api/admin/verkopers/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "goedgekeurd" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        onFout(d.error || "Doorzetten mislukt");
        return;
      }
      // Aanwijzen zonder te springen: zo kun je doorgaan met sorteren, en staat
      // deze verkoper open zodra je naar Nakijken gaat.
      naarNakijken(lead.id, false);
      await herlaad();
    } catch (e) {
      onFout(String(e));
    } finally {
      zetBezig(lead.id, null);
    }
  };

  if (leads === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={22} />
      </div>
    );
  }

  if (teBeoordelen.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {aantalKlaar > 0 && <KlaarBalk aantal={aantalKlaar} onGa={() => naarNakijken("", true)} />}
        <Empty
          icon={<Radar size={30} color={T.ink(0.2)} />}
          title={aantalKlaar > 0 ? "Alles beoordeeld" : "Nog geen verkopers gevonden"}
          body={
            aantalKlaar > 0
              ? "Wat je hebt doorgezet staat klaar op het tabblad Nakijken."
              : "Ga naar het tabblad Radar en doe je eerste zoekopdracht."
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {aantalKlaar > 0 && <KlaarBalk aantal={aantalKlaar} onGa={() => naarNakijken("", true)} />}

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const aantal =
            f.id === "alle" ? teBeoordelen.length : teBeoordelen.filter((l) => l.status === f.id).length;
          return (
            <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} {aantal > 0 && <span style={{ opacity: 0.6 }}>{aantal}</span>}
            </Chip>
          );
        })}
      </div>

      {zichtbaar.length === 0 ? (
        <Empty compact title="Niets in dit filter" body="Kies een ander filter." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2.5">
          {zichtbaar.map((lead) => (
            <LeadKaart
              key={lead.id}
              lead={lead}
              bezig={bezig[lead.id] ?? null}
              onWeg={() => verwijder(lead)}
              onKlaar={() => zetKlaar(lead)}
              onOpenen={() => naarNakijken(lead.id, true)}
              onLezen={() => leesUit(lead)}
            />
          ))}
        </div>
      )}

      <PanelVoet>
        Klik op een kaart om de advertentie te openen. Met de prullenbak gooi je hem weg én komt de verkoper op
        de blokkadelijst, zodat hij niet opnieuw opduikt. Met het vinkje zet je hem klaar op Nakijken — daar
        schrijf je het bericht en verstuur je de mail.
      </PanelVoet>
    </div>
  );
}

/** Vaste verwijzing naar wat er klaarstaat, zodat doorzetten niet in het niets verdwijnt. */
function KlaarBalk({ aantal, onGa }: { aantal: number; onGa: () => void }) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 px-4 py-3"
      style={{ backgroundColor: T.tintAmber, border: `1px solid ${T.amber}` }}
    >
      <Check size={14} color={T.amber} />
      <span style={body(12.5, T.navy)}>
        <strong>
          {aantal} {aantal === 1 ? "verkoper staat" : "verkopers staan"} klaar
        </strong>{" "}
        op Nakijken om te mailen.
      </span>
      <span className="ml-auto">
        <Btn size="sm" onClick={onGa}>
          <ScrollText size={11} /> Naar Nakijken
        </Btn>
      </span>
    </div>
  );
}

/**
 * Eén verkoper in de lijst.
 *
 * De kaart is een link naar de advertentie, niet een knop: klikken brengt je naar
 * de auto zelf. De twee actieknoppen liggen daar bovenop en stoppen het doorklikken,
 * anders zou wegklikken tegelijk een nieuw tabblad openen.
 */
function LeadKaart({
  lead,
  bezig,
  onWeg,
  onKlaar,
  onOpenen,
  onLezen,
}: {
  lead: Lead;
  bezig: "weg" | "klaar" | "lezen" | null;
  onWeg: () => void;
  onKlaar: () => void;
  onOpenen: () => void;
  onLezen: () => void;
}) {
  const st = STATUS_LABEL[lead.status];
  // Afgewezen zit erbij: die verkoper staat op de blokkadelijst, dus klaarzetten om
  // te mailen heeft geen zin — de verzending zou toch geweigerd worden.
  const afgerond =
    lead.status === "verstuurd" ||
    lead.status === "gereageerd" ||
    lead.status === "cosignatie" ||
    lead.status === "afgewezen";
  // Nooit uitgelezen: dan weten we niets van deze verkoper, geen contactgegevens en
  // geen scores. Eerst uitlezen heeft dan meer zin dan klaarzetten.
  const ongelezen = lead.particulier_score === 0;

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className="relative flex flex-col transition-all hover:opacity-90"
      style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}
    >
      <a
        href={lead.advertentie_url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="block flex-1"
        style={{ padding: "12px 14px", cursor: lead.advertentie_url ? "pointer" : "default" }}
        title={lead.advertentie_url ? "Open de advertentie in een nieuw tabblad" : "Geen link bekend"}
      >
        <div className="flex items-start gap-2 mb-1.5">
          <span
            className="flex-1 min-w-0 truncate flex items-center gap-1.5"
            style={{ fontFamily: T.play, fontSize: 14, fontWeight: 700, color: T.navy }}
          >
            {lead.merk} {lead.model}
            {lead.advertentie_url && <ExternalLink size={11} color={T.ink(0.3)} />}
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
      </a>

      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderTop: `1px solid ${T.line}`, backgroundColor: "rgba(0,19,55,0.015)" }}
      >
        <span style={{ ...micro(ongelezen ? T.amber : T.ink(0.3)), fontSize: 8.5 }}>
          {ongelezen ? "nog niet uitgelezen" : `Particulier ${lead.particulier_score}/10`}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <RijKnop
            titel="Weggooien en blokkeren"
            kleur={T.rood}
            bezig={bezig === "weg"}
            onClick={(e) => {
              stop(e);
              onWeg();
            }}
          >
            <Trash2 size={13} />
          </RijKnop>
          {!afgerond && ongelezen && (
            <RijKnop
              titel="Advertentie uitlezen"
              kleur={T.amber}
              bezig={bezig === "lezen"}
              onClick={(e) => {
                stop(e);
                onLezen();
              }}
            >
              <RefreshCw size={13} />
            </RijKnop>
          )}
          {afgerond ? (
            <RijKnop
              titel="Bekijk op Nakijken"
              kleur={T.navy}
              bezig={false}
              onClick={(e) => {
                stop(e);
                onOpenen();
              }}
            >
              <ChevronRight size={14} />
            </RijKnop>
          ) : (
            <RijKnop
              titel="Klaarzetten om te mailen"
              kleur={T.groen}
              bezig={bezig === "klaar"}
              onClick={(e) => {
                stop(e);
                onKlaar();
              }}
            >
              <Check size={14} />
            </RijKnop>
          )}
        </span>
      </div>
    </div>
  );
}

function RijKnop({
  children,
  titel,
  kleur,
  bezig,
  onClick,
}: {
  children: React.ReactNode;
  titel: string;
  kleur: string;
  bezig: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      title={titel}
      aria-label={titel}
      onClick={onClick}
      disabled={bezig}
      className="flex items-center justify-center transition-all hover:opacity-70 disabled:opacity-40"
      style={{ width: 30, height: 28, color: kleur, border: `1px solid ${T.line2}`, backgroundColor: T.paper }}
    >
      {bezig ? <Spinner size={12} /> : children}
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
  onVerstuurd,
}: {
  lead: Lead;
  herlaad: () => Promise<void>;
  herlaadBlokkade: () => Promise<void>;
  onFout: (s: string) => void;
  onVerwijderd: () => void;
  /** Na een geslaagde verzending, zodat de lijst deze verkoper open kan houden. */
  onVerstuurd?: (id: string) => void;
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
      // Bewust géén statuswijziging: goedkeuren doe jij met het vinkje op het
      // tabblad Verkopers. Schrijven is niet hetzelfde als akkoord gaan.
      await herlaad();
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
      // Eerst opslaan, dan pas versturen — en niet versturen als het opslaan mislukt.
      // De server pakt de ontvanger uit de database, niet uit dit verzoek. Corrigeer
      // je hier een verkeerd e-mailadres en gaat het opslaan mis, dan zou de mail
      // alsnog naar het oude adres vertrekken. Dat valt niet terug te halen.
      if (!(await patch({ onderwerp, bericht_mail: berichtMail, email }))) return;
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
      // Hem aangewezen houden: hij verlaat de wachtrij en zou anders meteen uit
      // beeld schuiven, zonder dat je ziet dat het gelukt is.
      onVerstuurd?.(lead.id);
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

// ── Tab: nakijken ─────────────────────────────────────────────────
/**
 * Het tabblad Nakijken is de werkbank.
 *
 * Wat je op het tabblad Verkopers hebt afgevinkt komt hier binnen. Per verkoper
 * laat je het bericht schrijven, lees je het na, past het desgewenst aan, en
 * verstuur je de mail. Daaronder staat wat er al de deur uit is en het vak waarin
 * je de AI bijstuurt — samen op één scherm, want het een leert van het ander.
 */
function NakijkenTab({
  leads,
  herlaad,
  herlaadBlokkade,
  onFout,
  gekozenId,
  setGekozenId,
}: {
  leads: Lead[] | null;
  herlaad: () => Promise<void>;
  herlaadBlokkade: () => Promise<void>;
  onFout: (s: string) => void;
  gekozenId: string | null;
  setGekozenId: (id: string | null) => void;
}) {
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

  const alle = useMemo(() => leads ?? [], [leads]);
  // De wachtrij: alles wat jij hebt afgevinkt en nog gemaild moet worden.
  const wachtrij = useMemo(() => alle.filter((l) => l.status === "goedgekeurd"), [alle]);
  // Welke verkoper er openstaat. Wijs je er zelf één aan — met het vinkje, of met de
  // pijl bij een al verstuurde — dan is dat leidend. Alleen als er niets is
  // aangewezen valt hij terug op de eerste uit de wachtrij, zodat het scherm niet
  // leeg staat terwijl er werk ligt.
  const gekozen = useMemo(() => {
    const aangewezen = alle.find((l) => l.id === gekozenId) ?? null;
    return aangewezen ?? wachtrij[0] ?? null;
  }, [alle, gekozenId, wachtrij]);

  // Na versturen moeten zowel de leads als het log opnieuw opgehaald worden,
  // anders klopt het overzicht eronder niet meer met wat je net gedaan hebt.
  const herlaadAlles = useCallback(async () => {
    await herlaad();
    try {
      const r = await fetch("/api/admin/verkopers/log");
      setLog(r.ok ? await r.json() : []);
    } catch {
      /* het log is bijzaak; de lead is bijgewerkt */
    }
  }, [herlaad]);

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
    <div className="flex flex-col gap-5 md:gap-6">
      {/* ── Werkbank: schrijven en versturen ── */}
      {leads === null ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size={22} />
        </div>
      ) : gekozen === null ? (
        <Empty
          icon={<Users size={30} color={T.ink(0.2)} />}
          title="Niets klaargezet"
          body="Ga naar het tabblad Verkopers en vink daar aan wie je wilt mailen. Wat je afvinkt komt hier terecht."
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-5">
          <div className="xl:col-span-2 flex flex-col gap-2">
            <p style={micro(T.ink(0.35))}>
              {wachtrij.length > 0
                ? `${wachtrij.length} klaar om te mailen`
                : "Wachtrij leeg — je kijkt naar een eerder verstuurde verkoper"}
            </p>
            {wachtrij.map((l) => (
              <WachtrijKaart
                key={l.id}
                lead={l}
                actief={l.id === gekozen.id}
                onClick={() => setGekozenId(l.id)}
              />
            ))}
            {wachtrij.length === 0 && (
              <Empty compact title="Wachtrij leeg" body="Vink op het tabblad Verkopers de volgende aan." />
            )}
          </div>

          <div className="xl:col-span-3">
            <LeadDetail
              key={gekozen.id}
              lead={gekozen}
              herlaad={herlaadAlles}
              herlaadBlokkade={herlaadBlokkade}
              onFout={onFout}
              onVerwijderd={() => setGekozenId(null)}
              onVerstuurd={setGekozenId}
            />
          </div>
        </div>
      )}

      {/* ── Verantwoording en bijsturen ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-5" style={{ borderTop: `1px solid ${T.line2}`, paddingTop: 20 }}>
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
    </div>
  );
}

/** Compacte rij in de wachtrij van Nakijken. */
function WachtrijKaart({ lead, actief, onClick }: { lead: Lead; actief: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left w-full transition-all hover:opacity-85"
      style={{
        backgroundColor: actief ? "rgba(0,19,55,0.035)" : T.paper,
        border: `1px solid ${actief ? T.navy : T.line}`,
        padding: "10px 13px",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="flex-1 min-w-0 truncate"
          style={{ fontFamily: T.play, fontSize: 13.5, fontWeight: 700, color: T.navy }}
        >
          {lead.merk} {lead.model}
        </span>
        {lead.bericht_mail ? (
          <Pill color={T.groen}>bericht klaar</Pill>
        ) : (
          <Pill color={T.amber}>nog schrijven</Pill>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1" style={body(11.5, T.ink(0.5))}>
        {lead.bouwjaar && <span>{lead.bouwjaar}</span>}
        {lead.vraagprijs > 0 && (
          <span style={{ color: T.navy, fontWeight: 600 }}>€ {lead.vraagprijs.toLocaleString("nl-NL")}</span>
        )}
        <span className="truncate">{lead.email || "geen e-mailadres"}</span>
      </div>
    </button>
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

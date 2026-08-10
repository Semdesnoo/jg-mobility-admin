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
  Sparkles,
  Trash2,
  Handshake,
  MessageSquare,
  Plus,
  RefreshCw,
  ScrollText,
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
  toelichting: string;
  merken?: string[];
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
  Empty,
  Foutmelding,
  Waarschuwing,
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

  // De zoekronde draait in de takenlaag boven de tabbladen. Daardoor loopt hij
  // door als je naar een ander scherm klikt, en staat het antwoord er nog als je
  // terugkomt.
  const { taak, start } = useAiTaak<ZoekResultaat>("verkopers-zoek");
  const bezig = taak?.bezig ?? false;
  const fase = taak?.stap ?? "";
  const resultaat = taak?.bezig ? null : (taak?.resultaat ?? null);
  /**
   * Alles ophalen van Marktplaats en AutoScout24.
   *
   * Eén verzoek, alle merken, en er komt geen AI aan te pas — dit kost dus niets.
   * Ook het uitlezen van elke advertentie gebeurt hier bewust NIET meer: dat was de
   * enige kostenpost, en het is zonde om ervoor te betalen bij advertenties die je
   * toch niet gaat benaderen. Je ziet in de lijst zelf wel of het een particulier is;
   * pas als jij iemand aanvinkt wordt er iets uitgelezen en geschreven.
   */
  const zoek = () => {
    if (bezig) return;
    onFout("");

    start("Verkopers zoeken", async (stap) => {
      stap("Marktplaats en AutoScout24 langslopen");
      const res = await fetch("/api/admin/verkopers/zoek", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Ook bij een fout de lijst verversen: als de server halverwege afgekapt is,
        // staan de gevonden verkopers er wél al en zou je ze anders niet zien.
        await herlaad().catch(() => null);
        throw new Error(
          data.error ||
            (res.status === 504
              ? "Het zoeken duurde te lang en werd afgebroken. Wat al gevonden was staat bij Verkopers."
              : `Zoeken mislukt (fout ${res.status})`)
        );
      }

      await herlaad();

      return {
        toegevoegd: Array.isArray(data.nieuwe_ids) ? data.nieuwe_ids.length : 0,
        overgeslagen: data.overgeslagen ?? 0,
        gecontroleerd: data.gevonden ?? 0,
        afgevallen: 0,
        toelichting: data.toelichting ?? "",
        merken: Array.isArray(data.merken) ? data.merken : [],
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
            <p style={body(11.5, T.ink(0.45))}>
              Doorzocht: <strong style={{ color: T.navy }}>Marktplaats</strong> en{" "}
              <strong style={{ color: T.navy }}>AutoScout24</strong>. AutoWereld en Facebook
              Marketplace kunnen niet: die laten hun advertenties alleen aan ingelogde bezoekers zien.
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
              <Btn onClick={zoek} disabled={bezig} size="lg">
                {bezig ? <Spinner size={13} tone="donker" /> : <Radar size={13} />}
                {bezig ? fase || "Bezig…" : "Zoek alle verkopers"}
              </Btn>
            </div>

            <p style={body(11.5, T.ink(0.45))}>
              Loopt alle merken langs op beide sites — een seconde of tien.{" "}
              <strong style={{ color: T.navy }}>Dit kost niets:</strong> er wordt alleen opgehaald wat
              openbaar op de overzichtspagina&apos;s staat. Pas als jij bij Verkopers iemand aanvinkt,
              wordt de advertentie gelezen en een bericht geschreven.
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
            {resultaat.merken && resultaat.merken.length > 0 && (
              <p className="mb-2" style={body(12, T.ink(0.5))}>
                Alle {resultaat.merken.length} merken doorzocht op beide sites.
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
                Niets nieuws gevonden. Waarschijnlijk ken je alles al wat er nu binnen je zoekgrenzen
                staat. Zet de actieradius ruimer of verbreed de prijsklasse om meer te zien.
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

      </div>

      <div className="flex flex-col gap-4 md:gap-5">
        <Panel title="Lopende trajecten">
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="Verstuurd" value={tellers.verstuurd} size={22} accent={T.teal} />
            <Stat label="Reacties" value={tellers.reacties} size={22} accent={T.groen} />
            <Stat label="Nog te sturen" value={tellers.klaar} size={22} accent={T.amber} />
            <Stat label="In consignatie" value={tellers.consignatie} size={22} accent={T.paars} />
          </div>
        </Panel>
      </div>
    </div>
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
/**
 * Een kort modelnaampje uit de advertentietitel, voor vondsten die nog niet zijn
 * uitgelezen en dus geen model-veld hebben. Het merk eraf halen in plaats van er een
 * vast aantal woorden af te knippen: "Alfa Romeo" is twee woorden, en dan werd het
 * "Alfa Romeo Romeo Giulietta".
 */
function korteTitel(lead: Lead): string {
  const zonderMerk = lead.titel.replace(new RegExp(lead.merk, "i"), "").trim();
  return zonderMerk.split(/\s+/).slice(0, 2).join(" ");
}

/**
 * De velden in de filterbalk. Compacter dan het standaardveld, maar zonder vaste
 * hoogte — die knipte de tekst af. De padding doet het werk, dan sluiten een
 * invoerveld en een keuzemenu vanzelf op elkaar aan.
 */
const FILTER_VELD = { ...inputStijl, padding: "7px 10px", fontSize: 12.5 } as const;

const FILTERS: { id: "alle" | Status; label: string }[] = [
  { id: "alle", label: "Alles" },
  { id: "nieuw", label: "Nieuw" },
  { id: "verstuurd", label: "Verstuurd" },
  { id: "gereageerd", label: "Reactie" },
  { id: "cosignatie", label: "Consignatie" },
  { id: "afgewezen", label: "Opzij gezet" },
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
  // Filters op de lijst zelf. Met tweehonderd kaarten is scrollen geen doen.
  const [zoekterm, setZoekterm] = useState("");
  const [merkFilter, setMerkFilter] = useState("");
  const [bronFilter, setBronFilter] = useState("");
  const [prijsVan, setPrijsVan] = useState("");
  const [prijsTot, setPrijsTot] = useState("");
  const [sortering, setSortering] = useState<"nieuwste" | "prijs-op" | "prijs-af" | "kans">("nieuwste");
  // Loopt er een zoekronde? Dan hoort hier niet "ga eerst zoeken" te staan. De takenlaag
  // ligt boven de tabbladen, dus dit tabblad kan er gewoon naar kijken.
  const { taak: zoekTaak } = useAiTaak<unknown>("verkopers-zoek");
  const zoektNu = zoekTaak?.bezig ?? false;
  // Welke rijen op dit moment een knop verwerken. Per lead, zodat de rest
  // aanklikbaar blijft terwijl er eentje bezig is.
  const [bezig, setBezig] = useState<Record<string, "weg" | "klaar" | "lezen" | "terug">>({});
  // Wie je hebt aangevinkt om een bericht voor te laten schrijven.
  const [gekozen, setGekozen] = useState<Set<string>>(new Set());

  const [zetBezigBulk, setZetBezigBulk] = useState(false);
  // Selecteerstand: pas als je die aanzet verschijnen de vinkvakjes en vinkt een klik
  // op een kaart aan in plaats van de advertentie te openen. Zo blijft de gewone stand
  // rustig, en kun je in de selecteerstand snel achter elkaar doorklikken.
  const [selecteerStand, setSelecteerStand] = useState(false);

  const kiesOfNiet = (id: string) =>
    setGekozen((v) => {
      const n = new Set(v);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  /**
   * Zet alles wat je hebt aangevinkt klaar op Nakijken.
   *
   * Eén verzoek voor de hele selectie. Hiervoor ging er een apart verzoek per verkoper
   * heen en weer — bij vijftig kaarten stond je tien seconden te wachten op iets wat de
   * database in één opdracht doet. Nu is het een kwestie van een tel, of je er nu drie
   * of driehonderd aanvinkt.
   *
   * Dit kost niets: er gaat alleen een vinkje om. Het schrijven van de tekst gebeurt op
   * Nakijken, per advertentie, als jij erop klikt.
   */
  /**
   * Gooi de hele selectie weg.
   *
   * Ze komen op de negeerlijst en daarna pas uit de lijst. Zonder die lijst zou een
   * volgende zoekronde ze allemaal opnieuw binnenhalen — en dat kost je elke keer weer
   * tijd en tokens.
   */
  const gooiSelectieWeg = async () => {
    if (zetBezigBulk || gekozen.size === 0) return;
    const ids = [...gekozen];
    if (
      !confirm(
        `${ids.length} verkopers weggooien?

Ze verdwijnen uit de lijst en komen bij een volgende zoekronde niet meer terug.`
      )
    )
      return;

    setZetBezigBulk(true);
    onFout("");
    try {
      const res = await fetch("/api/admin/verkopers/bulk-verwijder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        onFout(d.error || "Weggooien mislukt");
        return;
      }
      setGekozen(new Set());
      setSelecteerStand(false);
      await herlaad();
    } catch (e) {
      onFout(e instanceof Error ? e.message : String(e));
    } finally {
      setZetBezigBulk(false);
    }
  };

  const zetSelectieKlaar = async () => {
    if (zetBezigBulk || gekozen.size === 0) return;
    const ids = [...gekozen];
    setZetBezigBulk(true);
    onFout("");
    try {
      const res = await fetch("/api/admin/verkopers/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status: "goedgekeurd" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        onFout(d.error || "Klaarzetten mislukt");
        return;
      }
      setGekozen(new Set());
      setSelecteerStand(false);
      if (d.bijgewerkt < ids.length) {
        onFout(
          `${d.bijgewerkt} van de ${ids.length} klaargezet. De rest was al verstuurd en blijft ongemoeid.`
        );
      }
      await herlaad();
    } catch (e) {
      onFout(e instanceof Error ? e.message : String(e));
    } finally {
      setZetBezigBulk(false);
    }
  };

  // Goedgekeurde verkopers wachten op het tabblad Nakijken; die horen hier niet meer.
  const teBeoordelen = useMemo(
    () => (leads ?? []).filter((l) => l.status !== "goedgekeurd"),
    [leads]
  );

  // Alle merken die er echt in de lijst zitten, voor het keuzemenu. Geen vaste lijst:
  // dan zou je kunnen filteren op merken waar niets van te koop staat.
  const merkenInLijst = useMemo(
    () => [...new Set(teBeoordelen.map((l) => l.merk).filter(Boolean))].sort(),
    [teBeoordelen]
  );

  const zichtbaar = useMemo(() => {
    const term = zoekterm.trim().toLowerCase();
    const min = Number(prijsVan) || 0;
    const max = Number(prijsTot) || 0;

    const uit = teBeoordelen.filter((l) => {
      if (filter !== "alle" && l.status !== filter) return false;
      if (merkFilter && l.merk !== merkFilter) return false;
      if (bronFilter && l.bron !== bronFilter) return false;
      if (min > 0 && (l.vraagprijs === 0 || l.vraagprijs < min)) return false;
      if (max > 0 && (l.vraagprijs === 0 || l.vraagprijs > max)) return false;
      if (term) {
        const hooi = `${l.merk} ${l.model} ${l.titel} ${l.plaats} ${l.naam}`.toLowerCase();
        if (!hooi.includes(term)) return false;
      }
      return true;
    });

    const gesorteerd = [...uit];
    if (sortering === "prijs-op") gesorteerd.sort((a, b) => a.vraagprijs - b.vraagprijs);
    else if (sortering === "prijs-af") gesorteerd.sort((a, b) => b.vraagprijs - a.vraagprijs);
    else if (sortering === "kans") gesorteerd.sort((a, b) => b.kans_score - a.kans_score);
    // "nieuwste" is de volgorde waarin de server ze al aanlevert.
    return gesorteerd;
  }, [teBeoordelen, filter, merkFilter, bronFilter, prijsVan, prijsTot, zoekterm, sortering]);

  const zetBezig = (id: string, wat: "weg" | "klaar" | "lezen" | "terug" | null) =>
    setBezig((v) => {
      const n = { ...v };
      if (wat) n[id] = wat;
      else delete n[id];
      return n;
    });

  /**
   * Zet een opzij gelegde verkoper terug in de lijst.
   *
   * Het uitlezen zet handelaren automatisch opzij, maar dat is een inschatting en die
   * kan ernaast zitten. Daarom gooit niets in dit systeem nog automatisch iets weg —
   * en kun je zo'n oordeel met één klik terugdraaien.
   */
  const zetTerug = async (lead: Lead) => {
    zetBezig(lead.id, "terug");
    onFout("");
    try {
      const res = await fetch(`/api/admin/verkopers/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "nieuw", notitie: "" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        onFout(d.error || "Terugzetten mislukt");
        return;
      }
      await herlaad();
    } catch (e) {
      onFout(String(e));
    } finally {
      zetBezig(lead.id, null);
    }
  };

  /** Advertentie (opnieuw) openen en uitlezen. Nodig als dat tijdens de zoekronde
   *  misging: zonder scores weet je niets van deze verkoper. */
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
        {zoektNu ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Spinner size={20} />
            <p style={body(13, T.navy)}>Marktplaats en AutoScout24 worden doorzocht…</p>
            <p style={body(11.5, T.ink(0.45))}>
              Ze verschijnen hier zodra hij klaar is — een seconde of tien.
            </p>
          </div>
        ) : (
          <Empty
            icon={<Radar size={30} color={T.ink(0.2)} />}
            title={aantalKlaar > 0 ? "Alles beoordeeld" : "Nog geen verkopers gevonden"}
            body={
              aantalKlaar > 0
                ? "Wat je hebt doorgezet staat klaar op het tabblad Nakijken."
                : "Ga naar het tabblad Radar en druk op Zoek alle verkopers."
            }
          />
        )}
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

      {/* Filters. Met tweehonderd kaarten is doorscrollen geen doen; hiermee ga je
          gericht op zoek naar wat je wilt benaderen.

          Geen vaste hoogte op de velden: die botste met de padding van het
          standaardveld en knipte de tekst onderaan af. De padding bepaalt de hoogte,
          dan zijn ze vanzelf allemaal gelijk. */}
      <div
        className="flex flex-wrap items-center gap-2 px-3 py-2.5"
        style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}
      >
        <div className="relative flex-1" style={{ minWidth: 190 }}>
          <Search
            size={13}
            color={T.ink(0.3)}
            style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          />
          <input
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
            placeholder="Zoek op merk, model, plaats of naam…"
            style={{ ...FILTER_VELD, paddingLeft: 28 }}
          />
        </div>

        <select
          value={merkFilter}
          onChange={(e) => setMerkFilter(e.target.value)}
          style={{ ...FILTER_VELD, width: "auto", minWidth: 130, paddingRight: 26 }}
        >
          <option value="">Alle merken</option>
          {merkenInLijst.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <select
          value={bronFilter}
          onChange={(e) => setBronFilter(e.target.value)}
          style={{ ...FILTER_VELD, width: "auto", minWidth: 120, paddingRight: 26 }}
        >
          <option value="">Beide sites</option>
          <option value="Marktplaats">Marktplaats</option>
          <option value="AutoScout24">AutoScout24</option>
        </select>

        <div className="flex items-center gap-1">
          <input
            type="number"
            value={prijsVan}
            onChange={(e) => setPrijsVan(e.target.value)}
            placeholder="€ van"
            style={{ ...FILTER_VELD, width: 84 }}
          />
          <span style={body(12, T.ink(0.3))}>–</span>
          <input
            type="number"
            value={prijsTot}
            onChange={(e) => setPrijsTot(e.target.value)}
            placeholder="€ tot"
            style={{ ...FILTER_VELD, width: 84 }}
          />
        </div>

        <select
          value={sortering}
          onChange={(e) => setSortering(e.target.value as typeof sortering)}
          style={{ ...FILTER_VELD, width: "auto", minWidth: 145, paddingRight: 26 }}
        >
          <option value="nieuwste">Nieuwste eerst</option>
          <option value="prijs-af">Prijs hoog → laag</option>
          <option value="prijs-op">Prijs laag → hoog</option>
          <option value="kans">Beste kans eerst</option>
        </select>

        <Btn
          variant={selecteerStand ? "primair" : "ghost"}
          size="sm"
          onClick={() => {
            setSelecteerStand((v) => !v);
            if (selecteerStand) setGekozen(new Set());
          }}
        >
          <Check size={11} /> {selecteerStand ? "Klaar met selecteren" : "Selecteren"}
        </Btn>

        <span style={{ ...micro(T.ink(0.4)), marginLeft: "auto" }}>
          {zichtbaar.length} van {teBeoordelen.length}
        </span>

        {(zoekterm || merkFilter || bronFilter || prijsVan || prijsTot) && (
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => {
              setZoekterm("");
              setMerkFilter("");
              setBronFilter("");
              setPrijsVan("");
              setPrijsTot("");
            }}
          >
            Wis filters
          </Btn>
        )}
      </div>

      {(selecteerStand || gekozen.size > 0) && (
        <SelectieBalk
          aantal={gekozen.size}
          zichtbaar={zichtbaar.length}
          bezig={zetBezigBulk}
          onZet={zetSelectieKlaar}
          onWeg={gooiSelectieWeg}
          onAllesOpScherm={() => setGekozen(new Set(zichtbaar.map((l) => l.id)))}
          onWis={() => {
            setGekozen(new Set());
            setSelecteerStand(false);
          }}
        />
      )}

      {zichtbaar.length === 0 ? (
        <Empty
          compact
          title="Niets gevonden"
          body="Geen verkoper voldoet aan deze filters. Verruim de prijs of kies een ander merk."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2.5">
          {zichtbaar.map((lead) => (
            <LeadKaart
              key={lead.id}
              lead={lead}
              bezig={bezig[lead.id] ?? null}
              selecteerStand={selecteerStand}
              aangevinkt={gekozen.has(lead.id)}
              onVink={() => kiesOfNiet(lead.id)}
              onWeg={() => verwijder(lead)}
              onKlaar={() => zetKlaar(lead)}
              onOpenen={() => naarNakijken(lead.id, true)}
              onLezen={() => leesUit(lead)}
              onTerug={() => zetTerug(lead)}
            />
          ))}
        </div>
      )}

      <PanelVoet>
        Klik op een kaart om de advertentie te openen. Vink aan wie je wilt benaderen en zet ze klaar op
        Nakijken — dat kost niets. Daar vraag je per advertentie een tekst aan, dus je betaalt alleen voor
        wie je echt benadert. Met de prullenbak gooi je iemand weg én komt hij op de blokkadelijst.
      </PanelVoet>
    </div>
  );
}

/**
 * De balk in de selecteerstand: hoeveel je hebt aangevinkt, "alles op dit scherm", en
 * de knop om ze klaar te zetten. Bewust geen bedrag — klaarzetten kost niets. Je betaalt
 * pas op Nakijken, per advertentie waar jij een tekst voor vraagt.
 */
function SelectieBalk({
  aantal,
  zichtbaar,
  bezig,
  onZet,
  onWeg,
  onAllesOpScherm,
  onWis,
}: {
  aantal: number;
  zichtbaar: number;
  bezig: boolean;
  onZet: () => void;
  onWeg: () => void;
  onAllesOpScherm: () => void;
  onWis: () => void;
}) {
  return (
    <div
      className="sticky z-20 flex flex-wrap items-center gap-3 px-4 py-3"
      style={{ top: 102, backgroundColor: T.navy, color: "#ffffff" }}
    >
      <Check size={15} />
      <span style={{ fontFamily: T.inter, fontSize: 12.5 }}>
        {aantal === 0 ? (
          <>
            <strong>Selecteren aan</strong>
            <span style={{ opacity: 0.7 }}> · klik kaarten aan om ze te kiezen</span>
          </>
        ) : (
          <>
            <strong>{aantal} aangevinkt</strong>
            <span style={{ opacity: 0.7 }}> · klaarzetten kost niets</span>
          </>
        )}
      </span>

      <span className="ml-auto flex flex-wrap items-center gap-2">
        {bezig ? (
          <span className="flex items-center gap-2" style={{ fontFamily: T.inter, fontSize: 12 }}>
            <Spinner size={13} tone="donker" /> Klaarzetten…
          </span>
        ) : (
          <>
            {aantal < zichtbaar && (
              <button
                type="button"
                onClick={onAllesOpScherm}
                className="px-3 py-2 transition-all hover:opacity-70"
                style={{ fontFamily: T.inter, fontSize: 11.5, color: "rgba(255,255,255,0.85)" }}
              >
                Alle {zichtbaar} op dit scherm
              </button>
            )}
            <button
              type="button"
              onClick={onWis}
              className="px-3 py-2 transition-all hover:opacity-70"
              style={{ fontFamily: T.inter, fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}
            >
              Stop met selecteren
            </button>
            <button
              type="button"
              onClick={onWeg}
              disabled={aantal === 0}
              title="Weggooien — ze komen bij een volgende zoekronde niet meer terug"
              className="flex items-center gap-1.5 px-3 py-2 transition-all hover:opacity-80 disabled:opacity-40"
              style={{
                border: "1px solid rgba(255,255,255,0.35)",
                color: "#ffffff",
                fontFamily: T.inter,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <Trash2 size={12} /> Weggooien
            </button>
            <button
              type="button"
              onClick={onZet}
              disabled={aantal === 0}
              className="flex items-center gap-1.5 px-4 py-2 transition-all hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: "#ffffff", color: T.navy, fontFamily: T.inter, fontSize: 12, fontWeight: 700 }}
            >
              <ScrollText size={12} /> Zet {aantal > 0 ? `${aantal} ` : ""}klaar op Nakijken
            </button>
          </>
        )}
      </span>
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
  selecteerStand,
  aangevinkt,
  onVink,
  onWeg,
  onKlaar,
  onOpenen,
  onLezen,
  onTerug,
}: {
  lead: Lead;
  bezig: "weg" | "klaar" | "lezen" | "terug" | null;
  selecteerStand: boolean;
  aangevinkt: boolean;
  onVink: () => void;
  onWeg: () => void;
  onKlaar: () => void;
  onOpenen: () => void;
  onLezen: () => void;
  onTerug: () => void;
}) {
  const st = STATUS_LABEL[lead.status];
  // Afgewezen zit erbij: die verkoper staat op de blokkadelijst, dus klaarzetten om
  // te mailen heeft geen zin — de verzending zou toch geweigerd worden.
  const afgerond =
    lead.status === "verstuurd" ||
    lead.status === "gereageerd" ||
    lead.status === "cosignatie" ||
    lead.status === "afgewezen";
  // Nooit uitgelezen: dan kennen we alleen wat op de overzichtspagina stond, geen
  // bouwjaar en geen kilometerstand. Aan het bouwjaar afmeten en niet aan de
  // particulier-score: AutoScout24-vondsten krijgen die score al bij het ophalen mee.
  const ongelezen = !lead.bouwjaar;

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className="relative flex flex-col transition-all hover:opacity-90"
      style={{
        backgroundColor: aangevinkt ? "rgba(0,19,55,0.04)" : T.paper,
        border: `1px solid ${aangevinkt ? T.navy : T.line}`,
      }}
    >
      {/* In de selecteerstand ligt er een vinkvakje bovenop; in de gewone stand niet,
          want dan opent een klik gewoon de advertentie. */}
      {selecteerStand && !afgerond && (
        <span
          className="absolute flex items-center justify-center"
          style={{
            top: 10,
            right: 10,
            zIndex: 2,
            width: 22,
            height: 22,
            backgroundColor: aangevinkt ? T.navy : T.paper,
            border: `1px solid ${aangevinkt ? T.navy : T.line2}`,
            color: "#ffffff",
            pointerEvents: "none",
          }}
        >
          {aangevinkt && <Check size={13} />}
        </span>
      )}

      {/* In de selecteerstand is de kaart een knop die aanvinkt; daarbuiten een link
          naar de advertentie. Twee verschillende elementen in plaats van een link met
          een onderschepte klik: dan blijft midden- en ctrl-klikken gewoon werken. */}
      {selecteerStand && !afgerond ? (
        <button
          type="button"
          onClick={onVink}
          className="block flex-1 text-left w-full"
          style={{ padding: "12px 40px 12px 14px" }}
          aria-pressed={aangevinkt}
        >
        <KaartInhoud lead={lead} st={st} />
        </button>
      ) : (
        <a
          href={lead.advertentie_url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="block flex-1"
          style={{
            padding: "12px 14px",
            cursor: lead.advertentie_url ? "pointer" : "default",
          }}
          title={lead.advertentie_url ? "Open de advertentie in een nieuw tabblad" : "Geen link bekend"}
        >
          <KaartInhoud lead={lead} st={st} />
        </a>
      )}

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
          {lead.status === "afgewezen" ? (
            <RijKnop
              titel="Toch een particulier? Zet hem terug in de lijst"
              kleur={T.amber}
              bezig={bezig === "terug"}
              onClick={(e) => {
                stop(e);
                onTerug();
              }}
            >
              <RefreshCw size={13} />
            </RijKnop>
          ) : afgerond ? (
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

/** De inhoud van een verkoperskaart. Gedeeld, omdat de kaart in de selecteerstand een
 *  knop is en daarbuiten een link — de binnenkant is in beide gevallen hetzelfde. */
function KaartInhoud({ lead, st }: { lead: Lead; st: { label: string; kleur: string } }) {
  return (
    <>
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1 mb-1.5">
        <span
          className="flex-1 min-w-0 truncate flex items-center gap-1.5"
          style={{ fontFamily: T.play, fontSize: 14, fontWeight: 700, color: T.navy }}
        >
          {lead.merk} {lead.model || korteTitel(lead)}
          {lead.advertentie_url && <ExternalLink size={11} color={T.ink(0.3)} />}
        </span>
        <Pill color={st.kleur}>{st.label}</Pill>
        <Pill color={lead.bron === "AutoScout24" ? T.teal : T.blauw}>{lead.bron}</Pill>
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
    </>
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

// ── Nakijken: de zijbalk waarin je per advertentie een tekst laat schrijven ───────
/**
 * Alles voor één advertentie op één plek: wat het voor auto is, de link erheen, en de
 * tekst die je erbij kunt laten schrijven.
 *
 * Bewust één doorlopende kolom in plaats van een stapel losse panelen. Je doet hier
 * steeds hetzelfde rondje — kijken, tekst laten maken, kopiëren, plakken, afvinken —
 * en dat rondje moet je in één oogopslag kunnen volgen.
 */
function NakijkPaneel({
  lead,
  schrijft,
  onSchrijf,
  herlaad,
  herlaadBlokkade,
  onFout,
  onVerwijderd,
}: {
  lead: Lead;
  /** Draait er op dit moment een schrijfopdracht? Komt uit de takenlaag, niet uit dit
   *  component: die loopt door als je naar een ander tabblad gaat. */
  schrijft: boolean;
  onSchrijf: () => void;
  herlaad: () => Promise<void>;
  herlaadBlokkade: () => Promise<void>;
  onFout: (s: string) => void;
  onVerwijderd: () => void;
}) {
  // Geen useEffect die deze velden terugzet uit de lead: dit component krijgt een
  // key={lead.id} van de lijst, dus bij het wisselen van verkoper wordt het opnieuw
  // opgebouwd. Zou je hier synchroniseren, dan overschrijft elke herlaadactie de tekst
  // die je net zelf hebt aangepast.
  const [bericht, setBericht] = useState(lead.bericht_kort || lead.bericht_mail);
  const [email, setEmail] = useState(lead.email);
  const [bezig, setBezig] = useState<"" | "versturen" | "lezen">("");
  const [gekopieerd, setGekopieerd] = useState(false);

  const alVerstuurd =
    lead.status === "verstuurd" || lead.status === "gereageerd" || lead.status === "cosignatie";

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

  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(bericht);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2000);
    } catch {
      onFout("Kopiëren naar klembord lukte niet");
    }
  };

  const markeerVerstuurd = async () => {
    if (bezig) return;
    setBezig("versturen");
    try {
      await patch({ bericht_kort: bericht, handmatig_verstuurd_via: "platform" });
    } finally {
      setBezig("");
    }
  };

  const verstuurMail = async () => {
    if (bezig) return;
    setBezig("versturen");
    onFout("");
    try {
      // Eerst opslaan, dan pas versturen — en niet versturen als het opslaan mislukt.
      // De server pakt de ontvanger uit de database, niet uit dit verzoek.
      if (!(await patch({ email, bericht_mail: bericht, onderwerp: lead.onderwerp || "Over je advertentie" })))
        return;
      const res = await fetch(`/api/admin/verkopers/${lead.id}/verstuur`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onderwerp: lead.onderwerp || "Over je advertentie", bericht }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        onFout(d.error || "Versturen mislukt");
        return;
      }
      await herlaad();
    } finally {
      setBezig("");
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
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      onFout(d.error || "Omzetten mislukt");
      return;
    }
    await herlaad();
  };

  const feiten = [
    lead.bouwjaar,
    lead.km ? `${Number(lead.km).toLocaleString("nl-NL")} km` : "",
    lead.brandstof,
    lead.plaats,
  ].filter(Boolean);

  return (
    <div style={{ backgroundColor: T.paper, border: `1px solid ${T.line2}` }}>
      {/* ── Om welke auto gaat het ── */}
      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${T.line}` }}>
        <div className="flex flex-wrap items-start gap-2 mb-1.5">
          <h3 className="flex-1 min-w-0" style={{ fontFamily: T.play, fontSize: 17, fontWeight: 700, color: T.navy }}>
            {`${lead.merk} ${lead.model}`.trim() || lead.titel}
          </h3>
          <Pill color={lead.bron === "AutoScout24" ? T.teal : T.blauw}>{lead.bron}</Pill>
          {alVerstuurd && <Pill color={T.groen} solid>Verstuurd</Pill>}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" style={body(12.5, T.ink(0.55))}>
          {lead.vraagprijs > 0 && (
            <span style={{ color: T.navy, fontWeight: 700, fontSize: 15 }}>
              € {lead.vraagprijs.toLocaleString("nl-NL")}
            </span>
          )}
          {feiten.length > 0 && <span>{feiten.join(" · ")}</span>}
          {lead.naam && <span>· {lead.naam}</span>}
        </div>

        {lead.advertentie_url && (
          <a
            href={lead.advertentie_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-2 px-3 py-2.5 transition-all hover:opacity-80"
            style={{ backgroundColor: "rgba(0,19,55,0.03)", border: `1px solid ${T.line}` }}
          >
            <ExternalLink size={13} color={T.blauw} style={{ flexShrink: 0 }} />
            <span className="min-w-0 truncate" style={{ ...body(11.5, T.blauw), textDecoration: "underline" }}>
              {lead.advertentie_url}
            </span>
          </a>
        )}

        {lead.telefoon && (
          <a href={`tel:${lead.telefoon}`} className="inline-flex mt-2">
            <Btn variant="ghost" size="sm">
              <Phone size={12} /> {lead.telefoon}
            </Btn>
          </a>
        )}

        {lead.notitie && (
          <div className="mt-3 px-3 py-2" style={{ backgroundColor: T.tintAmber, borderLeft: `3px solid ${T.amber}` }}>
            <p style={body(11.5, T.ink(0.7))}>{lead.notitie}</p>
          </div>
        )}
      </div>

      {/* ── De tekst ── */}
      <div className="px-5 py-4">
        {schrijft ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Spinner size={18} />
            <span style={body(12.5)}>De AI leest de advertentie en schrijft een tekst…</span>
            <span style={body(11.5, T.ink(0.4))}>Een seconde of twintig. Je kunt gerust doorklikken.</span>
          </div>
        ) : !bericht ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <MessageSquare size={26} color={T.ink(0.2)} />
            <p style={body(12.5, T.ink(0.55))} className="max-w-md">
              Nog geen tekst. De AI leest deze advertentie en schrijft een persoonlijk bericht over
              díe auto — met het aanbod dat wij hem waarschijnlijk sneller en voor een betere prijs
              kunnen verkopen.
            </p>
            <Btn onClick={onSchrijf} size="lg">
              <Sparkles size={13} /> Genereer tekst
            </Btn>
            <span style={body(11, T.ink(0.35))}>Kost ongeveer 2 cent</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p style={micro(T.ink(0.4))}>
                Bericht voor de berichtenbox van {lead.bron || "het platform"}
              </p>
              {!alVerstuurd && (
                <Btn variant="ghost" size="sm" onClick={onSchrijf}>
                  <RefreshCw size={11} /> Opnieuw
                </Btn>
              )}
            </div>

            <textarea
              value={bericht}
              onChange={(e) => setBericht(e.target.value)}
              rows={14}
              disabled={alVerstuurd}
              style={{ ...inputStijl, resize: "vertical", lineHeight: 1.7 }}
            />

            {!alVerstuurd && (
              <>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Btn onClick={kopieer} size="lg">
                    {gekopieerd ? <Check size={13} /> : <Copy size={13} />}
                    {gekopieerd ? "Gekopieerd" : "1 · Kopieer tekst"}
                  </Btn>
                  <a href={lead.advertentie_url || undefined} target="_blank" rel="noopener noreferrer">
                    <Btn variant="ghost" size="lg" disabled={!lead.advertentie_url}>
                      <ExternalLink size={13} /> 2 · Open advertentie
                    </Btn>
                  </a>
                  <Btn variant="ghost" size="lg" onClick={markeerVerstuurd} disabled={bezig !== ""}>
                    {bezig === "versturen" ? <Spinner size={12} /> : <Check size={13} />} 3 · Verstuurd
                  </Btn>
                </div>
                <p style={body(11.5, T.ink(0.45))}>
                  Kopieer de tekst, open de advertentie, plak hem in de berichtenbox en verstuur daar.
                  Klik daarna op <strong style={{ color: T.navy }}>Verstuurd</strong> — dan komt hij in
                  het verzendlog en krijgt deze verkoper nooit een tweede bericht.
                </p>

                {/* Mailen kan alleen als er een adres bekend is. Particulieren zetten dat
                    niet in hun advertentie, dus dit is de uitzondering. */}
                <details style={{ borderTop: `1px solid ${T.line}`, paddingTop: 10 }}>
                  <summary className="cursor-pointer select-none py-1" style={{ ...micro(T.ink(0.4)), listStyle: "revert" }}>
                    Mailen in plaats van de berichtenbox
                  </summary>
                  <div className="pt-2 flex flex-col gap-2">
                    <Field label="E-mailadres verkoper" hint="Alleen invullen als je het écht hebt.">
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="niet bekend"
                        style={inputStijl}
                      />
                    </Field>
                    <div>
                      <Btn variant="ghost" onClick={verstuurMail} disabled={!email || bezig !== ""}>
                        {bezig === "versturen" ? <Spinner size={12} /> : <Mail size={12} />} Verstuur mail
                      </Btn>
                    </div>
                  </div>
                </details>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Vervolg ── */}
      <div
        className="px-5 py-3 flex flex-wrap items-center gap-2"
        style={{ borderTop: `1px solid ${T.line}`, backgroundColor: "rgba(0,19,55,0.015)" }}
      >
        {alVerstuurd && lead.verstuurd_op && (
          <span style={body(11.5, T.ink(0.5))}>
            Verstuurd op {new Date(lead.verstuurd_op).toLocaleDateString("nl-NL")}
          </span>
        )}
        {lead.status === "verstuurd" && (
          <Btn variant="ghost" size="sm" onClick={() => patch({ status: "gereageerd" })}>
            <MessageSquare size={11} /> Reactie ontvangen
          </Btn>
        )}
        {alVerstuurd && lead.status !== "cosignatie" && (
          <Btn size="sm" onClick={naarCosignatie}>
            <Handshake size={11} /> Naar consignatie
          </Btn>
        )}
        <span className="ml-auto">
          <Btn variant="ghost" size="sm" onClick={geenInteresse}>
            <Trash2 size={11} /> Geen interesse
          </Btn>
        </span>
      </div>
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
  // Welke lijst je bekijkt: wat er nog te doen is, of wat er al gedaan is.
  const [blad, setBlad] = useState<"klaar" | "archief">("klaar");

  // Het schrijven draait in de takenlaag boven de tabbladen. Dat moet, om twee redenen:
  // het duurt tientallen seconden en dit tabblad wordt uit het geheugen gegooid zodra je
  // ergens anders klikt — en die laag heeft een grendel die voorkomt dat je bij
  // terugkomen per ongeluk een tweede keer op de knop drukt en dus dubbel betaalt.
  const { taak: schrijfTaak, start: startSchrijven } = useAiTaak<{ leadId: string }>(
    "verkopers-tekst"
  );
  const schrijftVoor = schrijfTaak?.bezig ? (schrijfTaak.resultaat?.leadId ?? null) : null;
  // Welke rij op dit moment wordt afgevinkt.
  const [vinkBezig, setVinkBezig] = useState<string | null>(null);
  // Meldingen die het afvinken niet tegenhouden maar wel het vermelden waard zijn.
  const [melding, setMelding] = useState("");
  // Meerdere tegelijk aanwijzen om er in één keer teksten voor te laten schrijven.
  const [kiesStand, setKiesStand] = useState(false);
  const [aangevinkt, setAangevinkt] = useState<Set<string>>(new Set());
  const wissel = (id: string) =>
    setAangevinkt((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const alle = useMemo(() => leads ?? [], [leads]);
  // De wachtrij: alles wat jij hebt afgevinkt en nog gemaild moet worden.
  const wachtrij = useMemo(() => alle.filter((l) => l.status === "goedgekeurd"), [alle]);
  // Het archief: alles wat de deur uit is. Blijft staan, zodat je kunt terugzien wie je
  // benaderd hebt en wie er heeft gereageerd.
  const archief = useMemo(
    () =>
      alle.filter(
        (l) => l.status === "verstuurd" || l.status === "gereageerd" || l.status === "cosignatie"
      ),
    [alle]
  );
  const lijst = blad === "klaar" ? wachtrij : archief;

  /**
   * Laat de AI teksten schrijven voor alles wat je hebt aangevinkt.
   *
   * Eén voor één, niet allemaal tegelijk: het gaat om tientallen seconden per bericht en
   * een handvol parallelle aanvragen loopt tegen de snelheidslimiet aan. Zo zie je hem
   * bovendien vorderen in plaats van minutenlang niets.
   *
   * Elk antwoord wordt echt gelezen. Dat klinkt vanzelfsprekend, maar in een eerdere
   * versie van deze lus werd de uitkomst weggegooid — een ontbrekende sleutel zag er
   * daardoor uit als veertig geslaagde berichten.
   */
  const schrijfReeks = (ids: string[]) => {
    if (schrijfTaak?.bezig || ids.length === 0) return;
    onFout("");
    const rijen = ids.map((id) => alle.find((l) => l.id === id)).filter(Boolean) as Lead[];

    startSchrijven(`${rijen.length} teksten schrijven`, async (stap) => {
      const mislukt: string[] = [];
      let klaar = 0;

      for (const lead of rijen) {
        const naam = `${lead.merk} ${lead.model}`.trim() || lead.titel.slice(0, 30);
        stap(`${klaar + 1} van ${rijen.length} · ${naam}`);
        try {
          if (!lead.bouwjaar) {
            const vr = await fetch(`/api/admin/verkopers/${lead.id}/verrijk`, { method: "POST" });
            const vd = await vr.json().catch(() => ({}));
            if (vd?.handelaar) { mislukt.push(`${naam}: handelaar, uit de lijst gehaald`); continue; }
          }
          const res = await fetch(`/api/admin/verkopers/${lead.id}/bericht`, { method: "POST" });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) { mislukt.push(`${naam}: ${d.error || "schrijven mislukt"}`); continue; }
          klaar++;
        } catch (e) {
          mislukt.push(`${naam}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      await herlaad().catch(() => null);
      setAangevinkt(new Set());
      // Deels gelukt is geen mislukking, maar je hoort wél te horen wat er is overgeslagen.
      if (mislukt.length) {
        onFout(
          `${klaar} van de ${rijen.length} teksten geschreven. Niet gelukt: ${mislukt.slice(0, 4).join(" · ")}${
            mislukt.length > 4 ? ` en nog ${mislukt.length - 4}` : ""
          }`
        );
      }
      return { leadId: "" };
    });
  };

  /**
   * Laat de AI een tekst schrijven voor één advertentie.
   *
   * Leest zo nodig eerst de advertentie uit — zonder bouwjaar en kilometerstand wordt
   * de tekst algemeen, en juist het concrete maakt hem persoonlijk.
   */
  const schrijfTekst = (lead: Lead) => {
    if (schrijfTaak?.bezig) return;
    onFout("");
    const naam = `${lead.merk} ${lead.model}`.trim() || lead.titel.slice(0, 30);

    startSchrijven(`Tekst voor ${naam}`, async (stap) => {
      if (!lead.bouwjaar) {
        stap("Advertentie lezen");
        const vr = await fetch(`/api/admin/verkopers/${lead.id}/verrijk`, { method: "POST" });
        const vd = await vr.json().catch(() => ({}));
        if (vd?.handelaar) {
          await herlaad().catch(() => null);
          throw new Error("Dit blijkt een handelaar te zijn — de verkoper is uit de lijst gehaald.");
        }
      }

      stap("Bericht schrijven");
      const res = await fetch(`/api/admin/verkopers/${lead.id}/bericht`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Tekst schrijven mislukt");

      await herlaad().catch(() => null);
      return { leadId: lead.id };
    });
  };

  /**
   * Afvinken: je hebt het bericht zelf verstuurd, dus hier alleen vastleggen.
   *
   * Dat vastleggen is niet alleen administratie — het verzendlog is waar de "nooit
   * twee keer"-controle op kijkt. Vink je hier niet af, dan kan dezelfde verkoper bij
   * een volgende ronde opnieuw in je wachtrij belanden.
   */
  const vinkAf = async (lead: Lead) => {
    if (vinkBezig) return;
    setVinkBezig(lead.id);
    onFout("");
    setMelding("");
    try {
      const res = await fetch(`/api/admin/verkopers/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handmatig_verstuurd_via: "platform" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        onFout(d.error || "Afvinken mislukt");
        return;
      }
      // Wél afgevinkt, maar er is iets om te weten. Niet in het rood: er ging niets mis.
      setMelding(d.waarschuwing ?? "");
      await herlaad();
    } catch (e) {
      onFout(e instanceof Error ? e.message : String(e));
    } finally {
      setVinkBezig(null);
    }
  };
  // Welke verkoper er openstaat. Wijs je er zelf één aan — met het vinkje, of met de
  // pijl bij een al verstuurde — dan is dat leidend. Alleen als er niets is
  // aangewezen valt hij terug op de eerste uit de wachtrij, zodat het scherm niet
  // leeg staat terwijl er werk ligt.
  const gekozen = useMemo(() => {
    const aangewezen = alle.find((l) => l.id === gekozenId) ?? null;
    return aangewezen ?? lijst[0] ?? null;
  }, [alle, gekozenId, lijst]);

  const metTekst = useMemo(
    () => wachtrij.filter((l) => l.bericht_kort || l.bericht_mail).length,
    [wachtrij]
  );
  // Waar nog geen tekst voor ligt — precies wat je in één keer wilt laten schrijven.
  const zonderTekst = useMemo(
    () => wachtrij.filter((l) => !l.bericht_kort && !l.bericht_mail),
    [wachtrij]
  );

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {melding && <Waarschuwing>{melding}</Waarschuwing>}
      {/* ── Werkbank: schrijven en versturen ── */}
      {leads === null ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size={22} />
        </div>
      ) : gekozen === null && wachtrij.length === 0 && archief.length === 0 ? (
        <Empty
          icon={<Users size={30} color={T.ink(0.2)} />}
          title="Niets klaargezet"
          body="Ga naar het tabblad Verkopers en vink daar aan wie je wilt mailen. Wat je afvinkt komt hier terecht."
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-5 items-start">
          {/* Links: de lijst. Rechts: alles over de aangeklikte advertentie. */}
          <div className="xl:col-span-2 flex flex-col gap-1.5">
            {/* Twee lijsten: wat er nog te doen is, en wat er al de deur uit is. */}
            <div className="flex gap-1.5 mb-1">
              <Chip active={blad === "klaar"} onClick={() => setBlad("klaar")}>
                Klaargezet {wachtrij.length > 0 && <span style={{ opacity: 0.6 }}>{wachtrij.length}</span>}
              </Chip>
              <Chip active={blad === "archief"} onClick={() => setBlad("archief")}>
                Archief {archief.length > 0 && <span style={{ opacity: 0.6 }}>{archief.length}</span>}
              </Chip>
              {blad === "klaar" && metTekst > 0 && (
                <span className="ml-auto self-center" style={{ ...micro(T.groen), fontSize: 9 }}>
                  {metTekst} met tekst
                </span>
              )}
              {blad === "klaar" && (
                <button
                  type="button"
                  onClick={() => { setKiesStand((v) => !v); setAangevinkt(new Set()); }}
                  className={`self-center px-2.5 py-1 transition-all hover:opacity-75${metTekst > 0 ? "" : " ml-auto"}`}
                  style={{
                    ...micro(kiesStand ? "#ffffff" : T.ink(0.5)),
                    fontSize: 9,
                    backgroundColor: kiesStand ? T.navy : "transparent",
                    border: `1px solid ${kiesStand ? T.navy : T.line2}`,
                  }}
                >
                  {kiesStand ? "Klaar met kiezen" : "Meerdere kiezen"}
                </button>
              )}
            </div>

            {/* Wat je hebt aangevinkt, en wat je ermee kunt. Blijft boven de lijst staan
                zodat je kunt doorscrollen en tussendoor advertenties kunt openen. */}
            {blad === "klaar" && kiesStand && (
              <div
                className="flex flex-wrap items-center gap-2 px-3 py-2.5 mb-1 sticky top-0 z-10"
                style={{ backgroundColor: T.navy }}
              >
                <span style={{ ...micro("rgba(255,255,255,0.55)"), fontSize: 9 }}>
                  {aangevinkt.size} gekozen
                </span>
                <button
                  type="button"
                  onClick={() => setAangevinkt(new Set(zonderTekst.map((l) => l.id)))}
                  className="px-2 py-1 transition-all hover:opacity-75"
                  style={{ ...micro("rgba(255,255,255,0.8)"), fontSize: 9, border: "1px solid rgba(255,255,255,0.25)" }}
                >
                  Alles zonder tekst ({zonderTekst.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAangevinkt(new Set())}
                  disabled={aangevinkt.size === 0}
                  className="px-2 py-1 transition-all hover:opacity-75 disabled:opacity-30"
                  style={{ ...micro("rgba(255,255,255,0.8)"), fontSize: 9, border: "1px solid rgba(255,255,255,0.25)" }}
                >
                  Wis
                </button>
                <div className="ml-auto">
                  <Btn
                    variant="wit"
                    size="sm"
                    disabled={aangevinkt.size === 0 || !!schrijfTaak?.bezig}
                    onClick={() => schrijfReeks([...aangevinkt])}
                  >
                    <Sparkles size={11} />
                    {schrijfTaak?.bezig ? "Bezig…" : `Schrijf ${aangevinkt.size || ""} tekst${aangevinkt.size === 1 ? "" : "en"}`}
                  </Btn>
                </div>
              </div>
            )}

            {lijst.map((l) => (
              <WachtrijKaart
                key={l.id}
                lead={l}
                actief={l.id === gekozen.id}
                afvinkbaar={blad === "klaar"}
                vinkt={vinkBezig === l.id}
                kiesStand={kiesStand && blad === "klaar"}
                aangevinkt={aangevinkt.has(l.id)}
                onKies={() => wissel(l.id)}
                onClick={() => setGekozenId(l.id)}
                onAfvinken={() => vinkAf(l)}
              />
            ))}

            {lijst.length === 0 && (
              <Empty
                compact
                title={blad === "klaar" ? "Wachtrij leeg" : "Archief leeg"}
                body={
                  blad === "klaar"
                    ? "Vink op het tabblad Verkopers de volgende aan."
                    : "Zodra je iemand afvinkt als verstuurd, komt hij hier te staan."
                }
              />
            )}
          </div>

          <div className="xl:col-span-3 xl:sticky" style={{ top: 112 }}>
            {gekozen === null ? (
              <Panel>
                <Empty compact title="Niets geselecteerd" body="Kies links een verkoper." />
              </Panel>
            ) : (
            <NakijkPaneel
              // De sleutel bevat of er al een tekst is. Komt die binnen terwijl je op
              // dit scherm staat, dan wordt het paneel opnieuw opgebouwd en pikt het
              // de nieuwe tekst op — zonder dat een herlaadactie je eigen aanpassingen
              // overschrijft zolang die sleutel niet verandert.
              key={`${gekozen.id}-${gekozen.bericht_kort || gekozen.bericht_mail ? "tekst" : "leeg"}`}
              lead={gekozen}
              schrijft={schrijftVoor === gekozen.id || (schrijfTaak?.bezig ?? false)}
              onSchrijf={() => schrijfTekst(gekozen)}
              herlaad={herlaad}
              herlaadBlokkade={herlaadBlokkade}
              onFout={onFout}
              onVerwijderd={() => setGekozenId(null)}
            />
            )}
          </div>
        </div>
      )}

    </div>
  );
}

/** Compacte rij in de wachtrij van Nakijken. */
function WachtrijKaart({
  lead,
  actief,
  afvinkbaar,
  vinkt,
  kiesStand,
  aangevinkt,
  onKies,
  onClick,
  onAfvinken,
}: {
  lead: Lead;
  actief: boolean;
  /** Alleen in de wachtrij; in het archief is er niets meer af te vinken. */
  afvinkbaar: boolean;
  vinkt: boolean;
  /** Staat de lijst in kiesstand? Dan opent klikken niet maar vinkt het aan. */
  kiesStand: boolean;
  aangevinkt: boolean;
  onKies: () => void;
  onClick: () => void;
  onAfvinken: () => void;
}) {
  const heeftTekst = !!(lead.bericht_kort || lead.bericht_mail);
  const feiten = [
    lead.bouwjaar,
    lead.km ? `${Math.round(Number(lead.km) / 1000)}dkm` : "",
    lead.plaats,
  ].filter(Boolean);
  const st = STATUS_LABEL[lead.status];

  return (
    <div
      className="relative flex items-stretch transition-all"
      style={{
        backgroundColor: actief ? T.navy : T.paper,
        border: `1px solid ${actief ? T.navy : T.line}`,
        // Streepje links: in de wachtrij of er al een tekst ligt, in het archief of er
        // al gereageerd is. Met twintig in de rij wil je dat zien zonder te lezen.
        borderLeft: `3px solid ${
          afvinkbaar ? (heeftTekst ? T.groen : T.amber) : st.kleur
        }`,
      }}
    >
      {/* In kiesstand een vakje voor de rij. Los van de rest, zodat aanvinken en openen
          elkaar niet in de weg zitten. */}
      {kiesStand && (
        <button
          type="button"
          onClick={onKies}
          aria-label={aangevinkt ? "Uitvinken" : "Aanvinken"}
          className="flex items-center justify-center flex-shrink-0 transition-all hover:opacity-70"
          style={{ width: 34, borderRight: `1px solid ${actief ? "rgba(255,255,255,0.2)" : T.line}` }}
        >
          <span
            className="flex items-center justify-center"
            style={{
              width: 15,
              height: 15,
              border: `1.5px solid ${aangevinkt ? T.navy : T.ink(0.28)}`,
              backgroundColor: aangevinkt ? T.navy : "transparent",
            }}
          >
            {aangevinkt && <Check size={10} color="#ffffff" />}
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={kiesStand ? onKies : onClick}
        className="flex-1 min-w-0 text-left hover:opacity-85 transition-all"
        style={{ padding: "10px 12px" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="flex-1 min-w-0 truncate"
            style={{
              fontFamily: T.play,
              fontSize: 13.5,
              fontWeight: 700,
              color: actief ? "#ffffff" : T.navy,
            }}
          >
            {`${lead.merk} ${lead.model}`.trim() || lead.titel}
          </span>
          {lead.vraagprijs > 0 && (
            <span style={{ ...num(12, actief ? "#ffffff" : T.navy), flexShrink: 0 }}>
              € {lead.vraagprijs.toLocaleString("nl-NL")}
            </span>
          )}
        </div>
        <div
          className="flex items-center gap-2 mt-0.5"
          style={body(11, actief ? "rgba(255,255,255,0.65)" : T.ink(0.45))}
        >
          <span className="flex-1 min-w-0 truncate">{feiten.join(" · ") || lead.bron}</span>
          <span
            style={{
              flexShrink: 0,
              color: afvinkbaar ? (heeftTekst ? T.groen : T.amber) : st.kleur,
              fontWeight: 600,
            }}
          >
            {afvinkbaar ? (heeftTekst ? "tekst klaar" : "geen tekst") : st.label.toLowerCase()}
          </span>
        </div>
      </button>

      {/* De advertentie openen zonder de rij te verlaten. In kiesstand loop je de lijst
          langs en wil je er tussendoor een paar bekijken voor je ze aanvinkt; dan is
          telkens naar het paneel rechts moeten juist wat je niet wilt. */}
      {lead.advertentie_url && (
        <a
          href={lead.advertentie_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Advertentie openen in een nieuw tabblad"
          aria-label="Advertentie openen"
          className="flex items-center justify-center transition-all hover:opacity-70"
          style={{
            width: 36,
            flexShrink: 0,
            borderLeft: `1px solid ${actief ? "rgba(255,255,255,0.2)" : T.line}`,
            color: actief ? "rgba(255,255,255,0.75)" : T.ink(0.4),
          }}
        >
          <ExternalLink size={13} />
        </a>
      )}

      {/* Afvinken zodra je het bericht zelf hebt verstuurd. Hier in de rij, zodat je er
          een reeks achter elkaar kunt wegwerken zonder telkens naar rechts te hoeven. */}
      {afvinkbaar && (
        <button
          type="button"
          onClick={onAfvinken}
          disabled={vinkt}
          title="Verstuurd — zet in het archief"
          aria-label="Markeer als verstuurd"
          className="flex items-center justify-center transition-all hover:opacity-70 disabled:opacity-40"
          style={{
            width: 40,
            flexShrink: 0,
            borderLeft: `1px solid ${actief ? "rgba(255,255,255,0.2)" : T.line}`,
            color: actief ? "#ffffff" : T.groen,
          }}
        >
          {vinkt ? <Spinner size={13} tone={actief ? "donker" : undefined} /> : <Check size={16} />}
        </button>
      )}
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

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ArrowLeftRight, Archive, Car, Check, ClipboardCopy, RotateCcw, Search, Tag, FolderPlus, Wallet,
} from "lucide-react";
import {
  T, num, micro, klein, fmt, fmtGetal, fmtKm,
  Panel, Field, inputStijl, Btn, Chip, Spinner, Foutmelding, Waarschuwing, PanelVoet,
} from "./inkoop/ui";
import { berekenKoerslijst } from "./inkoop/koerslijst";
import { berekenInruil, maxBod, bodBijBijbetaling, winstEigenAuto } from "./inruil/som";
import InruilArchiefTab from "./inruil/ArchiefTab";
import { maakVoorstel } from "./inruil/voorstel";
import { useAiTaak } from "./AiTaken";
import type { RdwData, TaxatieResultaat } from "./inkoop/types";
import type { InruilArchiefRij } from "./inruil/types";

/**
 * Inruil: de auto van de klant tegen de auto van ons.
 *
 * WAAROM DIT EEN EIGEN PAGINA IS
 * Een inruil is geen korting maar een tweede auto die je koopt. Aan de balie is het één
 * gesprek en één bedrag ("wat krijg ik ervoor?"), en daardoor is precies het ding dat
 * geld kost onzichtbaar: elke euro die je extra biedt om de deal rond te krijgen gaat
 * rechtstreeks van je marge af. De taxatietool rekent wel uit wat je maximaal kunt
 * bieden, maar zegt niets over de auto die ernaast staat; de marge-calculator rekent aan
 * één auto tegelijk. Hier staan ze naast elkaar en zie je allebei de kanten tegelijk:
 * wat de klant bijbetaalt, én wat je aan zijn auto overhoudt.
 *
 * HOE DE WAARDE TOT STAND KOMT
 * Precies zoals in de taxatietool, met dezelfde motor achter dezelfde knop — er is geen
 * tweede waarheid over wat een auto waard is. Zodra het kenteken en de kilometerstand
 * bekend zijn staat er meteen een voorlopig bedrag op basis van de RDW-nieuwprijs; de
 * marktscan (een seconde of dertig) vervangt dat door wat vergelijkbare auto's vandaag
 * doen. Wat er uit komt is een advies, geen bod: het veld eronder is van jou en blijft
 * altijd met de hand te vullen, ook als het opzoeken niets oplevert.
 */

type VoorraadAuto = {
  id: number;
  merk: string;
  model: string;
  bouwjaar: number;
  km: number;
  prijs: number;
  verkocht?: boolean;
  gereserveerd?: boolean;
  kenteken?: string;
};

/** Wat de marge-calculator van onze eigen auto's weet: wat hij kostte en wat erin ging. */
type MargeDossier = {
  auto_id: number | null;
  inkoop: number;
  btw_type: "marge" | "21";
  kosten: { label: string; bedrag: string }[];
};

/** Alleen de cijfers overhouden: "12.500" en "12 500" horen allebei 12500 te worden. */
const getalUit = (s: string) => parseInt(s.replace(/\D/g, "")) || 0;

/**
 * Een bedrag dat ook negatief kan zijn. Kaal opgemaakt wordt dat "€ -14.587": het minteken
 * komt dan achter het euroteken en is een streepje dat je makkelijk over het hoofd ziet —
 * precies bij het ene getal waar het teken het hele verhaal is.
 */
const fmtTeken = (n: number) => (n < 0 ? `− ${fmt(Math.abs(n))}` : fmt(n));

const MARGE_PRESETS = [8, 10, 12, 15, 20];
const KOSTEN_PRESETS = [
  { label: "Poetsen", bedrag: 250 },
  { label: "Klein onderhoud", bedrag: 500 },
  { label: "Banden / APK", bedrag: 1000 },
  { label: "Schadeherstel", bedrag: 1500 },
];

/** Eén regel in de som: omschrijving links, bedrag rechts. */
function SomRegel({
  label,
  bedrag,
  teken,
  sub,
  sterk = false,
}: {
  label: string;
  bedrag: number;
  /** "−" voor wat eraf gaat. Leeg voor wat erbij hoort. */
  teken?: string;
  sub?: string;
  sterk?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <div className="min-w-0">
        <p
          className="truncate"
          style={{
            fontFamily: T.inter,
            fontSize: 12.5,
            fontWeight: sterk ? 700 : 400,
            color: sterk ? "#ffffff" : "rgba(255,255,255,0.62)",
          }}
        >
          {label}
        </p>
        {sub && <p className="truncate" style={klein("rgba(255,255,255,0.38)")}>{sub}</p>}
      </div>
      <p className="flex-shrink-0" style={num(sterk ? 17 : 15, "#ffffff", sterk ? 700 : 600)}>
        {teken}
        {fmt(bedrag)}
      </p>
    </div>
  );
}

export default function InruilContent({
  autos,
  focus,
}: {
  /** De voorraad, al opgehaald door het dashboard — hier alleen om uit te kiezen. */
  autos: VoorraadAuto[];
  /** Vanuit een aanvraag doorgestuurd: kenteken van de klant en/of onze auto. */
  focus?: { kenteken?: string; autoId?: number } | null;
}) {
  /** Rekenen of terugkijken. */
  const [tab, setTab] = useState<"rekenen" | "archief">("rekenen");

  // ── De auto van de klant ──
  const [klant, setKlant] = useState("");
  const [kenteken, setKenteken] = useState("");
  const [rdw, setRdw] = useState<RdwData | null>(null);
  const [rdwLaden, setRdwLaden] = useState(false);
  const [rdwFout, setRdwFout] = useState<string | null>(null);
  const [km, setKm] = useState("");
  const [uitvoering, setUitvoering] = useState("");
  const [marge, setMarge] = useState(10);
  const [kosten, setKosten] = useState(0);
  const [posten, setPosten] = useState<{ id: number; label: string; bedrag: number }[]>([]);
  const [btwType, setBtwType] = useState<"marge" | "btw">("marge");

  /**
   * Wat wij zijn auto voor wegzetten. Dit is het getal waar al het andere aan hangt: het
   * bod dat je kunt doen, wat je eraan overhoudt, of de bijbetaling van de klant uit kan.
   *
   * Daarom is het een veld en geen uitkomst. De marktscan telt advertenties, maar jij
   * staat naast de auto: je ziet de schade, de uitvoering, de bandenmaat en de kleur die
   * niemand wil. Weet jij het beter, dan overschrijf je het en rekent de rest van de
   * pagina verder met jouw bedrag.
   */
  const [verkoopTekst, setVerkoopTekst] = useState("");
  const [verkoopEigen, setVerkoopEigen] = useState(false);

  // Wat we bieden. Volgt het advies tot je zelf een bedrag intikt — daarna is het veld
  // van jou en verandert er niets meer onder je handen.
  const [bodTekst, setBodTekst] = useState("");
  const [bodEigen, setBodEigen] = useState(false);

  // ── Onze auto ──
  const [autoId, setAutoId] = useState<number | null>(null);
  const [zoek, setZoek] = useState("");
  const [prijsTekst, setPrijsTekst] = useState("");
  const [prijsEigen, setPrijsEigen] = useState(false);
  const [kortingTekst, setKortingTekst] = useState("");

  // ── De onderhandeling ──
  /** Wat de klant zelf zegt maximaal te willen bijleggen. */
  const [maxBijTekst, setMaxBijTekst] = useState("");
  /**
   * De marge-dossiers, voor wat wíj voor onze eigen auto betaald hebben. Zonder dat getal
   * is alleen de helft van de deal te zien; mét dat getal staat er wat de hele ruil je
   * oplevert. Wordt het niet opgehaald of staat er geen inkoopprijs in, dan blijft dat
   * deel gewoon weg — een winst die op een aanname rust is erger dan geen winst tonen.
   */
  const [dossiers, setDossiers] = useState<MargeDossier[]>([]);

  // ── Afhandeling ──
  const [seconden, setSeconden] = useState(0);
  const [gekopieerd, setGekopieerd] = useState(false);
  const [bewaard, setBewaard] = useState(false);
  const [bewaarBezig, setBewaarBezig] = useState(false);

  // ── Het archief ──
  const [archief, setArchief] = useState<InruilArchiefRij[] | null>(null);
  /**
   * De regel in het archief waar deze berekening in staat.
   *
   * Eén inruil is één regel, ook als je er een half uur aan zit te schuiven. Zolang je aan
   * dezelfde auto rekent wordt die regel bijgewerkt; hij komt er niet telkens naast. Een
   * archief met dertien keer dezelfde Polo eronder is geen archief, dan is het een
   * logboek van je toetsaanslagen.
   *
   * Er begint een nieuwe regel zodra je een ander kenteken opzoekt of het scherm leegmaakt.
   */
  const [actieveId, setActieveId] = useState<string | null>(null);
  /** De handtekening van wat er al bewaard is — wijkt hij af, dan moet er iets weg. */
  const [bewaardAls, setBewaardAls] = useState<string | null>(null);
  const [archiefStatus, setArchiefStatus] = useState<"leeg" | "bezig" | "bewaard" | "fout">("leeg");
  const [bewaardOm, setBewaardOm] = useState<string | null>(null);

  // De marktscan draait in de takenlaag boven de tabbladen: klik je tussendoor weg, dan
  // loopt hij door en staat het antwoord er nog als je terugkomt.
  const { taak, start, wis } = useAiTaak<TaxatieResultaat>("inruil-taxatie");
  const laden = taak?.bezig ?? false;
  const resultaat = taak?.bezig ? null : (taak?.resultaat ?? null);
  const scanFout = taak?.bezig ? null : (taak?.fout ?? null);

  const kmNum = getalUit(km);
  const preview = useMemo(
    () => berekenKoerslijst(rdw?.bouwjaar, rdw?.catalogusprijs, kmNum),
    [rdw?.bouwjaar, rdw?.catalogusprijs, kmNum]
  );

  useEffect(() => {
    if (!laden) return;
    const t = setInterval(() => setSeconden((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [laden]);

  // Eén keer ophalen bij het openen. Mislukt het, dan blijft de lijst leeg en verdwijnt
  // alleen het stukje over onze eigen auto — de inruilsom zelf heeft het niet nodig.
  useEffect(() => {
    fetch("/api/admin/dossiers")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => Array.isArray(d) && setDossiers(d))
      .catch(() => {});
    fetch("/api/admin/inruil/archief")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setArchief(Array.isArray(d) ? d : []))
      .catch(() => setArchief([]));
  }, []);

  /**
   * Welk kenteken er als laatste is opgezocht, kaal geschreven.
   *
   * Nodig om "dezelfde auto nog eens opzoeken" te onderscheiden van "de volgende klant".
   * Bij het tweede hoort de naam uit het vorige gesprek weg: die zou anders stilzwijgend
   * bij de auto van iemand anders in het archief belanden, en dat is erger dan een leeg veld.
   */
  const laatstOpgezocht = useRef("");

  const rdwOpzoeken = useCallback(
    async (raw: string) => {
      const k = raw.trim();
      if (!k) return;
      const kaal = k.replace(/-/g, "").toUpperCase();
      if (laatstOpgezocht.current && laatstOpgezocht.current !== kaal) setKlant("");
      laatstOpgezocht.current = kaal;
      setRdwLaden(true);
      setRdwFout(null);
      setRdw(null);
      // De vorige taxatie hoort bij het vorige kenteken en moet dus weg.
      wis();
      setBodEigen(false);
      setBodTekst("");
      // Een verkoopprijs die je met de hand hebt gezet hoorde bij de vorige auto.
      setVerkoopEigen(false);
      setVerkoopTekst("");
      // Een ander kenteken is een andere klant: vanaf hier een nieuwe regel in het archief,
      // in plaats van die van de vorige auto overschrijven.
      setActieveId(null);
      setBewaardAls(null);
      setArchiefStatus("leeg");
      setBewaardOm(null);
      try {
        const res = await fetch(`/api/admin/rdw-lookup?kenteken=${encodeURIComponent(k)}`);
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.merk) setRdw(d);
        else setRdwFout(d.error ?? "Kenteken niet gevonden in het RDW-register");
      } catch {
        setRdwFout("RDW-opzoeking mislukt");
      }
      setRdwLaden(false);
    },
    [wis]
  );

  // Kom je hier vanuit een aanvraag, dan staan het kenteken en onze auto al klaar.
  // Wat al opgepakt is onthouden we hier, zodat het effect niet bij elke render opnieuw afgaat.
  const gedaanVoor = useRef<string | undefined>(undefined);
  useEffect(() => {
    const sleutel = `${focus?.kenteken ?? ""}|${focus?.autoId ?? ""}`;
    if (!focus || sleutel === "|" || gedaanVoor.current === sleutel) return;
    gedaanVoor.current = sleutel;
    if (focus.autoId != null) setAutoId(focus.autoId);
    if (focus.kenteken) {
      setKenteken(focus.kenteken);
      rdwOpzoeken(focus.kenteken);
    }
  }, [focus, rdwOpzoeken]);

  const b = resultaat?.berekening;
  const m = resultaat?.markt;

  /**
   * Wat de auto van de klant naar verwachting opbrengt. Na de scan is dat de geadviseerde
   * verkoopprijs; daarvoor de koerslijst uit de RDW-nieuwprijs. Heb jij hem overschreven,
   * dan wint jouw bedrag — jij hebt de auto gezien en de scan niet.
   */
  const getaxeerdeVerkoop = b?.verwachte_verkoop ?? preview?.koerslijst ?? 0;
  const verkoopwaarde = verkoopEigen ? getalUit(verkoopTekst) : getaxeerdeVerkoop;
  const voorlopig = !b && !verkoopEigen && verkoopwaarde > 0;

  // Het advies beweegt mee met de marge en de kosten, zonder opnieuw de markt op te gaan:
  // dezelfde som als op de server, met de verkoopwaarde die er al ligt.
  const advies = maxBod(verkoopwaarde, marge, kosten, btwType);
  const bod = bodEigen ? getalUit(bodTekst) : advies;

  const gekozen = autos.find((a) => a.id === autoId) ?? null;
  const vraagprijs = prijsEigen ? getalUit(prijsTekst) : (gekozen?.prijs ?? 0);
  const korting = getalUit(kortingTekst);

  const som = berekenInruil({
    vraagprijs,
    korting,
    inruilbod: bod,
    verwachteVerkoop: verkoopwaarde,
    kosten,
    btwType,
  });

  // Dezelfde som, maar dan met het advies als bod. Alleen zo is te zeggen wat een euro
  // extra bieden je écht kost: het verschil tussen deze twee. Naar het marge-percentage
  // kijken zou hier misleiden, want bij een btw-auto rekent dat over een andere prijs.
  const bijAdvies = berekenInruil({
    vraagprijs,
    korting,
    inruilbod: advies,
    verwachteVerkoop: verkoopwaarde,
    kosten,
    btwType,
  });

  // ── Onze eigen auto: wat hij ons gekost heeft ──────────────────
  const onsDossier = autoId != null ? dossiers.find((d) => d.auto_id === autoId) : undefined;
  const onzeKostprijs = onsDossier
    ? Number(onsDossier.inkoop || 0) +
      (onsDossier.kosten ?? []).reduce((s, k) => s + (parseFloat(k.bedrag) || 0), 0)
    : 0;
  /** Alleen als er echt een inkoopprijs bekend is. Anders blijft dit deel van het scherm leeg. */
  const onzeWinst =
    onzeKostprijs > 0 && som.onzePrijs > 0
      ? winstEigenAuto({
          verkoopprijs: som.onzePrijs,
          kostprijs: onzeKostprijs,
          btwType: onsDossier?.btw_type === "21" ? "btw" : "marge",
        })
      : null;

  // ── Wat de klant maximaal wil bijbetalen ───────────────────────
  //
  // Zegt hij "ik leg er hooguit twaalfduizend bij", dan ligt daarmee vast wat je zijn auto
  // voor moet overnemen: onze prijs min dat bedrag. De vraag is niet meer wat zijn auto
  // waard is, maar of dat bedrag nog uit kan.
  const maxBij = getalUit(maxBijTekst);
  const benodigdBod = bodBijBijbetaling(som.onzePrijs, maxBij);
  const bijMax = berekenInruil({
    vraagprijs,
    korting,
    inruilbod: benodigdBod,
    verwachteVerkoop: verkoopwaarde,
    kosten,
    btwType,
  });
  /**
   * Wat de hele ruil je oplevert: onze auto én zijn auto bij elkaar.
   *
   * Onze eigen marge verandert niet mee met wat de klant bijbetaalt — die zit in ónze
   * prijs, en die staat vast zolang je de korting niet aanpast. Dat is precies waarom het
   * totaal hier klopt: alles wat de klant minder bijbetaalt komt uit de inruilwaarde, en
   * die zit in de andere helft van deze som.
   */
  const totaalNu = som.nettoMarge + (onzeWinst?.nettoMarge ?? 0);
  const totaalBijMax = bijMax.nettoMarge + (onzeWinst?.nettoMarge ?? 0);

  /**
   * Kan de bijbetaling die hij noemt uit?
   *
   * "Past" is niet hetzelfde als "levert geld op": het betekent dat je binnen de marge
   * blijft die je zelf wilde houden. Daaronder ligt nog een heel gebied waarin de deal
   * best kan, maar je marge inlevert — en dat is iets anders dan verlies. Die drie horen
   * uit elkaar gehouden te worden, anders staat er rood bij een deal die prima is.
   */
  const bijbetalingOordeel =
    som.onzePrijs > 0 && maxBij > 0 && verkoopwaarde > 0
      ? advies > 0 && benodigdBod <= advies
        ? { stand: "past" as const, kleur: T.groen }
        : bijMax.nettoMarge > 0 || (onzeWinst !== null && totaalBijMax > 0)
          ? { stand: "krap" as const, kleur: T.amber }
          : { stand: "kanNiet" as const, kleur: T.rood }
      : null;

  const beschikbaar = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    return autos
      .filter((a) => !a.verkocht)
      .filter((a) =>
        !z ? true : `${a.merk} ${a.model} ${a.bouwjaar} ${a.kenteken ?? ""}`.toLowerCase().includes(z)
      )
      .sort((x, y) => y.prijs - x.prijs);
  }, [autos, zoek]);

  const klaarVoorScan = !!rdw && kmNum > 0;
  // Er valt pas iets te rekenen als allebei de kanten een bedrag hebben.
  const somRond = vraagprijs > 0 && bod > 0;

  const scan = () => {
    if (!rdw || laden) return;
    setSeconden(0);
    // Alles nu vastleggen: de opdracht draait straks buiten dit scherm door.
    const auto = rdw;
    const gegevens = { km: kmNum, marge, kosten, btwType, uitvoering };

    start(`Inruilwaarde ${auto.merk} ${auto.model}`, async () => {
      const res = await fetch("/api/admin/inkoop/taxeer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merk: auto.merk,
          model: auto.model,
          bouwjaar: auto.bouwjaar,
          // Als cijfers doorgeven: de server doet parseInt, en die maakt van "125.000"
          // anders 125 — wat de hele waardebepaling zou vertekenen.
          km: String(gegevens.km),
          brandstof: auto.brandstof,
          vermogen: auto.vermogen,
          bodytype: auto.bodytype,
          catalogusprijs: auto.catalogusprijs,
          gewenste_marge: gegevens.marge,
          geschatte_kosten: gegevens.kosten,
          btw_type: gegevens.btwType,
          uitvoering: gegevens.uitvoering,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "De marktscan is mislukt");
      }
      return (await res.json()) as TaxatieResultaat;
    });
  };

  const kiesAuto = (a: VoorraadAuto) => {
    setAutoId(a.id);
    // Terug naar de vraagprijs van deze auto; een bedrag dat je bij de vórige auto had
    // ingetikt hoort niet bij deze te blijven staan.
    setPrijsEigen(false);
    setPrijsTekst("");
  };

  const voegKostenToe = (label: string, bedrag: number) => {
    setPosten((p) => [...p, { id: Date.now() + Math.random(), label, bedrag }]);
    setKosten((k) => k + bedrag);
  };

  const verwijderPost = (id: number, bedrag: number) => {
    setPosten((p) => p.filter((x) => x.id !== id));
    setKosten((k) => Math.max(0, k - bedrag));
  };

  const klantAuto = rdw ? `${rdw.merk} ${rdw.model}${rdw.bouwjaar ? ` (${rdw.bouwjaar})` : ""}` : "";
  const onzeAuto = gekozen ? `${gekozen.merk} ${gekozen.model} (${gekozen.bouwjaar})` : "Onze auto";

  /** Het voorstel voor de klant. Dezelfde tekst als op de detailpagina in het archief. */
  const voorstel = maakVoorstel({
    onzeAuto,
    vraagprijs,
    korting,
    klantAuto,
    km: kmNum,
    bod,
    richting: som.richting,
    bedrag: som.bedrag,
  });

  /** Waar de verkoopwaarde vandaan kwam. Gaat mee het archief in, want over een maand is
   *  dat het verschil tussen een gemeten bedrag en een onderbuikgevoel. */
  const bronTekst = verkoopEigen
    ? "eigen inschatting"
    : (b?.bron ?? (voorlopig ? "koerslijst (RDW-nieuwprijs)" : ""));

  /** Wat deze berekening uniek maakt. Verandert er één bedrag, dan moet het archief bij. */
  const handtekening = [kenteken, kmNum, verkoopwaarde, bod, autoId ?? "", vraagprijs, korting, maxBij, klant].join("|");
  const alBewaard = bewaardAls === handtekening;

  const bewaarInArchief = async () => {
    if (alBewaard || !somRond) return;
    const nu = handtekening;
    setArchiefStatus("bezig");
    const gegevensVoorArchief = {
      klant,
      kenteken,
      merk: rdw?.merk ?? "",
      model: rdw?.model ?? "",
      bouwjaar: rdw?.bouwjaar ?? 0,
      km: kmNum,
      auto_id: gekozen?.id ?? null,
      auto_naam: gekozen ? onzeAuto : "",
      vraagprijs,
      korting,
      verkoopwaarde,
      bod,
      verschil: som.verschil,
      netto_marge: som.nettoMarge,
      marge,
      kosten,
      btw_type: btwType,
      max_bijbetaling: maxBij,
      bron: bronTekst,
      // Genoeg om het later precies zo terug te zetten als het nu op het scherm staat.
      gegevens: { rdw, taxatie: resultaat, uitvoering, posten },
    };

    try {
      let rij: InruilArchiefRij | null = null;

      // Bestaat de regel al, dan wordt hij bijgewerkt. Is hij intussen weggegooid (404),
      // dan maken we er alsnog een nieuwe van in plaats van de wijziging te laten verdampen.
      if (actieveId) {
        const res = await fetch(`/api/admin/inruil/archief/${actieveId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gegevensVoorArchief),
        });
        if (res.ok) rij = await res.json();
        else if (res.status !== 404) {
          setArchiefStatus("fout");
          return;
        }
      }

      if (!rij) {
        const res = await fetch("/api/admin/inruil/archief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gegevensVoorArchief),
        });
        if (!res.ok) {
          setArchiefStatus("fout");
          return;
        }
        rij = await res.json();
      }

      const bewaarde = rij as InruilArchiefRij;
      setActieveId(bewaarde.id);
      setArchief((p) => [bewaarde, ...(p ?? []).filter((x) => x.id !== bewaarde.id)]);
      setBewaardAls(nu);
      setBewaardOm(new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }));
      setArchiefStatus("bewaard");
    } catch {
      /* Niet bewaard is vervelend, maar mag de berekening op het scherm niet stukmaken. */
      setArchiefStatus("fout");
    }
  };

  /**
   * Vanzelf bewaren.
   *
   * Na een korte pauze, niet bij elke toetsaanslag: anders staat "1" onderweg naar
   * "12.500" even als bod in het archief, en gaat er een verzoek uit voor elk cijfer dat
   * je intikt. Pas als de som rond is (allebei de bedragen ingevuld) valt er iets te
   * bewaren dat ergens op slaat.
   */
  const moetBewaren = somRond && !alBewaard;
  const bewaarRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    bewaarRef.current = bewaarInArchief;
  });
  useEffect(() => {
    if (!moetBewaren) return;
    const t = setTimeout(() => void bewaarRef.current(), 1800);
    return () => clearTimeout(t);
  }, [moetBewaren, handtekening]);

  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(voorstel);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2500);
      // Het voorstel gaat de deur uit — dan is dit het moment dat je later wilt terugvinden.
      void bewaarInArchief();
    } catch {
      /* Zonder klembordrechten valt er niets te kopiëren; de tekst staat op het scherm. */
    }
  };

  /** De ingeruilde auto is een auto die je koopt — dus hoort hij als dossier in de inkoop. */
  const bewaarAlsDossier = async () => {
    if (!rdw || bewaarBezig) return;
    setBewaarBezig(true);
    try {
      await fetch("/api/admin/inkoop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kenteken,
          merk: rdw.merk,
          model: rdw.model,
          bouwjaar: String(rdw.bouwjaar ?? ""),
          km: String(kmNum),
          kleur: rdw.kleur,
          brandstof: rdw.brandstof,
          aanbod_prijs: verkoopwaarde,
          bod_prijs: bod,
          naam: klant,
          status: "nieuw",
          notitie:
            `Inruil tegen ${onzeAuto} (${fmt(vraagprijs)}${korting > 0 ? `, korting ${fmt(korting)}` : ""}). ` +
            `${som.richting === "uit" ? `Wij betalen uit ${fmt(som.bedrag)}` : som.richting === "gelijk" ? "Gelijke ruil" : `Klant betaalt bij ${fmt(som.bedrag)}`}. ` +
            `Inruilwaarde ${fmt(bod)} bij een verwachte verkoop van ${fmt(verkoopwaarde)}` +
            `${kosten > 0 ? ` en ${fmt(kosten)} klaarmaakkosten` : ""}.`,
        }),
      });
      setBewaard(true);
      setTimeout(() => setBewaard(false), 4000);
      // Een auto die je in de inkoop zet, wil je later ook in het inruilarchief terugvinden.
      void bewaarInArchief();
    } catch {
      /* Mislukt het opslaan, dan blijft het scherm gewoon staan met alle bedragen erin. */
    } finally {
      setBewaarBezig(false);
    }
  };

  /**
   * Een bewaarde inruil terugzetten alsof je hem net had ingetikt.
   *
   * Alle bedragen worden als "eigen" gezet — de verkoopwaarde, het bod en de vraagprijs.
   * Dat is met opzet: terugkijken hoort te laten zien wat je toen hebt voorgerekend, niet
   * wat diezelfde auto vandaag zou doen. Wil je opnieuw taxeren, dan is dat één druk op
   * de knop, en pas dán verandert het.
   */
  const openUitArchief = (r: InruilArchiefRij) => {
    wis();
    const g = r.gegevens ?? {};
    setKlant(r.klant ?? "");
    setKenteken(r.kenteken ?? "");
    setRdw(g.rdw ?? null);
    setRdwFout(null);
    setKm(r.km ? String(r.km) : "");
    setUitvoering(g.uitvoering ?? "");
    setMarge(r.marge || 10);
    setKosten(r.kosten || 0);
    setPosten(g.posten ?? []);
    setBtwType(r.btw_type === "btw" ? "btw" : "marge");
    setVerkoopEigen(true);
    setVerkoopTekst(r.verkoopwaarde ? String(r.verkoopwaarde) : "");
    setBodEigen(true);
    setBodTekst(r.bod ? String(r.bod) : "");
    setAutoId(r.auto_id);
    setPrijsEigen(true);
    setPrijsTekst(r.vraagprijs ? String(r.vraagprijs) : "");
    setKortingTekst(r.korting ? String(r.korting) : "");
    setMaxBijTekst(r.max_bijbetaling ? String(r.max_bijbetaling) : "");
    // Vanaf nu schrijft het scherm in déze regel. Zonder dat zou wat je hier verandert er
    // als tweede regel naast komen, en had je dezelfde inruil twee keer in je archief.
    setActieveId(r.id);
    setBewaardAls(
      [r.kenteken, r.km, r.verkoopwaarde, r.bod, r.auto_id ?? "", r.vraagprijs, r.korting, r.max_bijbetaling, r.klant].join("|")
    );
    setArchiefStatus("bewaard");
    setBewaardOm(null);
    setTab("rekenen");
  };

  const opnieuw = () => {
    wis();
    setKlant("");
    laatstOpgezocht.current = "";
    // Het volgende gesprek is een nieuwe regel; wat er stond blijft in het archief staan.
    setActieveId(null);
    setBewaardAls(null);
    setArchiefStatus("leeg");
    setBewaardOm(null);
    setKenteken("");
    setRdw(null);
    setRdwFout(null);
    setKm("");
    setUitvoering("");
    setKosten(0);
    setPosten([]);
    setVerkoopTekst("");
    setVerkoopEigen(false);
    setBodTekst("");
    setBodEigen(false);
    setMaxBijTekst("");
    setAutoId(null);
    setPrijsTekst("");
    setPrijsEigen(false);
    setKortingTekst("");
    setZoek("");
  };

  // De uitkomst in woorden. Staat zowel bovenin de balk als groot in de som, en hoort op
  // allebei de plekken hetzelfde te heten.
  const uitkomstLabel =
    som.richting === "uit" ? "Wij betalen uit" : som.richting === "gelijk" ? "Gelijke ruil" : "Klant betaalt bij";
  const uitkomstKleur = som.richting === "uit" ? T.amber : T.groen;

  return (
    <div style={{ backgroundColor: T.wash, minHeight: "100%" }}>
      {/* ── Kop: de uitkomst blijft in beeld, ook als je naar beneden scrolt ── */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 xl:px-8"
        style={{ height: 56, backgroundColor: T.paper, borderBottom: `1px solid ${T.line2}` }}
      >
        <ArrowLeftRight size={15} style={{ color: T.ink(0.35), flexShrink: 0 }} />
        <h2
          className="min-w-0 truncate text-[17px] sm:text-[19px]"
          style={{ fontFamily: T.play, fontWeight: 700, color: T.navy }}
        >
          Inruil
        </h2>
        <span className="hidden md:block flex-shrink-0" style={{ width: 1, height: 16, backgroundColor: T.line2 }} />
        <p className="hidden md:block min-w-0 truncate" style={micro(T.ink(0.35))}>
          Zijn auto tegen onze auto
        </p>

        <div className="ml-auto flex flex-col items-end justify-center flex-shrink-0">
          <span style={{ ...micro(T.ink(0.32)), fontSize: 8.5 }}>{somRond ? uitkomstLabel : "Uitkomst"}</span>
          <span style={num(17, somRond ? uitkomstKleur : T.ink(0.25))}>
            {somRond ? fmt(som.bedrag) : "—"}
          </span>
        </div>
      </header>

      {/* ── Rekenen of terugkijken ── */}
      <nav
        className="sticky z-30 flex items-center px-2 md:px-4 xl:px-6 overflow-x-auto"
        style={{ top: 56, height: 46, backgroundColor: T.paper, borderBottom: `1px solid ${T.line2}` }}
      >
        {(
          [
            { id: "rekenen" as const, label: "Rekenmachine", Icon: ArrowLeftRight, teller: undefined },
            { id: "archief" as const, label: "Archief", Icon: Archive, teller: archief?.length },
          ]
        ).map(({ id, label, Icon, teller }) => {
          const actief = tab === id;
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

      <div className="px-4 md:px-6 xl:px-8 py-4 md:py-6" style={{ maxWidth: 1500, margin: "0 auto" }}>
        {tab === "archief" ? (
          <InruilArchiefTab
            rijen={archief}
            onOpen={openUitArchief}
            onBijgewerkt={(rij) =>
              setArchief((p) => (p ?? []).map((x) => (x.id === rij.id ? rij : x)))
            }
            onVerwijderd={(id) => {
              setArchief((p) => (p ? p.filter((x) => x.id !== id) : p));
              // Stond de rekenmachine in deze regel te schrijven, dan is die weg: vanaf nu
              // een nieuwe, anders zou het volgende bedrag naar een verwijderde regel gaan.
              if (actieveId === id) {
                setActieveId(null);
                setBewaardAls(null);
                setArchiefStatus("leeg");
              }
            }}
            onNieuw={() => setTab("rekenen")}
          />
        ) : (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ══ 1 · De auto van de klant ══════════════════════════ */}
          <Panel
            title="1 · De auto van de klant"
            icon={<Car size={13} style={{ color: T.ink(0.35) }} />}
            meta={rdw ? "Gevonden" : undefined}
          >
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
            <p className="mt-2" style={klein(rdwFout ? T.rood : T.ink(0.4))}>
              {rdwFout
                ? rdwFout
                : rdwLaden
                  ? "RDW-register raadplegen…"
                  : rdw
                    ? [rdw.bouwjaar, rdw.brandstof, rdw.bodytype, rdw.kleur].filter(Boolean).join(" · ")
                    : "Kenteken invullen — merk, bouwjaar en nieuwprijs komen uit het RDW"}
            </p>

            {rdw && (
              <p className="mt-1" style={{ fontFamily: T.play, fontSize: 17, fontWeight: 700, color: T.navy }}>
                {rdw.merk} {rdw.model}
              </p>
            )}

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Kilometerstand"
                suffix="km"
                hint={
                  preview && kmNum > 0
                    ? `≈ ${fmtGetal(preview.kmPerJaar)} km per jaar — ${
                        preview.kmAfwijkingPct <= -15
                          ? "onder gemiddeld"
                          : preview.kmAfwijkingPct <= 5
                            ? "rond gemiddeld"
                            : preview.kmAfwijkingPct <= 25
                              ? "bovengemiddeld"
                              : "fors bovengemiddeld"
                      }`
                    : "Staat niet in het RDW — van de teller aflezen"
                }
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                  placeholder="145.000"
                  style={{ ...inputStijl, paddingRight: 34 }}
                />
              </Field>

              <Field label="Uitvoering" hint="Optioneel — scheelt zomaar duizenden euro's">
                <input
                  type="text"
                  value={uitvoering}
                  onChange={(e) => setUitvoering(e.target.value)}
                  placeholder="Highline, R-Line…"
                  style={inputStijl}
                />
              </Field>
            </div>

            <div className="mt-3">
              <Field
                label="Klant"
                hint="Optioneel — maar hiermee vind je deze inruil later in het archief terug"
              >
                <input
                  type="text"
                  value={klant}
                  onChange={(e) => setKlant(e.target.value)}
                  placeholder="Naam of telefoonnummer"
                  style={inputStijl}
                />
              </Field>
            </div>

            {/* Wie verkoopt er? Een particulier kan geen btw-factuur geven, dus dat is
                altijd een marge-auto. Bij een bedrijf gaat de btw er eerst af, en dat
                scheelt tot zeventien procent in wat je kunt bieden. */}
            <div className="mt-4">
              <p className="mb-1.5" style={micro()}>
                Van wie ruil je in
              </p>
              <div className="flex items-center gap-1.5">
                <Chip active={btwType === "marge"} onClick={() => setBtwType("marge")}>
                  Particulier
                </Chip>
                <Chip active={btwType === "btw"} onClick={() => setBtwType("btw")}>
                  Bedrijf (met btw)
                </Chip>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-1.5" style={micro()}>
                Wat wil je eraan verdienen
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {MARGE_PRESETS.map((p) => (
                  <Chip key={p} active={marge === p} onClick={() => setMarge(p)}>
                    {p}%
                  </Chip>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-1.5" style={micro()}>
                Klaarmaakkosten {kosten > 0 && <span style={{ color: T.navy }}>· {fmt(kosten)}</span>}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {KOSTEN_PRESETS.map((k) => (
                  <Chip key={k.label} onClick={() => voegKostenToe(k.label, k.bedrag)}>
                    + {k.label}
                  </Chip>
                ))}
              </div>
              {posten.length > 0 && (
                <div className="mt-2 flex flex-col">
                  {posten.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => verwijderPost(p.id, p.bedrag)}
                      className="flex items-baseline justify-between gap-3 py-1.5 transition-all hover:opacity-60"
                      style={{ borderTop: `1px solid ${T.line}` }}
                      title="Klik om te verwijderen"
                    >
                      <span style={{ fontFamily: T.inter, fontSize: 11.5, color: T.ink(0.55) }}>{p.label}</span>
                      <span style={{ fontFamily: T.inter, fontSize: 11.5, fontWeight: 600, color: T.navy }}>
                        {fmt(p.bedrag)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              <Btn full onClick={scan} disabled={!klaarVoorScan || laden}>
                {laden ? (
                  <>
                    <Spinner size={13} tone="donker" /> Markt scannen… {seconden}s
                  </>
                ) : (
                  <>
                    <Search size={13} /> {b ? "Opnieuw scannen" : "Zoek de marktwaarde op"}
                  </>
                )}
              </Btn>
              {!klaarVoorScan && (
                <p className="mt-2" style={klein()}>
                  Vul eerst het kenteken en de kilometerstand in. Je kunt de inruilwaarde hieronder ook
                  gewoon zelf intikken.
                </p>
              )}
            </div>

            {scanFout && (
              <div className="mt-3">
                <Foutmelding>{scanFout} — vul de inruilwaarde hieronder met de hand in.</Foutmelding>
              </div>
            )}

            {/* ── Wat wij ervoor terugkrijgen ── */}
            <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${T.line2}` }}>
              <Field
                label="Wat verkopen wij hem voor"
                suffix="€"
                hint={
                  verkoopEigen
                    ? "Jouw bedrag — hier rekent de hele pagina mee"
                    : b
                      ? `${b.bron}${
                          b.spreiding
                            ? `. Vergelijkbare auto's wijken onderling ${fmt(b.spreiding)} af, dus zo scherp is dit getal ook`
                            : ""
                        }${
                          b.ijking?.eigen
                            ? `. Omgerekend met jouw eigen verkopen (${(b.ijking.factor * 100).toFixed(1).replace(".", ",")}% van de vraagprijs)`
                            : ""
                        }`
                      : voorlopig
                        ? "Voorlopig, uit de RDW-nieuwprijs met afschrijving. De marktscan maakt het scherper — of tik zelf in wat jij ervoor krijgt"
                        : "Nog niets bekend — scan de markt of vul zelf in wat jij ervoor krijgt"
                }
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={verkoopEigen ? verkoopTekst : verkoopwaarde > 0 ? String(verkoopwaarde) : ""}
                  onChange={(e) => {
                    setVerkoopEigen(true);
                    setVerkoopTekst(e.target.value);
                  }}
                  placeholder="0"
                  style={{
                    ...inputStijl,
                    height: 46,
                    paddingRight: 34,
                    fontFamily: T.play,
                    fontSize: 20,
                    fontWeight: 700,
                    color: T.navy,
                  }}
                />
              </Field>
              {verkoopEigen && getaxeerdeVerkoop > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setVerkoopEigen(false);
                    setVerkoopTekst("");
                  }}
                  className="mt-1.5 inline-flex items-center gap-1.5 transition-all hover:opacity-60"
                  style={klein(T.ink(0.5))}
                >
                  <RotateCcw size={10} /> Terug naar de taxatie van {fmt(getaxeerdeVerkoop)}
                </button>
              )}
              {m && m.aantal_gevonden ? (
                <p className="mt-2" style={klein()}>
                  Gevonden aanbod liep van {fmt(m.min_prijs)} tot {fmt(m.max_prijs)}
                  {b?.per_duizend_km ? ` — elke 1.000 km scheelt daarin ongeveer € ${Math.abs(b.per_duizend_km)}` : ""}.
                </p>
              ) : null}
            </div>

            {/* ── Het bod ── */}
            <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${T.line2}` }}>
              <Field
                label="Wat bieden we voor deze auto"
                suffix="€"
                hint={
                  advies > 0
                    ? `Advies: maximaal ${fmt(advies)} — dan houd je ${marge}% over op de verkoopprijs hierboven${
                        kosten > 0 ? `, met ${fmt(kosten)} klaarmaakkosten er al af` : ""
                      }`
                    : "Nog geen advies — vul hierboven een verkoopprijs in, of tik hier zelf een bedrag"
                }
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={bodEigen ? bodTekst : advies > 0 ? String(advies) : ""}
                  onChange={(e) => {
                    setBodEigen(true);
                    setBodTekst(e.target.value);
                  }}
                  placeholder="0"
                  style={{
                    ...inputStijl,
                    height: 46,
                    paddingRight: 34,
                    fontFamily: T.play,
                    fontSize: 20,
                    fontWeight: 700,
                    color: T.navy,
                  }}
                />
              </Field>
              {bodEigen && advies > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setBodEigen(false);
                    setBodTekst("");
                  }}
                  className="mt-1.5 inline-flex items-center gap-1.5 transition-all hover:opacity-60"
                  style={klein(T.ink(0.5))}
                >
                  <RotateCcw size={10} /> Terug naar het advies van {fmt(advies)}
                </button>
              )}

              {bod > advies && advies > 0 && (
                <div className="mt-3">
                  <Waarschuwing>
                    Je biedt {fmt(bod - advies)} meer dan deze auto ruimte geeft. Dat komt niet uit de
                    lucht: het gaat rechtstreeks van je marge af.{" "}
                    {som.nettoMarge < 0
                      ? `Je legt er ${fmt(-som.nettoMarge)} op toe, in plaats van er ${fmt(bijAdvies.nettoMarge)} aan over te houden.`
                      : `Je houdt er ${fmt(som.nettoMarge)} aan over in plaats van ${fmt(bijAdvies.nettoMarge)}.`}
                  </Waarschuwing>
                </div>
              )}
            </div>
          </Panel>

          {/* ══ 2 · Onze auto ═════════════════════════════════════ */}
          <Panel
            title="2 · Onze auto"
            icon={<Tag size={13} style={{ color: T.ink(0.35) }} />}
            meta={gekozen ? undefined : `${beschikbaar.length} in voorraad`}
          >
            {autos.length > 6 && (
              <div className="mb-3">
                <input
                  type="text"
                  value={zoek}
                  onChange={(e) => setZoek(e.target.value)}
                  placeholder="Zoek in de voorraad…"
                  style={inputStijl}
                />
              </div>
            )}

            <div
              className="flex flex-col"
              style={{ maxHeight: 260, overflowY: "auto", border: `1px solid ${T.line}` }}
            >
              {beschikbaar.length === 0 && (
                <p className="px-3 py-4" style={klein()}>
                  {autos.length === 0
                    ? "De voorraad is nog niet geladen."
                    : "Geen auto's gevonden — vul hieronder zelf een vraagprijs in."}
                </p>
              )}
              {beschikbaar.map((a, i) => {
                const actief = a.id === autoId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => kiesAuto(a)}
                    className="flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:opacity-75"
                    style={{
                      borderTop: i > 0 ? `1px solid ${T.line}` : undefined,
                      backgroundColor: actief ? "rgba(0,19,55,0.05)" : "#ffffff",
                      borderLeft: `3px solid ${actief ? T.navy : "transparent"}`,
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate"
                        style={{ fontFamily: T.inter, fontSize: 12.5, fontWeight: actief ? 700 : 600, color: T.navy }}
                      >
                        {a.merk} {a.model}
                      </span>
                      <span className="block truncate" style={klein()}>
                        {[a.bouwjaar, a.km ? fmtKm(a.km) : "", a.gereserveerd ? "gereserveerd" : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="flex-shrink-0" style={num(14)}>
                      {fmt(a.prijs)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Vraagprijs"
                suffix="€"
                hint={
                  gekozen && !prijsEigen
                    ? "Overgenomen uit de voorraad — aanpassen mag"
                    : "Staat de auto er nog niet bij? Tik het bedrag hier in"
                }
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={prijsEigen ? prijsTekst : vraagprijs > 0 ? String(vraagprijs) : ""}
                  onChange={(e) => {
                    setPrijsEigen(true);
                    setPrijsTekst(e.target.value);
                  }}
                  placeholder="0"
                  style={{
                    ...inputStijl,
                    height: 46,
                    paddingRight: 34,
                    fontFamily: T.play,
                    fontSize: 20,
                    fontWeight: 700,
                    color: T.navy,
                  }}
                />
              </Field>

              <Field
                label="Korting"
                suffix="€"
                hint={
                  korting > 0
                    ? `Onze prijs wordt ${fmt(som.onzePrijs)} — de korting komt uit je eigen marge`
                    : "Optioneel"
                }
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={kortingTekst}
                  onChange={(e) => setKortingTekst(e.target.value)}
                  placeholder="0"
                  style={{ ...inputStijl, height: 46, paddingRight: 34, fontFamily: T.play, fontSize: 20, fontWeight: 700 }}
                />
              </Field>
            </div>

            {gekozen && (
              <button
                type="button"
                onClick={() => {
                  setAutoId(null);
                  setPrijsEigen(false);
                  setPrijsTekst("");
                }}
                className="mt-3 inline-flex items-center gap-1.5 transition-all hover:opacity-60"
                style={klein(T.ink(0.5))}
              >
                <RotateCcw size={10} /> Andere auto kiezen
              </button>
            )}

            <PanelVoet>
              Alleen auto&apos;s die nog niet verkocht zijn staan in de lijst. Gereserveerde auto&apos;s
              staan er wél bij — een reservering die afketst is nog steeds een auto die je kunt ruilen.
            </PanelVoet>
          </Panel>
        </div>

        {/* ══ 3 · De som ══════════════════════════════════════════ */}
        <div className="mt-4">
          <Panel
            title="3 · De som"
            tone="donker"
            icon={<ArrowLeftRight size={13} style={{ color: "rgba(255,255,255,0.4)" }} />}
            actions={
              <div className="flex items-center gap-2">
                <Btn variant="ghostDonker" size="sm" onClick={opnieuw}>
                  <RotateCcw size={11} /> Leegmaken
                </Btn>
              </div>
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
              {/* Links: waar het bedrag vandaan komt */}
              <div className="flex flex-col">
                <SomRegel label={onzeAuto} bedrag={vraagprijs} sub={gekozen?.kenteken ?? undefined} />
                {korting > 0 && <SomRegel label="Korting" bedrag={korting} teken="− " />}
                <SomRegel
                  label={`Inruil ${klantAuto || "auto van de klant"}`}
                  bedrag={bod}
                  teken="− "
                  sub={kmNum > 0 ? fmtKm(kmNum) : undefined}
                />

                <div className="mt-1 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
                  <p style={{ ...micro("rgba(255,255,255,0.45)"), fontSize: 9 }}>
                    {somRond ? uitkomstLabel : "Nog niet compleet"}
                  </p>
                  <p className="mt-1" style={num(38, somRond ? "#ffffff" : "rgba(255,255,255,0.25)")}>
                    {somRond ? fmt(som.bedrag) : "—"}
                  </p>
                  <p className="mt-1.5" style={klein("rgba(255,255,255,0.45)")}>
                    {!somRond
                      ? "Zodra allebei de bedragen erin staan, staat hier wat er over tafel gaat."
                      : som.richting === "uit"
                        ? "Zijn auto is meer waard dan die van ons. Dit bedrag betalen wij hem uit."
                        : som.richting === "gelijk"
                          ? "Precies gelijk — er gaat geen geld heen en weer."
                          : "Dit betaalt de klant bij, boven op zijn ingeruilde auto."}
                  </p>
                </div>

                {somRond && (
                  <>
                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      <Btn variant="wit" size="sm" onClick={kopieer}>
                        {gekopieerd ? <Check size={11} /> : <ClipboardCopy size={11} />}
                        {gekopieerd ? "Gekopieerd" : "Kopieer voorstel"}
                      </Btn>
                      {rdw && (
                        <Btn variant="ghostDonker" size="sm" onClick={bewaarAlsDossier} disabled={bewaarBezig}>
                          {bewaard ? <Check size={11} /> : <FolderPlus size={11} />}
                          {bewaard ? "In de inkoop gezet" : bewaarBezig ? "Bezig…" : "Bewaar als inkoopdossier"}
                        </Btn>
                      )}
                    </div>

                    {/* Geen bewaarknop: het gaat vanzelf. Wél zichtbaar dát het gebeurt — een
                        stille automaat waar je niets van ziet vertrouw je niet. */}
                    <button
                      type="button"
                      onClick={() => setTab("archief")}
                      className="mt-2.5 flex items-center gap-1.5 transition-all hover:opacity-70"
                      style={klein(
                        archiefStatus === "fout" ? "#fca5a5" : "rgba(255,255,255,0.45)"
                      )}
                    >
                      {archiefStatus === "bezig" ? (
                        <>
                          <Spinner size={10} tone="donker" /> In het archief zetten…
                        </>
                      ) : archiefStatus === "fout" ? (
                        "Kon niet in het archief bewaren — controleer je verbinding"
                      ) : archiefStatus === "bewaard" ? (
                        <>
                          <Archive size={10} /> In het archief bewaard{bewaardOm ? ` om ${bewaardOm}` : ""} — klik
                          om terug te kijken
                        </>
                      ) : (
                        <>
                          <Archive size={10} /> Deze inruil gaat zo vanzelf het archief in
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>

              {/* Rechts: wat de inruilauto ons oplevert */}
              <div className="flex flex-col">
                <p style={{ ...micro("rgba(255,255,255,0.45)"), fontSize: 9 }}>Wat je aan zijn auto overhoudt</p>

                {verkoopwaarde <= 0 ? (
                  <p className="mt-2" style={klein("rgba(255,255,255,0.45)")}>
                    Zonder taxatie is niet te zeggen wat deze auto oplevert. Zoek de marktwaarde op, of
                    weet je hem uit je hoofd — dan blijft dit vak leeg en klopt de som links nog steeds.
                  </p>
                ) : (
                  <>
                    <p className="mt-1" style={num(30, som.nettoMarge < 0 ? "#f87171" : "#4ade80")}>
                      {fmtTeken(som.nettoMarge)}
                    </p>
                    <p className="mt-1" style={klein("rgba(255,255,255,0.45)")}>
                      {som.nettoMarge < 0
                        ? "Je legt op deze auto geld toe. Dat kan een bewuste keuze zijn om de deal rond te krijgen — maar dan weet je het."
                        : `${som.margePct}% van de verkoopprijs, ná btw en kosten.`}
                    </p>

                    <div className="mt-4 flex flex-col">
                      {(
                        [
                          [voorlopig ? "Verwachte verkoop (voorlopig)" : "Verwachte verkoop", verkoopwaarde, ""],
                          ["Ons bod", bod, "− "],
                          [btwType === "btw" ? "Btw (21% over de verkoop)" : "Btw (21/121 over de marge)", som.btwAfdracht, "− "],
                          ["Klaarmaakkosten", kosten, "− "],
                        ] as [string, number, string][]
                      ).map(([label, bedrag, teken], i) => (
                        <div
                          key={label}
                          className="flex items-baseline justify-between gap-3 py-1.5"
                          style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.09)" : undefined }}
                        >
                          <span style={{ fontFamily: T.inter, fontSize: 11.5, color: "rgba(255,255,255,0.5)" }}>
                            {label}
                          </span>
                          <span style={{ fontFamily: T.play, fontSize: 13, fontWeight: 700, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
                            {teken}
                            {fmt(bedrag)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Onze eigen auto erbij. Alleen als we weten wat hij ons gekost heeft —
                        anders zou dit een aanname zijn die eruitziet als een bedrag. */}
                    {onzeWinst && (
                      <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span style={{ ...micro("rgba(255,255,255,0.5)"), fontSize: 9 }}>
                            Op de hele ruil
                          </span>
                          <span style={num(21, totaalNu < 0 ? "#f87171" : "#ffffff")}>
                            {fmtTeken(totaalNu)}
                          </span>
                        </div>
                        <p className="mt-1.5" style={klein("rgba(255,255,255,0.45)")}>
                          Onze {gekozen?.merk ?? "auto"} levert daarvan {fmtTeken(onzeWinst.nettoMarge)} op:
                          verkocht voor {fmt(som.onzePrijs)}
                          {korting > 0 ? ` (na ${fmt(korting)} korting)` : ""}, en hij kostte ons{" "}
                          {fmt(onzeKostprijs)} inclusief wat erin ging.
                        </p>
                      </div>
                    )}

                    {b?.verkoopbaarheid_reden && (
                      <p className="mt-3" style={klein("rgba(255,255,255,0.4)")}>
                        {b.verkoopbaarheid_reden}
                      </p>
                    )}

                    {korting > 0 && (
                      <p className="mt-3" style={klein("rgba(255,255,255,0.4)")}>
                        De {fmt(korting)} korting op onze eigen auto staat hier los van — die komt van de
                        marge op díé auto af, niet van deze.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </Panel>
        </div>

        {/* ══ 4 · Wat de klant maximaal wil bijbetalen ═════════════ */}
        <div className="mt-4">
          <Panel
            title="4 · Wat de klant maximaal bijbetaalt"
            icon={<Wallet size={13} style={{ color: T.ink(0.35) }} />}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8">
              {/* Zijn grens */}
              <div className="lg:col-span-4">
                <Field
                  label="Hij legt er maximaal bij"
                  suffix="€"
                  hint="Wat de klant zelf noemt. Daarmee ligt vast wat je zijn auto voor moet overnemen — en dan is de vraag alleen nog of dat uit kan."
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    value={maxBijTekst}
                    onChange={(e) => setMaxBijTekst(e.target.value)}
                    placeholder="0"
                    style={{
                      ...inputStijl,
                      height: 46,
                      paddingRight: 34,
                      fontFamily: T.play,
                      fontSize: 20,
                      fontWeight: 700,
                      color: T.navy,
                    }}
                  />
                </Field>
              </div>

              {/* Wat dat betekent */}
              <div className="lg:col-span-8">
                {som.onzePrijs <= 0 || maxBij <= 0 ? (
                  <p style={klein()}>
                    {som.onzePrijs <= 0
                      ? "Kies eerst onze auto hierboven, dan is er iets om van af te trekken."
                      : "Vul in wat hij maximaal wil bijleggen. Je ziet dan wat je zijn auto voor moet overnemen om daaraan te komen, wat je daaraan overhoudt, en of het uit kan."}
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* Wat je zijn auto voor moet overnemen */}
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div className="min-w-0">
                        <p style={{ ...micro(), fontSize: 9 }}>Dan neem je zijn auto over voor</p>
                        <p className="mt-1" style={num(30)}>
                          {fmt(benodigdBod)}
                        </p>
                        <p className="mt-1" style={klein()}>
                          {benodigdBod === 0
                            ? "Hij legt meer bij dan onze auto kost — voor zijn auto hoef je dan niets te geven."
                            : advies > 0
                              ? benodigdBod > advies
                                ? `${fmt(benodigdBod - advies)} boven het advies van ${fmt(advies)}.`
                                : `${fmt(advies - benodigdBod)} onder het advies van ${fmt(advies)}.`
                              : `Onze prijs ${fmt(som.onzePrijs)} min zijn ${fmt(maxBij)}.`}
                        </p>
                      </div>

                      {benodigdBod !== bod && benodigdBod > 0 && (
                        <Btn
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBodEigen(true);
                            setBodTekst(String(benodigdBod));
                          }}
                        >
                          <ArrowLeftRight size={11} /> Neem dit bod over in de som
                        </Btn>
                      )}
                    </div>

                    {/* Wat je eraan overhoudt */}
                    {verkoopwaarde > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div
                          className="p-3.5"
                          style={{
                            backgroundColor: "rgba(0,19,55,0.02)",
                            border: `1px solid ${T.line}`,
                            borderLeft: `3px solid ${bijMax.nettoMarge < 0 ? T.rood : T.groen}`,
                          }}
                        >
                          <p style={{ ...micro(), fontSize: 9 }}>Houd je over aan zijn auto</p>
                          <p className="mt-1" style={num(22, bijMax.nettoMarge < 0 ? T.rood : T.groen)}>
                            {fmtTeken(bijMax.nettoMarge)}
                          </p>
                          <p className="mt-1" style={klein()}>
                            {fmt(verkoopwaarde)} verkoop − {fmt(benodigdBod)} inkoop − {fmt(bijMax.btwAfdracht)} btw
                            {kosten > 0 ? ` − ${fmt(kosten)} kosten` : ""}
                          </p>
                        </div>

                        <div
                          className="p-3.5"
                          style={{
                            backgroundColor: "rgba(0,19,55,0.02)",
                            border: `1px solid ${T.line}`,
                            borderLeft: `3px solid ${
                              onzeWinst ? (totaalBijMax < 0 ? T.rood : T.navy) : T.line2
                            }`,
                          }}
                        >
                          <p style={{ ...micro(), fontSize: 9 }}>Op de hele ruil</p>
                          {onzeWinst ? (
                            <>
                              <p className="mt-1" style={num(22, totaalBijMax < 0 ? T.rood : T.navy)}>
                                {fmtTeken(totaalBijMax)}
                              </p>
                              <p className="mt-1" style={klein()}>
                                Met {fmtTeken(onzeWinst.nettoMarge)} op onze eigen auto erbij.
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="mt-1" style={num(22, T.ink(0.25))}>
                                —
                              </p>
                              <p className="mt-1" style={klein()}>
                                {gekozen
                                  ? "Vul de inkoopprijs van deze auto in bij de Marge Calculator, dan staat hier wat de hele ruil oplevert."
                                  : "Kies een auto uit de voorraad, dan kan de winst op onze eigen auto erbij."}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p style={klein()}>
                        Wat je eraan overhoudt kan er pas bij als bekend is wat zijn auto opbrengt. Vul
                        hierboven een verkoopprijs in of scan de markt.
                      </p>
                    )}

                    {/* Het oordeel */}
                    {bijbetalingOordeel && (
                      <div className="flex items-start gap-2.5">
                        <span
                          className="flex-shrink-0 rounded-full"
                          style={{ width: 8, height: 8, backgroundColor: bijbetalingOordeel.kleur, marginTop: 5 }}
                        />
                        <p style={{ fontFamily: T.inter, fontSize: 12.5, color: T.ink(0.7), lineHeight: 1.55 }}>
                          {bijbetalingOordeel.stand === "past" ? (
                            <>
                              <strong style={{ color: T.navy }}>Dit kan.</strong> Wat hij wil bijleggen past
                              binnen de {marge}% die je wilde houden — je levert er niets voor in.
                            </>
                          ) : bijbetalingOordeel.stand === "krap" ? (
                            <>
                              <strong style={{ color: T.navy }}>Dit kan, maar het kost je marge.</strong>{" "}
                              {advies > 0
                                ? `Je gaat ${fmt(benodigdBod - advies)} boven je eigen advies zitten.`
                                : `Bij deze verkoopprijs en kosten was er eigenlijk geen ruimte om te bieden.`}
                              {bijMax.nettoMarge <= 0 && onzeWinst
                                ? ` Op zijn auto lever je ${fmt(-bijMax.nettoMarge)} in; dat haal je terug uit de winst op onze eigen auto.`
                                : ""}
                            </>
                          ) : (
                            <>
                              <strong style={{ color: T.navy }}>Dit kan niet uit.</strong> Je zou zijn auto
                              voor {fmt(benodigdBod)} overnemen terwijl hij {fmt(verkoopwaarde)} opbrengt
                              {kosten > 0 ? ` en nog ${fmt(kosten)} klaarmaken kost` : ""}: daar leg je{" "}
                              {fmt(-bijMax.nettoMarge)} op toe. Hij zal meer moeten bijleggen, of onze prijs
                              moet omlaag.
                            </>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <PanelVoet>
              {btwType === "marge" ? (
                <>
                  Of je het weggeeft als korting of als inruilwaarde maakt voor jou niets uit: allebei
                  kosten ze je € 0,83 per euro, want over dat stuk marge draag je geen btw meer af. Wat
                  telt is wat hij in totaal bijbetaalt en wat zijn auto opbrengt — niet hoe je het noemt.
                </>
              ) : (
                <>
                  Let op: ruil je in van een bedrijf, dan is het níét hetzelfde. Een euro extra
                  inruilwaarde kost je de volle euro, terwijl een euro korting op onze auto je € 0,83
                  kost. Bij deze inruil is korting geven dus goedkoper dan meer bieden.
                </>
              )}
            </PanelVoet>
          </Panel>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

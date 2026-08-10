"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus, Trash2, Check, Phone, Mail, MessageCircle, Store,
  Globe, Calculator, Sparkles, Copy, Car, CalendarDays, Users, AtSign, ExternalLink,
} from "lucide-react";
import {
  T, micro, body, klein, Panel, Btn, Chip, Field, inputStijl,
  Spinner, Empty, Foutmelding, Pill, PanelVoet,
} from "./inkoop/ui";
import { useAiTaak } from "./AiTaken";

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
  auto_id: number | null; auto_naam: string; bod: string; inruil: string;
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
  verloren: { label: "Verloren", kleur: T.ink(0.4) },
};

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
  const [toonAf, setToonAf] = useState(false);
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

  const zichtbaar = useMemo(
    () => (aanvragen ?? []).filter((a) => (toonAf ? true : !a.afgehandeld_op)),
    [aanvragen, toonAf]
  );

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

  const openAanvraag = useMemo(
    () => (aanvragen ?? []).find((a) => a.id === open) ?? null,
    [aanvragen, open]
  );

  const nogTeDoen = (aanvragen ?? []).filter((a) => !a.afgehandeld_op).length;
  const vandaag = perDag[0]?.[0] === new Date().toISOString().slice(0, 10) ? perDag[0][1].length : 0;

  return (
    <div className="px-4 md:px-8 py-4 md:py-6" style={{ maxWidth: 1500, margin: "0 auto" }}>
      {fout && <div className="mb-4"><Foutmelding>{fout}</Foutmelding></div>}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Chip active={blad === "dag"} onClick={() => setBlad("dag")}>
          <CalendarDays size={11} /> Per dag
        </Chip>
        <Chip active={blad === "auto"} onClick={() => setBlad("auto")}>
          <Car size={11} /> Per auto {perAuto.length > 0 && <span style={{ opacity: 0.6 }}>{perAuto.length}</span>}
        </Chip>
        <Chip active={toonAf} onClick={() => setToonAf((v) => !v)}>
          {toonAf ? "Ook afgehandeld" : "Alleen open"} <span style={{ opacity: 0.6 }}>{nogTeDoen}</span>
        </Chip>
        <div className="ml-auto flex items-center gap-2">
          {vandaag > 0 && (
            <span style={klein()}>{vandaag} vandaag binnengekomen</span>
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
        <Empty
          icon={<Users size={30} color={T.ink(0.2)} />}
          title="Nog niets vastgelegd"
          body="Zet met de knop hierboven een aanvraag erbij, of klik bij een mail in het E-mail-tabblad op “Zet in overzicht”."
        />
      ) : (
        <div className="flex flex-col xl:flex-row gap-4 items-start">
          <div className="w-full xl:w-[340px] xl:flex-none flex flex-col gap-4">
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
    onderwerp: "", autoId: "", bod: "", inruil: "", notitie: "",
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
 * Staat bewust HIER en niet binnen het detailpaneel. Een component die tijdens het
 * renderen wordt gemaakt is bij elke toetsaanslag een ander component, dus React gooit
 * het invoerveld weg en bouwt het opnieuw op — en dan ben je na elke letter je cursor kwijt.
 *
 * Alles is aanpasbaar, ook wat de AI uit een mail haalde: dat is een gok, en aan de balie
 * typ je niet meteen alles goed.
 */
function Bewerk({
  label, waarde, zet, huidig, veld, patch, plaats, regels,
}: {
  label: string;
  waarde: string;
  zet: (v: string) => void;
  /** Wat er in de database staat; alleen bij een echt verschil slaan we op. */
  huidig: string;
  veld: string;
  patch: (velden: Record<string, unknown>) => Promise<boolean>;
  plaats?: string;
  regels?: number;
}) {
  const bewaar = () => {
    if (waarde !== huidig) patch({ [veld]: waarde });
  };
  return (
    <Field label={label}>
      {regels ? (
        <textarea
          style={{ ...inputStijl, minHeight: regels * 20, resize: "vertical", lineHeight: 1.55 }}
          value={waarde}
          onChange={(e) => zet(e.target.value)}
          onBlur={bewaar}
          placeholder={plaats}
        />
      ) : (
        <input
          style={inputStijl}
          value={waarde}
          onChange={(e) => zet(e.target.value)}
          onBlur={bewaar}
          placeholder={plaats}
        />
      )}
    </Field>
  );
}

/** Alles over één aanvraag, plus wie er nog meer achter dezelfde auto aan zit. */
function Detail({
  a, autos, anderen, herlaad, onFout, onSluit, onNaarTaxatie,
}: {
  a: Aanvraag;
  autos: Auto[];
  anderen: Aanvraag[];
  herlaad: () => Promise<void>;
  onFout: (s: string) => void;
  onSluit: () => void;
  onNaarTaxatie?: (kenteken: string) => void;
}) {
  // Lokaal bewerken zonder dat een herlaadactie je aanpassing overschrijft. Het component
  // krijgt key={a.id}, dus bij een andere aanvraag begint het opnieuw.
  const [naam, setNaam] = useState(a.naam);
  const [telefoon, setTelefoon] = useState(a.telefoon);
  const [email, setEmail] = useState(a.email);
  const [onderwerp, setOnderwerp] = useState(a.onderwerp);
  const [kentekenVeld, setKentekenVeld] = useState(a.kenteken);
  const [advTitel, setAdvTitel] = useState(a.advertentie_titel);
  const [advUrl, setAdvUrl] = useState(a.advertentie_url);
  const [bericht, setBericht] = useState(a.bericht);
  const [bod, setBod] = useState(a.bod);
  const [inruil, setInruil] = useState(a.inruil);
  const [notitie, setNotitie] = useState(a.notitie);
  const [antwoord, setAntwoord] = useState(a.antwoord);
  const [gekopieerd, setGekopieerd] = useState(false);
  const [bezig, setBezig] = useState(false);

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
      <div className="flex flex-col gap-3">
      {/* Waar het over gaat. Bovenaan, want dit is waaraan je de aanvraag herkent —
          niet aan de naam. */}
      <Panel
        title="De advertentie"
        actions={<span style={{ ...micro(k.kleur), fontSize: 9 }}>{k.label}</span>}
      >
        {advUrl && (
          <a
            href={advUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 mb-2.5 hover:opacity-70 transition-all"
            style={{ ...body(12, T.navy), textDecoration: "underline", overflowWrap: "anywhere" }}
          >
            <ExternalLink size={12} style={{ flexShrink: 0 }} />
            {advTitel || advUrl}
          </a>
        )}
        <div className="grid grid-cols-1 gap-2">
          <Bewerk patch={patch} label="Auto uit zijn advertentie" waarde={advTitel} zet={setAdvTitel}
            huidig={a.advertentie_titel} veld="advertentie_titel"
            plaats="Mercedes-Benz CLA 250 224pk 7G-DCT 2020 Zwart" />
          <Bewerk patch={patch} label="Link naar de advertentie" waarde={advUrl} zet={setAdvUrl}
            huidig={a.advertentie_url} veld="advertentie_url"
            plaats="https://www.marktplaats.nl/v/..." />
        </div>

        <div className="mt-3">
          <p className="mb-1" style={{ ...micro(), fontSize: 9 }}>Wat hij zei</p>
          <textarea
            value={bericht}
            onChange={(e) => setBericht(e.target.value)}
            onBlur={() => bericht !== a.bericht && patch({ bericht })}
            placeholder="Zijn eigen woorden — plak hier het bericht dat hij stuurde."
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
        </div>
      </Panel>

      {/* De handel: waar het over gaat bij ons, wat hij bood, wat hij inruilt. */}
      <Panel title="De deal">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Onze auto waar hij op reageert">
            <select
              style={inputStijl}
              value={a.auto_id != null ? String(a.auto_id) : ""}
              onChange={(e) => {
                const gekozenAuto = autos.find((x) => String(x.id) === e.target.value);
                patch({
                  auto_naam: gekozenAuto ? `${gekozenAuto.merk ?? ""} ${gekozenAuto.model ?? ""}`.trim() : "",
                  kenteken: gekozenAuto?.kenteken ?? a.kenteken,
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
          </Field>
          <Bewerk patch={patch} label="Waar het over gaat" waarde={onderwerp} zet={setOnderwerp}
            huidig={a.onderwerp} veld="onderwerp" plaats="Vraagt of de prijs kan zakken" />
          <Bewerk patch={patch} label="Bood" waarde={bod} zet={setBod} huidig={a.bod} veld="bod" plaats="—" />
          <Bewerk patch={patch} label="Wil inruilen" waarde={inruil} zet={setInruil} huidig={a.inruil} veld="inruil" plaats="—" />
          <Bewerk patch={patch} label="Kenteken" waarde={kentekenVeld} zet={setKentekenVeld}
            huidig={a.kenteken} veld="kenteken" plaats="AB-123-C" />
        </div>

        <div className="mt-2.5">
          <Bewerk patch={patch} label="Notitie" waarde={notitie} zet={setNotitie} huidig={a.notitie}
            veld="notitie" regels={2} plaats="Belt maandag terug" />
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {Object.entries(STATUS).map(([w, st]) => (
            <Chip key={w} active={a.status === w} onClick={() => patch({ status: w })}>
              {st.label}
            </Chip>
          ))}
        </div>
      </Panel>
      </div>

      {/* Rechterkolom: wie het is, wie er nog meer wacht, en wat je nu doet. */}
      <div className="flex flex-col gap-3">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Bewerk patch={patch} label="Naam" waarde={naam} zet={setNaam} huidig={a.naam} veld="naam" plaats="—" />
          <Bewerk patch={patch} label="Telefoon" waarde={telefoon} zet={setTelefoon} huidig={a.telefoon} veld="telefoon" plaats="06 …" />
          <Bewerk patch={patch} label="E-mail" waarde={email} zet={setEmail} huidig={a.email} veld="email" plaats="—" />
          <Field label="Waar kwam het binnen">
            <select style={inputStijl} value={a.bron} onChange={(e) => patch({ bron: e.target.value })}>
              {Object.keys(KANAAL).map((w) => (
                <option key={w} value={w}>{KANAAL[w].label}</option>
              ))}
            </select>
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
      <Panel title="Wat nu">
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
            setBezig(true);
            await patch({ afgehandeld: !a.afgehandeld_op });
            setBezig(false);
          }}
        >
          <Check size={12} /> {a.afgehandeld_op ? "Terug in het overzicht" : "Afgehandeld"}
        </Btn>
        <Btn
          variant="ghost" size="sm"
          onClick={async () => {
            if (!confirm("Deze aanvraag verwijderen?")) return;
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

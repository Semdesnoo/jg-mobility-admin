"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeEuro,
  CalendarDays,
  Car,
  Check,
  ExternalLink,
  Gauge,
  Mail,
  MailCheck,
  Phone,
  Send,
  Sparkles,
} from "lucide-react";
import { Btn, Foutmelding, Panel, Spinner, T, body, inputStijl, klein, micro, num } from "./inkoop/ui";
import { useDialoog } from "./Dialoog";
import { haalKilometerstand, isTaxatieAanvraag, taxatieFase, type TaxatieFase } from "@/lib/taxatie-aanvragen";

type TaxatieAanvraag = {
  id: string;
  naam: string;
  telefoon: string;
  email: string;
  onderwerp: string;
  kenteken: string;
  inruil: string;
  bericht: string;
  notitie: string;
  bod: string;
  ons_bod: string;
  antwoord: string;
  antwoord_verstuurd_op: string | null;
  taxatie_resultaat: unknown | null;
  taxatie_berekend_op: string | null;
  afgehandeld_op: string | null;
  aangemaakt: string;
};

type Filter = "alles" | TaxatieFase;

const FASE: Record<TaxatieFase, { label: string; kleur: string; bg: string }> = {
  nieuw: { label: "Nieuw", kleur: "#b45309", bg: "#fef3c7" },
  getaxeerd: { label: "Getaxeerd", kleur: "#1d4ed8", bg: "#dbeafe" },
  klaar: { label: "E-mail klaar", kleur: "#7c3aed", bg: "#ede9fe" },
  verstuurd: { label: "Verstuurd", kleur: "#15803d", bg: "#dcfce7" },
};

const euro = (n: number) => `€ ${Math.round(n).toLocaleString("nl-NL")}`;

function object(waarde: unknown): Record<string, unknown> {
  return waarde !== null && typeof waarde === "object" && !Array.isArray(waarde)
    ? (waarde as Record<string, unknown>)
    : {};
}

function taxatieCijfers(aanvraag: TaxatieAanvraag) {
  const resultaat = object(aanvraag.taxatie_resultaat);
  const berekening = object(resultaat.berekening);
  const markt = object(resultaat.markt);
  return {
    bod: Number(berekening.max_inkoop) || 0,
    verkoop: Number(berekening.verwachte_verkoop) || 0,
    aantal: Number(markt.aantal_gevonden) || 0,
    marktGemiddelde: Number(markt.gemiddelde_prijs) || 0,
  };
}

function voertuig(aanvraag: TaxatieAanvraag): string {
  return aanvraag.inruil.split("·")[0]?.trim() || aanvraag.kenteken || "Onbekende auto";
}

function eersteLink(tekst: string): string {
  return tekst.match(/https?:\/\/[^\s]+/i)?.[0] ?? "";
}

function datum(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

export default function TaxatieAanvragenContent({
  focusId,
  onOpenCalculator,
}: {
  focusId?: string;
  onOpenCalculator: (aanvraag: { id: string; kenteken: string; km: string }) => void;
}) {
  const [aanvragen, setAanvragen] = useState<TaxatieAanvraag[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(focusId ?? null);
  const [filter, setFilter] = useState<Filter>("alles");
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState<"genereren" | "opslaan" | "versturen" | "" | null>(null);
  const [conceptOnderwerp, setConceptOnderwerp] = useState("");
  const [conceptAntwoord, setConceptAntwoord] = useState("");
  const { vraag } = useDialoog();

  const laad = async () => {
    const res = await fetch("/api/admin/aanvragen").catch(() => null);
    if (!res?.ok) {
      setFout("De taxatieaanvragen konden niet worden opgehaald.");
      setAanvragen([]);
      return;
    }
    const data = await res.json().catch(() => ({}));
    const lijst = Array.isArray(data.aanvragen)
      ? (data.aanvragen as TaxatieAanvraag[]).filter(isTaxatieAanvraag)
      : [];
    setAanvragen(lijst);
    setOpenId((huidig) => focusId ?? huidig ?? lijst[0]?.id ?? null);
  };

  useEffect(() => {
    void laad();
    // focusId is alleen een terugkeerdoel; opnieuw ophalen gebeurt via de acties hieronder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const aantallen = useMemo(() => {
    const basis = { nieuw: 0, getaxeerd: 0, klaar: 0, verstuurd: 0 } satisfies Record<TaxatieFase, number>;
    for (const aanvraag of aanvragen ?? []) basis[taxatieFase(aanvraag)]++;
    return basis;
  }, [aanvragen]);

  const zichtbaar = useMemo(
    () => (aanvragen ?? []).filter((aanvraag) => filter === "alles" || taxatieFase(aanvraag) === filter),
    [aanvragen, filter]
  );

  const actief = (aanvragen ?? []).find((aanvraag) => aanvraag.id === openId) ?? zichtbaar[0] ?? null;
  const fase = actief ? taxatieFase(actief) : null;
  const cijfers = actief ? taxatieCijfers(actief) : null;
  const link = actief ? eersteLink(actief.bericht) : "";

  useEffect(() => {
    setConceptOnderwerp(actief?.onderwerp ?? "");
    setConceptAntwoord(actief?.antwoord ?? "");
  }, [actief?.id, actief?.onderwerp, actief?.antwoord]);

  const patch = async (id: string, velden: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/aanvragen/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(velden),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFout(data.error || "Opslaan is mislukt.");
      return false;
    }
    await laad();
    return true;
  };

  const genereer = async () => {
    if (!actief || bezig) return;
    setBezig("genereren");
    setFout("");
    try {
      const res = await fetch(`/api/admin/aanvragen/${actief.id}/antwoord`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "De e-mail kon niet worden geschreven.");
      await laad();
    } catch (error) {
      setFout(error instanceof Error ? error.message : String(error));
    } finally {
      setBezig("");
    }
  };

  const bewaarConcept = async () => {
    if (!actief || bezig || !conceptAntwoord.trim()) return false;
    setBezig("opslaan");
    setFout("");
    const gelukt = await patch(actief.id, {
      onderwerp: conceptOnderwerp.trim(),
      antwoord: conceptAntwoord.trim(),
    });
    setBezig("");
    return gelukt;
  };

  const verstuur = async () => {
    if (!actief || bezig || !conceptAntwoord.trim()) return;
    const akkoord = await vraag({
      titel: `Taxatie naar ${actief.naam || actief.email} versturen?`,
      tekst: `De e-mail met ons bod wordt nu echt naar ${actief.email} gestuurd. Controleer het bedrag en de tekst eerst nog één keer.`,
      bevestig: "Goedkeuren & versturen",
    });
    if (!akkoord) return;

    // Sla eventuele laatste wijzigingen eerst op. Zo kan een klik op Versturen nooit de
    // oude tekst uit de database inhalen terwijl het tekstveld nog focus had.
    if (conceptOnderwerp.trim() !== actief.onderwerp || conceptAntwoord.trim() !== actief.antwoord) {
      setBezig("opslaan");
      const opgeslagen = await patch(actief.id, {
        onderwerp: conceptOnderwerp.trim(),
        antwoord: conceptAntwoord.trim(),
      });
      if (!opgeslagen) {
        setBezig("");
        return;
      }
    }

    setBezig("versturen");
    setFout("");
    try {
      const res = await fetch(`/api/admin/aanvragen/${actief.id}/verstuur`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bevestigd: true,
          onderwerp: conceptOnderwerp.trim(),
          antwoord: conceptAntwoord.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Versturen is mislukt.");
      await laad();
    } catch (error) {
      setFout(error instanceof Error ? error.message : String(error));
    } finally {
      setBezig("");
    }
  };

  return (
    <div style={{ backgroundColor: T.wash, minHeight: "100%" }}>
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 xl:px-8" style={{ height: 56, backgroundColor: T.paper, borderBottom: `1px solid ${T.line2}` }}>
        <div className="min-w-0">
          <h2 className="truncate text-[17px] sm:text-[19px]" style={{ fontFamily: T.play, fontWeight: 700, color: T.navy }}>Taxatieaanvragen</h2>
          <p className="hidden sm:block" style={micro(T.ink(0.38))}>Websiteaanvraag → calculator → goedgekeurde e-mail</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span style={klein()}>{(aanvragen ?? []).length} totaal</span>
          <span style={klein(T.amber)}>{aantallen.nieuw} nieuw</span>
        </div>
      </header>

      <nav className="sticky z-30 flex items-center gap-2 px-2 md:px-4 xl:px-6 overflow-x-auto" style={{ top: 56, height: 46, backgroundColor: T.paper, borderBottom: `1px solid ${T.line2}` }}>
        {(["alles", "nieuw", "getaxeerd", "klaar", "verstuurd"] as Filter[]).map((id) => {
          const actiefFilter = filter === id;
          const aantal = id === "alles" ? (aanvragen ?? []).length : aantallen[id];
          const label = id === "alles" ? "Alle" : FASE[id].label;
          return (
            <button key={id} type="button" className="jg-tab-swatch" data-active={actiefFilter} onClick={() => setFilter(id)}>
              {label}<span className="jg-tab-count">{aantal}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-4 md:px-6 xl:px-8 py-4 md:py-6" style={{ maxWidth: 1800, margin: "0 auto" }}>
        {fout && <div className="mb-4"><Foutmelding>{fout}</Foutmelding></div>}
        {aanvragen === null ? (
          <div className="flex justify-center py-20"><Spinner size={24} /></div>
        ) : zichtbaar.length === 0 ? (
          <Panel title="Geen aanvragen"><p className="py-8 text-center" style={body(13, T.ink(0.45))}>Er staan geen taxatieaanvragen in deze fase.</p></Panel>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
            <Panel title="Aanvragen" meta={String(zichtbaar.length)} className="xl:sticky xl:top-[118px]">
              <div className="flex flex-col gap-2 max-h-[calc(100vh-190px)] overflow-y-auto jg-scroll pr-1">
                {zichtbaar.map((aanvraag) => {
                  const aanvraagFase = taxatieFase(aanvraag);
                  const stijl = FASE[aanvraagFase];
                  const gekozen = aanvraag.id === actief?.id;
                  const bedragen = taxatieCijfers(aanvraag);
                  return (
                    <button key={aanvraag.id} type="button" onClick={() => setOpenId(aanvraag.id)} className="w-full text-left px-3.5 py-3 transition-all" style={{ backgroundColor: gekozen ? T.navy : T.paper, border: `1px solid ${gekozen ? T.navy : T.line}`, borderRadius: "var(--radius-control)" }}>
                      <div className="flex items-start gap-3">
                        <span className="flex items-center justify-center flex-shrink-0" style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: gekozen ? "rgba(255,255,255,.12)" : stijl.bg }}>
                          <Car size={15} color={gekozen ? "#fff" : stijl.kleur} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <strong className="truncate flex-1" style={{ fontFamily: T.play, fontSize: 13.5, color: gekozen ? "#fff" : T.navy }}>{voertuig(aanvraag)}</strong>
                            <span style={{ ...klein(gekozen ? "rgba(255,255,255,.5)" : T.ink(0.35)), flexShrink: 0 }}>{datum(aanvraag.aangemaakt)}</span>
                          </span>
                          <span className="block mt-1 truncate" style={klein(gekozen ? "rgba(255,255,255,.65)" : T.ink(0.55))}>{aanvraag.naam || aanvraag.email}</span>
                          <span className="flex items-center justify-between gap-2 mt-2">
                            <span style={{ ...micro(gekozen ? "rgba(255,255,255,.6)" : stijl.kleur), fontSize: 8.5 }}>{stijl.label}</span>
                            {bedragen.bod > 0 && <span style={num(13, gekozen ? "#fff" : T.navy)}>{euro(bedragen.bod)}</span>}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Panel>

            {actief && fase && cijfers && (
              <div className="flex flex-col gap-4 min-w-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Panel title="Klant & auto" className="lg:col-span-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      {[
                        ["Naam", actief.naam || "—"],
                        ["Kenteken", actief.kenteken || "—"],
                        ["Voertuig", voertuig(actief)],
                        ["Kilometerstand", haalKilometerstand(actief.inruil, actief.notitie, actief.bericht) ? `${Number(haalKilometerstand(actief.inruil, actief.notitie, actief.bericht)).toLocaleString("nl-NL")} km` : "—"],
                        ["E-mail", actief.email || "—"],
                        ["Telefoon", actief.telefoon || "—"],
                      ].map(([label, waarde]) => (
                        <div key={label}><p style={{ ...micro(), fontSize: 8.5 }}>{label}</p><p className="mt-1" style={body(13, T.navy)}>{waarde}</p></div>
                      ))}
                    </div>
                    {actief.bericht && <div className="mt-4 p-3.5" style={{ backgroundColor: "rgba(0,19,55,.025)", borderLeft: `3px solid ${T.navy}`, borderRadius: "0 var(--radius-control) var(--radius-control) 0" }}><p style={body(12.5, T.ink(0.7))}>{actief.bericht}</p></div>}
                    {link && <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-3" style={{ ...klein(T.blauw), textDecoration: "underline" }}><ExternalLink size={11} /> Bekijk advertentie / foto&apos;s</a>}
                  </Panel>

                  <Panel title="Status">
                    <div className="flex items-center gap-2"><span className="rounded-full" style={{ width: 9, height: 9, backgroundColor: FASE[fase].kleur }} /><strong style={body(13, FASE[fase].kleur)}>{FASE[fase].label}</strong></div>
                    <div className="mt-4 flex flex-col gap-2.5">
                      {[{ label: "Aanvraag ontvangen", klaar: true }, { label: "Taxatie gekoppeld", klaar: !!actief.taxatie_resultaat }, { label: "E-mail gecontroleerd", klaar: !!actief.antwoord }, { label: "Naar klant verstuurd", klaar: !!actief.antwoord_verstuurd_op }].map((stap) => (
                        <div key={stap.label} className="flex items-center gap-2"><span className="flex items-center justify-center rounded-full" style={{ width: 17, height: 17, backgroundColor: stap.klaar ? T.groen : "rgba(0,19,55,.08)" }}>{stap.klaar && <Check size={10} color="#fff" strokeWidth={3} />}</span><span style={klein(stap.klaar ? T.navy : T.ink(0.38))}>{stap.label}</span></div>
                      ))}
                    </div>
                  </Panel>
                </div>

                {fase === "nieuw" ? (
                  <section className="p-5 md:p-6" style={{ backgroundColor: T.navy, borderRadius: "var(--radius-card)", boxShadow: "0 10px 30px rgba(0,19,55,.14)" }}>
                    <div className="flex flex-col md:flex-row md:items-center gap-5">
                      <div className="flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,.1)" }}><Gauge size={24} color="#fff" /></div>
                      <div className="flex-1"><h3 style={{ fontFamily: T.play, fontSize: 18, fontWeight: 700, color: "#fff" }}>Zet deze aanvraag in Inkoop &amp; Taxatie</h3><p className="mt-1" style={body(12, "rgba(255,255,255,.58)")}>Kenteken en kilometerstand worden automatisch ingevuld. Na de marktscan koppel je het berekende bod met één knop terug.</p></div>
                      <Btn variant="wit" onClick={() => onOpenCalculator({ id: actief.id, kenteken: actief.kenteken, km: haalKilometerstand(actief.inruil, actief.notitie, actief.bericht) })}><Gauge size={13} /> Open in calculator</Btn>
                    </div>
                  </section>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {[{ label: "Ons inkoopbod", waarde: cijfers.bod, Icon: BadgeEuro }, { label: "Taxatiewaarde", waarde: cijfers.verkoop, Icon: Car }, { label: "Marktgemiddelde", waarde: cijfers.marktGemiddelde, Icon: Gauge }, { label: "Vergelijkbare auto's", waarde: cijfers.aantal, Icon: CalendarDays, aantal: true }].map(({ label, waarde, Icon, aantal }) => (
                      <div key={label} className="p-4" style={{ backgroundColor: label === "Ons inkoopbod" ? T.navy : T.paper, border: `1px solid ${label === "Ons inkoopbod" ? T.navy : T.line}`, borderRadius: "var(--radius-card)" }}><Icon size={14} color={label === "Ons inkoopbod" ? "rgba(255,255,255,.55)" : T.ink(0.35)} /><p className="mt-3" style={{ ...micro(label === "Ons inkoopbod" ? "rgba(255,255,255,.5)" : T.ink(0.4)), fontSize: 8.5 }}>{label}</p><p className="mt-1" style={num(23, label === "Ons inkoopbod" ? "#fff" : T.navy)}>{aantal ? waarde : euro(waarde)}</p></div>
                    ))}
                  </div>
                )}

                {fase !== "nieuw" && (
                  <Panel title="E-mail naar de klant" actions={actief.antwoord_verstuurd_op ? <span style={klein(T.groen)}>verstuurd op {datum(actief.antwoord_verstuurd_op)}</span> : undefined}>
                    {!actief.antwoord ? (
                      <div className="flex flex-col md:flex-row md:items-center gap-4 py-2"><div className="flex-1"><p style={body(13, T.navy)}>Laat een nette conceptmail schrijven met het berekende inkoopbod.</p><p className="mt-1" style={klein()}>Er wordt nog niets verstuurd. Jij controleert en wijzigt de tekst eerst.</p></div><Btn onClick={genereer} disabled={bezig === "genereren"}>{bezig === "genereren" ? <Spinner size={12} tone="donker" /> : <Sparkles size={12} />} Genereer concept</Btn></div>
                    ) : (
                      <div>
                        <label style={{ ...micro(), fontSize: 8.5 }}>Onderwerp</label>
                        <input value={conceptOnderwerp} onChange={(e) => setConceptOnderwerp(e.target.value)} disabled={!!actief.antwoord_verstuurd_op} className="mt-1 w-full" style={inputStijl} />
                        <label className="block mt-4" style={{ ...micro(), fontSize: 8.5 }}>Bericht</label>
                        <textarea value={conceptAntwoord} onChange={(e) => setConceptAntwoord(e.target.value)} disabled={!!actief.antwoord_verstuurd_op} className="mt-1 w-full" style={{ ...inputStijl, minHeight: 250, resize: "vertical", lineHeight: 1.65 }} />
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                          {!actief.antwoord_verstuurd_op && <><Btn variant="ghost" onClick={genereer} disabled={bezig === "genereren"}><Sparkles size={12} /> Opnieuw schrijven</Btn><Btn variant="ghost" onClick={bewaarConcept} disabled={!!bezig || !conceptAntwoord.trim()}>{bezig === "opslaan" ? <Spinner size={12} /> : <Check size={12} />} Concept opslaan</Btn><Btn onClick={verstuur} disabled={bezig === "versturen" || bezig === "opslaan" || !actief.email || !conceptAntwoord.trim()}>{bezig === "versturen" ? <Spinner size={12} tone="donker" /> : <Send size={12} />} Goedkeuren &amp; versturen</Btn></>}
                          {actief.antwoord_verstuurd_op && <span className="inline-flex items-center gap-2" style={body(12.5, T.groen)}><MailCheck size={15} /> De taxatiemail is naar {actief.email} verstuurd.</span>}
                        </div>
                      </div>
                    )}
                  </Panel>
                )}

                <div className="flex flex-wrap gap-3">
                  {actief.telefoon && <a href={`tel:${actief.telefoon}`} className="inline-flex items-center gap-1.5" style={{ ...klein(T.navy), textDecoration: "underline" }}><Phone size={11} /> Bel klant</a>}
                  {actief.email && <a href={`mailto:${actief.email}`} className="inline-flex items-center gap-1.5" style={{ ...klein(T.navy), textDecoration: "underline" }}><Mail size={11} /> Open e-mail</a>}
                  {fase !== "nieuw" && !actief.antwoord_verstuurd_op && <button type="button" onClick={() => onOpenCalculator({ id: actief.id, kenteken: actief.kenteken, km: haalKilometerstand(actief.inruil, actief.notitie, actief.bericht) })} className="inline-flex items-center gap-1.5" style={{ ...klein(T.blauw), textDecoration: "underline" }}><Gauge size={11} /> Taxatie opnieuw uitvoeren</button>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

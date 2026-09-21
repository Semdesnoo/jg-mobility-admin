"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Receipt, Printer, Download, Search, Check, Plus, Trash2, Car, Pencil, Send } from "lucide-react";
import {
  T, micro, body, klein, fmt, Panel, Btn, Field, inputStijl, Chip, Spinner, Empty, Foutmelding,
} from "./inkoop/ui";
import { genereerInkoopverklaringHTML, inWoorden } from "@/lib/inkoopverklaring";
import { useDialoog } from "./Dialoog";

/**
 * Inkoopverklaringen.
 *
 * WAAROM DIT SCHERM ER IS
 * Koop je een auto van een particulier, dan krijg je geen factuur — die persoon is geen
 * ondernemer. Zonder eigen bewijsstuk staat er straks een auto in de administratie waarvan
 * niet te zien is van wie hij kwam en wat ervoor betaald is, en dat is precies wat je bij
 * de margeregeling moet kunnen laten zien.
 *
 * DE OPZET IS DIE VAN DE FACTURENPAGINA
 * Eén lijst met inklapbare rijen: bovenaan het nummer, de verkoper en het bedrag, en pas
 * als je een rij openklapt zie je de details en de knoppen (afdrukken, PDF, bewerken,
 * verwijderen). Een nieuwe verklaring maak je via de knop rechtsboven, in een apart
 * formulierscherm — precies zoals een nieuwe factuur.
 *
 * HET KENTEKEN DOET HET WERK
 * Merk, model, bouwjaar, kleur, brandstof en APK komen uit het RDW-register, net als bij
 * het toevoegen van een auto. Dat scheelt niet alleen tikwerk: overgetypte chassisnummers
 * en bouwjaren zijn precies waar zo'n document op stukloopt.
 */

type Verklaring = {
  id: string;
  nummer: string;
  datum: string;
  verkoper_naam: string;
  verkoper_adres: string;
  verkoper_postcode: string;
  verkoper_stad: string;
  verkoper_email: string;
  verkoper_telefoon: string;
  verkoper_geboortedatum: string;
  legitimatie_soort: string;
  legitimatie_nummer: string;
  merk: string;
  model: string;
  type: string;
  bouwjaar: string;
  kenteken: string;
  vin: string;
  km: string;
  kleur: string;
  brandstof: string;
  apk: string;
  eerste_toelating: string;
  bedrag: number;
  betaalwijze: string;
  datum_overdracht: string;
  vrijwaringsnummer: string;
  aantal_sleutels: string;
  particulier: boolean;
  meegeleverd: string[];
  bijzonderheden: string;
  aangemaakt: string;
  /** ISO-moment waarop de kopie naar de verkoper is gemaild; leeg = nog niet. */
  gemaild_op?: string;
};

type Formulier = Omit<Verklaring, "id" | "nummer" | "aangemaakt" | "bedrag"> & { bedrag: string };

/** Wat er standaard mee hoort te komen. Aanklikbaar, want het verschilt per auto. */
const MEEGELEVERD = [
  "Kentekenbewijs",
  "Tenaamstellingscode",
  "Onderhoudsboekje",
  "Reservesleutel",
  "Instructieboekje",
  "Winterbanden",
  "Laadkabel",
  "APK-rapport",
];

const vandaag = () => new Date().toLocaleDateString("nl-NL");

const leegFormulier = (): Formulier => ({
  datum: vandaag(),
  verkoper_naam: "",
  verkoper_adres: "",
  verkoper_postcode: "",
  verkoper_stad: "",
  verkoper_email: "",
  verkoper_telefoon: "",
  verkoper_geboortedatum: "",
  legitimatie_soort: "Rijbewijs",
  legitimatie_nummer: "",
  merk: "",
  model: "",
  type: "",
  bouwjaar: "",
  kenteken: "",
  vin: "",
  km: "",
  kleur: "",
  brandstof: "",
  apk: "",
  eerste_toelating: "",
  bedrag: "",
  betaalwijze: "bank",
  datum_overdracht: vandaag(),
  vrijwaringsnummer: "",
  aantal_sleutels: "2",
  particulier: true,
  meegeleverd: ["Kentekenbewijs", "Tenaamstellingscode"],
  bijzonderheden: "",
});

const getalUit = (s: string) => parseInt(String(s).replace(/\D/g, "")) || 0;

/**
 * Het logo als data-URI. Moet ingesloten worden en niet als adres: het document wordt in
 * een kaal iframe gerenderd dat niets van buiten ophaalt. Zelfde aanpak als bij de
 * facturen en het consignatiecontract.
 */
async function haalLogo(): Promise<string> {
  try {
    const res = await fetch(encodeURI("/JG Mobility Transparant.png"));
    if (!res.ok) return "";
    const blob = await res.blob();
    return await new Promise<string>((klaar) => {
      const lezer = new FileReader();
      lezer.onloadend = () => klaar(String(lezer.result ?? ""));
      lezer.onerror = () => klaar("");
      lezer.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

/** Afdrukken via een verborgen iframe — de browser maakt er de PDF van. */
function drukAf(html: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;height:1123px";
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) { frame.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 2000);
  }, 500);
}

async function downloadPdf(html: string, naam: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;height:1123px";
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) { frame.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();
  await new Promise((k) => setTimeout(k, 400));
  const html2pdf = (await import("html2pdf.js")).default;
  await html2pdf()
    .set({
      margin: 0,
      filename: naam,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(doc.body)
    .save();
  frame.remove();
}

/** Rendert het document naar een base64-PDF — dat wordt de mailbijlage. */
async function pdfBase64Van(html: string): Promise<string> {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;height:1123px";
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) { frame.remove(); throw new Error("Render mislukt"); }
  doc.open();
  doc.write(html);
  doc.close();
  await new Promise((k) => setTimeout(k, 400));
  try {
    const html2pdf = (await import("html2pdf.js")).default;
    const dataUri = await html2pdf()
      .set({
        margin: 0,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(doc.body)
      .output("datauristring");
    return (dataUri as string).split(",")[1];
  } finally {
    frame.remove();
  }
}

/** Nummer, verkoper en auto in de bestandsnaam — daar zoek je op in een downloadmap. */
const bestandsnaamVoor = (nummer: string, naam: string, merk: string, model: string) => {
  const delen = ["Inkoopverklaring", nummer || "concept", naam.trim(), [merk, model].filter(Boolean).join(" ").trim()].filter(Boolean);
  return `${delen.join(" ").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim()}.pdf`;
};

export default function InkoopverklaringContent() {
  const { vraag } = useDialoog();
  const [lijst, setLijst] = useState<Verklaring[] | null>(null);
  const [view, setView] = useState<"lijst" | "form">("lijst");
  const [openRij, setOpenRij] = useState<string | null>(null);
  const [gekozenId, setGekozenId] = useState<string | null>(null);
  const [f, setF] = useState<Formulier>(leegFormulier);
  const [zoek, setZoek] = useState("");
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState(false);
  const [rijBezig, setRijBezig] = useState<Record<string, "print" | "pdf" | "mail">>({});
  const [rdwBezig, setRdwBezig] = useState(false);
  const [adresStatus, setAdresStatus] = useState<"stil" | "bezig" | "gevonden" | "onbekend" | "mislukt">("stil");
  /** Welk kenteken al is opgezocht, zodat uit het veld klikken niet elke keer opnieuw vraagt. */
  const laatstOpgezocht = useRef("");

  const zet = <K extends keyof Formulier>(veld: K, waarde: Formulier[K]) => {
    setF((huidig) => ({ ...huidig, [veld]: waarde }));
  };

  const laad = async () => {
    const res = await fetch("/api/admin/inkoopverklaringen").catch(() => null);
    if (res?.ok) setLijst(await res.json());
    else setLijst([]);
  };

  useEffect(() => {
    fetch("/api/admin/inkoopverklaringen")
      .then((r) => (r.ok ? r.json() : []))
      .then(setLijst)
      .catch(() => setLijst([]));
  }, []);

  const gekozen = useMemo(
    () => (gekozenId ? (lijst ?? []).find((v) => v.id === gekozenId) ?? null : null),
    [gekozenId, lijst]
  );

  const zichtbaar = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    return (lijst ?? []).filter(
      (v) =>
        !z ||
        `${v.nummer} ${v.verkoper_naam} ${v.merk} ${v.model} ${v.kenteken}`.toLowerCase().includes(z)
    );
  }, [lijst, zoek]);

  const nieuw = () => {
    setGekozenId(null);
    laatstOpgezocht.current = "";
    setAdresStatus("stil");
    setF(leegFormulier());
    setFout("");
    setView("form");
  };

  const openen = (v: Verklaring) => {
    setGekozenId(v.id);
    setFout("");
    const { id: _id, nummer: _nummer, aangemaakt: _aangemaakt, bedrag, ...rest } = v;
    void _id; void _nummer; void _aangemaakt;
    laatstOpgezocht.current = (v.kenteken ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    setAdresStatus("stil");
    setF({ ...rest, bedrag: bedrag ? String(bedrag) : "", meegeleverd: v.meegeleverd ?? [] });
    setView("form");
  };

  /**
   * Postcode plus huisnummer omzetten naar straat en plaats.
   *
   * Een adres van een rijbewijs overtypen gaat net iets te vaak mis: een straatnaam met
   * een spatie erin, een plaatsnaam met een letter te weinig. Op een bewijsstuk voor de
   * boekhouding is dat geen schoonheidsfoutje, want daar hoort het adres van de verkoper
   * op te kloppen. Zelfde dienst als bij de facturen: PDOK, de open adressendienst van
   * de overheid.
   */
  const zoekAdres = async () => {
    const pc = f.verkoper_postcode.replace(/\s+/g, "").toUpperCase();
    if (!/^[1-9][0-9]{3}[A-Z]{2}$/.test(pc)) return;
    const nummer = f.verkoper_adres.match(/\d+\s*[a-zA-Z]?/)?.[0]?.trim() ?? "";
    setAdresStatus("bezig");
    try {
      const res = await fetch(
        `/api/admin/adres?postcode=${encodeURIComponent(pc)}&nummer=${encodeURIComponent(nummer)}`
      );
      if (!res.ok) { setAdresStatus("mislukt"); return; }
      const d = await res.json();
      if (!d.gevonden) { setAdresStatus("onbekend"); return; }
      setF((huidig) => ({
        ...huidig,
        // Alleen aanvullen wat de dienst zeker weet. Stond er al een huisnummer, dan
        // blijft dat staan: dat weet jij beter dan een register dat op postcode zoekt.
        verkoper_adres: `${d.straat} ${nummer || d.huisnummer}`.trim(),
        verkoper_postcode: d.postcode || huidig.verkoper_postcode,
        verkoper_stad: d.stad || huidig.verkoper_stad,
      }));
      setAdresStatus("gevonden");
    } catch {
      setAdresStatus("mislukt");
    }
  };

  /** Het kenteken doet het werk: merk, bouwjaar, kleur en APK komen uit het RDW-register. */
  const rdwOpzoeken = async () => {
    const kenteken = f.kenteken.trim();
    if (!kenteken || rdwBezig) return;
    laatstOpgezocht.current = kenteken.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    setRdwBezig(true);
    setFout("");
    try {
      const res = await fetch(`/api/admin/rdw-lookup?kenteken=${encodeURIComponent(kenteken)}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.merk) {
        setFout(d.error ?? "Dit kenteken staat niet in het RDW-register.");
        return;
      }
      setF((huidig) => ({
        ...huidig,
        merk: d.merk || huidig.merk,
        model: d.model || huidig.model,
        bouwjaar: d.bouwjaar ? String(d.bouwjaar) : huidig.bouwjaar,
        kleur: d.kleur || huidig.kleur,
        brandstof: d.brandstof || huidig.brandstof,
        apk: d.apkVervaldatum || d.apk || huidig.apk,
        eerste_toelating: d.datumEersteToelatingNL || huidig.eerste_toelating,
        type: huidig.type || [d.vermogen, d.cilinderinhoud ? `${d.cilinderinhoud}L` : ""].filter(Boolean).join(" · "),
      }));
    } catch {
      setFout("Het RDW-register is niet bereikbaar.");
    } finally {
      setRdwBezig(false);
    }
  };

  const opslaan = async () => {
    if (!f.verkoper_naam.trim()) {
      setFout("Vul in ieder geval de naam van de verkoper in — zonder verkoper is het geen inkoopverklaring.");
      return;
    }
    setBezig(true);
    setFout("");
    try {
      const gegevens = { ...f, bedrag: getalUit(f.bedrag) };
      const res = gekozen
        ? await fetch(`/api/admin/inkoopverklaringen/${gekozen.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(gegevens),
          })
        : await fetch("/api/admin/inkoopverklaringen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(gegevens),
          });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFout(d.error ?? "Opslaan mislukt.");
        return;
      }
      await laad();
      // Terug naar de lijst met de zojuist bewaarde rij opengeklapt — dan zie je
      // meteen het resultaat en staan de afdrukknoppen voor je neus.
      const id = d.id ?? gekozen?.id ?? null;
      setGekozenId(null);
      setOpenRij(id);
      setView("lijst");
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    } finally {
      setBezig(false);
    }
  };

  const verwijderRij = async (v: Verklaring) => {
    const akkoord = await vraag({
      titel: `Inkoopverklaring ${v.nummer} verwijderen?`,
      tekst:
        `${v.verkoper_naam} · ${[v.merk, v.model].filter(Boolean).join(" ")}\n\n` +
        "Dit is een bewijsstuk voor je boekhouding. Weg is weg, en het nummer komt niet terug.",
      bevestig: "Verwijderen",
      gevaar: true,
    });
    if (!akkoord) return;
    await fetch(`/api/admin/inkoopverklaringen/${v.id}`, { method: "DELETE" });
    if (openRij === v.id) setOpenRij(null);
    await laad();
  };

  /** Het document van een bewaarde rij — origineel + kopie in één printtaak. */
  const htmlVanRij = async (v: Verklaring) => {
    const logo = await haalLogo();
    return genereerInkoopverklaringHTML({ ...v }, logo);
  };

  const afdrukkenRij = async (v: Verklaring) => {
    setRijBezig((p) => ({ ...p, [v.id]: "print" }));
    try { drukAf(await htmlVanRij(v)); }
    finally { setTimeout(() => setRijBezig((p) => { const n = { ...p }; delete n[v.id]; return n; }), 1200); }
  };

  const pdfRij = async (v: Verklaring) => {
    setRijBezig((p) => ({ ...p, [v.id]: "pdf" }));
    try { await downloadPdf(await htmlVanRij(v), bestandsnaamVoor(v.nummer, v.verkoper_naam, v.merk, v.model)); }
    finally { setRijBezig((p) => { const n = { ...p }; delete n[v.id]; return n; }); }
  };

  /**
   * Mailt de verklaring (kopie-exemplaar) met een automatisch begeleidend bericht
   * naar de verkoper. De kopie met watermerk is de bijlage: het origineel blijft
   * bij JG voor de administratie.
   */
  const mailRij = async (v: Verklaring) => {
    if (rijBezig[v.id]) return;
    if (!v.verkoper_email) {
      await vraag({
        titel: "Geen e-mailadres",
        tekst: "Deze verkoper heeft geen e-mailadres. Vul dat eerst in via Bewerken (potlood).",
        bevestig: "Begrepen",
      });
      return;
    }
    if (v.gemaild_op) {
      const wanneer = new Date(v.gemaild_op).toLocaleString("nl-NL");
      const opnieuw = await vraag({
        titel: "Al gemaild",
        tekst: `Deze inkoopverklaring is al op ${wanneer} naar ${v.verkoper_email} gemaild. Wil je hem echt nóg een keer versturen?`,
        bevestig: "Ja, verstuur opnieuw",
      });
      if (!opnieuw) return;
      await fetch(`/api/admin/inkoopverklaringen/${v.id}/mail`, { method: "DELETE" }).catch(() => null);
    }
    const door = await vraag({
      titel: "Inkoopverklaring mailen naar de verkoper?",
      tekst: `Het kopie-exemplaar van ${v.nummer} wordt met een begeleidend bericht als PDF naar ${v.verkoper_email} gestuurd.`,
      bevestig: "Ja, verstuur",
    });
    if (!door) return;
    setRijBezig((p) => ({ ...p, [v.id]: "mail" }));
    try {
      const logo = await haalLogo();
      // De bijlage is de KOPIE met watermerk: het origineel blijft bij JG.
      const html = genereerInkoopverklaringHTML({ ...v }, logo, { alleen: "kopie" });
      const pdfBase64 = await pdfBase64Van(html);
      const res = await fetch(`/api/admin/inkoopverklaringen/${v.id}/mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64 }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Versturen mislukt");
      await laad();
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    } finally {
      setRijBezig((p) => { const n = { ...p }; delete n[v.id]; return n; });
    }
  };

  /** Het document zoals het formulier er nu bij staat — ook vóór het bewaren. */
  const maakHtml = async () => {
    const logo = await haalLogo();
    return genereerInkoopverklaringHTML(
      { ...f, nummer: gekozen?.nummer ?? "CONCEPT", bedrag: getalUit(f.bedrag) },
      logo
    );
  };

  const afdrukken = async () => drukAf(await maakHtml());
  const pdf = async () => {
    await downloadPdf(await maakHtml(), bestandsnaamVoor(gekozen?.nummer ?? "concept", f.verkoper_naam, f.merk, f.model));
  };

  const bedrag = getalUit(f.bedrag);
  const woorden = inWoorden(bedrag);

  const invoer = (
    label: string,
    veld: keyof Formulier,
    opties: { plaats?: string; hint?: string; breed?: boolean } = {}
  ) => (
    <div className={opties.breed ? "sm:col-span-2" : ""}>
      <Field label={label} hint={opties.hint}>
        <input
          type="text"
          value={String(f[veld] ?? "")}
          onChange={(e) => zet(veld, e.target.value as Formulier[typeof veld])}
          placeholder={opties.plaats}
          style={inputStijl}
        />
      </Field>
    </div>
  );

  // ── De vaste kop: titel links, de hoofdknop rechts (zelfde plek als bij Facturen) ──
  const kop = (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 xl:px-8"
      style={{ height: 56, backgroundColor: T.paper, borderBottom: `1px solid ${T.line2}` }}
    >
      <Receipt size={15} style={{ color: T.ink(0.35), flexShrink: 0 }} />
      <h2
        className="min-w-0 truncate text-[17px] sm:text-[19px]"
        style={{ fontFamily: T.play, fontWeight: 700, color: T.navy }}
      >
        Inkoopverklaring
      </h2>
      <span className="hidden md:block flex-shrink-0" style={{ width: 1, height: 16, backgroundColor: T.line2 }} />
      <p className="hidden md:block min-w-0 truncate" style={micro(T.ink(0.35))}>
        {view === "form"
          ? (gekozen ? `Bewerken: ${gekozen.nummer}` : "Nieuwe verklaring")
          : "Bewijsstuk bij inkoop van een particulier"}
      </p>
      <div className="ml-auto flex items-center gap-2">
        {view === "form" ? (
          <Btn variant="ghost" size="sm" onClick={() => { setView("lijst"); setGekozenId(null); setFout(""); }}>
            ← Overzicht
          </Btn>
        ) : (
          <button
            type="button"
            onClick={nieuw}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: T.navy, color: "#ffffff", fontFamily: T.inter }}
          >
            <Plus size={12} /> Nieuwe verklaring
          </button>
        )}
      </div>
    </header>
  );

  // ── Lijstweergave: inklapbare rijen, zoals de facturenpagina ──
  if (view === "lijst") {
    return (
      <div style={{ backgroundColor: T.wash, minHeight: "100%" }}>
        {kop}
        <div className="px-4 md:px-6 xl:px-8 py-4 md:py-6" style={{ maxWidth: 1240, margin: "0 auto" }}>
          {fout && <div className="mb-4"><Foutmelding>{fout}</Foutmelding></div>}

          {/* Zoekbalk */}
          {(lijst?.length ?? 0) > 0 && (
            <div className="relative mb-4" style={{ maxWidth: 360 }}>
              <Search
                size={13}
                color={T.ink(0.3)}
                style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              />
              <input
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
                placeholder="Zoek op nummer, naam of kenteken…"
                style={{ ...inputStijl, padding: "8px 10px 8px 28px", fontSize: 12.5, backgroundColor: T.paper }}
              />
            </div>
          )}

          {lijst === null ? (
            <div className="flex justify-center py-24"><Spinner size={22} /></div>
          ) : lijst.length === 0 ? (
            <Empty
              icon={<Receipt size={30} style={{ color: T.ink(0.2) }} />}
              title="Nog geen inkoopverklaringen"
              body="Maak de eerste aan via de knop rechtsboven. Je krijgt een nummer (INK-2026-001) en kunt het document afdrukken of als PDF opslaan om te laten ondertekenen."
            />
          ) : zichtbaar.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20" style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}>
              <p className="text-sm font-semibold" style={{ color: T.navy, fontFamily: T.play }}>Niets gevonden</p>
              <p className="text-xs mt-1" style={{ color: T.ink(0.4), fontFamily: T.inter }}>Probeer een andere zoekterm.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {zichtbaar.map((v) => {
                const isOpen = openRij === v.id;
                const voertuig = [v.merk, v.model, v.bouwjaar].filter(Boolean).join(" ");
                return (
                  <div key={v.id} style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}>
                    {/* Rijkop: nummer · verkoper + badge, bedrag rechts. Klik = open/dicht. */}
                    <button
                      onClick={() => setOpenRij(isOpen ? null : v.id)}
                      className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all hover:bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="text-sm font-bold" style={{ color: T.navy, fontFamily: T.play }}>
                            {v.nummer} · {v.verkoper_naam || "Naamloos"}
                          </p>
                          <span
                            className="text-[10px] px-2 py-0.5 font-semibold"
                            style={{
                              backgroundColor: v.particulier ? "#f1f5f9" : "#dbeafe",
                              color: v.particulier ? "#64748b" : "#1d4ed8",
                              fontFamily: T.inter,
                            }}
                          >
                            {v.particulier ? "Particulier" : "Bedrijf"}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: T.ink(0.45), fontFamily: T.inter }}>
                          {voertuig}
                          {v.kenteken ? ` · ${v.kenteken.toUpperCase()}` : ""}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold" style={{ fontFamily: T.play, color: T.navy }}>
                          {v.bedrag ? fmt(v.bedrag) : "—"}
                        </p>
                        <p className="text-[10px]" style={{ color: T.ink(0.35), fontFamily: T.inter }}>
                          {v.datum} · {v.betaalwijze === "contant" ? "Contant" : v.betaalwijze === "inruil" ? "Inruil" : "Bank"}
                        </p>
                      </div>
                      <span className="text-xs ml-2 flex-shrink-0" style={{ color: T.ink(0.3) }}>
                        {isOpen ? "▲" : "▼"}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5" style={{ borderTop: `1px solid ${T.line2}` }}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                          {/* Links: de details, zelfde tabelvorm als bij een factuur */}
                          <div>
                            <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: T.ink(0.4), fontFamily: T.inter }}>
                              Details
                            </p>
                            <table className="w-full text-xs" style={{ fontFamily: T.inter }}>
                              <tbody>
                                {([
                                  ["Verkoper", v.verkoper_naam],
                                  ["Adres", [v.verkoper_adres, v.verkoper_postcode, v.verkoper_stad].filter(Boolean).join(", ")],
                                  ["E-mail", v.verkoper_email],
                                  ["Telefoon", v.verkoper_telefoon],
                                  ["Legitimatie", [v.legitimatie_soort, v.legitimatie_nummer].filter(Boolean).join(" · ")],
                                  ["Voertuig", voertuig],
                                  ["Kenteken", v.kenteken?.toUpperCase()],
                                  ["Chassisnummer", v.vin],
                                  ["KM-stand", v.km ? `${parseInt(v.km).toLocaleString("nl-NL")} km` : ""],
                                  ["Overdracht", v.datum_overdracht],
                                  ["Vrijwaring", v.vrijwaringsnummer],
                                  ["Meegeleverd", (v.meegeleverd ?? []).join(", ")],
                                ] as [string, string][])
                                  .filter(([, w]) => w)
                                  .map(([label, waarde]) => (
                                    <tr key={label}>
                                      <td className="py-1 pr-3 align-top" style={{ color: T.ink(0.45), width: "110px" }}>{label}</td>
                                      <td className="py-1 font-semibold" style={{ color: T.navy }}>{waarde}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                            {v.bijzonderheden && (
                              <div className="mt-3 p-3 text-xs" style={{ backgroundColor: "rgba(0,19,55,0.03)", border: `1px solid ${T.line}`, color: T.ink(0.65), fontFamily: T.inter, lineHeight: 1.6 }}>
                                {v.bijzonderheden}
                              </div>
                            )}
                          </div>

                          {/* Rechts: het document en de acties, zelfde knoppenrij als bij een factuur */}
                          <div>
                            <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: T.ink(0.4), fontFamily: T.inter }}>
                              Document
                            </p>
                            <p className="text-xs mb-4" style={{ color: T.ink(0.55), fontFamily: T.inter, lineHeight: 1.6 }}>
                              Afdrukken levert twee vellen in één printtaak: een origineel voor de
                              verkoper en een kopie met watermerk voor je eigen administratie. Het
                              bedrag staat er in cijfers én voluit op, met de handtekeningvelden.
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Hoofdactie: afdrukken levert origineel + kopie */}
                              <button
                                onClick={() => afdrukkenRij(v)}
                                disabled={!!rijBezig[v.id]}
                                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0"
                                style={{ backgroundColor: T.navy, fontFamily: T.inter, borderRadius: "var(--radius-control)", boxShadow: "0 6px 16px -8px rgba(0,19,55,0.5)" }}
                                title="Print een origineel (voor de verkoper) én een kopie (voor onze administratie)"
                              >
                                <Printer size={14} />
                                {rijBezig[v.id] === "print" ? "Voorbereiden..." : "Afdrukken"}
                                <span className="hidden sm:inline opacity-60 font-normal">· origineel + kopie</span>
                              </button>

                              <button
                                onClick={() => pdfRij(v)}
                                disabled={!!rijBezig[v.id]}
                                className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0"
                                style={{
                                  backgroundColor: T.paper,
                                  color: "#334155",
                                  border: `1px solid ${T.line}`,
                                  fontFamily: T.inter,
                                  borderRadius: "var(--radius-control)",
                                }}
                              >
                                <Download size={14} />
                                {rijBezig[v.id] === "pdf" ? "PDF maken..." : "PDF"}
                              </button>

                              <button
                                onClick={() => mailRij(v)}
                                disabled={!!rijBezig[v.id]}
                                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0"
                                style={{ backgroundColor: v.gemaild_op ? "#15803d" : "#1d4ed8", fontFamily: T.inter, borderRadius: "var(--radius-control)", boxShadow: "0 6px 16px -8px rgba(29,78,216,0.5)" }}
                                title="Mail het kopie-exemplaar met een begeleidend bericht naar de verkoper"
                              >
                                <Send size={14} />
                                {rijBezig[v.id] === "mail" ? "Versturen..." : v.gemaild_op ? "Verstuurd" : "Verstuur verklaring"}
                              </button>

                              {/* Rechts, apart: bewerken (potlood) en verwijderen (prullenbak) */}
                              <div className="flex items-center gap-1.5 ml-auto">
                                <button
                                  onClick={() => openen(v)}
                                  aria-label="Verklaring bewerken"
                                  title="Bewerken"
                                  className="inline-flex items-center justify-center transition-all duration-150 hover:-translate-y-0.5"
                                  style={{ width: 38, height: 38, color: T.navy, backgroundColor: T.paper, border: `1px solid ${T.line}`, borderRadius: "var(--radius-control)" }}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  onClick={() => verwijderRij(v)}
                                  aria-label="Verklaring verwijderen"
                                  title="Verwijderen"
                                  className="inline-flex items-center justify-center transition-all duration-150 hover:-translate-y-0.5"
                                  style={{ width: 38, height: 38, color: T.rood, backgroundColor: T.paper, border: "1px solid #fecaca", borderRadius: "var(--radius-control)" }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                            {v.gemaild_op && (
                              <p className="mt-2.5 text-[11px] font-medium" style={{ color: "#15803d", fontFamily: T.inter }}>
                                ✓ Gemaild op {new Date(v.gemaild_op).toLocaleString("nl-NL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} naar {v.verkoper_email}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Formulier: nieuwe verklaring of bewerken (apart scherm, zoals "Nieuwe factuur") ──
  return (
    <div style={{ backgroundColor: T.wash, minHeight: "100%" }}>
      {kop}
      <div className="px-4 md:px-6 xl:px-8 py-4 md:py-6" style={{ maxWidth: 920, margin: "0 auto" }}>
        <div className="flex flex-col gap-4">
          {fout && <Foutmelding>{fout}</Foutmelding>}

          <Panel
            title={gekozen ? `Verklaring ${gekozen.nummer}` : "Nieuwe inkoopverklaring"}
            icon={<Receipt size={13} style={{ color: T.ink(0.35) }} />}
            meta={gekozen ? undefined : "nog niet bewaard"}
            actions={
              <div className="flex items-center gap-2">
                <Btn size="sm" onClick={opslaan} disabled={bezig}>
                  {bezig ? <Spinner size={11} tone="donker" /> : <Check size={11} />}
                  {gekozen ? "Bijwerken" : "Opslaan"}
                </Btn>
                <Btn variant="ghost" size="sm" onClick={pdf}>
                  <Download size={11} /> PDF
                </Btn>
                <Btn variant="ghost" size="sm" onClick={afdrukken}>
                  <Printer size={11} /> Afdrukken
                </Btn>
              </div>
            }
          >
            {/* ── De verkoper ── */}
            <p className="mb-2" style={{ ...micro(), fontSize: 9 }}>De verkoper</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {invoer("Naam", "verkoper_naam", { plaats: "Voor- en achternaam", breed: true })}
              {invoer("Telefoon", "verkoper_telefoon", { plaats: "+31 6 …" })}

              {/* Adres, postcode en plaats op één regel: zo typ je een adres ook. */}
              <div>
                <Field label="Adres" hint="Huisnummer is genoeg">
                  <input
                    type="text"
                    value={f.verkoper_adres}
                    onChange={(e) => zet("verkoper_adres", e.target.value)}
                    // Staat er alleen een huisnummer, dan haalt hij de straat erbij.
                    // Staat er al een straatnaam, dan blijft die staan: dan weet jij het beter.
                    onBlur={() => { if (!/[a-zA-Z]{3}/.test(f.verkoper_adres)) zoekAdres(); }}
                    placeholder="Straat en huisnummer"
                    style={inputStijl}
                  />
                </Field>
              </div>
              <div>
                <Field
                  label="Postcode"
                  hint={
                    adresStatus === "bezig"
                      ? "Adres opzoeken…"
                      : adresStatus === "gevonden"
                        ? "Straat en plaats opgehaald"
                        : adresStatus === "onbekend"
                          ? "Staat niet in het register — vul zelf in"
                          : adresStatus === "mislukt"
                            ? "Adressendienst onbereikbaar — vul zelf in"
                            : "Vult straat en plaats in"
                  }
                  hintColor={
                    adresStatus === "gevonden"
                      ? T.groen
                      : adresStatus === "mislukt" || adresStatus === "onbekend"
                        ? T.amber
                        : undefined
                  }
                >
                  <input
                    type="text"
                    value={f.verkoper_postcode}
                    onChange={(e) => { zet("verkoper_postcode", e.target.value.toUpperCase()); setAdresStatus("stil"); }}
                    onBlur={zoekAdres}
                    onKeyDown={(e) => e.key === "Enter" && zoekAdres()}
                    placeholder="1234 AB"
                    style={inputStijl}
                  />
                </Field>
              </div>
              {invoer("Plaats", "verkoper_stad")}

              {invoer("E-mail", "verkoper_email", { breed: true })}
              {invoer("Geboortedatum", "verkoper_geboortedatum", { plaats: "01-01-1980" })}

              <div>
                <p className="mb-1.5" style={micro()}>Legitimatie</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["Rijbewijs", "Paspoort", "ID-kaart"].map((soort) => (
                    <Chip key={soort} active={f.legitimatie_soort === soort} onClick={() => zet("legitimatie_soort", soort)}>
                      {soort}
                    </Chip>
                  ))}
                </div>
              </div>
              {invoer("Documentnummer", "legitimatie_nummer", {
                breed: true,
                hint: "Alleen dit nummer komt op het document — de soort zonder nummer zegt niets",
              })}
            </div>

            {/* ── Het voertuig ── */}
            <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${T.line2}` }}>
              <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                <p style={{ ...micro(), fontSize: 9 }}>Het voertuig</p>
                <span style={klein()}>vult zichzelf zodra je het kenteken invult</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <div>
                  <Field label="Kenteken">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={f.kenteken}
                        onChange={(e) => zet("kenteken", e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && rdwOpzoeken()}
                        // Uit het veld klikken is genoeg: een kenteken tik je in een keer
                        // in, en dan hoort de rest er te staan zonder dat je nog ergens op
                        // moet drukken. Alleen bij een ander kenteken dan wat er al
                        // opgezocht is, anders vraagt elke muisklik het opnieuw.
                        onBlur={(e) => {
                          const kaal = e.target.value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
                          if (kaal.length >= 6 && kaal !== laatstOpgezocht.current) rdwOpzoeken();
                        }}
                        placeholder="AB-123-C"
                        style={{
                          ...inputStijl,
                          fontFamily: T.play,
                          fontSize: 16,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textAlign: "center",
                        }}
                      />
                      <Btn variant="ghost" size="sm" onClick={rdwOpzoeken} disabled={rdwBezig || !f.kenteken.trim()}>
                        {rdwBezig ? <Spinner size={11} /> : <Car size={11} />} RDW
                      </Btn>
                    </div>
                  </Field>
                </div>
                {invoer("Chassisnummer (VIN)", "vin", { plaats: "17 tekens", breed: true })}

                {invoer("Merk", "merk")}
                {invoer("Model", "model")}
                {invoer("Type / uitvoering", "type", { plaats: "150 pk · 2.0L" })}

                {invoer("Bouwjaar", "bouwjaar")}
                {invoer("1e toelating", "eerste_toelating")}
                {invoer("Kilometerstand", "km", { plaats: "145000" })}

                {invoer("Brandstof", "brandstof")}
                {invoer("Kleur", "kleur")}
                {invoer("APK tot", "apk")}
              </div>
            </div>

            {/* ── De koop ── */}
            <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${T.line2}` }}>
              <p className="mb-2" style={{ ...micro(), fontSize: 9 }}>De koop</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <div>
                  <Field label="Inkoopbedrag" suffix="€" hint={woorden ? `zegge: ${woorden}` : "Wat je werkelijk betaalt"}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={f.bedrag}
                      onChange={(e) => zet("bedrag", e.target.value)}
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
                <div className="sm:col-span-2">
                  <p className="mb-1.5" style={micro()}>Betaalwijze</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: "bank", label: "Bankoverschrijving" },
                      { id: "contant", label: "Contant" },
                      { id: "inruil", label: "Verrekend met inruil" },
                    ].map((keuze) => (
                      <Chip key={keuze.id} active={f.betaalwijze === keuze.id} onClick={() => zet("betaalwijze", keuze.id)}>
                        {keuze.label}
                      </Chip>
                    ))}
                  </div>
                  <p className="mt-2" style={klein()}>
                    Contant boven de € 3.000 valt op bij een controle; een overschrijving is altijd het
                    makkelijkst te verantwoorden.
                  </p>
                </div>

                {invoer("Datum overeenkomst", "datum")}
                {invoer("Datum overdracht", "datum_overdracht")}
                {invoer("Vrijwaringsbewijs", "vrijwaringsnummer", { plaats: "Nummer op het bewijs" })}

                {invoer("Aantal sleutels", "aantal_sleutels")}
                <div className="sm:col-span-2">
                  <p className="mb-1.5" style={micro()}>Van wie koop je</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Chip active={f.particulier} onClick={() => zet("particulier", true)}>
                      Particulier (margeregeling)
                    </Chip>
                    <Chip active={!f.particulier} onClick={() => zet("particulier", false)}>
                      Bedrijf (met btw-factuur)
                    </Chip>
                  </div>
                  <p className="mt-2" style={klein()}>
                    {f.particulier
                      ? "De verkoper verklaart mee dat hij geen btw in aftrek heeft gebracht — precies de zin die je nodig hebt voor de margeregeling."
                      : "Bij een ondernemer is diens factuur je bewijsstuk voor de btw; deze verklaring legt dan alleen de koop en de overdracht vast."}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Meegeleverd en bijzonderheden ── */}
            <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${T.line2}` }}>
              <p className="mb-1.5" style={micro()}>Meegeleverd</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {MEEGELEVERD.map((m) => {
                  const aan = f.meegeleverd.includes(m);
                  return (
                    <Chip
                      key={m}
                      active={aan}
                      onClick={() =>
                        zet("meegeleverd", aan ? f.meegeleverd.filter((x) => x !== m) : [...f.meegeleverd, m])
                      }
                    >
                      {m}
                    </Chip>
                  );
                })}
              </div>

              <div className="mt-4">
                <Field
                  label="Bijzonderheden"
                  hint="Bekende schade, gebreken of afspraken. Wat hier staat, staat ook op het document."
                >
                  <textarea
                    value={f.bijzonderheden}
                    onChange={(e) => zet("bijzonderheden", e.target.value)}
                    placeholder="Bijvoorbeeld: kras op achterbumper, distributieriem vervangen op 120.000 km"
                    style={{ ...inputStijl, minHeight: 80, resize: "vertical", lineHeight: 1.6 }}
                  />
                </Field>
              </div>
            </div>
          </Panel>

          {/* Samenvatting van wat er op papier komt */}
          <Panel title="Wat er op het document komt">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  ["Verkoper", f.verkoper_naam || "—"],
                  ["Auto", [f.merk, f.model].filter(Boolean).join(" ") || "—"],
                  ["Kenteken", f.kenteken || "—"],
                  ["Bedrag", bedrag > 0 ? fmt(bedrag) : "—"],
                ] as [string, string][]
              ).map(([l, w]) => (
                <div key={l} className="p-2.5" style={{ backgroundColor: "rgba(0,19,55,0.02)", border: `1px solid ${T.line}` }}>
                  <p className="truncate" style={{ ...micro(), fontSize: 8.5 }}>{l}</p>
                  <p className="mt-1 truncate" style={{ fontFamily: T.inter, fontSize: 12.5, fontWeight: 700, color: T.navy }}>
                    {w}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3" style={body(12, T.ink(0.6))}>
              Op het document staan verder de verklaringen die de verkoper ondertekent: dat hij eigenaar
              is en de auto vrij is van financiering of beslag, dat de kilometerstand klopt, wat er wordt
              meegeleverd, en — bij een particulier — dat er geen btw in aftrek is gebracht. Plus twee
              handtekeningvelden en het bedrag voluit geschreven.
            </p>
            <p className="mt-2" style={klein()}>
              De tekst is met zorg opgesteld maar niet fiscaal getoetst. Laat hem één keer nakijken door
              je boekhouder voordat je hem structureel gebruikt.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

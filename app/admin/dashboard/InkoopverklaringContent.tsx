"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Receipt, Printer, Download, Search, Check, Plus, Trash2, Car, Spline } from "lucide-react";
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
 * Het werd tot nu toe met de hand gedaan. Hier vul je het één keer in, komt het er in
 * dezelfde opmaak uit als de facturen, en blijft het bewaard met een eigen nummer zodat je
 * er over twee jaar nog bij kunt.
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

export default function InkoopverklaringContent() {
  const { vraag } = useDialoog();
  const [lijst, setLijst] = useState<Verklaring[] | null>(null);
  const [gekozenId, setGekozenId] = useState<string | null>(null);
  const [f, setF] = useState<Formulier>(leegFormulier);
  const [zoek, setZoek] = useState("");
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState(false);
  const [rdwBezig, setRdwBezig] = useState(false);
  const [adresStatus, setAdresStatus] = useState<"stil" | "bezig" | "gevonden" | "onbekend" | "mislukt">("stil");
  const [bewaardOp, setBewaardOp] = useState<string | null>(null);
  /** Welk kenteken al is opgezocht, zodat uit het veld klikken niet elke keer opnieuw vraagt. */
  const laatstOpgezocht = useRef("");

  const zet = <K extends keyof Formulier>(veld: K, waarde: Formulier[K]) => {
    setF((huidig) => ({ ...huidig, [veld]: waarde }));
    setBewaardOp(null);
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
    setBewaardOp(null);
    setFout("");
  };

  const openen = (v: Verklaring) => {
    setGekozenId(v.id);
    setBewaardOp(null);
    setFout("");
    const { id: _id, nummer: _nummer, aangemaakt: _aangemaakt, bedrag, ...rest } = v;
    void _id; void _nummer; void _aangemaakt;
    laatstOpgezocht.current = (v.kenteken ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    setAdresStatus("stil");
    setF({ ...rest, bedrag: bedrag ? String(bedrag) : "", meegeleverd: v.meegeleverd ?? [] });
  };

  /**
   * Postcode plus huisnummer omzetten naar straat en plaats.
   *
   * Een adres van een rijbewijs overtypen gaat net iets te vaak mis: een straatnaam met
   * een spatie erin, een plaatsnaam met een letter te weinig. Op een bewijsstuk voor de
   * boekhouding is dat geen schoonheidsfoutje, want daar hoort het adres van de verkoper
   * op te kloppen. Zelfde dienst als bij de facturen: PDOK, de open adressendienst van
   * de overheid.
   *
   * Het huisnummer komt uit wat er al in het adresveld staat, want daar typ je het toch
   * in. Levert het niets op, dan gebeurt er niets en typ je het zelf.
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
      setBewaardOp(null);
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
      setBewaardOp(null);
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
      setGekozenId(d.id ?? gekozen?.id ?? null);
      setBewaardOp(new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    } finally {
      setBezig(false);
    }
  };

  const verwijder = async () => {
    if (!gekozen) return;
    const akkoord = await vraag({
      titel: `Inkoopverklaring ${gekozen.nummer} verwijderen?`,
      tekst:
        `${gekozen.verkoper_naam} · ${[gekozen.merk, gekozen.model].filter(Boolean).join(" ")}\n\n` +
        "Dit is een bewijsstuk voor je boekhouding. Weg is weg, en het nummer komt niet terug.",
      bevestig: "Verwijderen",
      gevaar: true,
    });
    if (!akkoord) return;
    await fetch(`/api/admin/inkoopverklaringen/${gekozen.id}`, { method: "DELETE" });
    await laad();
    nieuw();
  };

  /** Het document zoals het er nu uitziet — ook voor een verklaring die nog niet bewaard is. */
  const maakHtml = async () => {
    const logo = await haalLogo();
    return genereerInkoopverklaringHTML(
      { ...f, nummer: gekozen?.nummer ?? "CONCEPT", bedrag: getalUit(f.bedrag) },
      logo
    );
  };

  const afdrukken = async () => drukAf(await maakHtml());

  /**
   * De naam van het bestand.
   *
   * Nummer, verkoper en auto, in die volgorde. In een map met downloads zoek je op de
   * naam van de persoon — niet op INK-2026-007 — en dan wil je hem in de bestandsnaam
   * zien staan zonder het document te hoeven openen. Dezelfde vorm als het
   * consignatiecontract: spaties, geen streepjes.
   *
   * Tekens die een bestandsnaam niet mag bevatten gaan eruit; een naam als "J. de
   * Vries/Jansen" zou anders een map aanmaken of de download laten mislukken.
   */
  const bestandsnaam = () => {
    const delen = [
      "Inkoopverklaring",
      gekozen?.nummer ?? "concept",
      f.verkoper_naam.trim(),
      [f.merk, f.model].filter(Boolean).join(" ").trim(),
    ].filter(Boolean);
    return `${delen.join(" ").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim()}.pdf`;
  };

  const pdf = async () => {
    await downloadPdf(await maakHtml(), bestandsnaam());
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

  return (
    <div style={{ backgroundColor: T.wash, minHeight: "100%" }}>
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
          Bewijsstuk bij inkoop van een particulier
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Btn variant="ghost" size="sm" onClick={nieuw}>
            <Plus size={12} /> Nieuwe verklaring
          </Btn>
        </div>
      </header>

      {/* Begrensde breedte: op een breed scherm werden korte velden als postcode
          balken van een halve meter, en dan zie je niet meer welk vak bij welk label
          hoort. */}
      <div className="px-4 md:px-6 xl:px-8 py-4 md:py-6" style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div className="flex flex-col xl:flex-row gap-4 items-start">
          {/* ── Bewaarde verklaringen ── */}
          <div className="w-full xl:w-[300px] xl:flex-none xl:sticky" style={{ top: 72 }}>
            <Panel title="Bewaard" meta={lijst ? `${lijst.length}` : undefined}>
              <div className="relative mb-3">
                <Search
                  size={13}
                  color={T.ink(0.3)}
                  style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                />
                <input
                  value={zoek}
                  onChange={(e) => setZoek(e.target.value)}
                  placeholder="Zoek op naam of kenteken…"
                  style={{ ...inputStijl, padding: "7px 10px 7px 28px", fontSize: 12.5 }}
                />
              </div>

              {lijst === null ? (
                <div className="flex justify-center py-8"><Spinner size={18} /></div>
              ) : zichtbaar.length === 0 ? (
                <p style={klein()}>
                  {lijst.length === 0
                    ? "Nog geen verklaringen. Vul rechts de gegevens in en druk op Opslaan."
                    : "Niets gevonden."}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
                  {zichtbaar.map((v) => {
                    const actief = v.id === gekozenId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => openen(v)}
                        className="text-left transition-all hover:opacity-85"
                        style={{
                          padding: "9px 11px",
                          backgroundColor: actief ? T.navy : T.paper,
                          border: `1px solid ${actief ? T.navy : T.line}`,
                        }}
                      >
                        <span
                          className="block truncate"
                          style={{
                            fontFamily: T.inter,
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: actief ? "#ffffff" : T.navy,
                          }}
                        >
                          {[v.merk, v.model].filter(Boolean).join(" ") || "Zonder auto"}
                        </span>
                        <span
                          className="block truncate"
                          style={{ fontFamily: T.inter, fontSize: 10.5, color: actief ? "rgba(255,255,255,0.6)" : T.ink(0.45) }}
                        >
                          {v.nummer} · {v.verkoper_naam || "—"}
                        </span>
                        <span
                          className="block truncate"
                          style={{ fontFamily: T.inter, fontSize: 10.5, color: actief ? "rgba(255,255,255,0.45)" : T.ink(0.35) }}
                        >
                          {[v.kenteken, v.bedrag ? fmt(v.bedrag) : "", v.datum].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          {/* ── Het formulier ── */}
          <div className="flex-1 min-w-0 w-full flex flex-col gap-4">
            {fout && <Foutmelding>{fout}</Foutmelding>}

            <Panel
              title={gekozen ? `Verklaring ${gekozen.nummer}` : "Nieuwe inkoopverklaring"}
              icon={<Receipt size={13} style={{ color: T.ink(0.35) }} />}
              meta={bewaardOp ? `bewaard om ${bewaardOp}` : gekozen ? undefined : "nog niet bewaard"}
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
                  {gekozen && (
                    <button
                      type="button"
                      onClick={verwijder}
                      aria-label="Verwijderen"
                      className="px-2 py-1.5 transition-all hover:opacity-70"
                      style={{ border: "1px solid rgba(185,28,28,0.25)", color: T.rood }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              }
            >
              {/* De verkoper */}
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
            <Panel title="Wat er op het document komt" icon={<Spline size={13} style={{ color: T.ink(0.35) }} />}>
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

        {lijst !== null && lijst.length === 0 && !gekozen && (
          <div className="mt-4">
            <Empty
              compact
              icon={<Receipt size={26} style={{ color: T.ink(0.2) }} />}
              title="Nog geen inkoopverklaringen"
              body="Vul het formulier in en druk op Opslaan. Je krijgt dan een nummer (INK-2026-001) en kunt het document als PDF opslaan of meteen afdrukken om te laten ondertekenen."
            />
          </div>
        )}
      </div>
    </div>
  );
}

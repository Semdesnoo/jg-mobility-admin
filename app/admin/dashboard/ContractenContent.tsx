"use client";

import { useState, useEffect, useMemo } from "react";
import { FileSignature, Printer, Download, Search, Check, AlertTriangle, Send, X, Pencil, Trash2 } from "lucide-react";
import {
  T, micro, klein, Field, inputStijl, Spinner, Empty, Foutmelding,
} from "./inkoop/ui";
import { genereerContractHTML, type ContractGegevens } from "@/lib/consignatie-contract";
import { useDialoog } from "./Dialoog";

/**
 * Consignatiecontracten.
 *
 * WAAROM DIT ER IS
 * Er stond een auto van iemand anders op het terrein, maandenlang, met vreemden die er
 * proefritten in reden en straks geld van een koper dat via JG naar de eigenaar gaat — en
 * daar lag niets over op papier. Niet over de vergoeding, niet over hoe lang, niet over
 * wat er gebeurt als hij blijft staan, en niet over wie waarvoor aansprakelijk is.
 *
 * DE OPZET IS DIE VAN DE FACTURENPAGINA
 * Eén lijst met inklapbare rijen: bovenaan de auto, de eigenaar en de vraagprijs, en pas
 * als je een rij openklapt zie je links de details en rechts de afspraken en de knoppen.
 * Het document zelf komt uit dezelfde koker als de factuur die dezelfde klant later
 * krijgt — zelfde balk, zelfde logo, zelfde adresblok.
 */

type Cosignatie = {
  id: string;
  datum: string;
  naam: string; email: string; telefoon: string;
  merk: string; model: string; bouwjaar: string; km: string; vraagprijs: string;
  kleur?: string; brandstof?: string;
  status: string;
  geaccepteerd_op?: string;
  kenteken?: string; vin?: string;
  klant_adres?: string; klant_postcode?: string; klant_stad?: string;
  bodemprijs?: number; fee_percentage?: number; fee_vast?: number;
  looptijd_maanden?: number; uitbetaling_dagen?: number;
  terugname_kosten?: number;
  bijzondere_afspraken?: string;
  contract_nr?: string; contract_op?: string;
  contract_gemaild_op?: string | null;
};

/**
 * De vaste voorwaarden van JG Mobility. Dit zijn geen verzonnen standaarden maar wat er in
 * de praktijk wordt afgesproken, dus een nieuw contract staat meteen goed en er hoeft
 * alleen iets aangepast te worden als er van wordt afgeweken.
 */
const STANDAARD = { fee: 10, looptijd: 6, uitbetaling: 0, terugname: 50 } as const;

const getal = (w: unknown) => Number(String(w ?? "").replace(/[^0-9.,-]/g, "").replace(",", ".")) || 0;

/**
 * Het logo als data-URI. Moet ingesloten worden en niet als adres: het document wordt in
 * een kaal iframe gerenderd dat niets van buiten mag ophalen, anders blijft de balk leeg
 * op de afdruk. Zelfde aanpak als bij de facturen.
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

export default function ContractenContent() {
  const [lijst, setLijst] = useState<Cosignatie[] | null>(null);
  const [fout, setFout] = useState("");
  const [zoek, setZoek] = useState("");
  // Welke rij open staat in de 70%-drawer. null = dicht. De oude inklap-rij is vervangen:
  // een klik op de rij opent de drawer; de helft van het scherm blijft beschikbaar voor de
  // lijst, en het contractdetail leest prettiger in een echt zijpaneel dan onder een rij.
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [bezig, setBezig] = useState<Record<string, "print" | "pdf" | "mail">>({});
  const { vraag, melden } = useDialoog();

  useEffect(() => {
    fetch("/api/admin/cosignaties")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLijst(Array.isArray(d) ? d : []))
      .catch(() => setLijst([]));
  }, []);

  const herlaad = async () => {
    const r = await fetch("/api/admin/cosignaties").catch(() => null);
    if (!r?.ok) return;
    const d = await r.json().catch(() => null);
    if (Array.isArray(d)) setLijst(d);
  };

  // Alleen wat in consignatie staat of gestaan heeft. Een afgewezen aanmelding hoeft geen
  // contract; die staat er alleen nog om te kunnen terugkijken.
  const zichtbaar = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    return (lijst ?? [])
      .filter((c) => c.status !== "afgewezen")
      .filter((c) =>
        !term
          ? true
          : [c.naam, c.merk, c.model, c.kenteken, c.contract_nr].join(" ").toLowerCase().includes(term)
      );
  }, [lijst, zoek]);

  /** De rij die in de drawer staat — afgeleid van de state, anders herbouwen we op elke render. */
  const inDrawer = useMemo(() => (drawerId ? (lijst ?? []).find((c) => c.id === drawerId) ?? null : null), [drawerId, lijst]);

  const patch = async (c: Cosignatie, velden: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/cosignaties/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(velden),
    });
    if (!res.ok) { setFout("Opslaan mislukt. Probeer het nog een keer."); return false; }
    await herlaad();
    return true;
  };

  /** Bouwt het document. Zonder nummer geen contract — dat wordt hier zo nodig gemaakt.
   *  `alleen: "kopie"` levert alleen het kopie-exemplaar: dat is de mailbijlage. */
  const maakDocument = async (c: Cosignatie, opties: { alleen?: "kopie" } = {}): Promise<string | null> => {
    setFout("");
    let nummer = c.contract_nr ?? "";
    if (!nummer) {
      const res = await fetch(`/api/admin/cosignaties/${c.id}/contractnummer`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.contract_nr) {
        setFout(d.error || "Het contractnummer kon niet worden aangemaakt.");
        return null;
      }
      nummer = d.contract_nr;
      await herlaad();
    }

    const logo = await haalLogo();
    const gegevens: ContractGegevens = {
      contract_nr: nummer,
      datum: new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }),
      klant_naam: c.naam || "—",
      klant_adres: c.klant_adres,
      klant_postcode: c.klant_postcode,
      klant_stad: c.klant_stad,
      klant_email: c.email,
      klant_telefoon: c.telefoon,
      merk: c.merk, model: c.model, bouwjaar: c.bouwjaar,
      kenteken: c.kenteken, vin: c.vin, km: c.km, kleur: c.kleur, brandstof: c.brandstof,
      vraagprijs: getal(c.vraagprijs),
      bodemprijs: getal(c.bodemprijs),
      fee_vast: getal(c.fee_vast),
      looptijd_maanden: getal(c.looptijd_maanden) || STANDAARD.looptijd,
      fee_percentage: getal(c.fee_percentage) || STANDAARD.fee,
      // Nul is hier een echte waarde ("dezelfde dag") en geen ontbrekende invoer, dus geen
      // || maar een expliciete controle.
      uitbetaling_dagen: c.uitbetaling_dagen == null ? STANDAARD.uitbetaling : getal(c.uitbetaling_dagen),
      terugname_kosten: c.terugname_kosten == null ? STANDAARD.terugname : getal(c.terugname_kosten),
      bijzondere_afspraken: c.bijzondere_afspraken,
    };
    return genereerContractHTML(gegevens, logo, opties);
  };

  /** Ontbreekt er iets dat op het contract hoort te staan? Dan eerst waarschuwen. */
  const ontbreekt = (c: Cosignatie): string[] =>
    [
      !c.naam?.trim() ? "de naam van de eigenaar" : "",
      !c.klant_adres?.trim() ? "het adres van de eigenaar" : "",
      !c.kenteken?.trim() ? "het kenteken" : "",
      getal(c.vraagprijs) <= 0 ? "de vraagprijs" : "",
      getal(c.fee_percentage) <= 0 && getal(c.fee_vast) <= 0 ? "de vergoeding" : "",
    ].filter(Boolean);

  const doe = async (c: Cosignatie, soort: "print" | "pdf") => {
    if (bezig[c.id]) return;
    const mist = ontbreekt(c);
    if (mist.length) {
      const door = await vraag({
        titel: "Er ontbreekt nog iets op dit contract",
        tekst: `Niet ingevuld: ${mist.join(", ")}.\n\nJe kunt het contract wel maken, maar die velden blijven dan leeg op papier. Meestal wil je ze eerst invullen.`,
        bevestig: "Toch doorgaan",
        annuleer: "Eerst invullen",
      });
      if (!door) return;
    }
    setBezig((p) => ({ ...p, [c.id]: soort }));
    try {
      const html = await maakDocument(c);
      if (!html) return;
      if (soort === "print") drukAf(html);
      else {
        await downloadPdf(html, `Consignatieovereenkomst ${c.contract_nr || ""} ${c.merk} ${c.model}.pdf`.replace(/\s+/g, " ").trim());
      }
    } catch (e) {
      await melden({
        titel: "Het contract kon niet worden gemaakt",
        tekst: e instanceof Error ? e.message : "Onbekende fout. Probeer het nog een keer.",
      });
    } finally {
      setBezig((p) => { const n = { ...p }; delete n[c.id]; return n; });
    }
  };

  /**
   * Mailt het contract (kopie-exemplaar) naar de eigenaar, met het automatische
   * begeleidende bericht. Zelfde route als op het Cosignatie-tabblad: na het versturen
   * gaat de aanvraag naar "lopend" en beginnen de tweewekelijkse updates.
   */
  const mailContract = async (c: Cosignatie) => {
    if (bezig[c.id]) return;
    if (!c.email) {
      await melden({ titel: "Geen e-mailadres", tekst: "Deze eigenaar heeft geen e-mailadres. Vul dat eerst in op het tabblad Cosignatie." });
      return;
    }
    if (c.contract_gemaild_op) {
      const wanneer = new Date(c.contract_gemaild_op).toLocaleDateString("nl-NL");
      const opnieuw = await vraag({
        titel: "Contract al gemaild",
        tekst: `Dit contract is al op ${wanneer} naar ${c.email} gemaild. Wil je het echt nóg een keer versturen?`,
        bevestig: "Ja, verstuur opnieuw",
        annuleer: "Annuleer",
      });
      if (!opnieuw) return;
      // Registratie eerst wissen, anders blijft de oude datum staan.
      await fetch(`/api/admin/cosignaties/${c.id}/mail-contract`, { method: "DELETE" }).catch(() => null);
    }
    const mist = ontbreekt(c);
    const door = await vraag({
      titel: "Contract mailen naar de eigenaar?",
      tekst: `${mist.length ? `Let op: nog niet ingevuld — ${mist.join(", ")}. Die blijven leeg op het contract.\n\n` : ""}Het kopie-exemplaar van het consignatiecontract wordt met een begeleidend bericht als PDF naar ${c.email} gestuurd. De consignatie gaat daarna naar "In verkoop" en de eigenaar krijgt om de week automatisch een update-mail.`,
      bevestig: "Ja, verstuur het contract",
      annuleer: mist.length ? "Eerst invullen" : "Annuleer",
    });
    if (!door) return;
    setBezig((p) => ({ ...p, [c.id]: "mail" }));
    try {
      // De bijlage is de KOPIE met watermerk: het origineel blijft bij JG.
      const html = await maakDocument(c, { alleen: "kopie" });
      if (!html) return;
      const pdfBase64 = await pdfBase64Van(html);
      const res = await fetch(`/api/admin/cosignaties/${c.id}/mail-contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64 }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Versturen mislukt");
      await herlaad();
    } catch (e) {
      await melden({ titel: "Contract niet verstuurd", tekst: e instanceof Error ? e.message : "Onbekende fout." });
    } finally {
      setBezig((p) => { const n = { ...p }; delete n[c.id]; return n; });
    }
  };

  return (
    <div style={{ backgroundColor: T.wash, minHeight: "100%" }}>
      {/* Vaste kop, zelfde vorm als de andere documentpagina's */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 xl:px-8"
        style={{ height: 56, backgroundColor: T.paper, borderBottom: `1px solid ${T.line2}` }}
      >
        <FileSignature size={15} style={{ color: T.ink(0.35), flexShrink: 0 }} />
        <h2
          className="min-w-0 truncate text-[17px] sm:text-[19px]"
          style={{ fontFamily: T.play, fontWeight: 700, color: T.navy }}
        >
          Consignatiecontract
        </h2>
        <span className="hidden md:block flex-shrink-0" style={{ width: 1, height: 16, backgroundColor: T.line2 }} />
        <p className="hidden md:block min-w-0 truncate" style={micro(T.ink(0.35))}>
          De afspraken op papier voor auto&apos;s die je voor een ander verkoopt
        </p>
        <div className="ml-auto">
          <span style={klein()}>{zichtbaar.length} consignatie{zichtbaar.length === 1 ? "" : "s"}</span>
        </div>
      </header>

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
              placeholder="Zoek op naam, auto, kenteken of contractnummer…"
              style={{ ...inputStijl, padding: "8px 10px 8px 28px", fontSize: 12.5, backgroundColor: T.paper }}
            />
          </div>
        )}

        {lijst === null ? (
          <div className="flex justify-center py-24"><Spinner size={22} /></div>
        ) : zichtbaar.length === 0 ? (
          <Empty
            icon={<FileSignature size={30} color={T.ink(0.2)} />}
            title={lijst.length === 0 ? "Nog geen consignaties" : "Niets gevonden"}
            body={
              lijst.length === 0
                ? "Zodra er een auto in consignatie staat, kun je hier het contract opmaken."
                : "Probeer een andere zoekterm."
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {zichtbaar.map((c) => {
              const auto = [c.merk, c.model].filter(Boolean).join(" ") || "Auto";
              const prijs = getal(c.vraagprijs);
              const feeTekst = getal(c.fee_vast) > 0
                ? `€ ${getal(c.fee_vast).toLocaleString("nl-NL")} vast`
                : `${getal(c.fee_percentage) || STANDAARD.fee}% fee`;
              return (
                <div key={c.id} style={{ backgroundColor: T.paper, border: `1px solid ${T.line}`, borderRadius: "var(--radius-card, 14px)", overflow: "hidden" }}>
                  {/* Rijkop: auto · eigenaar + contractbadge, vraagprijs rechts. Klik = drawer open. */}
                  <button
                    onClick={() => setDrawerId(drawerId === c.id ? null : c.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-bold" style={{ color: T.navy, fontFamily: T.play }}>
                          {auto} · {c.naam || "Naamloos"}
                        </p>
                        <span
                          className="text-[10px] px-2 py-0.5 font-semibold"
                          style={{
                            backgroundColor: c.contract_nr ? "#dcfce7" : "#fef3c7",
                            color: c.contract_nr ? "#15803d" : "#b45309",
                            fontFamily: T.inter,
                          }}
                        >
                          {c.contract_nr || "Geen contract"}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: T.ink(0.45), fontFamily: T.inter }}>
                        {[c.bouwjaar, c.kenteken?.toUpperCase(), c.km ? `${getal(c.km).toLocaleString("nl-NL")} km` : ""].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold" style={{ fontFamily: T.play, color: T.navy }}>
                        {prijs > 0 ? `€${prijs.toLocaleString("nl-NL")}` : "—"}
                      </p>
                      <p className="text-[10px]" style={{ color: T.ink(0.35), fontFamily: T.inter }}>
                        {feeTekst}
                      </p>
                    </div>
                    <span className="text-xs ml-2 flex-shrink-0" style={{ color: T.ink(0.3) }}>
                      {drawerId === c.id ? "▲" : "▶"}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 70%-drawer: detail van het geselecteerde contract ──
          Een klik op een rij schuift dit paneel van rechts in beeld. De helft van het
          scherm blijft zichtbaar voor de lijst — zo kun je snel door contracten bladeren
          zonder steeds het overzicht te verliezen. Sluit via X, Escape of de backdrop. */}
      {inDrawer && <ContractDrawer c={inDrawer} onClose={() => setDrawerId(null)} doe={doe} mailContract={mailContract} bezig={bezig} ontbreekt={ontbreekt} patch={patch} />}
    </div>
  );
}

/**
 * De 70%-detailkaart van één contract. Bevat dezelfde gegevens als de oude inklap-rij,
 * maar dan als overlay zodat meerdere contracten snel achter elkaar te bekijken zijn.
 */
function ContractDrawer({
  c, onClose, doe, mailContract, bezig, ontbreekt, patch,
}: {
  c: Cosignatie;
  onClose: () => void;
  doe: (c: Cosignatie, soort: "print" | "pdf") => Promise<void>;
  mailContract: (c: Cosignatie) => Promise<void>;
  bezig: Record<string, "print" | "pdf" | "mail">;
  ontbreekt: (c: Cosignatie) => string[];
  patch: (c: Cosignatie, velden: Record<string, unknown>) => Promise<boolean>;
}) {
  const auto = [c.merk, c.model].filter(Boolean).join(" ") || "Auto";
  const prijs = getal(c.vraagprijs);
  const mist = ontbreekt(c);

  // Escape sluit de drawer, net als de sluitknop of de backdrop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop — klik sluit de drawer, ook als de gebruiker naast het paneel klikt. */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,19,55,0.32)", zIndex: 50 }}
      />
      <aside
        role="dialog"
        aria-label={`Contract ${c.contract_nr ?? "zonder nummer"}`}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100%",
          width: "min(70vw, 980px)",
          backgroundColor: T.paper,
          borderLeft: `1px solid ${T.line}`,
          boxShadow: "-16px 0 32px -8px rgba(0,19,55,0.18)",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Cover: links merk+model+kenteken+klant+badge, rechts prijs+fee. */}
        <div className="px-6 py-5" style={{ borderBottom: `1px solid ${T.line2}`, backgroundColor: "rgba(0,19,55,0.015)" }}>
          <div className="flex items-start gap-4 mb-2">
            <p className="text-base font-bold flex-1 min-w-0 truncate" style={{ color: T.navy, fontFamily: T.play }}>
              {auto} · {c.naam || "Naamloos"}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Sluiten"
              className="inline-flex items-center justify-center flex-shrink-0 transition-all hover:opacity-70"
              style={{ width: 32, height: 32, color: T.ink(0.5), backgroundColor: T.paper, border: `1px solid ${T.line}`, borderRadius: "var(--radius-control, 10px)" }}
            >
              <X size={15} />
            </button>
          </div>
          <p className="text-[11px] mb-3" style={{ color: T.ink(0.45), fontFamily: T.inter }}>
            {[c.bouwjaar, c.kenteken?.toUpperCase(), c.km ? `${getal(c.km).toLocaleString("nl-NL")} km` : ""].filter(Boolean).join(" · ") || "—"}
          </p>
          <div className="flex items-center justify-between gap-3">
            <span
              className="text-[10px] px-2 py-0.5 font-semibold"
              style={{
                backgroundColor: c.contract_nr ? "#dcfce7" : "#fef3c7",
                color: c.contract_nr ? "#15803d" : "#b45309",
                fontFamily: T.inter,
              }}
            >
              {c.contract_nr || "Geen contract"}
            </span>
            <div className="text-right">
              <p className="text-base font-bold" style={{ fontFamily: T.play, color: T.navy }}>
                {prijs > 0 ? `€${prijs.toLocaleString("nl-NL")}` : "—"}
              </p>
              <p className="text-[10px]" style={{ color: T.ink(0.35), fontFamily: T.inter }}>
                {getal(c.fee_vast) > 0
                  ? `€ ${getal(c.fee_vast).toLocaleString("nl-NL")} vast`
                  : `${getal(c.fee_percentage) || STANDAARD.fee}% fee`}
              </p>
            </div>
          </div>
        </div>

        {/* Body: scrollt intern. Twee kolommen op desktop, stapelt op smaller scherm. */}
        <div className="flex-1 min-h-0 overflow-y-auto jg-scroll px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Links: details + aanvullen voor het contract */}
            <div>
              <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: T.ink(0.4), fontFamily: T.inter }}>
                Details
              </p>
              <table className="w-full text-xs" style={{ fontFamily: T.inter }}>
                <tbody>
                  {([
                    ["Eigenaar", c.naam],
                    ["E-mail", c.email],
                    ["Telefoon", c.telefoon],
                    ["Voertuig", [c.merk, c.model, c.bouwjaar].filter(Boolean).join(" ")],
                    ["KM-stand", c.km ? `${getal(c.km).toLocaleString("nl-NL")} km` : ""],
                    ["Aangemeld", c.datum],
                    c.contract_op
                      ? ["Contractnr. op", new Date(c.contract_op).toLocaleDateString("nl-NL")]
                      : ["", ""],
                  ] as [string, string][])
                    .filter(([, w]) => w)
                    .map(([label, waarde]) => (
                      <tr key={label}>
                        <td className="py-1 pr-3 align-top" style={{ color: T.ink(0.45), width: "100px" }}>{label}</td>
                        <td className="py-1 font-semibold" style={{ color: T.navy }}>{waarde}</td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {/* Adres, kenteken en VIN horen op het contract maar komen niet
                  altijd mee met de aanmelding — hier vul je ze aan. */}
              <p className="text-xs font-bold mt-4 mb-2 uppercase tracking-wider" style={{ color: T.ink(0.4), fontFamily: T.inter }}>
                Aanvullen voor het contract
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Veld label="Adres" waarde={c.klant_adres} veld="klant_adres" patch={(v) => patch(c, v)} tekst plaats="Straat 1" />
                <Veld label="Postcode" waarde={c.klant_postcode} veld="klant_postcode" patch={(v) => patch(c, v)} tekst plaats="1234 AB" />
                <Veld label="Plaats" waarde={c.klant_stad} veld="klant_stad" patch={(v) => patch(c, v)} tekst plaats="Barendrecht" />
                <Veld label="Kenteken" waarde={c.kenteken} veld="kenteken" patch={(v) => patch(c, v)} tekst plaats="AB-123-C" />
                <Veld label="Chassisnummer" waarde={c.vin} veld="vin" patch={(v) => patch(c, v)} tekst plaats="WVW…" />
              </div>
              <p className="mt-2" style={klein()}>
                Naam, e-mail, telefoon en de autogegevens komen uit de consignatie zelf; die
                pas je aan op het tabblad Cosignatie.
              </p>
            </div>

            {/* Rechts: de afspraken en de contractknoppen */}
            <div>
              <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: T.ink(0.4), fontFamily: T.inter }}>
                De afspraken
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Veld label="Vergoeding in %" waarde={c.fee_percentage ?? STANDAARD.fee} veld="fee_percentage"
                  patch={(v) => patch(c, v)} plaats="10" achtervoegsel="%" />
                <Veld label="Of een vast bedrag" waarde={c.fee_vast} veld="fee_vast"
                  patch={(v) => patch(c, v)} plaats="0" achtervoegsel="€" />
                <Veld label="Vraagprijs" waarde={c.vraagprijs} veld="vraagprijs"
                  patch={(v) => patch(c, v)} plaats="18500" achtervoegsel="€" />
                <Veld label="Niet verkopen onder" waarde={c.bodemprijs} veld="bodemprijs"
                  patch={(v) => patch(c, v)} plaats="17000" achtervoegsel="€" />
                <Veld label="Looptijd in maanden" waarde={c.looptijd_maanden ?? STANDAARD.looptijd} veld="looptijd_maanden"
                  patch={(v) => patch(c, v)} plaats="6" />
                <Veld label="Uitbetalen na (werkdagen)" waarde={c.uitbetaling_dagen ?? STANDAARD.uitbetaling} veld="uitbetaling_dagen"
                  patch={(v) => patch(c, v)} plaats="0" />
                <Veld label="Bij terugnemen: advertentiekosten" waarde={c.terugname_kosten ?? STANDAARD.terugname} veld="terugname_kosten"
                  patch={(v) => patch(c, v)} plaats="50" achtervoegsel="€" />
              </div>
              <div className="mt-2 mb-4">
                <Field label="Bijzondere afspraken (komt onder de voorwaarden)">
                  <textarea
                    key={c.id + (c.bijzondere_afspraken ?? "")}
                    defaultValue={c.bijzondere_afspraken ?? ""}
                    onBlur={(e) =>
                      e.target.value !== (c.bijzondere_afspraken ?? "") &&
                      patch(c, { bijzondere_afspraken: e.target.value })
                    }
                    placeholder="Bijvoorbeeld: winterbanden gaan mee, of de auto mag niet buiten staan."
                    style={{ ...inputStijl, minHeight: 56, resize: "vertical", lineHeight: 1.55 }}
                  />
                </Field>
              </div>

              {mist.length > 0 && (
                <div
                  className="flex items-start gap-2 px-3 py-2.5 mb-3"
                  style={{ backgroundColor: T.tintAmber, borderLeft: `3px solid ${T.amber}`, borderRadius: "var(--radius-control, 10px)" }}
                >
                  <AlertTriangle size={13} color={T.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                  <p className="text-xs" style={{ color: T.ink(0.7), fontFamily: T.inter, lineHeight: 1.5 }}>
                    Nog niet ingevuld: {mist.join(", ")}. Die blijven leeg op papier.
                  </p>
                </div>
              )}

              {/* Zelfde knoppenrij als bij een factuur: donkere hoofdactie + PDF + blauwe mailknop */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => doe(c, "print")}
                  disabled={!!bezig[c.id]}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0"
                  style={{ backgroundColor: T.navy, fontFamily: T.inter, borderRadius: "var(--radius-control, 10px)", boxShadow: "0 6px 16px -8px rgba(0,19,55,0.5)" }}
                  title="Print het contract om te laten ondertekenen"
                >
                  <Printer size={14} />
                  {bezig[c.id] === "print" ? "Voorbereiden..." : "Afdrukken"}
                </button>
                <button
                  onClick={() => doe(c, "pdf")}
                  disabled={!!bezig[c.id]}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0"
                  style={{
                    backgroundColor: T.paper,
                    color: "#334155",
                    border: `1px solid ${T.line}`,
                    fontFamily: T.inter,
                    borderRadius: "var(--radius-control, 10px)",
                  }}
                >
                  <Download size={14} />
                  {bezig[c.id] === "pdf" ? "PDF maken..." : "PDF"}
                </button>
                <button
                  onClick={() => mailContract(c)}
                  disabled={!!bezig[c.id]}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0"
                  style={{ backgroundColor: c.contract_gemaild_op ? "#15803d" : "#1d4ed8", fontFamily: T.inter, borderRadius: "var(--radius-control, 10px)", boxShadow: "0 6px 16px -8px rgba(29,78,216,0.5)" }}
                  title="Mail het kopie-exemplaar met een begeleidend bericht naar de eigenaar"
                >
                  <Send size={14} />
                  {bezig[c.id] === "mail" ? "Versturen..." : c.contract_gemaild_op ? "Verstuurd" : "Verstuur contract"}
                </button>
              </div>
              {c.contract_gemaild_op && (
                <p className="mt-2.5 text-[11px] font-medium" style={{ color: "#15803d", fontFamily: T.inter }}>
                  ✓ Contract gemaild op {new Date(c.contract_gemaild_op).toLocaleDateString("nl-NL")} naar {c.email}
                </p>
              )}
              <p className="mt-2.5" style={klein()}>
                Het contractnummer wordt bij de eerste keer aangemaakt en verandert daarna
                niet meer — een klant hoort niet twee verschillende nummers op hetzelfde
                stuk te zien.
              </p>
              {c.contract_op && (
                <p className="mt-1" style={klein(T.groen)}>
                  <Check size={10} style={{ display: "inline", marginRight: 4 }} />
                  Nummer toegekend op {new Date(c.contract_op).toLocaleDateString("nl-NL")}
                </p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

/** Eén veld dat opslaat zodra je eruit klikt. Zelfde patroon als bij Aanvragen. */
function Veld({
  label, waarde, veld, patch, plaats, achtervoegsel, tekst = false,
}: {
  label: string;
  waarde: unknown;
  veld: string;
  patch: (v: Record<string, unknown>) => Promise<boolean>;
  plaats?: string;
  achtervoegsel?: string;
  tekst?: boolean;
}) {
  const huidig = waarde === undefined || waarde === null ? "" : String(waarde);
  return (
    <Field label={achtervoegsel ? `${label} (${achtervoegsel})` : label}>
      <input
        key={huidig}
        defaultValue={huidig}
        placeholder={plaats}
        inputMode={tekst ? undefined : "decimal"}
        onBlur={(e) => e.target.value !== huidig && patch({ [veld]: e.target.value })}
        style={inputStijl}
      />
    </Field>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { FileSignature, Printer, Download, Search, Check, AlertTriangle } from "lucide-react";
import {
  T, micro, body, klein, Panel, Btn, Field, inputStijl, Spinner, Empty, Foutmelding, Pill,
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
 * De consignatiegegevens stonden al in het systeem; wat ontbrak waren de afspraken en een
 * document. Dat document komt uit dezelfde koker als de factuur die dezelfde klant later
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

export default function ContractenContent() {
  const [lijst, setLijst] = useState<Cosignatie[] | null>(null);
  const [fout, setFout] = useState("");
  const [zoek, setZoek] = useState("");
  const [gekozenId, setGekozenId] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
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

  const gekozen = useMemo(
    () => zichtbaar.find((c) => c.id === gekozenId) ?? zichtbaar[0] ?? null,
    [zichtbaar, gekozenId]
  );

  const patch = async (velden: Record<string, unknown>) => {
    if (!gekozen) return false;
    const res = await fetch(`/api/admin/cosignaties/${gekozen.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(velden),
    });
    if (!res.ok) { setFout("Opslaan mislukt. Probeer het nog een keer."); return false; }
    await herlaad();
    return true;
  };

  /** Bouwt het document. Zonder nummer geen contract — dat wordt hier zo nodig gemaakt. */
  const maakDocument = async (c: Cosignatie): Promise<string | null> => {
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
    return genereerContractHTML(gegevens, logo);
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

  const doe = async (soort: "print" | "pdf") => {
    if (!gekozen || bezig) return;
    const mist = ontbreekt(gekozen);
    if (mist.length) {
      const door = await vraag({
        titel: "Er ontbreekt nog iets op dit contract",
        tekst: `Niet ingevuld: ${mist.join(", ")}.\n\nJe kunt het contract wel maken, maar die velden blijven dan leeg op papier. Meestal wil je ze eerst invullen.`,
        bevestig: "Toch doorgaan",
        annuleer: "Eerst invullen",
      });
      if (!door) return;
    }
    setBezig(true);
    try {
      const html = await maakDocument(gekozen);
      if (!html) return;
      if (soort === "print") drukAf(html);
      else {
        await downloadPdf(html, `Consignatieovereenkomst ${gekozen.contract_nr || ""} ${gekozen.merk} ${gekozen.model}.pdf`.replace(/\s+/g, " ").trim());
      }
    } catch (e) {
      await melden({
        titel: "Het contract kon niet worden gemaakt",
        tekst: e instanceof Error ? e.message : "Onbekende fout. Probeer het nog een keer.",
      });
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="px-4 md:px-6 py-4 md:py-5 w-full">
      {fout && <div className="mb-4"><Foutmelding>{fout}</Foutmelding></div>}

      <div
        className="flex flex-wrap items-center gap-2 px-3 py-2.5 mb-4"
        style={{ backgroundColor: T.paper, border: `1px solid ${T.line}` }}
      >
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search
            size={13}
            color={T.ink(0.3)}
            style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          />
          <input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek op naam, auto, kenteken of contractnummer…"
            style={{ ...inputStijl, padding: "7px 10px 7px 28px", fontSize: 12.5 }}
          />
        </div>
        <span style={klein()}>{zichtbaar.length} consignatie{zichtbaar.length === 1 ? "" : "s"}</span>
      </div>

      {lijst === null ? (
        <div className="flex justify-center py-16"><Spinner size={22} /></div>
      ) : zichtbaar.length === 0 ? (
        <Empty
          icon={<FileSignature size={30} color={T.ink(0.2)} />}
          title="Nog geen consignaties"
          body="Zodra er een auto in consignatie staat, kun je hier het contract opmaken."
        />
      ) : (
        <div className="flex flex-col xl:flex-row gap-4 items-start">
          <div className="w-full xl:w-[320px] xl:flex-none xl:sticky" style={{ top: 16 }}>
            <Panel title="Consignaties" meta={`${zichtbaar.length}`}>
              <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 210px)" }}>
                {zichtbaar.map((c) => {
                  const actief = c.id === gekozen?.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setGekozenId(c.id)}
                      className="text-left transition-all hover:opacity-85"
                      style={{
                        padding: "9px 11px",
                        backgroundColor: actief ? T.navy : T.paper,
                        border: `1px solid ${actief ? T.navy : T.line}`,
                        borderLeft: `3px solid ${c.contract_nr ? T.groen : T.amber}`,
                      }}
                    >
                      <div className="flex items-baseline gap-2">
                        <span
                          className="flex-1 min-w-0 truncate"
                          style={{ fontFamily: T.play, fontSize: 13, fontWeight: 700, color: actief ? "#ffffff" : T.navy }}
                        >
                          {`${c.merk} ${c.model}`.trim() || "Auto"}
                        </span>
                        <span style={{ ...klein(actief ? "rgba(255,255,255,0.5)" : c.contract_nr ? T.groen : T.amber), flexShrink: 0 }}>
                          {c.contract_nr || "geen contract"}
                        </span>
                      </div>
                      <div className="truncate mt-0.5" style={body(11.5, actief ? "rgba(255,255,255,0.6)" : T.ink(0.5))}>
                        {[c.naam, c.kenteken].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>

          {gekozen && (
            <div className="w-full xl:flex-1 xl:min-w-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Panel
                title="De afspraken"
                actions={
                  gekozen.contract_nr ? (
                    <Pill color={T.groen}>{gekozen.contract_nr}</Pill>
                  ) : (
                    <span style={{ ...micro(T.amber), fontSize: 9 }}>nog geen nummer</span>
                  )
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Veld label="Vergoeding in %" waarde={gekozen.fee_percentage ?? STANDAARD.fee} veld="fee_percentage"
                    patch={patch} plaats="10" achtervoegsel="%" />
                  <Veld label="Of een vast bedrag" waarde={gekozen.fee_vast} veld="fee_vast"
                    patch={patch} plaats="0" achtervoegsel="€" />
                  <Veld label="Vraagprijs" waarde={gekozen.vraagprijs} veld="vraagprijs"
                    patch={patch} plaats="18500" achtervoegsel="€" />
                  <Veld label="Niet verkopen onder" waarde={gekozen.bodemprijs} veld="bodemprijs"
                    patch={patch} plaats="17000" achtervoegsel="€" />
                  <Veld label="Looptijd in maanden" waarde={gekozen.looptijd_maanden ?? STANDAARD.looptijd} veld="looptijd_maanden"
                    patch={patch} plaats="6" />
                  <Veld label="Uitbetalen na (werkdagen, 0 = dezelfde dag)"
                    waarde={gekozen.uitbetaling_dagen ?? STANDAARD.uitbetaling} veld="uitbetaling_dagen"
                    patch={patch} plaats="0" />
                  <Veld label="Bij terugnemen: advertentiekosten"
                    waarde={gekozen.terugname_kosten ?? STANDAARD.terugname} veld="terugname_kosten"
                    patch={patch} plaats="50" achtervoegsel="€" />
                </div>
                <div className="mt-2">
                  <Field label="Bijzondere afspraken (komt onder de voorwaarden)">
                    <textarea
                      key={gekozen.id + (gekozen.bijzondere_afspraken ?? "")}
                      defaultValue={gekozen.bijzondere_afspraken ?? ""}
                      onBlur={(e) =>
                        e.target.value !== (gekozen.bijzondere_afspraken ?? "") &&
                        patch({ bijzondere_afspraken: e.target.value })
                      }
                      placeholder="Bijvoorbeeld: winterbanden gaan mee, of de auto mag niet buiten staan."
                      style={{ ...inputStijl, minHeight: 64, resize: "vertical", lineHeight: 1.55 }}
                    />
                  </Field>
                </div>
              </Panel>

              <div className="flex flex-col gap-3">
                <Panel title="Eigenaar en voertuig">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Veld label="Adres" waarde={gekozen.klant_adres} veld="klant_adres" patch={patch} tekst plaats="Straat 1" />
                    <Veld label="Postcode" waarde={gekozen.klant_postcode} veld="klant_postcode" patch={patch} tekst plaats="1234 AB" />
                    <Veld label="Plaats" waarde={gekozen.klant_stad} veld="klant_stad" patch={patch} tekst plaats="Barendrecht" />
                    <Veld label="Kenteken" waarde={gekozen.kenteken} veld="kenteken" patch={patch} tekst plaats="AB-123-C" />
                    <Veld label="Chassisnummer" waarde={gekozen.vin} veld="vin" patch={patch} tekst plaats="WVW…" />
                  </div>
                  <p className="mt-2" style={klein()}>
                    Naam, e-mail, telefoon en de autogegevens komen uit de consignatie zelf; die pas
                    je aan op het tabblad Cosignatie.
                  </p>
                </Panel>

                <Panel title="Contract">
                  {ontbreekt(gekozen).length > 0 && (
                    <div
                      className="flex items-start gap-2 px-3 py-2.5 mb-3"
                      style={{ backgroundColor: T.tintAmber, borderLeft: `3px solid ${T.amber}` }}
                    >
                      <AlertTriangle size={13} color={T.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={body(11.5, T.ink(0.7))}>
                        Nog niet ingevuld: {ontbreekt(gekozen).join(", ")}. Die blijven leeg op papier.
                      </p>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <Btn full onClick={() => doe("print")} disabled={bezig}>
                      {bezig ? <Spinner size={12} /> : <Printer size={12} />} Afdrukken of opslaan als PDF
                    </Btn>
                    <Btn variant="ghost" full onClick={() => doe("pdf")} disabled={bezig}>
                      <Download size={12} /> PDF downloaden
                    </Btn>
                  </div>
                  <p className="mt-2.5" style={klein()}>
                    Het contractnummer wordt bij de eerste keer aangemaakt en verandert daarna niet
                    meer — een klant hoort niet twee verschillende nummers op hetzelfde stuk te zien.
                  </p>
                  {gekozen.contract_op && (
                    <p className="mt-1" style={klein(T.groen)}>
                      <Check size={10} style={{ display: "inline", marginRight: 4 }} />
                      Nummer toegekend op {new Date(gekozen.contract_op).toLocaleDateString("nl-NL")}
                    </p>
                  )}
                </Panel>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
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

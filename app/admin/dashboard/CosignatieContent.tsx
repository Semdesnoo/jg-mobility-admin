"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Handshake, ChevronDown, ChevronUp, Trash2, RefreshCw, Send,
  ExternalLink, FileSignature, Check, X, Mail, Phone, CircleCheck, Clock, Pencil,
  Archive,
} from "lucide-react";
import { useDialoog } from "./Dialoog";
import { toonBedrag, bedragUit, AUTO_ONDERGRENS } from "@/lib/bedrag";
import { genereerContractHTML, type ContractGegevens } from "@/lib/consignatie-contract";

type Cosignatie = {
  id: string;
  datum: string;
  tijd: string;
  naam: string;
  email: string;
  telefoon: string;
  merk: string;
  model: string;
  bouwjaar: string;
  km: string;
  kleur?: string;
  brandstof?: string;
  vraagprijs: string;
  opmerking: string;
  aantal_fotos: number;
  status: string;
  notitie: string;
  platform_prijzen?: Record<string, string> | null;
  geaccepteerd_op?: string;
  // Contract
  kenteken?: string; vin?: string;
  klant_adres?: string; klant_postcode?: string; klant_stad?: string;
  bodemprijs?: number; fee_percentage?: number; fee_vast?: number;
  looptijd_maanden?: number; uitbetaling_dagen?: number; terugname_kosten?: number;
  bijzondere_afspraken?: string;
  contract_nr?: string; contract_op?: string;
  contract_gemaild_op?: string | null;
  laatste_update_op?: string | null;
  auto_updates?: boolean;
};

/**
 * De vier stappen van de consignatieflow. Elke aanvraag doorloopt ze op volgorde:
 * nieuw → geaccepteerd → lopend, of nieuw → afgewezen.
 */
const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  nieuw:        { label: "Nieuw",        color: "#b45309", bg: "#fef3c7" },
  geaccepteerd: { label: "Geaccepteerd", color: "#1d4ed8", bg: "#dbeafe" },
  lopend:       { label: "In verkoop",   color: "#15803d", bg: "#dcfce7" },
  afgewezen:    { label: "Afgewezen",    color: "#b91c1c", bg: "#fee2e2" },
  archief:      { label: "Archief",      color: "#475569", bg: "#e2e8f0" },
};
// Volgorde van de stappenbalk boven aan een geopende aanvraag.
const FLOW = ["nieuw", "geaccepteerd", "lopend"] as const;

const PLATFORMS: Record<string, string> = {
  marktplaats: "Marktplaats.nl",
  nederlandmobiel: "NederlandMobiel.nl",
  autoscout24: "AutoScout24.nl",
};

const STANDAARD = { fee: 10, looptijd: 6, uitbetaling: 0, terugname: 50 } as const;
const getal = (w: unknown) => Number(String(w ?? "").replace(/[^0-9.,-]/g, "").replace(",", ".")) || 0;

const S = {
  label: { color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" } as React.CSSProperties,
  veld: { border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", backgroundColor: "#fafafa", borderRadius: "var(--radius-control)" } as React.CSSProperties,
};

type LeegForm = {
  naam: string; email: string; telefoon: string;
  merk: string; model: string; bouwjaar: string; km: string;
  kleur: string; brandstof: string; bodytype: string; apk: string; vermogen: string;
  vraagprijs: string; opmerking: string;
};
const LEEG: LeegForm = {
  naam: "", email: "", telefoon: "",
  merk: "", model: "", bouwjaar: "", km: "",
  kleur: "", brandstof: "", bodytype: "", apk: "", vermogen: "",
  vraagprijs: "", opmerking: "",
};

// ── Contract-PDF helpers (client-side, zelfde aanpak als ContractenContent) ──
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
  } catch { return ""; }
}

function contractGegevens(c: Cosignatie, nummer: string): ContractGegevens {
  return {
    contract_nr: nummer,
    datum: new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }),
    klant_naam: c.naam || "—",
    klant_adres: c.klant_adres, klant_postcode: c.klant_postcode, klant_stad: c.klant_stad,
    klant_email: c.email, klant_telefoon: c.telefoon,
    merk: c.merk, model: c.model, bouwjaar: c.bouwjaar,
    kenteken: c.kenteken, vin: c.vin, km: c.km, kleur: c.kleur, brandstof: c.brandstof,
    vraagprijs: getal(c.vraagprijs),
    bodemprijs: getal(c.bodemprijs),
    fee_vast: getal(c.fee_vast),
    fee_percentage: getal(c.fee_percentage) || STANDAARD.fee,
    looptijd_maanden: getal(c.looptijd_maanden) || STANDAARD.looptijd,
    uitbetaling_dagen: c.uitbetaling_dagen == null ? STANDAARD.uitbetaling : getal(c.uitbetaling_dagen),
    terugname_kosten: c.terugname_kosten == null ? STANDAARD.terugname : getal(c.terugname_kosten),
    bijzondere_afspraken: c.bijzondere_afspraken,
  };
}

/** Rendert contract-HTML naar een base64-PDF via html2pdf (voor de mailbijlage). */
async function contractNaarPdf(html: string): Promise<string> {
  const html2pdf = (await import("html2pdf.js")).default;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;height:1123px;border:none;";
  document.body.appendChild(frame);
  return await new Promise<string>((resolve, reject) => {
    frame.onload = async () => {
      try {
        const body = frame.contentDocument?.body;
        if (!body) { reject(new Error("Render mislukt")); return; }
        const dataUri = await html2pdf().set({
          margin: 0,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        }).from(body).output("datauristring");
        frame.remove();
        resolve((dataUri as string).split(",")[1]);
      } catch (e) { frame.remove(); reject(e); }
    };
    const doc = frame.contentDocument;
    if (doc) { doc.open(); doc.write(html); doc.close(); }
  });
}

/** Afdrukken via verborgen iframe. */
function drukAf(html: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;height:1123px";
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) { frame.remove(); return; }
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => { frame.contentWindow?.focus(); frame.contentWindow?.print(); setTimeout(() => frame.remove(), 2000); }, 500);
}

export default function CosignatieContent() {
  const { vraag, melden } = useDialoog();
  const [aanvragen, setAanvragen] = useState<Cosignatie[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toonNieuw, setToonNieuw] = useState(false);
  const [form, setForm] = useState<LeegForm>(LEEG);
  const [saving, setSaving] = useState(false);
  const [prijzenLaden, setPrijzenLaden] = useState<Record<string, boolean>>({});
  const [updateLaden, setUpdateLaden] = useState<Record<string, boolean>>({});
  const [updateOk, setUpdateOk] = useState<Record<string, boolean>>({});
  const [contractLaden, setContractLaden] = useState<Record<string, boolean>>({});
  const [filterStatus, setFilterStatus] = useState<string>("nieuw");
  const [rdwLaden, setRdwLaden] = useState(false);
  const [nu, setNu] = useState(() => Date.now());

  useEffect(() => {
    const tik = setInterval(() => setNu(Date.now()), 10 * 60 * 1000);
    const bijKomen = () => { if (document.visibilityState === "visible") setNu(Date.now()); };
    document.addEventListener("visibilitychange", bijKomen);
    return () => { clearInterval(tik); document.removeEventListener("visibilitychange", bijKomen); };
  }, []);

  const laad = useCallback(async () => {
    const res = await fetch("/api/admin/cosignaties");
    if (res.ok) setAanvragen(await res.json());
  }, []);

  useEffect(() => {
    fetch("/api/admin/cosignaties")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d)) setAanvragen(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const rdwOpzoeken = async (kenteken: string) => {
    if (!kenteken.trim()) return;
    setRdwLaden(true);
    const res = await fetch(`/api/admin/rdw-lookup?kenteken=${encodeURIComponent(kenteken)}`);
    if (res.ok) {
      const d = await res.json();
      if (d.merk) setForm((p) => ({
        ...p,
        merk: d.merk || p.merk, model: d.model || p.model,
        bouwjaar: d.bouwjaar ? String(d.bouwjaar) : p.bouwjaar,
        kleur: d.kleur || p.kleur, brandstof: d.brandstof || p.brandstof,
        bodytype: d.bodytype || p.bodytype, apk: d.apk || p.apk, vermogen: d.vermogen || p.vermogen,
      }));
    }
    setRdwLaden(false);
  };

  const maakAan = async () => {
    if (!form.merk.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/cosignaties", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (res.ok) { await laad(); setForm(LEEG); setToonNieuw(false); setFilterStatus("nieuw"); }
    setSaving(false);
  };

  const patchVeld = async (id: string, velden: Record<string, unknown>) => {
    await fetch(`/api/admin/cosignaties/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(velden),
    });
    setAanvragen((p) => p.map((a) => (a.id === id ? { ...a, ...velden } : a)));
  };

  /** Zet de status en, bij accepteren, meteen geaccepteerd_op via de server.
   *  Optimistisch: de kaart springt meteen naar de nieuwe stap, ook als het herladen
   *  even duurt. Mislukt de server, dan draaien we terug en tonen een melding — de
   *  knop kan zo nooit stil blijven hangen. */
  const zetStatus = async (id: string, status: string) => {
    const vorige = aanvragen.find((a) => a.id === id)?.status;
    // Meteen in beeld bijwerken zodat de flow niet "vastloopt" op een trage fetch.
    setAanvragen((p) => p.map((a) => (a.id === id ? { ...a, status } : a)));
    setFilterStatus(status);
    try {
      const res = await fetch(`/api/admin/cosignaties/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Server gaf ${res.status}`);
      }
      // Verse gegevens ophalen (o.a. geaccepteerd_op) — mislukt dit, dan blijft de
      // optimistische status staan; dat is de bedoeling.
      await laad().catch(() => {});
    } catch (e) {
      // Terugdraaien naar de oude status en het echt vertellen.
      if (vorige) {
        setAanvragen((p) => p.map((a) => (a.id === id ? { ...a, status: vorige } : a)));
        setFilterStatus(vorige);
      }
      await melden({ titel: "Status niet gewijzigd", tekst: e instanceof Error ? e.message : "Er ging iets mis. Probeer het nog een keer." });
    }
  };

  const haalMarktprijzen = async (id: string) => {
    setPrijzenLaden((p) => ({ ...p, [id]: true }));
    const res = await fetch(`/api/admin/cosignaties/${id}/zoek-prijzen`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setAanvragen((p) => p.map((a) => (a.id === id ? { ...a, platform_prijzen: data.platform_prijzen } : a)));
    }
    setPrijzenLaden((p) => ({ ...p, [id]: false }));
  };

  const verstuurUpdate = async (id: string) => {
    setUpdateLaden((p) => ({ ...p, [id]: true }));
    const res = await fetch(`/api/admin/cosignaties/${id}/verstuur-update`, { method: "POST" });
    if (res.ok) {
      setUpdateOk((p) => ({ ...p, [id]: true }));
      setTimeout(() => setUpdateOk((p) => ({ ...p, [id]: false })), 3000);
      await laad();
    } else {
      const d = await res.json().catch(() => ({}));
      await melden({ titel: "Update niet verstuurd", tekst: d.error || "Er ging iets mis. Probeer het nog een keer." });
    }
    setUpdateLaden((p) => ({ ...p, [id]: false }));
  };

  /** Zorgt voor een contractnummer en levert het contract-HTML.
   *  `alleen: "kopie"` geeft alleen het kopie-exemplaar — dat is de mailbijlage. */
  const bouwContract = async (c: Cosignatie, opties: { alleen?: "kopie" } = {}): Promise<{ html: string; nummer: string } | null> => {
    let nummer = c.contract_nr ?? "";
    if (!nummer) {
      const res = await fetch(`/api/admin/cosignaties/${c.id}/contractnummer`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.contract_nr) {
        await melden({ titel: "Contract niet gemaakt", tekst: d.error || "Het contractnummer kon niet worden aangemaakt." });
        return null;
      }
      nummer = d.contract_nr;
      await laad();
    }
    const logo = await haalLogo();
    return { html: genereerContractHTML(contractGegevens(c, nummer), logo, opties), nummer };
  };

  const ontbreekt = (c: Cosignatie): string[] => [
    !c.naam?.trim() ? "naam eigenaar" : "",
    !c.klant_adres?.trim() ? "adres eigenaar" : "",
    !c.kenteken?.trim() ? "kenteken" : "",
    getal(c.vraagprijs) <= 0 ? "vraagprijs" : "",
    getal(c.fee_percentage) <= 0 && getal(c.fee_vast) <= 0 ? "vergoeding" : "",
  ].filter(Boolean);

  const drukContractAf = async (c: Cosignatie) => {
    const r = await bouwContract(c);
    if (r) drukAf(r.html);
  };

  const mailContract = async (c: Cosignatie) => {
    if (!c.email) { await melden({ titel: "Geen e-mailadres", tekst: "Vul eerst het e-mailadres van de klant in." }); return; }
    const alGemaild = !!c.contract_gemaild_op;
    const mist = ontbreekt(c);
    const bevestig = await vraag({
      titel: alGemaild ? "Gewijzigd contract opnieuw mailen?" : "Contract mailen naar de klant?",
      tekst: alGemaild
        ? `Het contract is al op ${new Date(c.contract_gemaild_op!).toLocaleDateString("nl-NL")} naar ${c.email} gestuurd. De klant krijgt nu de nieuwste versie (met je laatste wijzigingen) opnieuw als PDF toegestuurd.`
        : `${mist.length ? `Let op: nog niet ingevuld — ${mist.join(", ")}. Die blijven leeg op het contract.\n\n` : ""}Het consignatiecontract wordt als PDF naar ${c.email} gestuurd. De aanvraag gaat daarna naar "In verkoop" en de auto krijgt om de week automatisch een update-mail.`,
      bevestig: alGemaild ? "Ja, verstuur de nieuwe versie" : "Ja, verstuur het contract",
      annuleer: !alGemaild && mist.length ? "Eerst invullen" : "Annuleer",
    });
    if (!bevestig) return;
    setContractLaden((p) => ({ ...p, [c.id]: true }));
    try {
      // Bij opnieuw versturen eerst de verzendregistratie vrijgeven, anders
      // weigert de dubbel-verstuur-grendel de tweede mail.
      if (alGemaild) await fetch(`/api/admin/cosignaties/${c.id}/mail-contract`, { method: "DELETE" }).catch(() => null);
      // De bijlage is de KOPIE met watermerk: het origineel blijft bij JG.
      const r = await bouwContract(c, { alleen: "kopie" });
      if (!r) return;
      const pdfBase64 = await contractNaarPdf(r.html);
      const res = await fetch(`/api/admin/cosignaties/${c.id}/mail-contract`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pdfBase64 }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Versturen mislukt");
      await laad();
      if (!alGemaild) setFilterStatus("lopend");
    } catch (e) {
      await melden({ titel: "Contract niet verstuurd", tekst: e instanceof Error ? e.message : "Onbekende fout." });
    } finally {
      setContractLaden((p) => ({ ...p, [c.id]: false }));
    }
  };

  const verwijder = async (id: string) => {
    const a = aanvragen.find((x) => x.id === id);
    const auto = [a?.merk, a?.model, a?.bouwjaar].filter(Boolean).join(" ");
    const wie = [a?.naam, auto].filter(Boolean).join(" — ") || "Deze aanvraag";
    const bevestigd = await vraag({
      titel: "Aanvraag verwijderen?",
      tekst: `${wie} wordt definitief verwijderd, samen met de interne notitie en de opgehaalde marktprijzen. Dit is niet ongedaan te maken.`,
      bevestig: "Verwijderen", gevaar: true,
    });
    if (!bevestigd) return;
    await fetch(`/api/admin/cosignaties/${id}`, { method: "DELETE" });
    setAanvragen((p) => p.filter((a) => a.id !== id));
    if (openId === id) setOpenId(null);
  };

  const gefilterd = (() => {
    if (filterStatus === "alle") return aanvragen;
    if (filterStatus === "archief") return aanvragen.filter((a) => a.status === "archief" || a.status === "afgewezen");
    return aanvragen.filter((a) => a.status === filterStatus);
  })();

  const telArchief = aanvragen.filter((a) => a.status === "archief" || a.status === "afgewezen").length;

  const dagenSinds = (datum: string | null | undefined) => {
    if (!datum) return null;
    const d = new Date(datum);
    if (isNaN(d.getTime())) return null;
    return Math.floor((nu - d.getTime()) / (1000 * 60 * 60 * 24));
  };

  const telPer = (s: string) => aanvragen.filter((a) => a.status === s).length;

  return (
    <div style={{ backgroundColor: "#f4f6fa", minHeight: "100%" }}>
      {/* Dezelfde vaste kop en statusnavigatie als bij Verkopersradar. */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 xl:px-8"
        style={{ height: 56, backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}
      >
        <h2
          className="min-w-0 truncate text-[17px] sm:text-[19px]"
          style={{ fontFamily: "var(--font-playfair)", fontWeight: 700, color: "#001337" }}
        >
          Consignatie
        </h2>
        <span className="hidden md:block flex-shrink-0" style={{ width: 1, height: 16, backgroundColor: "rgba(0,19,55,0.08)" }} />
        <p className="hidden md:block min-w-0 truncate text-[10px] uppercase tracking-[0.14em]" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
          {telPer("nieuw")} nieuw · {telPer("geaccepteerd")} te contracteren · {telPer("lopend")} in verkoop
        </p>
        <button
          type="button"
          onClick={() => setToonNieuw((v) => !v)}
          className="ml-auto flex items-center justify-center gap-2 flex-shrink-0 px-3 sm:px-4 py-2 text-xs font-semibold text-white transition-all hover:opacity-85"
          style={{ backgroundColor: "#001337", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}
        >
          <Plus size={13} /> <span className="hidden sm:inline">Klant toevoegen</span><span className="sm:hidden">Toevoegen</span>
        </button>
      </header>

      <nav
        className="sticky z-30 flex items-center gap-2 px-2 md:px-4 xl:px-6 overflow-x-auto"
        style={{ top: 56, height: 46, backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}
      >
        {([
          { id: "nieuw", label: "Nieuw", Icon: Clock },
          { id: "geaccepteerd", label: "Geaccepteerd", Icon: FileSignature },
          { id: "lopend", label: "In verkoop", Icon: CircleCheck },
          { id: "archief", label: "Archief", Icon: Archive },
          { id: "alle", label: "Alle", Icon: Handshake },
        ] as const).map(({ id, label, Icon }) => {
          const actief = filterStatus === id;
          const count = id === "alle" ? aanvragen.length : id === "archief" ? telArchief : telPer(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFilterStatus(id)}
              className="jg-tab-swatch"
              data-active={actief}
            >
              <Icon size={13} style={{ opacity: actief ? 1 : 0.55 }} />
              {label}
              <span className="jg-tab-count">{count}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-4 md:px-6 xl:px-8 py-4 md:py-6" style={{ maxWidth: 1800, margin: "0 auto" }}>
        {/* Nieuw formulier */}
        {toonNieuw && (
          <div className="mb-6" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
            <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={S.label}>Nieuwe consignatie-aanvraag</p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex gap-2 mb-5 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Kenteken (auto-invullen)</label>
                  <input type="text" placeholder="bijv. AB-123-C" onBlur={(e) => rdwOpzoeken(e.target.value)} className="w-full px-3 py-2 text-sm outline-none" style={S.veld} />
                </div>
                {rdwLaden && <div className="mb-2 w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />}
              </div>

              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={S.label}>Klantgegevens</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                {([
                  { label: "Naam klant *", field: "naam" as const },
                  { label: "E-mail", field: "email" as const },
                  { label: "Telefoon", field: "telefoon" as const },
                  { label: "Vraagprijs (€)", field: "vraagprijs" as const },
                ]).map(({ label, field }) => (
                  <div key={field}>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>{label}</label>
                    <input type="text" value={form[field]} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={S.veld} />
                  </div>
                ))}
              </div>

              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={S.label}>
                Voertuig {!rdwLaden && form.merk && <span className="text-[9px] ml-1" style={{ color: "#15803d" }}>✓ RDW ingevuld</span>}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { label: "Merk *", field: "merk" as const, rdw: true },
                  { label: "Model", field: "model" as const, rdw: true },
                  { label: "Bouwjaar", field: "bouwjaar" as const, rdw: true },
                  { label: "Kleur", field: "kleur" as const, rdw: true },
                  { label: "Brandstof", field: "brandstof" as const, rdw: true },
                  { label: "Carrosserie", field: "bodytype" as const, rdw: true },
                  { label: "Vermogen", field: "vermogen" as const, rdw: true },
                  { label: "APK vervaldatum", field: "apk" as const, rdw: true },
                  { label: "Kilometerstand *", field: "km" as const, rdw: false },
                ]).map(({ label, field, rdw }) => (
                  <div key={field}>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>
                      {label}
                      {rdw && form[field] && <span className="ml-1 text-[8px]" style={{ color: "#15803d" }}>RDW</span>}
                    </label>
                    <input type="text" value={form[field]} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} placeholder={field === "km" ? "bijv. 85000" : ""} className="w-full px-3 py-2 text-sm outline-none" style={{ ...S.veld, backgroundColor: rdw && form[field] ? "#f0fdf4" : "#fafafa", borderColor: rdw && form[field] ? "rgba(21,128,61,0.3)" : "rgba(0,19,55,0.15)" }} />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={S.label}>Opmerking</label>
                  <textarea value={form.opmerking} rows={2} onChange={(e) => setForm((p) => ({ ...p, opmerking: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none resize-none" style={{ ...S.veld, lineHeight: 1.6 }} />
                </div>
              </div>
            </div>
            <div className="px-4 sm:px-5 pb-5 flex flex-wrap gap-2">
              <button type="button" onClick={maakAan} disabled={saving || !form.merk.trim()} className="px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#001337", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}>
                {saving ? "Opslaan..." : "Aanvraag toevoegen"}
              </button>
              <button type="button" onClick={() => { setToonNieuw(false); setForm(LEEG); }} className="px-4 py-2.5 text-sm" style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}>
                Annuleer
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />
          </div>
        ) : gefilterd.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", borderRadius: "var(--radius-card)" }}>
            <Handshake size={38} style={{ color: "rgba(0,19,55,0.12)" }} />
            <p className="text-base font-bold mt-4" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
              {filterStatus === "nieuw" ? "Geen nieuwe aanvragen" : filterStatus === "alle" ? "Nog geen aanvragen" : filterStatus === "archief" ? "Het archief is leeg" : `Niets ${STATUS_LABELS[filterStatus]?.label.toLowerCase() ?? ""}`}
            </p>
            <p className="text-sm mt-1" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
              {filterStatus === "archief" ? "Hier komen aanvragen die je zelf archiveert of hebt afgewezen." : "Voeg een klant toe of wacht op aanvragen via de website."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {gefilterd.map((a) => (
              <Kaart
                key={a.id}
                a={a}
                open={openId === a.id}
                onToggle={() => setOpenId(openId === a.id ? null : a.id)}
                nu={nu}
                dagenSinds={dagenSinds}
                onStatus={zetStatus}
                onPatch={patchVeld}
                onMarktprijzen={haalMarktprijzen}
                prijzenLaden={!!prijzenLaden[a.id]}
                onUpdate={verstuurUpdate}
                updateLaden={!!updateLaden[a.id]}
                updateOk={!!updateOk[a.id]}
                onDrukContract={drukContractAf}
                onMailContract={mailContract}
                contractLaden={!!contractLaden[a.id]}
                ontbreekt={ontbreekt}
                onVerwijder={verwijder}
                vraag={vraag}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ══ Eén aanvraagkaart met de volledige flow ══════════════════════
function Kaart({
  a, open, onToggle, nu, dagenSinds, onStatus, onPatch, onMarktprijzen, prijzenLaden,
  onUpdate, updateLaden, updateOk, onDrukContract, onMailContract, contractLaden, ontbreekt, onVerwijder, vraag,
}: {
  a: Cosignatie;
  open: boolean;
  onToggle: () => void;
  nu: number;
  dagenSinds: (d: string | null | undefined) => number | null;
  onStatus: (id: string, status: string) => void;
  onPatch: (id: string, velden: Record<string, unknown>) => void;
  onMarktprijzen: (id: string) => void;
  prijzenLaden: boolean;
  onUpdate: (id: string) => void;
  updateLaden: boolean;
  updateOk: boolean;
  onDrukContract: (c: Cosignatie) => void;
  onMailContract: (c: Cosignatie) => void;
  contractLaden: boolean;
  ontbreekt: (c: Cosignatie) => string[];
  vraag: (q: { titel: string; tekst: string; bevestig: string }) => Promise<boolean>;
  onVerwijder: (id: string) => void;
}) {
  const sl = STATUS_LABELS[a.status] ?? STATUS_LABELS.nieuw;
  const dagenInVerkoop = dagenSinds(a.contract_gemaild_op || a.geaccepteerd_op);
  let prijzen: Record<string, string> = {};
  try { prijzen = typeof a.platform_prijzen === "string" ? JSON.parse(a.platform_prijzen) : (a.platform_prijzen ?? {}); } catch { /* */ }
  const mist = ontbreekt(a);

  return (
    <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
      {/* Kop-rij */}
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 text-left transition-all hover:bg-gray-50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-sm font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)" }}>
              {a.merk} {a.model}{" "}<span style={{ fontWeight: 400, color: "rgba(0,19,55,0.5)" }}>{a.bouwjaar}</span>
            </p>
            <span className="text-[10px] px-1.5 py-0.5 font-semibold" style={{ backgroundColor: sl.bg, color: sl.color, fontFamily: "var(--font-inter)", borderRadius: 999 }}>{sl.label}</span>
            {a.status === "lopend" && dagenInVerkoop !== null && (
              <span className="text-[10px] px-1.5 py-0.5" style={{ backgroundColor: "rgba(0,19,55,0.05)", color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)", borderRadius: 999 }}>
                dag {dagenInVerkoop}
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
            {a.naam}{a.email ? ` · ${a.email}` : ""}{a.telefoon ? ` · ${a.telefoon}` : ""}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {a.vraagprijs && <p className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>{toonBedrag(a.vraagprijs, { minimaal: AUTO_ONDERGRENS })}</p>}
          <p className="text-[10px]" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
            {a.datum}{a.aantal_fotos > 0 ? ` · ${a.aantal_fotos} foto's` : ""}
          </p>
        </div>
        {open ? <ChevronUp size={14} style={{ color: "rgba(0,19,55,0.3)", flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: "rgba(0,19,55,0.3)", flexShrink: 0 }} />}
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-5" style={{ borderTop: "1px solid rgba(0,19,55,0.06)" }}>
          {/* Stappenbalk */}
          {a.status !== "afgewezen" && (
            <div className="flex items-center gap-2 py-4 flex-wrap">
              {FLOW.map((stap, i) => {
                const idx = FLOW.indexOf(a.status as typeof FLOW[number]);
                const bereikt = idx >= i;
                const nu2 = a.status === stap;
                const labels: Record<string, string> = { nieuw: "1 · Aanvraag", geaccepteerd: "2 · Contract", lopend: "3 · In verkoop" };
                return (
                  <div key={stap} className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold" style={{
                      backgroundColor: nu2 ? "#001337" : bereikt ? "#dcfce7" : "rgba(0,19,55,0.05)",
                      color: nu2 ? "#ffffff" : bereikt ? "#15803d" : "rgba(0,19,55,0.4)",
                      fontFamily: "var(--font-inter)", borderRadius: 999,
                    }}>
                      {bereikt && !nu2 && <Check size={11} />}
                      {labels[stap]}
                    </span>
                    {i < FLOW.length - 1 && <span style={{ width: 16, height: 1, backgroundColor: "rgba(0,19,55,0.15)" }} />}
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Links: gegevens + marktprijzen ── */}
            <div>
              <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Klant &amp; voertuig</p>
              <div className="grid grid-cols-1 gap-2 mb-4">
                {([
                  { label: "Naam", field: "naam" as const },
                  { label: "E-mail", field: "email" as const },
                  { label: "Telefoon", field: "telefoon" as const },
                  { label: "Vraagprijs", field: "vraagprijs" as const },
                  { label: "Merk", field: "merk" as const },
                  { label: "Model", field: "model" as const },
                  { label: "Bouwjaar", field: "bouwjaar" as const },
                  { label: "Km-stand", field: "km" as const },
                ]).map(({ label, field }) => (
                  <div key={field} className="flex items-center gap-2">
                    <span className="text-[10px] flex-shrink-0" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)", width: 80 }}>{label}</span>
                    <input
                      type="text" title={label} placeholder={label}
                      defaultValue={(a as unknown as Record<string, string>)[field] ?? ""}
                      onBlur={(e) => { if (e.target.value !== (a as unknown as Record<string, string>)[field]) onPatch(a.id, { [field]: e.target.value }); }}
                      className="flex-1 px-2 py-1 text-xs outline-none" style={S.veld}
                    />
                  </div>
                ))}
              </div>

              {/* Marktprijzen */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Marktprijzen online</p>
                <button type="button" onClick={() => onMarktprijzen(a.id)} disabled={prijzenLaden} className="flex items-center gap-1 text-[10px] px-2 py-1 transition-all hover:opacity-70 disabled:opacity-40" style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}>
                  <RefreshCw size={9} className={prijzenLaden ? "animate-spin" : ""} />{prijzenLaden ? "Zoeken..." : "Ophalen"}
                </button>
              </div>
              {Object.keys(prijzen).length > 0 ? (
                <div style={{ backgroundColor: "rgba(0,19,55,0.02)", border: "1px solid rgba(0,19,55,0.07)", padding: "10px 12px", borderRadius: "var(--radius-control)" }}>
                  {Object.entries(prijzen).map(([platform, prijs]) => (
                    <div key={platform} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-1.5">
                        <ExternalLink size={9} style={{ color: "rgba(0,19,55,0.3)" }} />
                        <span className="text-xs" style={{ color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)" }}>{PLATFORMS[platform] ?? platform}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>{toonBedrag(prijs, { minimaal: AUTO_ONDERGRENS })}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: "1px solid rgba(0,19,55,0.07)" }}>
                    <span className="text-[10px]" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Gemiddeld</span>
                    <span className="text-xs font-bold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                      {toonBedrag(Object.values(prijzen).reduce((s, p) => s + (bedragUit(p) ?? 0), 0) / Object.values(prijzen).length)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>Nog niet opgehaald — klik op &quot;Ophalen&quot;.</p>
              )}

              {a.opmerking && (
                <div className="mt-4 p-3 text-xs" style={{ backgroundColor: "rgba(0,19,55,0.03)", border: "1px solid rgba(0,19,55,0.07)", color: "rgba(0,19,55,0.65)", fontFamily: "var(--font-inter)", lineHeight: 1.6, borderRadius: "var(--radius-control)" }}>
                  {a.opmerking}
                </div>
              )}

              <p className="text-xs font-bold mb-1.5 mt-4 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>Interne notitie</p>
              <textarea defaultValue={a.notitie} rows={3} onBlur={(e) => { if (e.target.value !== a.notitie) onPatch(a.id, { notitie: e.target.value }); }} placeholder="Intern bijhouden wat er besproken is..." className="w-full px-3 py-2 text-xs outline-none resize-none" style={{ ...S.veld, lineHeight: 1.6 }} />
            </div>

            {/* ── Rechts: stap-afhankelijke acties ── */}
            <div className="flex flex-col gap-4">
              {/* STAP 1 — Nieuw: beoordelen */}
              {a.status === "nieuw" && (
                <div style={{ border: "1px solid rgba(0,19,55,0.1)", borderRadius: "var(--radius-card)", padding: 16 }}>
                  <p className="text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>Stap 1 · Beoordelen</p>
                  <p className="text-[12px] mb-3" style={{ color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
                    Bekijk de auto, haal eventueel marktprijzen op, en beslis of je de auto in consignatie neemt.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => onStatus(a.id, "geaccepteerd")} className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5" style={{ backgroundColor: "#15803d", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}>
                      <CircleCheck size={15} /> Akkoord
                    </button>
                    <button type="button" onClick={() => onStatus(a.id, "afgewezen")} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5" style={{ border: "1px solid #fecaca", color: "#b91c1c", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}>
                      <X size={15} /> Afwijzen
                    </button>
                  </div>
                </div>
              )}

              {/* STAP 2 — Geaccepteerd: contract opstellen + mailen */}
              {a.status === "geaccepteerd" && (
                <ContractStap a={a} onPatch={onPatch} mist={mist} onDruk={() => onDrukContract(a)} onMail={() => onMailContract(a)} contractLaden={contractLaden} />
              )}

              {/* STAP 3 — Lopend: in verkoop, updates */}
              {a.status === "lopend" && (
                <VerkoopStap a={a} nu={nu} onPatch={onPatch} onUpdate={() => onUpdate(a.id)} updateLaden={updateLaden} updateOk={updateOk} onContractOpnieuw={() => onDrukContract(a)} onMail={() => onMailContract(a)} contractLaden={contractLaden} mist={mist} />
              )}

              {/* Afgewezen */}
              {a.status === "afgewezen" && (
                <div style={{ border: "1px solid #fecaca", borderRadius: "var(--radius-card)", padding: 16, backgroundColor: "#fef2f2" }}>
                  <p className="text-sm font-bold mb-1" style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>Afgewezen</p>
                  <p className="text-[12px] mb-3" style={{ color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)" }}>Deze aanvraag is afgewezen. Je kunt hem alsnog accepteren of verwijderen.</p>
                  <button type="button" onClick={() => onStatus(a.id, "nieuw")} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5" style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}>
                    Terugzetten naar nieuw
                  </button>
                </div>
              )}

              {/* Contact + verwijderen — altijd beschikbaar */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  {a.email && (
                    <a href={`mailto:${a.email}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all hover:opacity-80" style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}>
                      <Mail size={13} /> Mail klant
                    </a>
                  )}
                  {a.telefoon && (
                    <a href={`tel:${a.telefoon}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all hover:opacity-80" style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}>
                      <Phone size={13} /> Bel klant
                    </a>
                  )}
                </div>

                {/* Archief-acties: lopend kan naar archief, gearchiveerd kan terug naar actief. */}
                {a.status === "lopend" && (
                  <button
                    type="button"
                    onClick={async () => {
                      const door = await vraag({
                        titel: "Naar het archief?",
                        tekst: `Deze aanvraag verdwijnt uit de actieve tabs en is terug te vinden op de archief-tab. De data blijven bewaard; je kunt hem later altijd weer terughalen.`,
                        bevestig: "Ja, archiveer",
                      });
                      if (door) onStatus(a.id, "archief");
                    }}
                    className="inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all hover:-translate-y-0.5"
                    style={{ border: "1px solid rgba(71,85,105,0.3)", color: "#475569", backgroundColor: "#f1f5f9", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}
                  >
                    <Archive size={13} /> Naar archief
                  </button>
                )}
                {a.status === "archief" && (
                  <button
                    type="button"
                    onClick={() => onStatus(a.id, "lopend")}
                    className="inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all hover:-translate-y-0.5"
                    style={{ border: "1px solid rgba(21,128,61,0.3)", color: "#15803d", backgroundColor: "#f0fdf4", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}
                  >
                    <CircleCheck size={13} /> Terug naar in verkoop
                  </button>
                )}

                <button type="button" onClick={() => onVerwijder(a.id)} className="text-xs py-1.5 transition-all hover:opacity-70 text-center" style={{ color: "#b91c1c", fontFamily: "var(--font-inter)" }}>
                  <Trash2 size={11} className="inline mr-1" /> Verwijder aanvraag
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stap 2: contract-afspraken + versturen ──
function ContractStap({
  a, onPatch, mist, onDruk, onMail, contractLaden,
}: {
  a: Cosignatie;
  onPatch: (id: string, velden: Record<string, unknown>) => void;
  mist: string[];
  onDruk: () => void;
  onMail: () => void;
  contractLaden: boolean;
}) {
  const velden: { label: string; field: keyof Cosignatie; ph?: string; suffix?: string }[] = [
    { label: "Adres eigenaar", field: "klant_adres", ph: "Straat 1" },
    { label: "Postcode", field: "klant_postcode", ph: "1234 AB" },
    { label: "Plaats", field: "klant_stad", ph: "Barendrecht" },
    { label: "Kenteken", field: "kenteken", ph: "AB-123-C" },
    { label: "Chassisnr", field: "vin", ph: "WVW…" },
    { label: "Vergoeding %", field: "fee_percentage", ph: "10", suffix: "%" },
    { label: "Of vast bedrag", field: "fee_vast", ph: "0", suffix: "€" },
    { label: "Niet verkopen onder", field: "bodemprijs", ph: "17000", suffix: "€" },
    { label: "Looptijd (mnd)", field: "looptijd_maanden", ph: "6" },
    { label: "Terugname kosten", field: "terugname_kosten", ph: "50", suffix: "€" },
  ];
  return (
    <div style={{ border: "1px solid rgba(29,78,216,0.25)", borderRadius: "var(--radius-card)", padding: 16, backgroundColor: "#f5f8ff" }}>
      <p className="text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: "#1d4ed8", fontFamily: "var(--font-inter)" }}>Stap 2 · Contract opstellen</p>
      <p className="text-[12px] mb-3" style={{ color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
        Vul de contractafspraken in en stuur het consignatiecontract als PDF naar de klant.
      </p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {velden.map(({ label, field, ph, suffix }) => (
          <div key={String(field)}>
            <label className="block text-[9px] font-semibold uppercase tracking-wider mb-1" style={S.label}>{label}{suffix ? ` (${suffix})` : ""}</label>
            <input
              type="text" placeholder={ph}
              defaultValue={(a as unknown as Record<string, string | number>)[field as string] != null ? String((a as unknown as Record<string, string | number>)[field as string]) : ""}
              onBlur={(e) => { const huidig = (a as unknown as Record<string, string | number>)[field as string]; if (e.target.value !== (huidig != null ? String(huidig) : "")) onPatch(a.id, { [field as string]: e.target.value }); }}
              className="w-full px-2 py-1.5 text-xs outline-none" style={S.veld}
            />
          </div>
        ))}
      </div>
      <div className="mb-3">
        <label className="block text-[9px] font-semibold uppercase tracking-wider mb-1" style={S.label}>Bijzondere afspraken</label>
        <textarea defaultValue={a.bijzondere_afspraken ?? ""} rows={2} onBlur={(e) => { if (e.target.value !== (a.bijzondere_afspraken ?? "")) onPatch(a.id, { bijzondere_afspraken: e.target.value }); }} placeholder="bijv. winterbanden gaan mee" className="w-full px-2 py-1.5 text-xs outline-none resize-none" style={{ ...S.veld, lineHeight: 1.5 }} />
      </div>
      {mist.length > 0 && (
        <p className="text-[11px] mb-3 px-2.5 py-2" style={{ backgroundColor: "#fef3c7", color: "#b45309", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}>
          Nog niet ingevuld: {mist.join(", ")}. Die blijven leeg op het contract.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <button type="button" onClick={onMail} disabled={contractLaden} className="inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50" style={{ backgroundColor: "#001337", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)", boxShadow: "0 6px 16px -8px rgba(0,19,55,0.5)" }}>
          {contractLaden ? <><RefreshCw size={15} className="animate-spin" /> Versturen...</> : <><FileSignature size={15} /> Contract mailen naar klant</>}
        </button>
        <button type="button" onClick={onDruk} disabled={contractLaden} className="inline-flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50" style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}>
          Eerst afdrukken / bekijken
        </button>
      </div>
      {a.contract_nr && <p className="text-[11px] mt-2" style={{ color: "#15803d", fontFamily: "var(--font-inter)" }}>Contractnummer {a.contract_nr}</p>}
    </div>
  );
}

// ── Stap 3: in verkoop, automatische + handmatige updates ──
function VerkoopStap({
  a, nu, onPatch, onUpdate, updateLaden, updateOk, onContractOpnieuw, onMail, contractLaden, mist,
}: {
  a: Cosignatie;
  nu: number;
  onPatch: (id: string, velden: Record<string, unknown>) => void;
  onUpdate: () => void;
  updateLaden: boolean;
  updateOk: boolean;
  onContractOpnieuw: () => void;
  onMail: () => void;
  contractLaden: boolean;
  mist: string[];
}) {
  /** Contract klopt niet volgens de klant? Dan hier aanpassen en opnieuw mailen. */
  const [wijzigen, setWijzigen] = useState(false);
  const autoUpdates = a.auto_updates !== false;
  const gemaild = a.contract_gemaild_op ? new Date(a.contract_gemaild_op) : null;
  const laatste = a.laatste_update_op ? new Date(a.laatste_update_op) : null;
  const dagenSindsUpdate = laatste ? Math.floor((nu - laatste.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const volgende = laatste ? Math.max(0, 14 - (dagenSindsUpdate ?? 0)) : 0;

  return (
    <div style={{ border: "1px solid rgba(21,128,61,0.25)", borderRadius: "var(--radius-card)", padding: 16, backgroundColor: "#f2fbf5" }}>
      <p className="text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: "#15803d", fontFamily: "var(--font-inter)" }}>Stap 3 · In verkoop</p>
      <p className="text-[12px] mb-3" style={{ color: "rgba(0,19,55,0.55)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
        {gemaild ? `Contract gemaild op ${gemaild.toLocaleDateString("nl-NL")}. ` : ""}
        De auto staat in de verkoop.
      </p>

      {/* Automatische updates aan/uit */}
      <div className="flex items-center justify-between px-3 py-2.5 mb-3" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.08)", borderRadius: "var(--radius-control)" }}>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>Automatische update om de week</p>
          <p className="text-[10px]" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
            {autoUpdates
              ? (laatste ? `Laatste: ${laatste.toLocaleDateString("nl-NL")} · volgende over ${volgende} dag${volgende !== 1 ? "en" : ""}` : "Eerste update binnen 14 dagen")
              : "Staat uit — geen automatische mails"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoUpdates}
          onClick={() => onPatch(a.id, { auto_updates: !autoUpdates })}
          className="relative flex-shrink-0 transition-all"
          style={{ width: 42, height: 24, borderRadius: 999, backgroundColor: autoUpdates ? "#15803d" : "rgba(0,19,55,0.2)" }}
        >
          <span style={{ position: "absolute", top: 2, left: autoUpdates ? 20 : 2, width: 20, height: 20, borderRadius: 999, backgroundColor: "#fff", transition: "left 150ms ease" }} />
        </button>
      </div>

      <button type="button" onClick={onUpdate} disabled={updateLaden} className="inline-flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 mb-2" style={{ backgroundColor: updateOk ? "#15803d" : "#001337", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}>
        {updateLaden ? <><RefreshCw size={14} className="animate-spin" /> Versturen...</> : updateOk ? <><Check size={14} /> Update verstuurd!</> : <><Send size={14} /> Nu handmatig update sturen</>}
      </button>

      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={onContractOpnieuw} className="inline-flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-all hover:-translate-y-0.5" style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}>
          <FileSignature size={13} /> Contract opnieuw bekijken
        </button>
        <button type="button" onClick={() => setWijzigen((w) => !w)} className="inline-flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-all hover:-translate-y-0.5" style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}>
          <Pencil size={13} /> {wijzigen ? "Wijzigen sluiten" : "Contract wijzigen"}
        </button>

        {/* Klopt er iets niet volgens de klant? Pas de afspraken hier aan en
            stuur de nieuwe versie — de klant krijgt dan een verse PDF. */}
        {wijzigen && (
          <div className="mt-1 p-3" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.1)", borderRadius: "var(--radius-control)" }}>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {([
                { label: "Adres eigenaar", field: "klant_adres", ph: "Straat 1" },
                { label: "Postcode", field: "klant_postcode", ph: "1234 AB" },
                { label: "Plaats", field: "klant_stad", ph: "Barendrecht" },
                { label: "Kenteken", field: "kenteken", ph: "AB-123-C" },
                { label: "Chassisnr", field: "vin", ph: "WVW…" },
                { label: "Vraagprijs", field: "vraagprijs", ph: "16000", suffix: "€" },
                { label: "Vergoeding %", field: "fee_percentage", ph: "10", suffix: "%" },
                { label: "Of vast bedrag", field: "fee_vast", ph: "0", suffix: "€" },
                { label: "Niet verkopen onder", field: "bodemprijs", ph: "17000", suffix: "€" },
                { label: "Looptijd (mnd)", field: "looptijd_maanden", ph: "6" },
                { label: "Terugname kosten", field: "terugname_kosten", ph: "50", suffix: "€" },
              ] as { label: string; field: keyof Cosignatie; ph?: string; suffix?: string }[]).map(({ label, field, ph, suffix }) => (
                <div key={String(field)}>
                  <label className="block text-[9px] font-semibold uppercase tracking-wider mb-1" style={S.label}>{label}{suffix ? ` (${suffix})` : ""}</label>
                  <input
                    type="text" placeholder={ph}
                    defaultValue={(a as unknown as Record<string, string | number>)[field as string] != null ? String((a as unknown as Record<string, string | number>)[field as string]) : ""}
                    onBlur={(e) => { const huidig = (a as unknown as Record<string, string | number>)[field as string]; if (e.target.value !== (huidig != null ? String(huidig) : "")) onPatch(a.id, { [field as string]: e.target.value }); }}
                    className="w-full px-2 py-1.5 text-xs outline-none" style={S.veld}
                  />
                </div>
              ))}
            </div>
            <div className="mb-2">
              <label className="block text-[9px] font-semibold uppercase tracking-wider mb-1" style={S.label}>Bijzondere afspraken</label>
              <textarea defaultValue={a.bijzondere_afspraken ?? ""} rows={2} onBlur={(e) => { if (e.target.value !== (a.bijzondere_afspraken ?? "")) onPatch(a.id, { bijzondere_afspraken: e.target.value }); }} placeholder="bijv. winterbanden gaan mee" className="w-full px-2 py-1.5 text-xs outline-none resize-none" style={{ ...S.veld, lineHeight: 1.5 }} />
            </div>
            {mist.length > 0 && (
              <p className="text-[11px] mb-2 px-2.5 py-2" style={{ backgroundColor: "#fef3c7", color: "#b45309", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)" }}>
                Nog niet ingevuld: {mist.join(", ")}.
              </p>
            )}
            <button type="button" onClick={onMail} disabled={contractLaden} className="inline-flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50" style={{ backgroundColor: "#1d4ed8", fontFamily: "var(--font-inter)", borderRadius: "var(--radius-control)", boxShadow: "0 6px 16px -8px rgba(29,78,216,0.5)" }}>
              {contractLaden ? <><RefreshCw size={14} className="animate-spin" /> Versturen...</> : <><Send size={14} /> Gewijzigd contract opnieuw mailen</>}
            </button>
            <p className="text-[10px] mt-1.5" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)", lineHeight: 1.5 }}>
              Wijzigingen worden direct opgeslagen. De klant krijgt de nieuwste versie als PDF, met hetzelfde contractnummer.
            </p>
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-1">
          <Clock size={11} style={{ color: "rgba(0,19,55,0.35)" }} />
          <span className="text-[10px]" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
            {a.contract_nr ? `Contract ${a.contract_nr}` : "Nog geen contractnummer"}
          </span>
        </div>
      </div>
    </div>
  );
}

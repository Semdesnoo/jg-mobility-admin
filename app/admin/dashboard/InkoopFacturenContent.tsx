"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useScrollNaar } from "@/lib/use-scroll-naar";
import { Plus, Upload, Sparkles, Trash2, AlertTriangle, Check, Wallet, Mail, FileText, Paperclip } from "lucide-react";

type InkoopFactuur = {
  id: string; leverancier: string; factuurnummer: string;
  datum: string; vervaldatum: string;
  bedrag_incl: number; btw_bedrag: number; btw_tarief: number;
  omschrijving: string; categorie: string;
  status: "open" | "betaald"; betaald_op: string | null;
  bron: "handmatig" | "ai" | "email"; gmail_afzender: string;
  gmail_message_id: string | null; dagenOver: number | null;
};

/** Een bijlage uit de bron-e-mail (meestal de factuur-PDF van de leverancier). */
type Bijlage = { attachmentId: string; filename: string; mimeType: string; size: number };

type Overzicht = {
  facturen: InkoopFactuur[];
  openTotaal: number; openAantal: number;
  teLaatTotaal: number; teLaatAantal: number;
  binnenkortAantal: number; voorbelasting: number;
};

const CATEGORIEEN = [
  "Auto-inkoop", "Onderhoud & reparatie", "Poets & detailing", "Transport",
  "Advertentie & marketing", "Kantoor & software", "Overig",
];

const ROOD = "#b91c1c";
const GROEN = "#15803d";
const AMBER = "#b45309";

const euro = (n: number) => `€${n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const euroKort = (n: number) => `€${Math.round(n).toLocaleString("nl-NL")}`;

const leegFormulier = () => ({
  leverancier: "", factuurnummer: "", datum: new Date().toISOString().slice(0, 10),
  vervaldatum: "", bedrag_incl: "", btw_bedrag: "", btw_tarief: "21",
  omschrijving: "", categorie: "Overig", bron: "handmatig" as "handmatig" | "ai",
});

const veldStijl: React.CSSProperties = {
  border: "1px solid rgba(0,19,55,0.15)", color: "#001337",
  fontFamily: "var(--font-inter)", backgroundColor: "#fafafa",
};
const labelStijl: React.CSSProperties = { color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" };

export default function InkoopFacturenContent() {
  const [data, setData] = useState<Overzicht | null>(null);
  const [laden, setLaden] = useState(true);
  const [toonForm, setToonForm] = useState(false);
  const [form, setForm] = useState(leegFormulier);
  const [bezig, setBezig] = useState(false);
  const [aiBezig, setAiBezig] = useState(false);
  const [aiMelding, setAiMelding] = useState<string | null>(null);
  const [onzeker, setOnzeker] = useState<string[]>([]);
  const bestandRef = useRef<HTMLInputElement>(null);
  const formRef = useScrollNaar<HTMLDivElement>(toonForm);
  // Het gekozen bestand blijft hangen, zodat je zelf bepaalt of je het laat
  // uitlezen of de bedragen met de hand invult.
  const [bestand, setBestand] = useState<File | null>(null);
  const [sleep, setSleep] = useState(false);
  const [scanBezig, setScanBezig] = useState(false);
  // Voortgang van de doorlopende scan: hoeveel mails al bekeken en hoeveel er nog
  // wachten, zodat de knop een echte teller kan tonen.
  const [scanVoortgang, setScanVoortgang] = useState<{ bekeken: number; resterend: number } | null>(null);
  const [scanUitslag, setScanUitslag] = useState<{
    verwerkt?: number; nieuw?: number; resterend?: number; klaar?: boolean;
    toegevoegd?: { leverancier: string; bedrag: number; vervaldatum: string; onzeker: string[] }[];
    overgeslagen?: { onderwerp: string; reden: string }[];
    error?: string; blokkades?: string[]; ontbrekendeSleutel?: boolean; geenGmail?: boolean;
  } | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    try {
      const r = await fetch("/api/admin/inkoopfacturen");
      if (r.ok) setData(await r.json());
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => { laad(); }, [laad]);

  /** Stuurt het bestand naar Claude en vult het formulier met wat eruit komt. */
  const leesUit = async () => {
    if (!bestand) return;
    setAiBezig(true);
    setAiMelding(null);
    setOnzeker([]);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const lezer = new FileReader();
        lezer.onload = () => res(String(lezer.result).split(",")[1] ?? "");
        lezer.onerror = rej;
        lezer.readAsDataURL(bestand);
      });

      const r = await fetch("/api/admin/inkoopfacturen/uitlezen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bestandBase64: base64, mediaType: bestand.type, bestandsnaam: bestand.name }),
      });
      const uit = await r.json();

      if (uit.error) {
        setAiMelding(uit.ontbrekendeSleutel
          ? "ANTHROPIC_API_KEY is leeg — vul die in om facturen automatisch te laten uitlezen."
          : uit.error);
        return;
      }

      setForm({
        leverancier: uit.leverancier ?? "",
        factuurnummer: uit.factuurnummer ?? "",
        datum: uit.datum ?? "",
        vervaldatum: uit.vervaldatum ?? "",
        bedrag_incl: uit.bedrag_incl ? String(uit.bedrag_incl) : "",
        btw_bedrag: uit.btw_bedrag != null ? String(uit.btw_bedrag) : "",
        btw_tarief: uit.btw_tarief != null ? String(uit.btw_tarief) : "21",
        omschrijving: uit.omschrijving ?? "",
        categorie: uit.categorie ?? "Overig",
        bron: "ai",
      });
      setOnzeker(Array.isArray(uit.onzeker) ? uit.onzeker : []);
      setToonForm(true);
    } catch (e) {
      setAiMelding(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBezig(false);
    }
  };

  /**
   * Doorzoekt de mailbox op facturen en boekt ze in. De route verwerkt een
   * handvol mails per aanroep (Vercel kapt af op 60s); deze functie rijgt die
   * rondes aaneen tot de mailbox helemaal is nagelopen — één klik, alles erin.
   * Reeds bekeken mails worden server-side onthouden, dus de scan convergeert en
   * kost niets dubbel.
   */
  const scanEmail = async () => {
    setScanBezig(true);
    setScanUitslag(null);
    setScanVoortgang({ bekeken: 0, resterend: 0 });

    const alleToegevoegd: { leverancier: string; bedrag: number; vervaldatum: string; onzeker: string[] }[] = [];
    const alleOvergeslagen: { onderwerp: string; reden: string }[] = [];
    let bekeken = 0;
    let ietsGeboekt = false;

    try {
      // Harde bovengrens als vangnet: 80 rondes × 4 mails = 320, ruim boven een
      // normale mailbox. Voorkomt een oneindige lus mocht resterend ooit blijven
      // hangen.
      for (let ronde = 0; ronde < 80; ronde++) {
        const r = await fetch("/api/admin/inkoopfacturen/scan-email", { method: "POST" });
        const uit = await r.json();

        if (uit.error) {
          setScanUitslag(uit);
          setScanVoortgang(null);
          return;
        }

        alleToegevoegd.push(...(uit.toegevoegd ?? []));
        alleOvergeslagen.push(...(uit.overgeslagen ?? []));
        bekeken += (uit.toegevoegd?.length ?? 0) + (uit.overgeslagen?.length ?? 0);
        if ((uit.verwerkt ?? 0) > 0) ietsGeboekt = true;

        const resterend = uit.resterend ?? 0;
        setScanVoortgang({ bekeken, resterend });
        // Tussentijds tonen zodat de gebruiker het ziet groeien.
        setScanUitslag({
          verwerkt: alleToegevoegd.length,
          toegevoegd: alleToegevoegd,
          overgeslagen: alleOvergeslagen,
          resterend,
          klaar: false,
        });

        // Niets meer te doen, of deze ronde bekeek niets meer (geen voortgang):
        // dan zijn we klaar.
        const bekekenDezeRonde = (uit.toegevoegd?.length ?? 0) + (uit.overgeslagen?.length ?? 0);
        if (resterend <= 0 || bekekenDezeRonde === 0) break;
      }

      setScanUitslag({
        verwerkt: alleToegevoegd.length,
        toegevoegd: alleToegevoegd,
        overgeslagen: alleOvergeslagen,
        resterend: 0,
        klaar: true,
      });
      if (ietsGeboekt) await laad();
    } catch (e) {
      setScanUitslag({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setScanBezig(false);
      setScanVoortgang(null);
    }
  };

  const bewaar = async () => {
    if (!form.leverancier.trim() || !form.bedrag_incl) return;
    setBezig(true);
    try {
      await fetch("/api/admin/inkoopfacturen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          bedrag_incl: parseFloat(form.bedrag_incl) || 0,
          btw_bedrag: parseFloat(form.btw_bedrag) || 0,
          btw_tarief: parseFloat(form.btw_tarief) || 0,
        }),
      });
      setForm(leegFormulier());
      setOnzeker([]);
      setToonForm(false);
      await laad();
    } finally {
      setBezig(false);
    }
  };

  const zetStatus = async (f: InkoopFactuur, status: "open" | "betaald") => {
    await fetch(`/api/admin/inkoopfacturen/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await laad();
  };

  // ── Meerdere tegelijk ────────────────────────────────────────────
  const [selectie, setSelectie] = useState<Set<string>>(new Set());
  const [bulkBezig, setBulkBezig] = useState(false);

  const wisselSelectie = (id: string) =>
    setSelectie((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  /** Zet de status van alle geselecteerde facturen in één handeling. De
   *  bestaande route werkt per factuur; die roepen we parallel aan. */
  const bulkStatus = async (status: "open" | "betaald") => {
    if (selectie.size === 0) return;
    setBulkBezig(true);
    try {
      await Promise.all(
        [...selectie].map((id) =>
          fetch(`/api/admin/inkoopfacturen/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          })
        )
      );
      setSelectie(new Set());
      await laad();
    } finally {
      setBulkBezig(false);
    }
  };

  const verwijder = async (f: InkoopFactuur) => {
    if (!confirm(`Factuur van ${f.leverancier || "onbekende leverancier"} verwijderen?`)) return;
    await fetch(`/api/admin/inkoopfacturen/${f.id}`, { method: "DELETE" });
    await laad();
  };

  // ── Bijlagen uit de bron-e-mail ──────────────────────────────────
  // De originele factuur-PDF die de leverancier meestuurde, lazy opgehaald: pas
  // bij het openklappen doen we de Gmail-call, zodat de lijst niet trager laadt.
  const [bijlageOpen, setBijlageOpen] = useState<Set<string>>(new Set());
  const [bijlageState, setBijlageState] = useState<
    Record<string, { status: "laden" | "klaar" | "leeg" | "fout"; items: Bijlage[] }>
  >({});

  const openBijlagen = async (f: InkoopFactuur) => {
    setBijlageOpen((prev) => {
      const n = new Set(prev);
      if (n.has(f.id)) n.delete(f.id);
      else n.add(f.id);
      return n;
    });
    if (!f.gmail_message_id || bijlageState[f.id]) return; // al geladen of geen mail
    setBijlageState((p) => ({ ...p, [f.id]: { status: "laden", items: [] } }));
    try {
      const r = await fetch(`/api/admin/gmail/attachments?messageId=${encodeURIComponent(f.gmail_message_id)}`);
      const uit = await r.json().catch(() => ({}));
      const items: Bijlage[] = Array.isArray(uit.bijlagen) ? uit.bijlagen : [];
      setBijlageState((p) => ({ ...p, [f.id]: { status: items.length ? "klaar" : "leeg", items } }));
    } catch {
      setBijlageState((p) => ({ ...p, [f.id]: { status: "fout", items: [] } }));
    }
  };

  const bijlageUrl = (messageId: string, b: Bijlage) =>
    `/api/admin/gmail/attachment?messageId=${encodeURIComponent(messageId)}` +
    `&attachmentId=${encodeURIComponent(b.attachmentId)}` +
    `&mimeType=${encodeURIComponent(b.mimeType)}&name=${encodeURIComponent(b.filename)}`;

  const invoer = (veld: keyof ReturnType<typeof leegFormulier>) => ({
    value: form[veld] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [veld]: e.target.value })),
  });

  return (
    <div>
      <div className="px-4 md:px-8 py-4 md:py-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sticky top-0 z-10" style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}>
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Inkoopfacturen</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
            Wat jij nog moet betalen — handmatig invoeren of laten uitlezen
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={scanEmail}
            disabled={scanBezig}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50"
            style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
          >
            <Mail size={14} />
            {scanBezig
              ? scanVoortgang && scanVoortgang.bekeken > 0
                ? `Bezig… ${scanVoortgang.bekeken} bekeken${scanVoortgang.resterend > 0 ? `, nog ${scanVoortgang.resterend}` : ""}`
                : "E-mail doorzoeken…"
              : "Scan e-mail"}
          </button>
          <button
            onClick={() => { setForm(leegFormulier()); setOnzeker([]); setBestand(null); setToonForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
          >
            <Plus size={14} /> Nieuwe factuur
          </button>
        </div>
      </div>

      <div className="p-4 md:p-8 flex flex-col gap-6">

        {/* ── Bovenaan: wat moet je nog betalen ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 p-6" style={{ backgroundColor: "#001337" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-inter)" }}>
              Nog te betalen
            </p>
            <p className="text-4xl font-bold leading-none text-white" style={{ fontFamily: "var(--font-playfair)" }}>
              {euroKort(data?.openTotaal ?? 0)}
            </p>
            <p className="text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-inter)" }}>
              {data?.openAantal ?? 0} openstaande factu{(data?.openAantal ?? 0) === 1 ? "ur" : "ren"}
            </p>
          </div>
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)", borderColor: "rgba(0,19,55,0.07)" }}>
            {[
              { label: "Te laat", waarde: euroKort(data?.teLaatTotaal ?? 0), sub: `${data?.teLaatAantal ?? 0} over de vervaldatum`, kleur: (data?.teLaatAantal ?? 0) > 0 ? ROOD : "#001337" },
              { label: "Vervalt deze week", waarde: String(data?.binnenkortAantal ?? 0), sub: "binnen 7 dagen", kleur: "#001337" },
              { label: "Voorbelasting", waarde: euroKort(data?.voorbelasting ?? 0), sub: "BTW terug te vorderen", kleur: "#001337" },
            ].map((c) => (
              <div key={c.label} className="px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={labelStijl}>{c.label}</p>
                <p className="text-2xl font-bold leading-none" style={{ fontFamily: "var(--font-playfair)", color: c.kleur }}>{c.waarde}</p>
                <p className="text-[11px] mt-1.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>{c.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Uitslag van de e-mailscan ── */}
        {scanUitslag && (
          scanUitslag.error ? (
            <div className="flex items-start gap-3 px-4 py-3" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
              <AlertTriangle size={15} style={{ color: AMBER, flexShrink: 0, marginTop: 1 }} />
              <p className="text-[12px]" style={{ color: AMBER, fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
                {(scanUitslag.blokkades ?? [scanUitslag.error ?? ""]).map((b, i) => (
                  <span key={i} className="block">{b}</span>
                ))}
              </p>
            </div>
          ) : (
            <div className="px-4 py-3.5" style={{ backgroundColor: "#f8fafc", border: "1px solid rgba(0,19,55,0.08)" }}>
              <p className="text-[12px] font-bold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                {scanUitslag.verwerkt === 0
                  ? "Geen nieuwe facturen gevonden"
                  : `${scanUitslag.verwerkt} factu${scanUitslag.verwerkt === 1 ? "ur" : "ren"} toegevoegd`}
              </p>

              {(scanUitslag.toegevoegd ?? []).map((t, i) => (
                <p key={i} className="text-[11px] mt-1.5 flex items-center gap-1.5" style={{ color: GROEN, fontFamily: "var(--font-inter)" }}>
                  <Check size={11} /> {t.leverancier} — {euro(t.bedrag)}
                  {t.vervaldatum ? ` · uiterlijk ${t.vervaldatum}` : " · geen vervaldatum gevonden"}
                  {t.onzeker.length > 0 && (
                    <span style={{ color: AMBER }}>· controleer: {t.onzeker.join(", ")}</span>
                  )}
                </p>
              ))}

              {scanUitslag.klaar && (
                <p className="text-[11px] mt-2" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>
                  De hele mailbox is nagelopen. Al eerder bekeken mails worden onthouden, dus een
                  volgende scan kijkt alleen naar nieuwe binnengekomen post.
                </p>
              )}

              {(scanUitslag.overgeslagen ?? []).length > 0 && (
                <p className="text-[11px] mt-2" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
                  Overgeslagen: {(scanUitslag.overgeslagen ?? []).map((o) => `${o.onderwerp || "zonder onderwerp"} (${o.reden})`).join(" · ")}
                </p>
              )}
            </div>
          )
        )}

        {aiMelding && (
          <div className="flex items-start gap-3 px-4 py-3" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
            <AlertTriangle size={15} style={{ color: AMBER, flexShrink: 0, marginTop: 1 }} />
            <p className="text-[12px]" style={{ color: AMBER, fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>{aiMelding}</p>
          </div>
        )}

        {/* ── Invoerformulier ── */}
        {toonForm && (
          <div ref={formRef} style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
            <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(0,19,55,0.06)", backgroundColor: "rgba(0,19,55,0.02)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={labelStijl}>Nieuwe inkoopfactuur</p>
              {form.bron === "ai" && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold" style={{ backgroundColor: "#dbeafe", color: "#1d4ed8", fontFamily: "var(--font-inter)" }}>
                  <Sparkles size={9} /> UITGELEZEN — CONTROLEER
                </span>
              )}
            </div>

            {/* Bestand importeren — optioneel. Je kunt ook gewoon typen. */}
            <div className="px-5 pt-5">
              <input
                ref={bestandRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => { const b = e.target.files?.[0]; if (b) { setBestand(b); setAiMelding(null); } }}
              />

              {!bestand ? (
                <div
                  onClick={() => bestandRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setSleep(true); }}
                  onDragLeave={() => setSleep(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setSleep(false);
                    const b = e.dataTransfer.files?.[0];
                    if (b) { setBestand(b); setAiMelding(null); }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); bestandRef.current?.click(); } }}
                  className="flex flex-col items-center justify-center gap-2 py-7 cursor-pointer transition-all"
                  style={{
                    border: `1.5px dashed ${sleep ? "#1d4ed8" : "rgba(0,19,55,0.18)"}`,
                    backgroundColor: sleep ? "#eef4ff" : "#fafbfc",
                  }}
                >
                  <Upload size={20} style={{ color: sleep ? "#1d4ed8" : "rgba(0,19,55,0.3)" }} />
                  <p className="text-[12px] font-semibold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                    Sleep een factuur hierheen of klik om te kiezen
                  </p>
                  <p className="text-[11px]" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                    PDF of foto · optioneel — je kunt de velden ook zelf invullen
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 flex-wrap" style={{ border: "1px solid rgba(0,19,55,0.12)", backgroundColor: "#f8fafc" }}>
                  <FileText size={16} style={{ color: "#1d4ed8", flexShrink: 0 }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold truncate" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                      {bestand.name}
                    </p>
                    <p className="text-[10px]" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                      {(bestand.size / 1024).toFixed(0)} kB · geïmporteerd
                    </p>
                  </div>
                  <button
                    onClick={leesUit}
                    disabled={aiBezig}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: "#001337", color: "#fff", fontFamily: "var(--font-inter)" }}
                  >
                    <Sparkles size={12} />
                    {aiBezig ? "Bezig met uitlezen..." : "Bedragen uitlezen"}
                  </button>
                  <button
                    onClick={() => { setBestand(null); if (bestandRef.current) bestandRef.current.value = ""; }}
                    className="px-3 py-2 text-[12px] font-semibold transition-all hover:opacity-70"
                    style={{ border: "1px solid rgba(0,19,55,0.12)", color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}
                  >
                    Verwijder
                  </button>
                </div>
              )}
            </div>

            {onzeker.length > 0 && (
              <div className="mx-5 mt-4 flex items-start gap-2.5 px-3 py-2.5" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
                <AlertTriangle size={13} style={{ color: AMBER, flexShrink: 0, marginTop: 1 }} />
                <p className="text-[11px]" style={{ color: AMBER, fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
                  Niet met zekerheid van de factuur af te lezen: <strong>{onzeker.join(", ")}</strong>. Die
                  velden zijn leeg gelaten in plaats van gegokt — vul ze zelf aan.
                </p>
              </div>
            )}

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {([
                { veld: "leverancier", label: "Leverancier *", type: "text" },
                { veld: "factuurnummer", label: "Factuurnummer", type: "text" },
                { veld: "datum", label: "Factuurdatum", type: "date" },
                { veld: "vervaldatum", label: "Vervaldatum", type: "date" },
                { veld: "bedrag_incl", label: "Bedrag incl. BTW *", type: "number" },
                { veld: "btw_bedrag", label: "Waarvan BTW", type: "number" },
              ] as const).map((v) => (
                <div key={v.veld}>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={labelStijl}>{v.label}</label>
                  <input type={v.type} step={v.type === "number" ? "0.01" : undefined} {...invoer(v.veld)} className="w-full px-3 py-2 text-sm outline-none" style={veldStijl} />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={labelStijl}>BTW-tarief</label>
                <select {...invoer("btw_tarief")} className="w-full px-3 py-2 text-sm outline-none" style={veldStijl}>
                  <option value="21">21%</option>
                  <option value="9">9%</option>
                  <option value="0">0% / geen BTW (marge)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={labelStijl}>Categorie</label>
                <select {...invoer("categorie")} className="w-full px-3 py-2 text-sm outline-none" style={veldStijl}>
                  {CATEGORIEEN.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={labelStijl}>Omschrijving</label>
                <input {...invoer("omschrijving")} className="w-full px-3 py-2 text-sm outline-none" style={veldStijl} />
              </div>
            </div>

            <div className="px-5 pb-5 flex items-center gap-2">
              <button
                onClick={bewaar}
                disabled={bezig || !form.leverancier.trim() || !form.bedrag_incl}
                className="px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
              >
                {bezig ? "Opslaan..." : "Opslaan"}
              </button>
              <button
                onClick={() => { setToonForm(false); setOnzeker([]); }}
                className="px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-70"
                style={{ border: "1px solid rgba(0,19,55,0.12)", color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}
              >
                Annuleren
              </button>
            </div>
          </div>
        )}

        {/* ── Urgentiemelding: facturen die binnen 3 dagen vervallen ── */}
        {(() => {
          const urgent = (data?.facturen ?? []).filter(
            (f) => f.status === "open" && f.dagenOver !== null && f.dagenOver <= 0 && f.dagenOver >= -3
          );
          if (urgent.length === 0) return null;
          const totaal = urgent.reduce((s, f) => s + f.bedrag_incl, 0);
          return (
            <div className="flex items-start gap-3 px-4 py-3.5" style={{ backgroundColor: "#fee2e2", border: "1px solid #fca5a5" }}>
              <AlertTriangle size={17} style={{ color: ROOD, flexShrink: 0, marginTop: 1 }} strokeWidth={2.5} />
              <div className="min-w-0">
                <p className="text-[12px] font-bold" style={{ color: ROOD, fontFamily: "var(--font-inter)" }}>
                  {urgent.length} factu{urgent.length === 1 ? "ur vervalt" : "ren vervallen"} binnen 3 dagen — samen {euro(totaal)}
                </p>
                <p className="text-[11px] mt-1" style={{ color: "rgba(0,19,55,0.6)", fontFamily: "var(--font-inter)", lineHeight: 1.6 }}>
                  {urgent
                    .slice()
                    .sort((a, b) => (a.dagenOver ?? 0) - (b.dagenOver ?? 0)) // meest urgent eerst (vandaag → +3)
                    .map((f) => {
                      const rest = -(f.dagenOver ?? 0);
                      const wanneer = rest === 0 ? "vandaag" : rest === 1 ? "morgen" : `over ${rest} dagen`;
                      return `${f.leverancier || "onbekend"} (${euro(f.bedrag_incl)}) — ${wanneer}`;
                    })
                    .join(" · ")}
                </p>
              </div>
            </div>
          );
        })()}

        {/* ── Lijst ── */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)" }}>
          {laden ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }} />
            </div>
          ) : !data || data.facturen.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Wallet size={28} style={{ color: "rgba(0,19,55,0.12)" }} />
              <p className="text-sm font-bold mt-3" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>Nog geen inkoopfacturen</p>
              <p className="text-[11px] mt-1 text-center max-w-sm" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)", lineHeight: 1.65 }}>
                Voeg er handmatig één toe, of upload een PDF of foto en laat de bedragen uitlezen.
              </p>
            </div>
          ) : (
            <>
            {/* Selectiebalk: alles aan/uit + bulkacties zodra er iets aan staat */}
            {(() => {
              const alleIds = data.facturen.map((f) => f.id);
              const allesAan = alleIds.length > 0 && alleIds.every((id) => selectie.has(id));
              const somSelectie = data.facturen
                .filter((f) => selectie.has(f.id))
                .reduce((t, f) => t + f.bedrag_incl, 0);
              return (
                <div
                  className="px-5 py-2.5 flex items-center gap-3 flex-wrap sticky top-0 z-[1]"
                  style={{ borderBottom: "1px solid rgba(0,19,55,0.08)", backgroundColor: "#f8fafc" }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectie(allesAan ? new Set() : new Set(alleIds))}
                    className="flex items-center justify-center flex-shrink-0 transition-all"
                    aria-label={allesAan ? "Selectie wissen" : "Alles selecteren"}
                    style={{
                      width: 18, height: 18,
                      border: `1.5px solid ${allesAan ? "#001337" : "rgba(0,19,55,0.3)"}`,
                      backgroundColor: allesAan ? "#001337" : "#ffffff",
                    }}
                  >
                    {allesAan && <Check size={12} style={{ color: "#ffffff" }} strokeWidth={3} />}
                  </button>
                  {selectie.size === 0 ? (
                    <span className="text-[11px]" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>
                      Selecteer facturen om ze in één keer op betaald te zetten
                    </span>
                  ) : (
                    <>
                      <span className="text-[12px] font-bold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                        {selectie.size} geselecteerd · {euro(somSelectie)}
                      </span>
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={() => bulkStatus("betaald")}
                          disabled={bulkBezig}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase transition-all hover:opacity-85 disabled:opacity-50"
                          style={{ backgroundColor: GROEN, color: "#ffffff", fontFamily: "var(--font-inter)" }}
                        >
                          <Check size={12} /> {bulkBezig ? "Bezig…" : "Markeer betaald"}
                        </button>
                        <button
                          type="button"
                          onClick={() => bulkStatus("open")}
                          disabled={bulkBezig}
                          className="px-3 py-1.5 text-[11px] font-bold uppercase transition-all hover:opacity-80 disabled:opacity-50"
                          style={{ border: `1px solid ${AMBER}`, color: AMBER, fontFamily: "var(--font-inter)" }}
                        >
                          Op openstaand
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectie(new Set())}
                          className="text-[11px] transition-all hover:opacity-70"
                          style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}
                        >
                          wissen
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
            {data.facturen.map((f) => {
              const teLaat = f.status === "open" && (f.dagenOver ?? -1) > 0;
              // Bijna te laat: vervalt vandaag of binnen 3 dagen en nog niet betaald.
              // dagenOver is negatief als de vervaldatum nog moet komen (−3 = over 3 dagen).
              const d = f.dagenOver;
              const bijnaTeLaat = f.status === "open" && d !== null && d <= 0 && d >= -3;
              const restDagen = d !== null ? -d : 0; // 0 = vandaag, 3 = over 3 dagen
              const gekozen = selectie.has(f.id);
              return (
                <div key={f.id} className="px-5 py-3 flex items-center gap-4 flex-wrap" style={{ borderBottom: "1px solid rgba(0,19,55,0.05)", opacity: f.status === "betaald" ? 0.6 : 1, backgroundColor: gekozen ? "#eef4ff" : undefined }}>
                  <button
                    type="button"
                    onClick={() => wisselSelectie(f.id)}
                    className="flex items-center justify-center flex-shrink-0 transition-all"
                    aria-label={gekozen ? "Deselecteren" : "Selecteren"}
                    style={{
                      width: 18, height: 18,
                      border: `1.5px solid ${gekozen ? "#001337" : "rgba(0,19,55,0.25)"}`,
                      backgroundColor: gekozen ? "#001337" : "#ffffff",
                    }}
                  >
                    {gekozen && <Check size={12} style={{ color: "#ffffff" }} strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate flex items-center gap-2" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                      {f.leverancier || "Onbekende leverancier"}
                      {f.bron === "ai" && <Sparkles size={11} style={{ color: "#1d4ed8" }} />}
                      {f.bron === "email" && <Mail size={11} style={{ color: "#1d4ed8" }} />}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>
                      {[f.factuurnummer, f.categorie, f.omschrijving, f.datum && `datum ${f.datum}`, f.vervaldatum && `vervalt ${f.vervaldatum}`]
                        .filter(Boolean).join(" · ")}
                    </p>
                  </div>

                  {teLaat && (
                    <span className="px-2 py-1 text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: "#fee2e2", color: ROOD, fontFamily: "var(--font-inter)" }}>
                      {f.dagenOver} dagen te laat
                    </span>
                  )}

                  {bijnaTeLaat && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold flex-shrink-0"
                      style={{ backgroundColor: "#fee2e2", color: ROOD, fontFamily: "var(--font-inter)" }}
                      title="Betaaltermijn loopt bijna af"
                    >
                      <AlertTriangle size={11} strokeWidth={2.5} />
                      {restDagen === 0
                        ? "Vervalt vandaag!"
                        : restDagen === 1
                          ? "Nog 1 dag!"
                          : `Nog ${restDagen} dagen!`}
                    </span>
                  )}

                  <div className="text-right flex-shrink-0" style={{ minWidth: 110 }}>
                    <p className="text-base font-bold" style={{ color: "#001337", fontFamily: "var(--font-playfair)", fontVariantNumeric: "tabular-nums" }}>
                      {euro(f.bedrag_incl)}
                    </p>
                    <p className="text-[10px]" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                      {f.btw_bedrag > 0 ? `${euro(f.btw_bedrag)} btw (${f.btw_tarief}%)` : "geen btw"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {(["open", "betaald"] as const).map((s) => {
                      const actief = f.status === s;
                      return (
                        <button
                          key={s}
                          onClick={() => !actief && zetStatus(f, s)}
                          className="px-2.5 py-1 text-[10px] font-bold uppercase transition-all hover:opacity-80"
                          style={{
                            fontFamily: "var(--font-inter)",
                            backgroundColor: actief ? (s === "betaald" ? "#dcfce7" : "#fef3c7") : "transparent",
                            color: actief ? (s === "betaald" ? GROEN : AMBER) : "rgba(0,19,55,0.3)",
                            border: `1px solid ${actief ? (s === "betaald" ? GROEN : AMBER) : "rgba(0,19,55,0.12)"}`,
                            cursor: actief ? "default" : "pointer",
                          }}
                        >
                          {s === "betaald" && actief && <Check size={9} style={{ display: "inline", marginRight: 3 }} />}
                          {s === "open" ? "Openstaand" : "Betaald"}
                        </button>
                      );
                    })}
                    {f.gmail_message_id && (
                      <button
                        onClick={() => openBijlagen(f)}
                        aria-label="Bijlage uit e-mail openen"
                        title="Open de factuur-bijlage uit de originele e-mail"
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase transition-all hover:opacity-80"
                        style={{
                          border: `1px solid ${bijlageOpen.has(f.id) ? "#1d4ed8" : "rgba(0,19,55,0.15)"}`,
                          color: bijlageOpen.has(f.id) ? "#1d4ed8" : "#001337",
                          backgroundColor: bijlageOpen.has(f.id) ? "rgba(29,78,216,0.06)" : "transparent",
                          fontFamily: "var(--font-inter)",
                        }}
                      >
                        <Paperclip size={11} /> Bijlage
                      </button>
                    )}
                    <button
                      onClick={() => verwijder(f)}
                      aria-label="Verwijderen"
                      className="px-2 py-1 transition-all hover:opacity-70"
                      style={{ border: "1px solid rgba(185,28,28,0.25)", color: ROOD }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>

                  {/* Uitklap: de originele factuur-bijlage(n) uit de e-mail. w-full
                      zodat het onder de regel valt (de regel is flex-wrap). */}
                  {f.gmail_message_id && bijlageOpen.has(f.id) && (
                    <div className="w-full mt-1.5 sm:pl-8">
                      {(() => {
                        const st = bijlageState[f.id];
                        if (!st || st.status === "laden") {
                          return (
                            <p className="text-[11px] flex items-center gap-2" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>
                              <span className="inline-block w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                              Bijlagen laden…
                            </p>
                          );
                        }
                        if (st.status === "fout") {
                          return <p className="text-[11px]" style={{ color: ROOD, fontFamily: "var(--font-inter)" }}>Kon de bijlagen niet ophalen — is Gmail nog gekoppeld?</p>;
                        }
                        if (st.status === "leeg") {
                          return <p className="text-[11px]" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}>Geen bijlage in deze e-mail — de factuur stond vermoedelijk in de tekst van de mail zelf.</p>;
                        }
                        return (
                          <div className="flex flex-col gap-1.5">
                            {st.items.map((b) => (
                              <a
                                key={b.attachmentId}
                                href={bijlageUrl(f.gmail_message_id!, b)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold transition-all hover:opacity-80 w-fit max-w-full"
                                style={{ border: "1px solid rgba(29,78,216,0.25)", color: "#1d4ed8", backgroundColor: "rgba(29,78,216,0.04)", fontFamily: "var(--font-inter)" }}
                              >
                                <FileText size={13} style={{ flexShrink: 0 }} />
                                <span className="truncate">{b.filename}</span>
                                {b.size > 0 && <span style={{ color: "rgba(0,19,55,0.4)" }}>· {(b.size / 1024).toFixed(0)} kB</span>}
                              </a>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Plus, ArrowLeft, Search, Upload, Sparkles } from "lucide-react";

type Optie = { categorie: string; items: string[] };

const STANDAARD_CATEGORIEEN = ["Exterieur", "Interieur", "Technologie", "Aandrijving"];

const leegFormulier = () => ({
  kenteken: "",
  merk: "",
  model: "",
  versie: "",
  bouwjaar: "",
  bodytype: "Hatchback",
  prijs: "",
  km: "",
  brandstof: "Benzine",
  transmissie: "Handgeschakeld",
  vermogen: "",
  kleur: "",
  apk: "Onbekend",
  btw: "Marge",
  bekleding: "Stof",
  kleurExterieur: "",
  omschrijving: "",
  verkocht: false,
  cilinderinhoud: "",
  aantalDeuren: "",
  aantalCilinders: "",
});

export default function AutoToevoegen() {
  const router = useRouter();
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(leegFormulier());
  const [opties, setOpties] = useState<Optie[]>(
    STANDAARD_CATEGORIEEN.map((c) => ({ categorie: c, items: [] }))
  );
  const [fotoPreviews, setFotoPreviews] = useState<string[]>([]);
  const [fotoFiles, setFotoFiles] = useState<File[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [rdwLoading, setRdwLoading] = useState(false);
  const [rdwError, setRdwError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [opslaan, setOpslaan] = useState(false);
  const [error, setError] = useState("");

  const set = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // AI omschrijving + versie + opties genereren
  const genereerAI = async (huidigForm?: typeof form) => {
    const bronForm = huidigForm ?? form;
    if (!bronForm.merk || !bronForm.model) {
      setAiError("Zoek eerst het kenteken op zodat merk en model bekend zijn.");
      return;
    }
    setAiLoading(true);
    setAiError("");

    const res = await fetch("/api/admin/generate-description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bronForm),
    });
    const data = await res.json();

    if (!res.ok) {
      // 503 = geen API key ingesteld → stil overslaan, handmatig invullen
      if (res.status !== 503) {
        setAiError(data.error ?? "AI genereren mislukt");
      }
    } else {
      const geldigeTransmissies = ["Handgeschakeld", "Automatisch", "Semi-automaat"];
      setForm((prev) => ({
        ...prev,
        omschrijving: data.omschrijving || prev.omschrijving,
        versie: data.versie || prev.versie,
        transmissie: geldigeTransmissies.includes(data.transmissie) ? data.transmissie : prev.transmissie,
      }));
      if (data.opties?.length) setOpties(data.opties);
    }
    setAiLoading(false);
  };

  // RDW opzoeking — daarna automatisch AI aanroepen
  const zoekKenteken = async () => {
    if (!form.kenteken.trim()) return;
    setRdwLoading(true);
    setRdwError("");

    const res = await fetch(
      `/api/admin/rdw-lookup?kenteken=${encodeURIComponent(form.kenteken)}`
    );
    const data = await res.json();

    if (!res.ok) {
      setRdwError(data.error ?? "Kenteken niet gevonden");
      setRdwLoading(false);
      return;
    }

    const updatedForm = {
      ...form,
      merk: data.merk || form.merk,
      model: data.model || form.model,
      bouwjaar: data.bouwjaar ? String(data.bouwjaar) : form.bouwjaar,
      kleur: data.kleur || form.kleur,
      kleurExterieur: data.kleur || form.kleurExterieur,
      brandstof: data.brandstof || form.brandstof,
      bodytype: data.bodytype || form.bodytype,
      apk: data.apk || form.apk,
      vermogen: data.vermogen || form.vermogen,
      cilinderinhoud: data.cilinderinhoud || form.cilinderinhoud,
      aantalDeuren: data.aantalDeuren ? String(data.aantalDeuren) : form.aantalDeuren,
      aantalCilinders: data.aantalCilinders ? String(data.aantalCilinders) : form.aantalCilinders,
    };

    setForm(updatedForm);
    setRdwLoading(false);

    // Automatisch AI starten met de verse RDW data
    await genereerAI(updatedForm);
  };

  // Foto's selecteren
  const handleFotos = (files: FileList | null) => {
    if (!files) return;
    const nieuw = Array.from(files);
    setFotoFiles((prev) => [...prev, ...nieuw]);
    nieuw.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) =>
        setFotoPreviews((prev) => [...prev, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const verwijderFoto = (index: number) => {
    setFotoFiles((prev) => prev.filter((_, i) => i !== index));
    setFotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const verplaatsFoto = (van: number, naar: number) => {
    if (van === naar) return;
    const verplaats = <T,>(arr: T[]) => {
      const nieuw = [...arr];
      const [item] = nieuw.splice(van, 1);
      nieuw.splice(naar, 0, item);
      return nieuw;
    };
    setFotoFiles((prev) => verplaats(prev));
    setFotoPreviews((prev) => verplaats(prev));
  };

  // Opties beheer
  const voegItemToe = (catIndex: number, item: string) => {
    if (!item.trim()) return;
    setOpties((prev) =>
      prev.map((o, i) => (i === catIndex ? { ...o, items: [...o.items, item.trim()] } : o))
    );
  };

  const verwijderItem = (catIndex: number, itemIndex: number) => {
    setOpties((prev) =>
      prev.map((o, i) =>
        i === catIndex ? { ...o, items: o.items.filter((_, j) => j !== itemIndex) } : o
      )
    );
  };

  const voegCategorieToe = () => {
    const naam = prompt("Naam van nieuwe categorie:");
    if (naam?.trim()) {
      setOpties((prev) => [...prev, { categorie: naam.trim(), items: [] }]);
    }
  };

  // Opslaan
  const slaOp = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!form.merk || !form.model || !form.prijs || !form.km) {
      setError("Vul minimaal merk, model, prijs en kilometerstand in.");
      return;
    }

    setOpslaan(true);

    try {
      let fotoUrls: string[] = [];

      // Upload foto's rechtstreeks naar Vercel Blob (gedeelde opslag voor admin + website).
      // De volgorde blijft behouden (Promise.all), dus de eerste foto blijft de hoofdfoto.
      if (fotoFiles.length > 0) {
        const { upload } = await import("@vercel/blob/client");
        const kenteken = form.kenteken.replace(/-/g, "").toUpperCase() || `auto-${Date.now()}`;
        fotoUrls = await Promise.all(
          fotoFiles.map(async (file, i) => {
            const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
            const pad = `autos/${kenteken}/${String(i + 1).padStart(2, "0")}.${ext}`;
            const blob = await upload(pad, file, {
              access: "public",
              handleUploadUrl: "/api/admin/upload-photos",
            });
            return blob.url;
          })
        );
      }

      // Sla auto op
      const auto = {
        ...form,
        prijs: Number(form.prijs),
        km: Number(form.km),
        bouwjaar: Number(form.bouwjaar),
        fotos: fotoUrls,
        opties: opties.filter((o) => o.items.length > 0),
      };

      const res = await fetch("/api/admin/save-car", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auto),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Opslaan mislukt");

      router.push("/admin/dashboard");
    } catch (err) {
      setError(String(err));
      setOpslaan(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5f5f5" }}>
      {/* Header */}
      <div
        className="px-6 py-5 sticky top-0 z-40"
        style={{ backgroundColor: "#001337", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-1.5 text-xs transition-all hover:opacity-70"
              style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-inter)" }}
            >
              <ArrowLeft size={12} /> Dashboard
            </Link>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
            <h1
              className="text-sm font-semibold text-white"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              Nieuwe auto
            </h1>
          </div>
          <button
            form="auto-form"
            type="submit"
            disabled={opslaan}
            className="px-5 py-2 text-xs font-semibold tracking-widest uppercase transition-all hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "#ffffff", color: "#001337", fontFamily: "var(--font-inter)" }}
          >
            {opslaan ? "Opslaan..." : "Auto opslaan"}
          </button>
        </div>
      </div>

      {/* ── AI laad-banner ── */}
      {aiLoading && (
        <div
          className="sticky top-[73px] z-30 px-6 py-3 flex items-center justify-center gap-3"
          style={{ backgroundColor: "#001337", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div
            className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin flex-shrink-0"
          />
          <span className="text-sm text-white font-semibold" style={{ fontFamily: "var(--font-inter)" }}>
            AI zoekt internet af voor uitrusting, trim-niveau en omschrijving…
          </span>
        </div>
      )}

      <form id="auto-form" onSubmit={slaOp} className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-8">

        {error && (
          <div
            className="p-4 text-sm"
            style={{ backgroundColor: "#fee2e2", border: "1px solid #fca5a5", color: "#dc2626", fontFamily: "var(--font-inter)" }}
          >
            {error}
          </div>
        )}

        {/* ── KENTEKEN ── */}
        <Sectie titel="Kenteken opzoeken">
          <div className="flex gap-3">
            <input
              type="text"
              value={form.kenteken}
              onChange={(e) => set("kenteken", e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), zoekKenteken())}
              placeholder="bijv. AB-123-C"
              className="flex-1 px-4 py-3 text-sm outline-none tracking-widest uppercase"
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid rgba(0,19,55,0.15)",
                color: "#001337",
                fontFamily: "var(--font-inter)",
              }}
            />
            <button
              type="button"
              onClick={zoekKenteken}
              disabled={rdwLoading || aiLoading || !form.kenteken.trim()}
              className="flex items-center gap-2 px-5 py-3 text-sm font-semibold tracking-wide transition-all hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
            >
              <Search size={14} />
              {rdwLoading ? "RDW zoeken..." : aiLoading ? "AI genereren..." : "Opzoeken"}
            </button>
          </div>
          {rdwError && (
            <p className="text-xs mt-2" style={{ color: "#dc2626", fontFamily: "var(--font-inter)" }}>
              {rdwError}
            </p>
          )}
          {aiError && (
            <p className="text-xs mt-2" style={{ color: "#dc2626", fontFamily: "var(--font-inter)" }}>
              {aiError}
            </p>
          )}
          <p className="text-xs mt-2" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
            Vul het kenteken in — RDW vult de specs automatisch in. Zodra de API key actief is vult AI ook de uitvoering, omschrijving en opties in.
          </p>
        </Sectie>

        {/* ── BASISGEGEVENS ── */}
        <Sectie titel="Basisgegevens">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Veld label="Merk *">
              <input value={form.merk} onChange={(e) => set("merk", e.target.value)} placeholder="bijv. Volkswagen" {...inputProps} />
            </Veld>
            <Veld label="Model *">
              <input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="bijv. Golf 1.5 TSI" {...inputProps} />
            </Veld>
            <Veld label="Uitvoering / versie">
              <input value={form.versie} onChange={(e) => set("versie", e.target.value)} placeholder="bijv. 150 pk | Navi | ACC" {...inputProps} />
            </Veld>
            <Veld label="Bouwjaar">
              <input type="number" value={form.bouwjaar} onChange={(e) => set("bouwjaar", e.target.value)} placeholder="bijv. 2020" {...inputProps} />
            </Veld>
            <Veld label="Vraagprijs (€) *">
              <input type="number" value={form.prijs} onChange={(e) => set("prijs", e.target.value)} placeholder="bijv. 15000" {...inputProps} />
            </Veld>
            <Veld label="Kilometerstand *">
              <input type="number" value={form.km} onChange={(e) => set("km", e.target.value)} placeholder="bijv. 85000" {...inputProps} />
            </Veld>
          </div>
        </Sectie>

        {/* ── KENMERKEN ── */}
        <Sectie titel="Kenmerken">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Veld label="Brandstof">
              <select value={form.brandstof} onChange={(e) => set("brandstof", e.target.value)} {...selectProps}>
                {["Benzine", "Diesel", "Elektrisch", "Hybride", "Hybride (Plug-in)", "LPG"].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </Veld>
            <Veld label="Transmissie">
              <select value={form.transmissie} onChange={(e) => set("transmissie", e.target.value)} {...selectProps}>
                {["Handgeschakeld", "Automatisch", "Semi-automaat"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Veld>
            <Veld label="Carrosserie">
              <select value={form.bodytype} onChange={(e) => set("bodytype", e.target.value)} {...selectProps}>
                {["Hatchback", "Sedan", "Stationwagen", "SUV", "MPV", "Coupe", "Cabriolet", "Bestelauto"].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </Veld>
            <Veld label="Vermogen">
              <input value={form.vermogen} onChange={(e) => set("vermogen", e.target.value)} placeholder="bijv. 150 pk" {...inputProps} />
            </Veld>
            <Veld label="Kleur">
              <input value={form.kleur} onChange={(e) => set("kleur", e.target.value)} placeholder="bijv. Zwart" {...inputProps} />
            </Veld>
            <Veld label="Kleur exterieur (volledig)">
              <input value={form.kleurExterieur} onChange={(e) => set("kleurExterieur", e.target.value)} placeholder="bijv. Sapphire Black metallic" {...inputProps} />
            </Veld>
            <Veld label="APK tot">
              <input value={form.apk} onChange={(e) => set("apk", e.target.value)} placeholder="bijv. 06-2026 of Onbekend" {...inputProps} />
            </Veld>
            <Veld label="BTW / Marge">
              <select value={form.btw} onChange={(e) => set("btw", e.target.value)} {...selectProps}>
                {["Marge", "BTW-auto"].map((b) => <option key={b}>{b}</option>)}
              </select>
            </Veld>
            <Veld label="Bekleding">
              <input value={form.bekleding} onChange={(e) => set("bekleding", e.target.value)} placeholder="bijv. Leder" {...inputProps} />
            </Veld>
            <Veld label="Status">
              <select
                value={form.verkocht ? "verkocht" : "beschikbaar"}
                onChange={(e) => set("verkocht", e.target.value === "verkocht")}
                {...selectProps}
              >
                <option value="beschikbaar">Beschikbaar</option>
                <option value="verkocht">Verkocht</option>
              </select>
            </Veld>
          </div>
        </Sectie>

        {/* ── FOTO'S ── */}
        <Sectie titel={`Foto's (${fotoFiles.length} geselecteerd)`}>
          <div
            className="border-2 border-dashed p-8 text-center cursor-pointer transition-all hover:opacity-70"
            style={{ borderColor: "rgba(0,19,55,0.2)" }}
            onClick={() => fotoInputRef.current?.click()}
          >
            <Upload size={24} className="mx-auto mb-3" style={{ color: "rgba(0,19,55,0.3)" }} />
            <p className="text-sm font-semibold mb-1" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
              Klik om foto&apos;s te uploaden
            </p>
            <p className="text-xs" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
              JPG, PNG, WEBP — meerdere bestanden tegelijk selecteren
            </p>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFotos(e.target.files)}
            />
          </div>

          {fotoPreviews.length > 0 && (
            <>
              <p className="text-xs mt-3 mb-2" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                Sleep foto&apos;s om de volgorde te wijzigen — de eerste foto wordt de hoofdfoto
              </p>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {fotoPreviews.map((src, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                    onDrop={() => {
                      if (dragIndex !== null) verplaatsFoto(dragIndex, i);
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                    className="relative aspect-[4/3] overflow-hidden cursor-grab active:cursor-grabbing transition-all"
                    style={{
                      backgroundColor: "#001337",
                      opacity: dragIndex === i ? 0.4 : 1,
                      outline: dragOverIndex === i && dragIndex !== i ? "2px solid #001337" : "none",
                      outlineOffset: "2px",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-full h-full object-cover pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => verwijderFoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center transition-all hover:opacity-70"
                      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
                    >
                      <X size={10} color="white" />
                    </button>
                    <span
                      className="absolute bottom-1 left-1 text-[8px] px-1 py-0.5 tracking-widest uppercase"
                      style={{
                        backgroundColor: i === 0 ? "#ffffff" : "rgba(0,0,0,0.5)",
                        color: i === 0 ? "#001337" : "#ffffff",
                        fontFamily: "var(--font-inter)",
                      }}
                    >
                      {i === 0 ? "Hoofd" : `${i + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Sectie>

        {/* ── OMSCHRIJVING ── */}
        <Sectie titel="Omschrijving">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
              Schrijf zelf of laat AI genereren op basis van de kenmerken
            </p>
            <button
              type="button"
              onClick={() => genereerAI()}
              disabled={aiLoading || !form.merk}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wide transition-all hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
            >
              <Sparkles size={12} />
              {aiLoading ? "Genereren..." : "AI genereren"}
            </button>
          </div>
          {aiError && (
            <p className="text-xs mb-2" style={{ color: "#dc2626", fontFamily: "var(--font-inter)" }}>
              {aiError}
            </p>
          )}
          <div className="relative">
            <textarea
              value={form.omschrijving}
              onChange={(e) => set("omschrijving", e.target.value)}
              rows={6}
              placeholder="Schrijf hier de omschrijving van de auto, of klik op AI genereren..."
              className="w-full px-4 py-3 text-sm outline-none resize-y transition-opacity"
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid rgba(0,19,55,0.15)",
                color: "#001337",
                fontFamily: "var(--font-inter)",
                lineHeight: "1.7",
                opacity: aiLoading ? 0.4 : 1,
              }}
            />
            {aiLoading && (
              <div className="absolute inset-0 flex items-center justify-center gap-2">
                <div
                  className="w-5 h-5 rounded-full border-2 animate-spin"
                  style={{ borderColor: "rgba(0,19,55,0.15)", borderTopColor: "#001337" }}
                />
                <span className="text-sm font-semibold" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                  Omschrijving schrijven…
                </span>
              </div>
            )}
          </div>
        </Sectie>

        {/* ── OPTIES ── */}
        <Sectie titel="Opties & uitrusting">
          {aiLoading ? (
            <div
              className="flex flex-col items-center justify-center gap-4 py-16"
              style={{ border: "1px dashed rgba(0,19,55,0.15)" }}
            >
              <div
                className="w-10 h-10 rounded-full border-[3px] animate-spin"
                style={{ borderColor: "rgba(0,19,55,0.15)", borderTopColor: "#001337" }}
              />
              <div className="text-center">
                <p className="text-sm font-semibold mb-1" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
                  Opties worden opgezocht…
                </p>
                <p className="text-xs" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                  Uitrusting, trim-niveau en opties voor dit model en bouwjaar
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {opties.map((opt, catIdx) => (
                <OptieCategorie
                  key={opt.categorie}
                  categorie={opt}
                  catIdx={catIdx}
                  onVoegToe={voegItemToe}
                  onVerwijder={verwijderItem}
                />
              ))}
              <button
                type="button"
                onClick={voegCategorieToe}
                className="flex items-center gap-2 self-start text-xs font-semibold transition-all hover:opacity-70"
                style={{ color: "#001337", fontFamily: "var(--font-inter)" }}
              >
                <Plus size={12} /> Categorie toevoegen
              </button>
            </div>
          )}
        </Sectie>

        {/* Submit */}
        <div className="flex justify-end gap-3 pb-8">
          <Link
            href="/admin/dashboard"
            className="px-6 py-3 text-sm font-semibold tracking-wide transition-all hover:opacity-70"
            style={{ border: "1px solid rgba(0,19,55,0.2)", color: "#001337", fontFamily: "var(--font-inter)" }}
          >
            Annuleren
          </Link>
          <button
            type="submit"
            disabled={opslaan}
            className="px-8 py-3 text-sm font-semibold tracking-widest uppercase transition-all hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
          >
            {opslaan ? "Opslaan..." : "Auto opslaan"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Hulpcomponenten ──

const inputProps = {
  className: "w-full px-4 py-2.5 text-sm outline-none",
  style: {
    backgroundColor: "#ffffff",
    border: "1px solid rgba(0,19,55,0.15)",
    color: "#001337",
    fontFamily: "var(--font-inter)",
  } as React.CSSProperties,
};

const selectProps = {
  className: "w-full px-4 py-2.5 text-sm outline-none appearance-none cursor-pointer",
  style: {
    backgroundColor: "#ffffff",
    border: "1px solid rgba(0,19,55,0.15)",
    color: "#001337",
    fontFamily: "var(--font-inter)",
  } as React.CSSProperties,
};

function Sectie({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="p-6" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
      <h2 className="text-base font-bold mb-5" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
        {titel}
      </h2>
      {children}
    </div>
  );
}

function Veld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 tracking-wide" style={{ color: "rgba(0,19,55,0.6)", fontFamily: "var(--font-inter)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function OptieCategorie({
  categorie,
  catIdx,
  onVoegToe,
  onVerwijder,
}: {
  categorie: Optie;
  catIdx: number;
  onVoegToe: (ci: number, item: string) => void;
  onVerwijder: (ci: number, ii: number) => void;
}) {
  const [nieuw, setNieuw] = useState("");

  const voegToe = () => {
    onVoegToe(catIdx, nieuw);
    setNieuw("");
  };

  return (
    <div>
      <h3
        className="text-sm font-bold mb-3 pb-2"
        style={{ color: "#001337", fontFamily: "var(--font-playfair)", borderBottom: "1px solid rgba(0,19,55,0.08)" }}
      >
        {categorie.categorie}
      </h3>

      <div className="flex flex-col gap-1.5 mb-3">
        {categorie.items.map((item, ii) => (
          <div key={ii} className="flex items-center gap-2 group">
            <div className="w-1.5 h-1.5 flex-shrink-0" style={{ backgroundColor: "#001337" }} />
            <span className="text-sm flex-1" style={{ color: "#374151", fontFamily: "var(--font-inter)" }}>
              {item}
            </span>
            <button
              type="button"
              onClick={() => onVerwijder(catIdx, ii)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} style={{ color: "#dc2626" }} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={nieuw}
          onChange={(e) => setNieuw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), voegToe())}
          placeholder="Optie toevoegen..."
          className="flex-1 px-3 py-2 text-sm outline-none"
          style={{
            backgroundColor: "rgba(0,19,55,0.03)",
            border: "1px solid rgba(0,19,55,0.1)",
            color: "#001337",
            fontFamily: "var(--font-inter)",
          }}
        />
        <button
          type="button"
          onClick={voegToe}
          disabled={!nieuw.trim()}
          className="px-3 py-2 transition-all hover:opacity-70 disabled:opacity-30"
          style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337" }}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

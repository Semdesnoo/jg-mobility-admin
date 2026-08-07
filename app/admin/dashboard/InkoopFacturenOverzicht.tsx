"use client";

import { useState, useMemo, useEffect } from "react";
import { Download, AlertTriangle, Calendar, FileArchive, Check } from "lucide-react";
import { boekDatum, betaalDatum, kwartaalVan, maandSleutel, maandNaam } from "@/lib/factuur-periode";

type InkoopFactuur = {
  id: string; leverancier: string; factuurnummer: string;
  datum: string; vervaldatum: string;
  bedrag_incl: number; btw_bedrag: number; btw_tarief: number;
  omschrijving: string; categorie: string;
  status: "open" | "betaald"; betaald_op: string | null;
  bron: string; gmail_message_id: string | null;
};

type Bijlage = { attachmentId: string; filename: string; mimeType: string; size: number };
type FactuurMetBijlagen = InkoopFactuur & { bijlagen: Bijlage[]; geenDocumentReden: string };

type KwartaalData = {
  jaar: number; kwartaal: number; periode: string;
  facturen: FactuurMetBijlagen[];
  totalen: { aantal: number; incl: number; btw: number; excl: number };
  perCategorie: { categorie: string; aantal: number; incl: number; btw: number }[];
  metDocument: number; zonderDocument: number;
  gmailFout: string; afgekapt: boolean;
};

const NAVY = "#001337";
const ROOD = "#b91c1c";
const GROEN = "#15803d";
const AMBER = "#b45309";

const euro = (n: number) =>
  `€${n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const paneel: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid rgba(0,19,55,0.07)",
  boxShadow: "0 1px 3px rgba(0,19,55,0.05)",
};
const kop: React.CSSProperties = { fontFamily: "var(--font-playfair)", color: NAVY, fontWeight: 700 };
const tekst: React.CSSProperties = { fontFamily: "var(--font-inter)", color: "rgba(0,19,55,0.6)" };
const cel: React.CSSProperties = {
  padding: "9px 14px",
  fontFamily: "var(--font-inter)",
  fontSize: 12.5,
  color: NAVY,
};
const kopCel: React.CSSProperties = {
  padding: "9px 14px",
  fontFamily: "var(--font-inter)",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(0,19,55,0.4)",
  textAlign: "left",
  whiteSpace: "nowrap",
};

/** Bestandsnaam die op elk besturingssysteem veilig is. */
function veiligeNaam(s: string, max = 60): string {
  return (s || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max) || "onbekend";
}

/** Nederlandse Excel verwacht puntkomma's en komma's als decimaalteken. */
function naarCsv(facturen: FactuurMetBijlagen[]): string {
  const kolommen = [
    "Factuurdatum", "Vervaldatum", "Leverancier", "Factuurnummer", "Omschrijving",
    "Categorie", "Bedrag incl. BTW", "BTW-bedrag", "Bedrag excl. BTW", "BTW-tarief",
    "Status", "Betaald op", "Document bijgevoegd",
  ];
  const getal = (n: number) => n.toFixed(2).replace(".", ",");
  const veld = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;

  const regels = facturen.map((f) =>
    [
      veld(f.datum), veld(f.vervaldatum), veld(f.leverancier), veld(f.factuurnummer),
      veld(f.omschrijving), veld(f.categorie),
      getal(f.bedrag_incl), getal(f.btw_bedrag), getal(f.bedrag_incl - f.btw_bedrag),
      getal(f.btw_tarief), veld(f.status), veld(f.betaald_op ?? ""),
      veld(f.bijlagen.length ? "ja" : "nee"),
    ].join(";")
  );

  const t = facturen.reduce(
    (a, f) => ({ incl: a.incl + f.bedrag_incl, btw: a.btw + f.btw_bedrag }),
    { incl: 0, btw: 0 }
  );
  regels.push(
    ["", "", "TOTAAL", "", "", "", getal(t.incl), getal(t.btw), getal(t.incl - t.btw), "", "", "", ""].join(";")
  );

  // BOM vooraan, anders maakt Excel er "Ã©" van bij accenten in leveranciersnamen.
  return "﻿" + [kolommen.join(";"), ...regels].join("\r\n");
}

export default function InkoopFacturenOverzicht({ facturen }: { facturen: InkoopFactuur[] }) {
  const [periodes, setPeriodes] = useState<{ jaar: number; kwartaal: number; aantal: number }[]>([]);
  const [gekozen, setGekozen] = useState<{ jaar: number; kwartaal: number } | null>(null);
  const [data, setData] = useState<KwartaalData | null>(null);
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState("");
  const [pakken, setPakken] = useState(false);
  const [voortgang, setVoortgang] = useState("");
  const [klaar, setKlaar] = useState(false);

  useEffect(() => {
    fetch("/api/admin/inkoopfacturen/kwartaal", { method: "POST" })
      .then((r) => (r.ok ? r.json() : { periodes: [] }))
      .then((d) => {
        setPeriodes(d.periodes ?? []);
        if (d.periodes?.length) setGekozen({ jaar: d.periodes[0].jaar, kwartaal: d.periodes[0].kwartaal });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!gekozen) return;
    setLaden(true);
    setFout("");
    setKlaar(false);
    fetch(`/api/admin/inkoopfacturen/kwartaal?jaar=${gekozen.jaar}&kwartaal=${gekozen.kwartaal}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Ophalen mislukt");
        return d;
      })
      .then(setData)
      .catch((e) => { setFout(String(e.message ?? e)); setData(null); })
      .finally(() => setLaden(false));
  }, [gekozen]);

  /** Per maand: wat moet er nog betaald worden. Alleen openstaande facturen —
   *  betaalde staan niet meer op je rekening te wachten. */
  const perMaand = useMemo(() => {
    const kaart = new Map<string, { aantal: number; incl: number; teLaat: number }>();
    const vandaag = new Date();
    vandaag.setHours(0, 0, 0, 0);
    for (const f of facturen) {
      if (f.status !== "open") continue;
      const d = betaalDatum(f);
      if (!d) continue;
      const s = maandSleutel(d);
      const r = kaart.get(s) ?? { aantal: 0, incl: 0, teLaat: 0 };
      r.aantal++;
      r.incl += f.bedrag_incl;
      if (d < vandaag) r.teLaat++;
      kaart.set(s, r);
    }
    return [...kaart.entries()]
      .map(([sleutel, v]) => ({ sleutel, ...v }))
      .sort((a, b) => a.sleutel.localeCompare(b.sleutel));
  }, [facturen]);

  /** Per kwartaal: alles wat in die periode is gefactureerd — open én betaald,
   *  want de BTW-aangifte gaat over de factuurdatum, niet over de betaaldatum. */
  const perKwartaal = useMemo(() => {
    const kaart = new Map<string, { jaar: number; kwartaal: number; aantal: number; incl: number; btw: number }>();
    for (const f of facturen) {
      const d = boekDatum(f);
      if (!d) continue;
      const jaar = d.getFullYear();
      const kw = kwartaalVan(d);
      const s = `${jaar}-${kw}`;
      const r = kaart.get(s) ?? { jaar, kwartaal: kw, aantal: 0, incl: 0, btw: 0 };
      r.aantal++;
      r.incl += f.bedrag_incl;
      r.btw += f.btw_bedrag;
      kaart.set(s, r);
    }
    return [...kaart.values()].sort((a, b) => b.jaar - a.jaar || b.kwartaal - a.kwartaal);
  }, [facturen]);

  const zonderDatum = useMemo(() => facturen.filter((f) => boekDatum(f) === null).length, [facturen]);

  /**
   * Bouwt de zip in de browser.
   *
   * Bewust hier en niet op de server: een kwartaal aan PDF's is zo tientallen
   * megabytes, en Vercel kapt zowel de responsgrootte als de looptijd af. In de
   * browser is er geen limiet en zie je bovendien hoe ver hij is.
   */
  const maakZip = async () => {
    if (!data || pakken) return;
    setPakken(true);
    setKlaar(false);
    setFout("");
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const naam = `Inkoopfacturen ${data.jaar} Q${data.kwartaal}`;

      zip.file("specificatie.csv", naarCsv(data.facturen));

      const map = zip.folder("facturen");
      const ontbreekt: string[] = [];
      let nr = 0;

      for (let i = 0; i < data.facturen.length; i++) {
        const f = data.facturen[i];
        setVoortgang(`Factuur ${i + 1} van ${data.facturen.length} ophalen…`);

        if (f.bijlagen.length === 0) {
          ontbreekt.push(
            `${f.datum || "?"} — ${f.leverancier || "onbekend"} — ${euro(f.bedrag_incl)}` +
              (f.geenDocumentReden ? ` (${f.geenDocumentReden})` : "")
          );
          continue;
        }

        for (const b of f.bijlagen) {
          try {
            const url =
              `/api/admin/gmail/attachment?messageId=${encodeURIComponent(f.gmail_message_id ?? "")}` +
              `&attachmentId=${encodeURIComponent(b.attachmentId)}` +
              `&mimeType=${encodeURIComponent(b.mimeType)}&name=${encodeURIComponent(b.filename)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(String(res.status));
            const blob = await res.blob();

            nr++;
            const ext = b.filename.includes(".") ? b.filename.slice(b.filename.lastIndexOf(".")) : "";
            const bestandsnaam =
              `${String(nr).padStart(3, "0")} - ${veiligeNaam(f.leverancier)}` +
              `${f.factuurnummer ? ` - ${veiligeNaam(f.factuurnummer, 30)}` : ""}${ext}`;
            map?.file(bestandsnaam, blob);
          } catch {
            ontbreekt.push(
              `${f.datum || "?"} — ${f.leverancier || "onbekend"} — bijlage "${b.filename}" kon niet worden opgehaald`
            );
          }
        }
      }

      if (ontbreekt.length) {
        zip.file(
          "ONTBREKENDE DOCUMENTEN.txt",
          [
            `Van deze facturen zit geen document in dit bestand (${ontbreekt.length} stuks).`,
            "De bedragen staan wél in specificatie.csv, dus de aangifte klopt.",
            "",
            ...ontbreekt.map((r) => `- ${r}`),
          ].join("\r\n")
        );
      }

      setVoortgang("Inpakken…");
      const blob = await zip.generateAsync({ type: "blob" }, (m) => {
        setVoortgang(`Inpakken… ${Math.round(m.percent)}%`);
      });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${naam}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Even wachten voor de browser het bestand heeft opgepakt, dan pas opruimen.
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      setKlaar(true);
    } catch (e) {
      setFout(`Zip maken mislukt: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPakken(false);
      setVoortgang("");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {fout && (
        <div className="flex items-start gap-2.5 px-4 py-3" style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca" }}>
          <AlertTriangle size={14} style={{ color: ROOD, flexShrink: 0, marginTop: 1 }} />
          <p style={{ ...tekst, fontSize: 12.5, color: ROOD }}>{fout}</p>
        </div>
      )}

      {zonderDatum > 0 && (
        <div className="flex items-start gap-2.5 px-4 py-3" style={{ backgroundColor: "#fef3c7", border: "1px solid #fde68a" }}>
          <AlertTriangle size={14} style={{ color: AMBER, flexShrink: 0, marginTop: 1 }} />
          <p style={{ ...tekst, fontSize: 12.5, color: "rgba(0,19,55,0.7)" }}>
            {zonderDatum} factu{zonderDatum === 1 ? "ur heeft" : "ren hebben"} geen leesbare datum en
            {zonderDatum === 1 ? " valt" : " vallen"} daardoor buiten deze overzichten. Vul de
            factuurdatum aan bij de facturen zelf.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Per maand betalen */}
        <div style={paneel}>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
            <Calendar size={14} style={{ color: NAVY }} />
            <h3 style={{ ...kop, fontSize: 14 }}>Per maand te betalen</h3>
            <span className="ml-auto" style={{ ...tekst, fontSize: 11 }}>alleen openstaand</span>
          </div>
          {perMaand.length === 0 ? (
            <p className="px-5 py-8 text-center" style={{ ...tekst, fontSize: 12.5 }}>
              Er staan geen facturen open.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                    <th style={kopCel}>Maand</th>
                    <th style={{ ...kopCel, textAlign: "right" }}>Facturen</th>
                    <th style={{ ...kopCel, textAlign: "right" }}>Te betalen</th>
                  </tr>
                </thead>
                <tbody>
                  {perMaand.map((m, i) => (
                    <tr key={m.sleutel} style={{ backgroundColor: i % 2 ? "#fafbfc" : "#ffffff" }}>
                      <td style={cel}>
                        {maandNaam(m.sleutel)}
                        {m.teLaat > 0 && (
                          <span style={{ ...tekst, fontSize: 11, color: ROOD, marginLeft: 8 }}>
                            {m.teLaat} te laat
                          </span>
                        )}
                      </td>
                      <td style={{ ...cel, textAlign: "right" }}>{m.aantal}</td>
                      <td style={{ ...cel, textAlign: "right", fontWeight: 700 }}>{euro(m.incl)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid rgba(0,19,55,0.12)" }}>
                    <td style={{ ...cel, fontWeight: 700 }}>Totaal open</td>
                    <td style={{ ...cel, textAlign: "right", fontWeight: 700 }}>
                      {perMaand.reduce((s, m) => s + m.aantal, 0)}
                    </td>
                    <td style={{ ...cel, textAlign: "right", fontWeight: 700 }}>
                      {euro(perMaand.reduce((s, m) => s + m.incl, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Per kwartaal */}
        <div style={paneel}>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
            <FileArchive size={14} style={{ color: NAVY }} />
            <h3 style={{ ...kop, fontSize: 14 }}>Per kwartaal voor de boekhouder</h3>
            <span className="ml-auto" style={{ ...tekst, fontSize: 11 }}>op factuurdatum</span>
          </div>
          {perKwartaal.length === 0 ? (
            <p className="px-5 py-8 text-center" style={{ ...tekst, fontSize: 12.5 }}>
              Nog geen facturen met een datum.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                    <th style={kopCel}>Kwartaal</th>
                    <th style={{ ...kopCel, textAlign: "right" }}>Facturen</th>
                    <th style={{ ...kopCel, textAlign: "right" }}>Incl. BTW</th>
                    <th style={{ ...kopCel, textAlign: "right" }}>BTW terug</th>
                  </tr>
                </thead>
                <tbody>
                  {perKwartaal.map((k, i) => {
                    const actief = gekozen?.jaar === k.jaar && gekozen?.kwartaal === k.kwartaal;
                    return (
                      <tr
                        key={`${k.jaar}-${k.kwartaal}`}
                        onClick={() => setGekozen({ jaar: k.jaar, kwartaal: k.kwartaal })}
                        style={{
                          backgroundColor: actief ? "rgba(0,19,55,0.05)" : i % 2 ? "#fafbfc" : "#ffffff",
                          cursor: "pointer",
                          borderLeft: `3px solid ${actief ? NAVY : "transparent"}`,
                        }}
                      >
                        <td style={{ ...cel, fontWeight: actief ? 700 : 400 }}>
                          {k.jaar} — Q{k.kwartaal}
                        </td>
                        <td style={{ ...cel, textAlign: "right" }}>{k.aantal}</td>
                        <td style={{ ...cel, textAlign: "right" }}>{euro(k.incl)}</td>
                        <td style={{ ...cel, textAlign: "right", color: GROEN, fontWeight: 600 }}>
                          {euro(k.btw)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-5 py-2.5" style={{ ...tekst, fontSize: 11, borderTop: "1px solid rgba(0,19,55,0.07)" }}>
            Klik op een kwartaal om het klaar te zetten voor de boekhouder.
          </p>
        </div>
      </div>

      {/* Gekozen kwartaal */}
      {gekozen && (
        <div style={paneel}>
          <div className="flex flex-wrap items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
            <h3 style={{ ...kop, fontSize: 14 }}>
              {gekozen.jaar} — Kwartaal {gekozen.kwartaal}
            </h3>
            {data && <span style={{ ...tekst, fontSize: 11 }}>{data.periode}</span>}
            <div className="ml-auto flex items-center gap-2">
              {klaar && (
                <span className="flex items-center gap-1.5" style={{ ...tekst, fontSize: 12, color: GROEN }}>
                  <Check size={13} /> Opgeslagen
                </span>
              )}
              <button
                type="button"
                onClick={maakZip}
                disabled={!data || pakken || laden || data.totalen.aantal === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: NAVY, color: "#ffffff", fontFamily: "var(--font-inter)" }}
              >
                <Download size={13} />
                {pakken ? voortgang || "Bezig…" : "Download als zip"}
              </button>
            </div>
          </div>

          {laden && <p className="px-5 py-8 text-center" style={{ ...tekst, fontSize: 12.5 }}>Facturen en documenten opzoeken…</p>}

          {data && !laden && (
            <div className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { l: "Facturen", v: String(data.totalen.aantal) },
                  { l: "Totaal incl. BTW", v: euro(data.totalen.incl) },
                  { l: "BTW terug te vragen", v: euro(data.totalen.btw), kleur: GROEN },
                  { l: "Totaal excl. BTW", v: euro(data.totalen.excl) },
                ].map((s) => (
                  <div key={s.l} className="p-3.5" style={{ backgroundColor: "rgba(0,19,55,0.02)", border: "1px solid rgba(0,19,55,0.07)" }}>
                    <p style={{ ...kopCel, padding: 0, marginBottom: 6 }}>{s.l}</p>
                    <p style={{ fontFamily: "var(--font-playfair)", fontSize: 20, fontWeight: 700, color: s.kleur ?? NAVY }}>
                      {s.v}
                    </p>
                  </div>
                ))}
              </div>

              {data.gmailFout && (
                <div className="flex items-start gap-2.5 px-4 py-3" style={{ backgroundColor: "#fef3c7", border: "1px solid #fde68a" }}>
                  <AlertTriangle size={14} style={{ color: AMBER, flexShrink: 0, marginTop: 1 }} />
                  <p style={{ ...tekst, fontSize: 12.5, color: "rgba(0,19,55,0.7)" }}>
                    {data.gmailFout} De zip bevat wél de specificatie met alle bedragen.
                  </p>
                </div>
              )}

              {data.afgekapt && (
                <div className="flex items-start gap-2.5 px-4 py-3" style={{ backgroundColor: "#fef3c7", border: "1px solid #fde68a" }}>
                  <AlertTriangle size={14} style={{ color: AMBER, flexShrink: 0, marginTop: 1 }} />
                  <p style={{ ...tekst, fontSize: 12.5, color: "rgba(0,19,55,0.7)" }}>
                    Niet alle documenten konden binnen de tijd worden opgezocht. Vernieuw de pagina en
                    kies dit kwartaal opnieuw om de rest op te halen.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-4" style={{ ...tekst, fontSize: 12.5 }}>
                <span>
                  <strong style={{ color: GROEN }}>{data.metDocument}</strong> met document
                </span>
                {data.zonderDocument > 0 && (
                  <span>
                    <strong style={{ color: AMBER }}>{data.zonderDocument}</strong> zonder document —
                    die staan straks in de zip in een apart tekstbestand
                  </span>
                )}
              </div>

              {data.perCategorie.length > 0 && (
                <div style={{ border: "1px solid rgba(0,19,55,0.07)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
                        <th style={kopCel}>Categorie</th>
                        <th style={{ ...kopCel, textAlign: "right" }}>Aantal</th>
                        <th style={{ ...kopCel, textAlign: "right" }}>Incl. BTW</th>
                        <th style={{ ...kopCel, textAlign: "right" }}>BTW</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.perCategorie.map((c, i) => (
                        <tr key={c.categorie} style={{ backgroundColor: i % 2 ? "#fafbfc" : "#ffffff" }}>
                          <td style={cel}>{c.categorie}</td>
                          <td style={{ ...cel, textAlign: "right" }}>{c.aantal}</td>
                          <td style={{ ...cel, textAlign: "right" }}>{euro(c.incl)}</td>
                          <td style={{ ...cel, textAlign: "right" }}>{euro(c.btw)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p style={{ ...tekst, fontSize: 11.5, lineHeight: 1.7 }}>
                De zip bevat <strong>specificatie.csv</strong> met alle bedragen (opent in Excel) en een
                map <strong>facturen</strong> met de originele PDF&apos;s uit de mailbox. Ontbreekt er een
                document, dan staat dat in een apart tekstbestand — de bedragen kloppen dan nog steeds.
              </p>
            </div>
          )}

          {periodes.length === 0 && !laden && (
            <p className="px-5 py-8 text-center" style={{ ...tekst, fontSize: 12.5 }}>
              Er zijn nog geen facturen met een datum om te exporteren.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

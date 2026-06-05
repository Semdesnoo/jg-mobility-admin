import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NAVY = "FF001337";
const WIT = "FFFFFFFF";
const GRIJS = "FF94A3B8";
const SLATE = "FF334155";
const ZEBRA = "FFF8FAFC";
const EUR = '"€" #,##0.00';

type Factuur = {
  factuur_nr?: string;
  datum?: string;
  klant_naam?: string;
  auto_merk?: string;
  auto_model?: string;
  auto_bouwjaar?: string;
  auto_kenteken?: string;
  betaalwijze?: string;
  btw_type?: string;
  verkoopprijs?: unknown;
  regels?: string;
};

function berekenTotalen(f: Factuur) {
  let bruto = Number(f.verkoopprijs) || 0;
  try {
    const regels = JSON.parse(f.regels || "[]") as { prijs?: unknown }[];
    bruto += regels.reduce((s, r) => s + (Number(r.prijs) || 0), 0);
  } catch { /* alleen verkoopprijs */ }
  const subtotaal = f.btw_type === "21" ? Math.round((bruto / 1.21) * 100) / 100 : bruto;
  const btw = f.btw_type === "21" ? Math.round((bruto - subtotaal) * 100) / 100 : 0;
  return { subtotaal, btw, eindtotaal: bruto };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const facturen: Factuur[] = Array.isArray(body.facturen) ? body.facturen : [];
    const jaar: string = String(body.jaar || new Date().getFullYear());
    const logo: string | undefined = typeof body.logo === "string" ? body.logo : undefined;

    const wb = new ExcelJS.Workbook();
    wb.creator = "JG Mobility";
    const ws = wb.addWorksheet(`Facturen ${jaar}`, {
      views: [{ showGridLines: false }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    ws.columns = [
      { width: 15 }, // Factuurnr
      { width: 12 }, // Datum
      { width: 28 }, // Klant
      { width: 30 }, // Voertuig
      { width: 12 }, // Kenteken
      { width: 11 }, // Betaling
      { width: 11 }, // BTW-type
      { width: 15 }, // Excl. BTW
      { width: 13 }, // BTW
      { width: 16 }, // Totaal
    ];

    // ── Navy kopband (rij 1-3) met wit logo links en titel rechts ──
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= 10; c++) {
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      }
    }
    ws.getRow(1).height = 30;
    ws.getRow(2).height = 20;
    ws.getRow(3).height = 8;

    if (logo && logo.includes(",")) {
      const base64 = logo.split(",")[1];
      const extension = logo.includes("jpeg") || logo.includes("jpg") ? "jpeg" : "png";
      const imgId = wb.addImage({ base64, extension });
      ws.addImage(imgId, { tl: { col: 0.25, row: 0.3 }, ext: { width: 150, height: 46 } });
    }

    ws.mergeCells("G1:J1");
    const titel = ws.getCell("G1");
    titel.value = "FACTURENOVERZICHT";
    titel.font = { name: "Arial", size: 16, bold: true, color: { argb: WIT } };
    titel.alignment = { horizontal: "right", vertical: "middle" };

    ws.mergeCells("G2:J2");
    const sub = ws.getCell("G2");
    sub.value = `Jaar ${jaar}  ·  gegenereerd ${new Date().toLocaleDateString("nl-NL")}`;
    sub.font = { name: "Arial", size: 9, color: { argb: "FFC7D2E5" } };
    sub.alignment = { horizontal: "right", vertical: "middle" };

    // Bedrijfsinfo (rij 4)
    ws.mergeCells("A4:J4");
    const info = ws.getCell("A4");
    info.value = "JG Mobility · Arnhemseweg 10a · 2994 LA Barendrecht · info@jgmobility.nl · KVK 42042275";
    info.font = { name: "Arial", size: 8, color: { argb: GRIJS } };
    info.alignment = { vertical: "middle" };
    ws.getRow(4).height = 16;

    // ── Kolomkoppen (rij 6) ──
    const HEAD = 6;
    const kolommen = ["Factuurnr.", "Datum", "Klant", "Voertuig", "Kenteken", "Betaling", "BTW-type", "Excl. BTW", "BTW", "Totaal incl."];
    const headRow = ws.getRow(HEAD);
    kolommen.forEach((k, i) => {
      const cel = headRow.getCell(i + 1);
      cel.value = k;
      cel.font = { name: "Arial", size: 9, bold: true, color: { argb: WIT } };
      cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      cel.alignment = { horizontal: i >= 7 ? "right" : i >= 4 && i <= 6 ? "center" : "left", vertical: "middle" };
    });
    headRow.height = 20;

    // ── Datarijen ──
    let totOmzet = 0, totBtw = 0, totTotaal = 0;
    facturen.forEach((f, i) => {
      const t = berekenTotalen(f);
      totOmzet += t.subtotaal; totBtw += t.btw; totTotaal += t.eindtotaal;
      const voertuig = [f.auto_merk, f.auto_model, f.auto_bouwjaar].filter(Boolean).join(" ");
      const r = ws.getRow(HEAD + 1 + i);

      r.getCell(1).value = f.factuur_nr || "";
      r.getCell(2).value = f.datum || "";
      r.getCell(3).value = f.klant_naam || "";
      r.getCell(4).value = voertuig;
      r.getCell(5).value = f.auto_kenteken ? f.auto_kenteken.toUpperCase() : "";
      r.getCell(6).value = f.betaalwijze === "bank" ? "Bank" : "Contant";
      r.getCell(7).value = f.btw_type === "21" ? "21% BTW" : "Marge";
      r.getCell(8).value = t.subtotaal;
      r.getCell(9).value = t.btw;
      r.getCell(10).value = t.eindtotaal;

      for (let c = 1; c <= 10; c++) {
        const cel = r.getCell(c);
        cel.font = { name: "Arial", size: 9, color: { argb: SLATE } };
        cel.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
        if (i % 2 === 1) cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      }
      r.getCell(1).font = { name: "Arial", size: 9, bold: true, color: { argb: NAVY } };
      [1, 2, 3, 4].forEach((c) => (r.getCell(c).alignment = { horizontal: "left", vertical: "middle" }));
      [5, 6, 7].forEach((c) => (r.getCell(c).alignment = { horizontal: "center", vertical: "middle" }));
      [8, 9, 10].forEach((c) => {
        r.getCell(c).numFmt = EUR;
        r.getCell(c).alignment = { horizontal: "right", vertical: "middle" };
      });
      r.getCell(10).font = { name: "Arial", size: 9, bold: true, color: { argb: NAVY } };
      r.height = 18;
    });

    // ── Totaalrij ──
    const TOT = HEAD + 1 + facturen.length;
    ws.mergeCells(TOT, 1, TOT, 7);
    const totRow = ws.getRow(TOT);
    totRow.getCell(1).value = `Totaal ${facturen.length} ${facturen.length === 1 ? "factuur" : "facturen"}`;
    totRow.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
    totRow.getCell(8).value = totOmzet;
    totRow.getCell(9).value = totBtw;
    totRow.getCell(10).value = totTotaal;
    for (let c = 1; c <= 10; c++) {
      const cel = totRow.getCell(c);
      cel.font = { name: "Arial", size: 10, bold: true, color: { argb: NAVY } };
      cel.border = { top: { style: "medium", color: { argb: NAVY } } };
      cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    }
    [8, 9, 10].forEach((c) => {
      totRow.getCell(c).numFmt = EUR;
      totRow.getCell(c).alignment = { horizontal: "right", vertical: "middle" };
    });
    totRow.height = 22;

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="JG-Mobility-facturen-${jaar}.xlsx"`,
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

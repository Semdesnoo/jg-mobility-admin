import sql from "@/lib/db";

export const dynamic = "force-dynamic";

const MS_PER_DAG = 86_400_000;

type AutoData = {
  merk?: string;
  model?: string;
  prijs?: number | string;
  verkocht?: boolean;
  gereserveerd?: boolean;
  verkocht_op?: string;
  toegevoegd_op?: string;
};

function maandKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Pakt zowel "31-5-2026" (NL) als "2026-05-31" / ISO-datums.
function parseDatum(s: string | undefined): Date | null {
  if (!s) return null;
  if (s.includes("T")) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const p = s.split("-").map((x) => parseInt(x, 10));
  if (p.length !== 3 || p.some(isNaN)) return null;
  const [a, b, c] = p;
  const [jaar, maand, dag] = a > 31 ? [a, b, c] : [c, b, a];
  const d = new Date(jaar, maand - 1, dag);
  return isNaN(d.getTime()) ? null : d;
}

function dagenTussen(vanISO: string, tot: Date): number | null {
  const d0 = new Date(vanISO);
  if (isNaN(d0.getTime())) return null;
  return Math.max(0, Math.round((tot.getTime() - d0.getTime()) / MS_PER_DAG));
}

function gemiddelde(arr: number[]): number | null {
  return arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null;
}

export async function GET() {
  try {
    // Elke query apart afgevangen: een ontbrekende tabel mag het dashboard niet slopen.
    const [autosRows, facturenRows, leadsRows, afsprakenRows] = await Promise.all([
      sql`SELECT data FROM autos`.catch(() => []),
      sql`SELECT datum, verkoopprijs, btw_type, status, regels FROM facturen`.catch(() => []),
      sql`SELECT status FROM leads`.catch(() => []),
      sql`SELECT status FROM afspraken`.catch(() => []),
    ]);

    const autos: AutoData[] = autosRows.map((a) =>
      (typeof a.data === "string" ? JSON.parse(a.data) : a.data) as AutoData
    );
    const nu = new Date();
    const ditJaar = nu.getFullYear();
    const dezeMaand = maandKey(nu);

    // ── Voorraad & verkoop ──
    const verkocht = autos.filter((a) => a.verkocht);
    const gereserveerd = autos.filter((a) => a.gereserveerd && !a.verkocht);
    const beschikbaar = autos.filter((a) => !a.verkocht && !a.gereserveerd);

    const voorraadwaarde = beschikbaar.reduce((s, a) => s + (Number(a.prijs) || 0), 0);
    const gemVraagprijs = beschikbaar.length ? Math.round(voorraadwaarde / beschikbaar.length) : 0;

    let verkochtDitJaar = 0;
    let verkochtDezeMaand = 0;
    const verkopenPerMaand: Record<string, number> = {};
    for (const a of verkocht) {
      const d = parseDatum(a.verkocht_op);
      if (!d) continue;
      const k = maandKey(d);
      verkopenPerMaand[k] = (verkopenPerMaand[k] ?? 0) + 1;
      if (d.getFullYear() === ditJaar) verkochtDitJaar++;
      if (k === dezeMaand) verkochtDezeMaand++;
    }

    // ── Omzet uit betaalde facturen (eindtotaal = verkoopprijs + extra regels) ──
    const eindtotaal = (f: { verkoopprijs?: unknown; regels?: unknown }): number => {
      let bruto = Number(f.verkoopprijs) || 0;
      try {
        const r = JSON.parse((f.regels as string) || "[]") as { prijs?: unknown }[];
        bruto += r.reduce((s, x) => s + (Number(x.prijs) || 0), 0);
      } catch { /* alleen verkoopprijs */ }
      return bruto;
    };
    const betaald = facturenRows.filter((f) => f.status === "betaald");
    let totaalOmzet = 0;
    let omzetDitJaar = 0;
    let omzetDezeMaand = 0;
    const omzetPerMaand: Record<string, number> = {};
    for (const f of betaald) {
      const bedrag = eindtotaal(f);
      totaalOmzet += bedrag;
      const d = parseDatum(f.datum as string);
      if (d) {
        const k = maandKey(d);
        omzetPerMaand[k] = (omzetPerMaand[k] ?? 0) + bedrag;
        if (d.getFullYear() === ditJaar) omzetDitJaar += bedrag;
        if (k === dezeMaand) omzetDezeMaand += bedrag;
      }
    }
    const gemVerkoopprijs = betaald.length ? Math.round(totaalOmzet / betaald.length) : 0;

    // ── Standtijd (showroom-tijd) ──
    const standtijdVerkocht: number[] = [];
    for (const a of verkocht) {
      if (!a.toegevoegd_op || !a.verkocht_op) continue;
      const tot = parseDatum(a.verkocht_op);
      if (!tot) continue;
      const dagen = dagenTussen(a.toegevoegd_op, tot);
      if (dagen != null) standtijdVerkocht.push(dagen);
    }
    const voorraadStandtijden: { merk: string; model: string; dagen: number }[] = [];
    for (const a of beschikbaar) {
      if (!a.toegevoegd_op) continue;
      const dagen = dagenTussen(a.toegevoegd_op, nu);
      if (dagen != null) {
        voorraadStandtijden.push({ merk: a.merk || "Onbekend", model: a.model || "", dagen });
      }
    }
    const gemStandtijdVerkocht = gemiddelde(standtijdVerkocht);
    const gemStandtijdVoorraad = gemiddelde(voorraadStandtijden.map((x) => x.dagen));
    const langstInVoorraad = [...voorraadStandtijden].sort((a, b) => b.dagen - a.dagen).slice(0, 6);
    const standtijdDataCount = standtijdVerkocht.length + voorraadStandtijden.length;

    // ── Standtijd-verdeling (histogram) van verkochte auto's ──
    // Vertelt hoe snel voorraad doorstroomt: veel in de linkerbakken = snelle omloop.
    const BAKKEN = [
      { label: "0-30", min: 0, max: 30 },
      { label: "30-60", min: 30, max: 60 },
      { label: "60-90", min: 60, max: 90 },
      { label: "90+", min: 90, max: Infinity },
    ];
    const standtijdVerdeling = BAKKEN.map((b) => ({
      label: b.label,
      verkocht: standtijdVerkocht.filter((d) => d >= b.min && d < b.max).length,
      voorraad: voorraadStandtijden.filter((x) => x.dagen >= b.min && x.dagen < b.max).length,
    }));

    // ── Per merk ──
    // Twee losse standtijd-reeksen: `standtijden` = huidige voorraad (hoe lang staat
    // het er nu), `verkochtStandtijden` = doorlooptijd van wat écht verkocht is.
    // Die tweede is de bruikbare maat voor inkoopbeslissingen.
    const merkMap = new Map<
      string,
      { naam: string; voorraad: number; verkocht: number; standtijden: number[]; verkochtStandtijden: number[]; voorraadwaarde: number; verkoopprijzen: number[] }
    >();
    // "BMW" en "Bmw" zijn hetzelfde merk — groepeer op hoofdletterloze sleutel,
    // anders splitst de analyse en lijkt elk merk half zo groot als het is.
    const ensure = (m: string) => {
      const naam = (m || "Onbekend").trim();
      const key = naam.toUpperCase();
      if (!merkMap.has(key)) {
        merkMap.set(key, { naam, voorraad: 0, verkocht: 0, standtijden: [], verkochtStandtijden: [], voorraadwaarde: 0, verkoopprijzen: [] });
      }
      const e = merkMap.get(key)!;
      // Toon de variant met de meeste hoofdletters (BMW leest beter dan Bmw).
      const hoofdletters = (s: string) => s.replace(/[^A-Z]/g, "").length;
      if (hoofdletters(naam) > hoofdletters(e.naam)) e.naam = naam;
      return e;
    };
    for (const a of beschikbaar) {
      const e = ensure(a.merk || "Onbekend");
      e.voorraad++;
      e.voorraadwaarde += Number(a.prijs) || 0;
      if (a.toegevoegd_op) {
        const dg = dagenTussen(a.toegevoegd_op, nu);
        if (dg != null) e.standtijden.push(dg);
      }
    }
    for (const a of verkocht) {
      const e = ensure(a.merk || "Onbekend");
      e.verkocht++;
      if (Number(a.prijs) > 0) e.verkoopprijzen.push(Number(a.prijs));
      if (a.toegevoegd_op && a.verkocht_op) {
        const tot = parseDatum(a.verkocht_op);
        if (tot) {
          const dg = dagenTussen(a.toegevoegd_op, tot);
          if (dg != null) e.verkochtStandtijden.push(dg);
        }
      }
    }
    const perMerk = [...merkMap.values()]
      .map((e) => ({
        merk: e.naam,
        voorraad: e.voorraad,
        verkocht: e.verkocht,
        gemStandtijd: gemiddelde(e.standtijden),
        gemStandtijdVerkocht: gemiddelde(e.verkochtStandtijden),
        verkochtMetStandtijd: e.verkochtStandtijden.length,
        voorraadwaarde: e.voorraadwaarde,
        gemVerkoopprijs: gemiddelde(e.verkoopprijzen),
      }))
      .sort((a, b) => b.voorraad + b.verkocht - (a.voorraad + a.verkocht));

    // ── Leads & afspraken ──
    const leadsPerStatus: Record<string, number> = {};
    for (const l of leadsRows) {
      const s = (l.status as string) || "nieuw";
      leadsPerStatus[s] = (leadsPerStatus[s] ?? 0) + 1;
    }
    const openAfspraken = afsprakenRows.filter(
      (a) => a.status !== "afgehandeld" && a.status !== "geannuleerd"
    ).length;

    return Response.json({
      totaalVerkocht: verkocht.length,
      verkochtDitJaar,
      verkochtDezeMaand,
      inVoorraad: beschikbaar.length,
      gereserveerd: gereserveerd.length,
      voorraadwaarde,
      gemVraagprijs,
      totaalOmzet,
      omzetDitJaar,
      omzetDezeMaand,
      gemVerkoopprijs,
      betaaldeFacturen: betaald.length,
      omzetPerMaand,
      verkopenPerMaand,
      gemStandtijdVerkocht,
      gemStandtijdVoorraad,
      standtijdDataCount,
      standtijdVerdeling,
      langstInVoorraad,
      perMerk,
      leadsPerStatus,
      openAfspraken,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

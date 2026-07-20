import sql from "@/lib/db";
import { getDossiers } from "@/lib/dossiers-db";
import { getAutos } from "@/lib/autos-db";

export const dynamic = "force-dynamic";

/**
 * Boekhoudoverzicht voor een autobedrijf.
 *
 * De kern is de margeregeling: bij gebruikte auto's die je zonder BTW inkoopt
 * (particulier) draag je BTW af over de wínst, niet over de verkoopprijs.
 * BTW = (verkoop − inkoop) × 21/121. Bij 21%-facturen gaat het over het hele
 * bedrag.
 *
 * Belangrijk: dit is een hulpmiddel, geen aangifte. Zonder ingevulde inkoopprijs
 * kan de marge-BTW niet berekend worden — die facturen worden apart gemeld in
 * plaats van stilzwijgend op 0 gezet.
 */

type Regel = { omschrijving?: string; prijs?: unknown };

type Factuur = {
  id: string;
  factuur_nr: string;
  datum: string;
  vervaldatum: string;
  klant_naam: string;
  auto_merk: string;
  auto_model: string;
  auto_kenteken: string;
  verkoopprijs: unknown;
  btw_type: string;
  status: string;
  regels: unknown;
};

/** "31-5-2026", "3-6-2026" of ISO → Date. */
function parseDatum(s: string | undefined | null): Date | null {
  if (!s) return null;
  const t = String(s).trim();
  if (t.includes("T") || /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d;
  }
  const p = t.split("-").map((x) => parseInt(x, 10));
  if (p.length !== 3 || p.some(isNaN)) return null;
  const [a, b, c] = p;
  const [jaar, maand, dag] = a > 31 ? [a, b, c] : [c, b, a];
  const d = new Date(jaar, maand - 1, dag);
  return isNaN(d.getTime()) ? null : d;
}

/** Bruto factuurbedrag = verkoopprijs + eventuele extra regels. */
function brutoBedrag(f: Factuur): number {
  let bruto = Number(f.verkoopprijs) || 0;
  try {
    const r: Regel[] = typeof f.regels === "string" ? JSON.parse(f.regels) : Array.isArray(f.regels) ? f.regels : [];
    bruto += r.reduce((s, x) => s + (Number(x.prijs) || 0), 0);
  } catch {
    /* alleen verkoopprijs */
  }
  return bruto;
}

const rond = (n: number) => Math.round(n * 100) / 100;

export async function GET() {
  const [facturenRows, dossiers, autos] = await Promise.all([
    sql`SELECT * FROM facturen`.catch(() => []),
    getDossiers().catch(() => []),
    getAutos().catch(() => []),
  ]);
  const facturen = facturenRows as unknown as Factuur[];

  // Een margefactuur moet weten wat de auto heeft gekost. Twee manieren om dat
  // dossier te vinden, in volgorde van betrouwbaarheid:
  //   1. kenteken — uniek, dus hard bewijs
  //   2. merk + model — alleen als er precies één dossier op past. Bij twee
  //      kandidaten liever géén match dan de verkeerde inkoopprijs, want dat
  //      levert een fout BTW-bedrag op.
  const dossierPerAutoId = new Map(dossiers.filter((d) => d.auto_id != null).map((d) => [d.auto_id!, d]));
  const normaliseer = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const kostenVan = (d: (typeof dossiers)[number]) =>
    d.kosten.reduce((s, k) => s + (parseFloat(k.bedrag) || 0), 0);

  const perKenteken = new Map<string, { inkoop: number; kosten: number }>();
  const perNaam: { naam: string; inkoop: number; kosten: number }[] = [];
  for (const a of autos) {
    const d = dossierPerAutoId.get(a.id);
    if (!d || d.inkoop <= 0) continue;
    const gegevens = { inkoop: d.inkoop, kosten: kostenVan(d) };
    const kenteken = String(a.kenteken ?? "").replace(/-/g, "").toUpperCase();
    if (kenteken) perKenteken.set(kenteken, gegevens);
    perNaam.push({ naam: normaliseer(`${a.merk} ${a.model}`), ...gegevens });
  }

  /** Zoekt de inkoop bij een factuur. `null` = niet met zekerheid vast te stellen. */
  function zoekInkoop(f: Factuur): { inkoop: number; kosten: number; afgeleid: boolean } | null {
    const kenteken = String(f.auto_kenteken ?? "").replace(/-/g, "").toUpperCase();
    const opKenteken = kenteken ? perKenteken.get(kenteken) : undefined;
    if (opKenteken) return { ...opKenteken, afgeleid: false };

    const zoek = normaliseer(`${f.auto_merk ?? ""} ${f.auto_model ?? ""}`);
    if (zoek.length < 6) return null; // te kort om betrouwbaar te matchen
    const treffers = perNaam.filter((x) => x.naam.startsWith(zoek) || zoek.startsWith(x.naam));
    if (treffers.length !== 1) return null; // 0 of meerdere → niet gokken
    return { inkoop: treffers[0].inkoop, kosten: treffers[0].kosten, afgeleid: true };
  }

  // ── Per kwartaal ──
  type Kwartaal = {
    sleutel: string;
    jaar: number;
    kwartaal: number;
    label: string;
    omzet: number;
    btwHoog: number;
    btwMarge: number;
    margeGrondslag: number;
    aantal: number;
    zonderInkoop: string[];
  };
  const kwartalen = new Map<string, Kwartaal>();

  let omzetTotaal = 0;
  let inkoopTotaal = 0;
  let kostenTotaal = 0;
  let btwTotaal = 0;
  const zonderInkoopAlgemeen: string[] = [];
  // Facturen waarvan de inkoop op naam is gevonden i.p.v. op kenteken — die
  // wil je kunnen nalopen voor je de aangifte indient.
  const afgeleideKoppelingen: string[] = [];

  for (const f of facturen) {
    const datum = parseDatum(f.datum);
    if (!datum) continue;
    const bruto = brutoBedrag(f);
    const jaar = datum.getFullYear();
    const kw = Math.floor(datum.getMonth() / 3) + 1;
    const sleutel = `${jaar}-K${kw}`;

    if (!kwartalen.has(sleutel)) {
      kwartalen.set(sleutel, {
        sleutel, jaar, kwartaal: kw, label: `${jaar} · Q${kw}`,
        omzet: 0, btwHoog: 0, btwMarge: 0, margeGrondslag: 0, aantal: 0, zonderInkoop: [],
      });
    }
    const k = kwartalen.get(sleutel)!;
    k.omzet += bruto;
    k.aantal += 1;
    omzetTotaal += bruto;

    if (f.btw_type === "21") {
      const btw = rond((bruto * 21) / 121);
      k.btwHoog += btw;
      btwTotaal += btw;
    } else {
      // Margeregeling: BTW over (verkoop − inkoop).
      const gegevens = zoekInkoop(f);
      if (!gegevens || gegevens.inkoop <= 0) {
        // Zonder inkoopprijs is de marge-BTW niet te berekenen. Niet gokken —
        // een verzonnen bedrag levert een fout aangiftecijfer op.
        k.zonderInkoop.push(f.factuur_nr);
        zonderInkoopAlgemeen.push(f.factuur_nr);
        continue;
      }
      if (gegevens.afgeleid) afgeleideKoppelingen.push(f.factuur_nr);
      const marge = bruto - gegevens.inkoop;
      const btw = marge > 0 ? rond((marge * 21) / 121) : 0;
      k.btwMarge += btw;
      k.margeGrondslag += Math.max(marge, 0);
      btwTotaal += btw;
      inkoopTotaal += gegevens.inkoop;
      kostenTotaal += gegevens.kosten;
    }
  }

  const perKwartaal = [...kwartalen.values()]
    .map((k) => ({ ...k, omzet: rond(k.omzet), btwHoog: rond(k.btwHoog), btwMarge: rond(k.btwMarge), btwTotaal: rond(k.btwHoog + k.btwMarge), margeGrondslag: rond(k.margeGrondslag) }))
    .sort((a, b) => b.jaar - a.jaar || b.kwartaal - a.kwartaal);

  // ── Debiteuren: wat staat er nog open ──
  const nu = new Date();
  const vandaag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());
  const debiteuren = facturen
    .filter((f) => String(f.status ?? "").toLowerCase() !== "betaald")
    .map((f) => {
      const verval = parseDatum(f.vervaldatum);
      const dagenOver = verval ? Math.round((vandaag.getTime() - verval.getTime()) / 86_400_000) : null;
      return {
        id: f.id,
        factuur_nr: f.factuur_nr,
        klant: f.klant_naam,
        auto: `${f.auto_merk ?? ""} ${f.auto_model ?? ""}`.trim(),
        bedrag: rond(brutoBedrag(f)),
        datum: f.datum,
        vervaldatum: f.vervaldatum,
        dagenOver,
        status: f.status,
      };
    })
    .sort((a, b) => (b.dagenOver ?? -9999) - (a.dagenOver ?? -9999));

  const openstaandTotaal = rond(debiteuren.reduce((s, d) => s + d.bedrag, 0));
  const teLaat = debiteuren.filter((d) => (d.dagenOver ?? 0) > 0);

  // ── Resultaat ──
  const brutowinst = rond(omzetTotaal - inkoopTotaal);
  const nettowinst = rond(brutowinst - kostenTotaal - btwTotaal);

  // ── Voorraadwaarde: wat er nu aan inkoop in de schappen staat ──
  const voorraadInkoop = dossiers
    .filter((d) => !d.gearchiveerd && d.inkoop > 0)
    .reduce((s, d) => s + d.inkoop, 0);

  return Response.json({
    perKwartaal,
    resultaat: {
      omzet: rond(omzetTotaal),
      inkoopwaarde: rond(inkoopTotaal),
      kosten: rond(kostenTotaal),
      brutowinst,
      btwAfdracht: rond(btwTotaal),
      nettowinst,
    },
    debiteuren,
    debiteurenTotaal: openstaandTotaal,
    debiteurenTeLaat: teLaat.length,
    voorraadInkoop: rond(voorraadInkoop),
    // Facturen waarvan de marge-BTW niet berekend kon worden.
    zonderInkoop: [...new Set(zonderInkoopAlgemeen)],
    afgeleideKoppelingen: [...new Set(afgeleideKoppelingen)],
  });
}

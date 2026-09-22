import sql from "@/lib/db";
import { getDossiers } from "@/lib/dossiers-db";
import { getAutos } from "@/lib/autos-db";
import { getInkoopFacturen } from "@/lib/inkoopfacturen-db";
import { bedragUit } from "@/lib/bedrag";
import { berekenBoekhouding } from "@/lib/boekhouding-berekening";

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

type Consignatie = {
  id: string;
  status: string;
  vraagprijs: unknown;
  fee_percentage: unknown;
  fee_vast: unknown;
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
  const [facturenRows, dossiers, autos, inkoopFacturen, consignatieRows] = await Promise.all([
    sql`SELECT * FROM facturen`,
    getDossiers(),
    getAutos(),
    getInkoopFacturen(),
    sql`SELECT * FROM cosignaties`,
  ]);
  const facturen = facturenRows as unknown as Factuur[];
  const consignaties = consignatieRows as unknown as Consignatie[];
  // Alleen verzonden en betaalde verkoopfacturen zijn definitieve omzet. Concepten
  // blijven buiten omzet, BTW, debiteuren en kwartaalcijfers.
  const definitieveFacturen = facturen.filter((f) => ["verzonden", "betaald"].includes(String(f.status).toLowerCase()));

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

  // Auto's terugvindbaar op kenteken en op naam — nodig om bij een waarschuwing
  // het bijbehorende dossier en de auto te kunnen aanwijzen, zodat een knop
  // rechtstreeks naar de juiste plek springt in plaats van naar een lijst.
  const autoPerKenteken = new Map<string, (typeof autos)[number]>();
  const autoPerNaam: { naam: string; auto: (typeof autos)[number] }[] = [];
  for (const a of autos) {
    const k = String(a.kenteken ?? "").replace(/-/g, "").toUpperCase();
    if (k) autoPerKenteken.set(k, a);
    autoPerNaam.push({ naam: normaliseer(`${a.merk} ${a.model}`), auto: a });
  }

  /** Herstelpunt: waar de gebruiker heen moet om dit recht te zetten. */
  function zoekDoel(f: Factuur): Herstelpunt {
    const kent = String(f.auto_kenteken ?? "").replace(/-/g, "").toUpperCase();
    let auto = kent ? autoPerKenteken.get(kent) : undefined;
    if (!auto) {
      const zoek = normaliseer(`${f.auto_merk ?? ""} ${f.auto_model ?? ""}`);
      if (zoek.length >= 6) {
        const treffers = autoPerNaam.filter((x) => x.naam.startsWith(zoek) || zoek.startsWith(x.naam));
        if (treffers.length === 1) auto = treffers[0].auto;
      }
    }
    const dossier = auto ? dossierPerAutoId.get(auto.id) : undefined;
    return {
      factuur_nr: f.factuur_nr,
      auto_naam: `${f.auto_merk ?? ""} ${f.auto_model ?? ""}`.trim() || (auto ? `${auto.merk} ${auto.model}` : ""),
      dossier_id: dossier?.id ?? null,
      auto_id: auto?.id ?? null,
    };
  }

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

  const zonderInkoopAlgemeen: Herstelpunt[] = [];
  // Facturen waarvan de inkoop op naam is gevonden i.p.v. op kenteken — die
  // wil je kunnen nalopen voor je de aangifte indient.
  const afgeleideKoppelingen: Herstelpunt[] = [];

  for (const f of definitieveFacturen) {
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

    if (f.btw_type === "21") {
      const btw = rond((bruto * 21) / 121);
      k.btwHoog += btw;
    } else {
      // Margeregeling: BTW over (verkoop − inkoop).
      const gegevens = zoekInkoop(f);
      if (!gegevens || gegevens.inkoop <= 0) {
        // Zonder inkoopprijs is de marge-BTW niet te berekenen. Niet gokken —
        // een verzonnen bedrag levert een fout aangiftecijfer op.
        k.zonderInkoop.push(f.factuur_nr);
        zonderInkoopAlgemeen.push(zoekDoel(f));
        continue;
      }
      if (gegevens.afgeleid) afgeleideKoppelingen.push(zoekDoel(f));
      const marge = bruto - gegevens.inkoop;
      const btw = marge > 0 ? rond((marge * 21) / 121) : 0;
      k.btwMarge += btw;
      k.margeGrondslag += Math.max(marge, 0);
    }
  }

  const perKwartaal = [...kwartalen.values()]
    .map((k) => ({ ...k, omzet: rond(k.omzet), btwHoog: rond(k.btwHoog), btwMarge: rond(k.btwMarge), btwTotaal: rond(k.btwHoog + k.btwMarge), margeGrondslag: rond(k.margeGrondslag) }))
    .sort((a, b) => b.jaar - a.jaar || b.kwartaal - a.kwartaal);

  // ── Geld in & uit per kwartaal ──
  // Bedoeld om naast je bankafschriften te leggen: erbij = wat je met
  // verkoopfacturen hebt gefactureerd, eraf = wat je met inkoopfacturen bent
  // gefactureerd. Op factuurdatum (niet betaaldatum), dus de timing kan iets
  // afwijken van de bank — het gaat om of er iets ontbreekt, niet om de cent.
  type InUit = {
    sleutel: string; label: string; jaar: number; kwartaal: number;
    inkomsten: number; inkomstenAantal: number;
    uitgaven: number; uitgavenAantal: number; saldo: number;
  };
  const inUitMap = new Map<string, InUit>();
  const inUitBucket = (datum: Date): InUit => {
    const jaar = datum.getFullYear();
    const kw = Math.floor(datum.getMonth() / 3) + 1;
    const sleutel = `${jaar}-K${kw}`;
    if (!inUitMap.has(sleutel)) {
      inUitMap.set(sleutel, {
        sleutel, label: `${jaar} · Q${kw}`, jaar, kwartaal: kw,
        inkomsten: 0, inkomstenAantal: 0, uitgaven: 0, uitgavenAantal: 0, saldo: 0,
      });
    }
    return inUitMap.get(sleutel)!;
  };
  for (const f of definitieveFacturen) {
    const d = parseDatum(f.datum);
    if (!d) continue;
    const b = inUitBucket(d);
    b.inkomsten += brutoBedrag(f);
    b.inkomstenAantal += 1;
  }
  for (const f of inkoopFacturen) {
    const d = parseDatum(f.datum);
    if (!d) continue;
    const b = inUitBucket(d);
    b.uitgaven += Number(f.bedrag_incl) || 0;
    b.uitgavenAantal += 1;
  }
  const inUit = [...inUitMap.values()]
    .map((x) => ({ ...x, inkomsten: rond(x.inkomsten), uitgaven: rond(x.uitgaven), saldo: rond(x.inkomsten - x.uitgaven) }))
    .sort((a, b) => b.jaar - a.jaar || b.kwartaal - a.kwartaal);

  // ── Debiteuren: wat staat er nog open ──
  const nu = new Date();
  const vandaag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());
  const debiteuren = definitieveFacturen
    .filter((f) => String(f.status ?? "").toLowerCase() === "verzonden")
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

  // ── Crediteuren: inkoopfacturen die JG Mobility nog moet betalen ──
  // Zelfde vorm en logica als debiteuren (oudste/meest te laat bovenaan), maar
  // dan de andere kant op: geld dat de deur uit moet.
  const crediteuren = inkoopFacturen
    .filter((f) => String(f.status ?? "").toLowerCase() !== "betaald")
    .map((f) => {
      const verval = parseDatum(f.vervaldatum);
      const dagenOver = verval ? Math.round((vandaag.getTime() - verval.getTime()) / 86_400_000) : null;
      return {
        id: f.id,
        factuurnummer: f.factuurnummer,
        leverancier: f.leverancier,
        categorie: f.categorie,
        omschrijving: f.omschrijving,
        bedrag: rond(Number(f.bedrag_incl) || 0),
        datum: f.datum,
        vervaldatum: f.vervaldatum,
        dagenOver,
      };
    })
    .sort((a, b) => (b.dagenOver ?? -9999) - (a.dagenOver ?? -9999));

  const crediteurenTotaal = rond(crediteuren.reduce((s, c) => s + c.bedrag, 0));
  const crediteurenTeLaat = crediteuren.filter((c) => (c.dagenOver ?? 0) > 0);

  // ── Genormaliseerd financieel overzicht ──
  // Verkoopfacturen bepalen de omzet; calculatordossiers leveren uitsluitend de
  // kostprijs van de verkochte auto. Inkoopfacturen leveren de echte algemene
  // bedrijfskosten en voorbelasting. Auto-inkoopfacturen worden niet nogmaals als
  // kosten geboekt, omdat de kostprijs al via het gekoppelde dossier wordt genomen.
  const financieel = berekenBoekhouding({
    verkopen: facturen.map((f) => {
      const gevonden = zoekInkoop(f);
      return {
        id: f.id,
        status: String(f.status ?? ""),
        datum: f.datum,
        vervaldatum: f.vervaldatum,
        bruto: brutoBedrag(f),
        btwType: String(f.btw_type ?? "marge"),
        inkoop: gevonden?.inkoop ?? 0,
        inkoopBekend: Boolean(gevonden && gevonden.inkoop > 0),
      };
    }),
    inkopen: inkoopFacturen.map((f) => ({
      id: f.id,
      status: f.status,
      datum: f.datum,
      vervaldatum: f.vervaldatum,
      bedragIncl: Number(f.bedrag_incl) || 0,
      btwBedrag: Number(f.btw_bedrag) || 0,
      categorie: f.categorie,
    })),
    consignaties: consignaties.map((c) => ({
      id: c.id,
      status: String(c.status ?? ""),
      vraagprijs: bedragUit(c.vraagprijs == null ? null : String(c.vraagprijs)) ?? 0,
      feePercentage: bedragUit(c.fee_percentage == null ? null : String(c.fee_percentage)) ?? 0,
      feeVast: bedragUit(c.fee_vast == null ? null : String(c.fee_vast)) ?? 0,
    })),
  });

  // Ook bij een normale 21%-verkoop is de inkoopprijs nodig voor een kloppende
  // brutowinst. Voeg ontbrekende koppelingen daarom toe aan dezelfde herstelrij.
  for (const f of definitieveFacturen) {
    const gevonden = zoekInkoop(f);
    if (!gevonden || gevonden.inkoop <= 0) zonderInkoopAlgemeen.push(zoekDoel(f));
  }

  // ── Voorraadwaarde: uitsluitend eigen, onverkochte auto's ──
  // Consignatieauto's staan in hun eigen tabel en komen dus nooit als bezit in
  // deze voorraadwaarde terecht.
  const onverkochteAutoIds = new Set(autos.filter((a) => !a.verkocht).map((a) => a.id));
  const voorraadInkoop = dossiers
    .filter((d) => !d.gearchiveerd && d.inkoop > 0 && (d.auto_id == null || onverkochteAutoIds.has(d.auto_id)))
    .reduce((s, d) => s + d.inkoop, 0);

  return Response.json({
    perKwartaal,
    inUit,
    resultaat: {
      omzet: financieel.resultaat.omzetExclBtw,
      omzetInclBtw: financieel.verkoop.omzetInclBtw,
      inkoopwaarde: financieel.resultaat.kostprijsAutos,
      kosten: financieel.resultaat.bedrijfskostenExclBtw,
      brutowinst: financieel.resultaat.brutowinst,
      btwAfdracht: financieel.btw.saldo,
      nettowinst: financieel.resultaat.nettowinst,
    },
    verkoop: financieel.verkoop,
    inkoop: financieel.inkoop,
    btw: financieel.btw,
    consignatie: financieel.consignatie,
    debiteuren,
    debiteurenTotaal: openstaandTotaal,
    debiteurenTeLaat: teLaat.length,
    crediteuren,
    crediteurenTotaal,
    crediteurenTeLaat: crediteurenTeLaat.length,
    voorraadInkoop: rond(voorraadInkoop),
    // Facturen zonder betrouwbare kostprijskoppeling blijven zichtbaar. Zo lijkt
    // de winst nooit vollediger dan de onderliggende administratie werkelijk is.
    zonderInkoop: dedupeHerstel(zonderInkoopAlgemeen),
    afgeleideKoppelingen: dedupeHerstel(afgeleideKoppelingen),
  });
}

/** Waar je heen moet om een waarschuwing recht te zetten. */
type Herstelpunt = {
  factuur_nr: string;
  auto_naam: string;
  dossier_id: number | null;
  auto_id: number | null;
};

/** Elk factuurnummer hoogstens één keer. */
function dedupeHerstel(punten: Herstelpunt[]): Herstelpunt[] {
  const gezien = new Set<string>();
  return punten.filter((h) => (gezien.has(h.factuur_nr) ? false : gezien.add(h.factuur_nr)));
}

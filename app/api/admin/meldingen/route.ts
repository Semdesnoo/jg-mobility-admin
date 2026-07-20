import sql from "@/lib/db";
import { getAutos } from "@/lib/autos-db";

export const dynamic = "force-dynamic";

const MS_PER_DAG = 86_400_000;

export type Melding = {
  id: string;
  soort: "afspraak" | "auto" | "cosignatie" | "factuur";
  titel: string;
  detail: string;
  urgent: boolean;
  /** Welke tab het dashboard moet openen als je erop klikt. */
  tab: string;
};

/** "2026-07-19" of een ISO-datum → dagen vanaf vandaag (negatief = verleden). */
function dagenVanaf(datum: string | null | undefined, vandaag: Date): number | null {
  if (!datum) return null;
  const s = String(datum);
  // Zowel "2026-07-19" als "19-07-2026" komen voor in dit systeem.
  const iso = /^\d{4}-\d{2}-\d{2}/.test(s)
    ? s.slice(0, 10)
    : (() => {
        const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
        return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
      })();
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - vandaag.getTime()) / MS_PER_DAG);
}

function maandenTotApk(apk: string | undefined, nu: Date): number | null {
  if (!apk || apk === "Onbekend") return null;
  const kort = apk.match(/^(\d{1,2})-(\d{4})$/);
  const lang = apk.match(/^\d{1,2}-(\d{1,2})-(\d{4})$/);
  const m = kort ?? lang;
  if (!m) return null;
  const maand = parseInt(m[1]);
  const jaar = parseInt(m[2]);
  if (isNaN(maand) || isNaN(jaar) || maand < 1 || maand > 12) return null;
  return (jaar - nu.getFullYear()) * 12 + (maand - (nu.getMonth() + 1));
}

export async function GET() {
  const nu = new Date();
  const vandaag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());
  const meldingen: Melding[] = [];

  // Elke bron apart afgevangen: één ontbrekende tabel mag het belletje niet slopen.
  const [autos, afspraken, cosignaties, facturen] = await Promise.all([
    getAutos().catch(() => []),
    sql`SELECT id, datum, tijd, type, klant_naam, auto_naam, status FROM afspraken`.catch(() => []),
    sql`SELECT id, merk, model, status, aangemaakt FROM cosignaties`.catch(() => []),
    sql`SELECT id, factuur_nr, klant_naam, datum, vervaldatum, status FROM facturen`.catch(() => []),
  ]);

  // ── Afspraken vandaag en morgen ──
  for (const a of afspraken) {
    if (a.status === "afgerond" || a.status === "geannuleerd") continue;
    const d = dagenVanaf(a.datum as string, vandaag);
    if (d == null || d < 0 || d > 1) continue;
    const wanneer = d === 0 ? "Vandaag" : "Morgen";
    meldingen.push({
      id: `afspraak-${a.id}`,
      soort: "afspraak",
      titel: `${wanneer}${a.tijd ? ` om ${a.tijd}` : ""} — ${a.type ?? "afspraak"}`,
      detail: [a.klant_naam, a.auto_naam].filter(Boolean).join(" · ") || "Geen details",
      urgent: d === 0,
      tab: "afspraken",
    });
  }

  // ── Auto's die aandacht vragen ──
  for (const a of autos) {
    if (a.verkocht) continue;
    const naam = `${a.merk} ${a.model}`;
    if (!a.fotos || a.fotos.length === 0) {
      meldingen.push({ id: `auto-foto-${a.id}`, soort: "auto", titel: naam, detail: "Geen foto's", urgent: true, tab: "voorraad" });
    }
    if (!a.prijs || a.prijs <= 0) {
      meldingen.push({ id: `auto-prijs-${a.id}`, soort: "auto", titel: naam, detail: "Geen prijs ingevuld", urgent: true, tab: "voorraad" });
    }
    const apk = maandenTotApk(a.apk, nu);
    if (apk != null && apk < 0) {
      meldingen.push({ id: `auto-apk-${a.id}`, soort: "auto", titel: naam, detail: "APK verlopen", urgent: true, tab: "voorraad" });
    } else if (apk != null && apk <= 2) {
      meldingen.push({ id: `auto-apk-${a.id}`, soort: "auto", titel: naam, detail: `APK verloopt over ${apk} mnd`, urgent: false, tab: "voorraad" });
    }
    if (a.toegevoegd_op) {
      const dagen = Math.round((nu.getTime() - new Date(a.toegevoegd_op).getTime()) / MS_PER_DAG);
      if (dagen >= 90) {
        meldingen.push({ id: `auto-standtijd-${a.id}`, soort: "auto", titel: naam, detail: `${dagen} dagen in voorraad`, urgent: false, tab: "voorraad" });
      }
    }
  }

  // ── Nieuwe cosignatie-aanvragen ──
  for (const c of cosignaties) {
    const status = String(c.status ?? "nieuw").toLowerCase();
    if (status !== "nieuw" && status !== "") continue;
    meldingen.push({
      id: `cosignatie-${c.id}`,
      soort: "cosignatie",
      titel: `${c.merk ?? ""} ${c.model ?? ""}`.trim() || "Cosignatie-aanvraag",
      detail: "Nieuwe aanvraag — nog niet beoordeeld",
      urgent: true,
      tab: "cosignatie",
    });
  }

  // ── Openstaande facturen ──
  for (const f of facturen) {
    if (String(f.status ?? "").toLowerCase() === "betaald") continue;
    const overDagen = dagenVanaf(f.vervaldatum as string, vandaag);
    const teLaat = overDagen != null && overDagen < 0;
    meldingen.push({
      id: `factuur-${f.id}`,
      soort: "factuur",
      titel: `Factuur ${f.factuur_nr ?? ""}`.trim(),
      detail: teLaat
        ? `${Math.abs(overDagen!)} dagen over de vervaldatum · ${f.klant_naam ?? ""}`
        : `Nog niet betaald · ${f.klant_naam ?? ""}`,
      urgent: teLaat,
      tab: "facturen",
    });
  }

  // Urgent eerst, daarbinnen op soort gegroepeerd.
  meldingen.sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.soort.localeCompare(b.soort));

  return Response.json({
    totaal: meldingen.length,
    urgent: meldingen.filter((m) => m.urgent).length,
    meldingen,
  });
}

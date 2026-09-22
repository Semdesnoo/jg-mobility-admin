type TaxatieBron = {
  onderwerp?: string;
  taxatie_resultaat?: unknown;
};

export type TaxatieFase = "nieuw" | "getaxeerd" | "klaar" | "verstuurd";

function alsObject(waarde: unknown): Record<string, unknown> {
  return waarde !== null && typeof waarde === "object" && !Array.isArray(waarde)
    ? (waarde as Record<string, unknown>)
    : {};
}

export function heeftGeldigeTaxatie(waarde: unknown): boolean {
  const resultaat = alsObject(waarde);
  const berekening = alsObject(resultaat.berekening);
  const maxInkoop = Number(berekening.max_inkoop);
  return Number.isFinite(maxInkoop) && maxInkoop > 0;
}

export function isTaxatieAanvraag(aanvraag: TaxatieBron): boolean {
  if (heeftGeldigeTaxatie(aanvraag.taxatie_resultaat)) return true;
  return /taxatieaanvraag/i.test(String(aanvraag.onderwerp ?? ""));
}

export function haalKilometerstand(...teksten: (string | null | undefined)[]): string {
  const samen = teksten.filter(Boolean).join(" ");
  const match = samen.match(/(\d[\d.\s]{2,})\s*km\b/i);
  return match ? match[1].replace(/\D/g, "") : "";
}

export function taxatieFase(aanvraag: {
  taxatie_resultaat?: unknown;
  antwoord?: string;
  antwoord_verstuurd_op?: string | null;
}): TaxatieFase {
  if (aanvraag.antwoord_verstuurd_op) return "verstuurd";
  if (String(aanvraag.antwoord ?? "").trim()) return "klaar";
  if (heeftGeldigeTaxatie(aanvraag.taxatie_resultaat)) return "getaxeerd";
  return "nieuw";
}

function veilig(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function alineaHtml(bericht: string): string {
  return bericht
    .trim()
    .split(/\n\s*\n/)
    .map((alinea) => `<p style="margin:0 0 16px;line-height:1.7;color:#25324a">${veilig(alinea).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function bouwTaxatieMail({
  naam,
  kenteken,
  voertuig,
  bericht,
}: {
  naam: string;
  kenteken: string;
  voertuig: string;
  bericht: string;
}): string {
  return `<!doctype html>
<html lang="nl">
  <body style="margin:0;background:#f3f5f8;font-family:Arial,sans-serif;color:#001337">
    <div style="max-width:640px;margin:0 auto;padding:24px 12px">
      <div style="background:#001337;padding:28px 30px;border-radius:14px 14px 0 0;text-align:center">
        <div style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#ffffff">JG Mobility</div>
        <div style="margin-top:7px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.58)">Uw taxatie</div>
      </div>
      <div style="background:#ffffff;padding:30px;border-radius:0 0 14px 14px;box-shadow:0 10px 30px rgba(0,19,55,.08)">
        <div style="margin-bottom:22px;padding:14px 16px;background:#f7f9fc;border-left:3px solid #001337;border-radius:8px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280">Aanvraag</div>
          <div style="margin-top:5px;font-size:14px;font-weight:700;color:#001337">${veilig(voertuig || "Uw auto")}${kenteken ? ` · ${veilig(kenteken)}` : ""}</div>
          ${naam ? `<div style="margin-top:3px;font-size:12px;color:#64748b">Voor ${veilig(naam)}</div>` : ""}
        </div>
        ${alineaHtml(bericht)}
        <div style="margin-top:26px;padding-top:18px;border-top:1px solid #e5e7eb">
          <div style="font-weight:700;color:#001337">JG Mobility</div>
          <div style="margin-top:5px;font-size:12px;line-height:1.6;color:#64748b">Arnhemseweg 10a · Barendrecht<br>info@jgmobility.nl</div>
        </div>
      </div>
      <div style="padding:14px;text-align:center;font-size:10px;color:#94a3b8">Dit voorstel is onder voorbehoud van bezichtiging, onderhoudshistorie en de actuele staat van de auto.</div>
    </div>
  </body>
</html>`;
}

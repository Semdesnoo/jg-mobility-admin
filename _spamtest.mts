/** Tijdelijk — stuurt de reviewmail naar mail-tester voor een spamscore. Daarna verwijderen. */
import { readFileSync } from "node:fs";
import { Resend } from "resend";
import { reviewMail } from "./lib/mail-sjabloon";

const env = readFileSync(".env.local", "utf8");
const apiKey = env.split(/\r?\n/).find((r) => r.startsWith("RESEND_API_KEY="))?.slice(15).replace(/^["']|["']$/g, "").trim() ?? "";
if (!apiKey) { console.error("geen key"); process.exit(1); }

const m = reviewMail({
  klant_naam: "Geert Meesen",
  factuur_nr: "JGM-2026-013",
  voertuig: "Volkswagen Golf (2019)",
  totaal: 400,
});

const { data, error } = await new Resend(apiKey).emails.send({
  from: "JG Mobility <info@jgmobility.nl>",
  to: "test-jgm2026sem@srv1.mail-tester.com",
  replyTo: "info@jgmobility.nl",
  subject: m.onderwerp,
  html: m.html,
  text: m.tekst,
});
console.log(error ? `MISLUKT: ${error.message}` : `verstuurd: ${data?.id}`);

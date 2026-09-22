// Quick test: laadt de mail-HTML en dumpt het logo-gedeelte naar stdout.
// Run: node test-mail-html.mjs
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Reproduceer de helper letterlijk in JS-vorm en draai 'm.
function logoDataUrl() {
  try {
    const p = path.join(process.cwd(), "public", "JG Mobility Transparant.png");
    const buf = fs.readFileSync(p);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch (e) {
    return `__FAIL__: ${e.message}`;
  }
}

const dataUrl = logoDataUrl();
console.log("=== Data-URL resultaat ===");
console.log("Lengte:", dataUrl.length, "chars");
console.log("Prefix:", dataUrl.slice(0, 22));
console.log("Eerste 80 chars:", dataUrl.slice(0, 80));
console.log("Is het een geldige PNG-data-URL?", dataUrl.startsWith("data:image/png;base64,"));

if (dataUrl.startsWith("__FAIL__")) {
  console.log("FALLBACK WERD GEBRUIKT — logo wordt NIET getoond.");
  process.exit(1);
}

// Decode het eerste stukje om te verifiëren dat het een echte PNG is
const b64 = dataUrl.replace("data:image/png;base64,", "");
const buf = Buffer.from(b64, "base64");
console.log("\n=== Decode-check ===");
console.log("Bytes:", buf.length);
console.log("Eerste 16 bytes (hex):", buf.slice(0, 16).toString("hex"));
console.log("PNG-magic?", buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47);

// Schrijf een test-mail.html met deze data-URL erin verwerkt, dan kunnen we 'm
// openen in de browser en zien wat de mailclient er mogelijk van bakt.
const testHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Mail logo test</title></head>
<body style="margin:0;padding:20px;background:#f0f0f0;font-family:Arial">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff;margin:0 auto;">
<tr><td align="center" style="background:#001337;padding:26px 30px;">
  <img src="${dataUrl}" alt="JG Mobility" width="100" style="display:block;margin:0 auto 12px;width:100px;max-width:100px;height:auto;border:0" />
  <div style="font-family:Georgia,serif;font-size:23px;font-weight:bold;color:#fff;letter-spacing:1px;">JG Mobility</div>
</td></tr>
</table>
<p>Hierboven staat het mail-logo in een navy balk, exact zoals in de mails.</p>
</body></html>`;

const outPath = path.join(__dirname, "test-mail-logo.html");
fs.writeFileSync(outPath, testHtml);
console.log("\nTest-HTML geschreven naar:", outPath);
console.log("Open dit in een browser om visueel te verifiëren.");

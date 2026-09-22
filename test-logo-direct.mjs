import fs from "fs";
import path from "path";

const buf = fs.readFileSync(path.join(process.cwd(), "public", "JG Mobility Transparant.png"));
const out = path.join(process.env.TEMP || "C:/Users/Gebruiker/AppData/Local/Temp", "logo-direct.png");
fs.writeFileSync(out, buf);
console.log("Geschreven naar:", out, "size:", buf.length);

// Draaien: npx tsx app/admin/dashboard/inkoop/historie.check.ts
import assert from "node:assert/strict";
import { historieVlaggen } from "./historie";

const nu = new Date(2026, 10, 22);

// Schone auto: geen vlaggen.
assert.deepEqual(historieVlaggen({ tellerLogisch: true, tenaamstellenMogelijk: true }, 90000, [], nu), []);

// Handmatige invoer (geen RDW-velden): geen valse alarmen.
assert.deepEqual(historieVlaggen({}, 90000, [], nu), []);

// Teller lager dan eerder genoteerd → rood.
const terug = historieVlaggen({}, 85000, [{ km: 120000, datum: "2025-03-01T00:00:00Z", bron: "taxatie" }], nu);
assert.equal(terug.length, 1);
assert.equal(terug[0].ernst, "rood");

// Import (toegelaten 2018, in NL sinds 2021) + recent overgeschreven → twee gele.
const imp = historieVlaggen(
  { datumEersteToelatingNL: "1-3-2018", eersteToelatingNederland: "5-6-2021", datumTenaamstelling: "1-11-2026" },
  0, [], nu,
);
assert.deepEqual(imp.map((v) => v.ernst), ["geel", "geel"]);

// NAP onlogisch + terugroepactie → rood.
assert.equal(historieVlaggen({ tellerLogisch: false, openstaandeTerugroepactie: true }, 0, [], nu).filter((v) => v.ernst === "rood").length, 2);

console.log("historie OK");

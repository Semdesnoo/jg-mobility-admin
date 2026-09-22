import assert from "node:assert/strict";
import test from "node:test";

import { bouwTaxatieMail, haalKilometerstand, isTaxatieAanvraag, taxatieFase } from "./taxatie-aanvragen";

test("herkent nieuwe en reeds getaxeerde taxatieaanvragen", () => {
  assert.equal(isTaxatieAanvraag({ onderwerp: "Taxatieaanvraag via de website", taxatie_resultaat: null }), true);
  assert.equal(isTaxatieAanvraag({ onderwerp: "Re: Taxatieaanvraag via de website", taxatie_resultaat: null }), true);
  assert.equal(isTaxatieAanvraag({ onderwerp: "Re: Uw Audi", taxatie_resultaat: { berekening: { max_inkoop: 12000 } } }), true);
  assert.equal(isTaxatieAanvraag({ onderwerp: "Inruilaanvraag via de website", taxatie_resultaat: null }), false);
});

test("haalt de kilometerstand betrouwbaar uit de aanvraagtekst", () => {
  assert.equal(haalKilometerstand("Audi S3 2015 · 185.000 km"), "185000");
  assert.equal(haalKilometerstand("Kilometerstand: 92 450 km"), "92450");
  assert.equal(haalKilometerstand("geen stand genoemd"), "");
});

test("workflowfase volgt taxatie, concept en verzending", () => {
  assert.equal(taxatieFase({ taxatie_resultaat: null, antwoord: "", antwoord_verstuurd_op: null }), "nieuw");
  assert.equal(taxatieFase({ taxatie_resultaat: {}, antwoord: "", antwoord_verstuurd_op: null }), "nieuw");
  assert.equal(taxatieFase({ taxatie_resultaat: { berekening: { max_inkoop: 12000 } }, antwoord: "", antwoord_verstuurd_op: null }), "getaxeerd");
  assert.equal(taxatieFase({ taxatie_resultaat: { berekening: { max_inkoop: 12000 } }, antwoord: "Beste klant", antwoord_verstuurd_op: null }), "klaar");
  assert.equal(taxatieFase({ taxatie_resultaat: { berekening: { max_inkoop: 12000 } }, antwoord: "Beste klant", antwoord_verstuurd_op: "2026-09-22" }), "verstuurd");
});

test("mailopmaak ontsnapt klanttekst en behoudt alinea's", () => {
  const html = bouwTaxatieMail({
    naam: "Piet <script>",
    kenteken: "AB-12-CD",
    voertuig: "Audi S3",
    bericht: "Beste Piet,\n\nWij kunnen uw auto inkopen voor € 12.500.",
  });

  assert.match(html, /Piet &lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /€ 12\.500/);
  assert.match(html, /AB-12-CD/);
});

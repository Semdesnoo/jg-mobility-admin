import assert from "node:assert/strict";
import test from "node:test";

import { berekenBoekhouding } from "./boekhouding-berekening";

const verkoop = (overrides: Record<string, unknown> = {}) => ({
  id: "v1",
  status: "verzonden",
  datum: "2026-09-01",
  vervaldatum: "2026-09-15",
  bruto: 1210,
  btwType: "21",
  inkoop: 600,
  inkoopBekend: true,
  ...overrides,
});

const inkoop = (overrides: Record<string, unknown> = {}) => ({
  id: "i1",
  status: "open",
  datum: "2026-09-02",
  vervaldatum: "2026-09-20",
  bedragIncl: 1210,
  btwBedrag: 210,
  categorie: "Kantoor & software",
  ...overrides,
});

test("conceptfacturen tellen niet mee en de kostprijs geldt ook voor 21%-verkopen", () => {
  const resultaat = berekenBoekhouding({
    verkopen: [
      verkoop({ id: "concept", status: "concept", bruto: 99999, inkoop: 50000 }),
      verkoop(),
      verkoop({ id: "marge", status: "betaald", bruto: 12100, btwType: "marge", inkoop: 10000 }),
    ],
    inkopen: [],
    consignaties: [],
  });

  assert.equal(resultaat.verkoop.definitiefAantal, 2);
  assert.equal(resultaat.verkoop.conceptAantal, 1);
  assert.equal(resultaat.verkoop.omzetInclBtw, 13310);
  assert.equal(resultaat.resultaat.kostprijsAutos, 10600);
  assert.equal(resultaat.btw.verschuldigd, 574.46);
  assert.equal(resultaat.verkoop.openstaand, 1210);
  assert.equal(resultaat.verkoop.betaald, 12100);
});

test("inkoopfacturen verlagen de winst exclusief btw zonder auto-inkoop dubbel te tellen", () => {
  const resultaat = berekenBoekhouding({
    verkopen: [verkoop()],
    inkopen: [
      inkoop(),
      inkoop({ id: "auto", status: "betaald", bedragIncl: 6050, btwBedrag: 1050, categorie: "Auto-inkoop" }),
    ],
    consignaties: [],
  });

  assert.equal(resultaat.inkoop.bedrijfskostenExclBtw, 1000);
  assert.equal(resultaat.inkoop.autoInkoopInclBtw, 6050);
  assert.equal(resultaat.btw.voorbelasting, 1260);
  assert.equal(resultaat.inkoop.openstaand, 1210);
  assert.equal(resultaat.resultaat.nettowinst, -600);
  assert.equal(resultaat.btw.saldo, -1050);
});

test("consignatie blijft buiten eigen voorraad en toont alleen de verwachte vergoeding", () => {
  const resultaat = berekenBoekhouding({
    verkopen: [],
    inkopen: [],
    consignaties: [
      { id: "c1", status: "lopend", vraagprijs: 30000, feePercentage: 10, feeVast: 0 },
      { id: "c2", status: "lopend", vraagprijs: 20000, feePercentage: 0, feeVast: 1500 },
      { id: "c3", status: "nieuw", vraagprijs: 25000, feePercentage: 8, feeVast: 0 },
    ],
  });

  assert.equal(resultaat.consignatie.inVerkoop, 2);
  assert.equal(resultaat.consignatie.vraagprijsInVerkoop, 50000);
  assert.equal(resultaat.consignatie.verwachteVergoeding, 4500);
  assert.equal(resultaat.resultaat.nettowinst, 0);
});

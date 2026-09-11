const test = require("node:test");
const assert = require("node:assert/strict");
const { mesesSiguientes } = require("./fechas");

test("mesesSiguientes genera la cantidad pedida empezando en el mes dado", () => {
  assert.deepEqual(mesesSiguientes("2026-09", 6), [
    "2026-09",
    "2026-10",
    "2026-11",
    "2026-12",
    "2027-01",
    "2027-02",
  ]);
});

test("mesesSiguientes cruza el cambio de año correctamente", () => {
  assert.deepEqual(mesesSiguientes("2026-11", 3), [
    "2026-11",
    "2026-12",
    "2027-01",
  ]);
});

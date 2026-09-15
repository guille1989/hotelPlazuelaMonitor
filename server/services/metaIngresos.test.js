const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularMetaIngresos } = require("./metaIngresos");

test("calcula ADR, RevPAR y escenarios para una meta mensual", () => {
  const dias = Array.from({ length: 30 }, (_, indice) => ({
    dia: `2026-09-${String(indice + 1).padStart(2, "0")}`,
    ocupacion: indice < 20 ? 20 : 10,
    tarifas: indice < 20 ? 2400000 : 1200000,
    habsTarifa: indice < 20 ? 20 : 10,
  }));
  const plan = calcularMetaIngresos(
    { mes: "2026-09", hoy: "2026-09-15", dias },
    100000000
  );

  assert.equal(plan.meta.revParRequeridoCOP, 114943);
  assert.equal(plan.situacionRegistradaProyectada.ocupadasRoomNoches, 500);
  assert.equal(plan.situacionRegistradaProyectada.ingresoCOP, 60000000);
  assert.equal(plan.situacionRegistradaProyectada.ingresoFaltanteCOP, 40000000);
  assert.equal(plan.situacionRegistradaProyectada.adrCOP, 120000);
  assert.equal(
    plan.situacionRegistradaProyectada.roomNochesAdicionalesManteniendoAdr,
    334
  );
  assert.equal(
    plan.situacionRegistradaProyectada
      .porcentajeDisponiblesAVenderManteniendoAdr,
    90
  );
  assert.equal(
    plan.situacionRegistradaProyectada.tarifaMediaNecesariaEnDisponiblesCOP,
    108108
  );
  assert.equal(
    plan.escenarios.find((escenario) => escenario.ocupacionPct === 75)
      .adrPromedioTotalRequeridoCOP,
    153257
  );
  assert.equal(
    plan.escenarios.find((escenario) => escenario.ocupacionPct === 90)
      .adrPromedioTotalRequeridoCOP,
    127714
  );
  assert.equal(
    plan.escenarios.find((escenario) => escenario.ocupacionPct === 90)
      .roomNochesAdicionales,
    283
  );
  assert.equal(
    plan.escenarios.find((escenario) => escenario.ocupacionPct === 90)
      .tarifaMediaNuevasVentasCOP,
    141343
  );
});

test("rechaza metas que no sean positivas", () => {
  assert.throws(
    () => calcularMetaIngresos({ mes: "2026-09", dias: [] }, 0),
    /número positivo/
  );
});

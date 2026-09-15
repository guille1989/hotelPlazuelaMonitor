const test = require("node:test");
const assert = require("node:assert/strict");
const {
  mesesEntre,
  obtenerFacturacionMensual,
} = require("./facturacionMensual");

function dbDePrueba(cargos = []) {
  return {
    collection(nombre) {
      assert.equal(nombre, "noches_vendidas");
      return {
        find() {
          return { async toArray() { return cargos; } };
        },
      };
    },
  };
}

test("mesesEntre genera hasta veinticuatro meses inclusive", () => {
  const meses = mesesEntre("2025-01", "2026-12");
  assert.equal(meses.length, 24);
  assert.equal(meses[0], "2025-01");
  assert.equal(meses[23], "2026-12");
  assert.throws(() => mesesEntre("2024-12", "2026-12"), /24 meses/);
});

test("compara facturación real, marca el mes actual y excluye futuros", async () => {
  const resultado = await obtenerFacturacionMensual(
    dbDePrueba([
      { fecha: "2025-01-10", numero_habitacion: "101", concepto: 1020, valor_neto: 300000 },
      { fecha: "2025-02-10", numero_habitacion: "101", concepto: 1020, valor_neto: 400000 },
      { fecha: "2025-02-10", numero_habitacion: "217", concepto: 1020, valor_neto: 500000 },
      { fecha: "2026-07-10", numero_habitacion: "101", concepto: 1020, valor_neto: 1100000 },
      { fecha: "2026-09-10", numero_habitacion: "101", concepto: 1020, valor_neto: 700000 },
      { fecha: "2026-10-10", numero_habitacion: "101", concepto: 1020, valor_neto: 9000000 },
    ]),
    "2025-01",
    "2026-12",
    { hoy: "2026-09-15" }
  );

  assert.equal(resultado.porAnio["2025"].mes, "2025-02");
  assert.equal(resultado.porAnio["2025"].ingresoCOP, 900000);
  assert.equal(resultado.porAnio["2026"].mes, "2026-07");
  assert.equal(resultado.mayorGeneral.mes, "2026-07");
  assert.equal(resultado.mayorMesCerrado.mes, "2026-07");
  assert.equal(
    resultado.meses.find((mes) => mes.mes === "2026-09").estado,
    "parcial"
  );
  assert.equal(
    resultado.meses.find((mes) => mes.mes === "2026-09").fechaCorte,
    "2026-09-14"
  );
  assert.equal(
    resultado.meses.find((mes) => mes.mes === "2026-10").ingresoCOP,
    0
  );
  assert.equal(
    resultado.meses.find((mes) => mes.mes === "2026-10").estado,
    "futuro"
  );
});

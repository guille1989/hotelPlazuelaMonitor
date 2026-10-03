const test = require("node:test");
const assert = require("node:assert/strict");
const { ingresoPorDia } = require("./ingresoAlojamiento");
const { ocupacionPorDia } = require("./ocupacionDiaria");

function dbDePrueba({ cargos = [], movimientos = [], reservas = [] } = {}) {
  const porColeccion = {
    noches_vendidas: cargos,
    movimientos_alojamiento: movimientos,
    reservas,
  };
  return {
    collection(nombre) {
      return {
        find() {
          return { async toArray() { return porColeccion[nombre] || []; } };
        },
      };
    },
  };
}

test("ingresoPorDia suma con signo: traslados y anulaciones se cancelan", async () => {
  const porDia = await ingresoPorDia(
    dbDePrueba({
      movimientos: [
        { fecha: "2025-09-30", valor_neto: 766386.55 },
        { fecha: "2025-09-30", valor_neto: -766386.55 },
        { fecha: "2025-09-30", valor_neto: 35000 },
        { fecha: null, valor_neto: 999 },
      ],
    }),
    "2025-09-01",
    "2025-09-30"
  );
  assert.deepEqual([...porDia], [["2025-09-30", 35000]]);
});

test("ocupacionPorDia cuenta habitaciones del folio e ingreso de MOVFOLIO", async () => {
  const { porDia } = await ocupacionPorDia(
    dbDePrueba({
      cargos: [
        { fecha: "2025-09-29", numero_habitacion: "205", concepto: 1020, valor_neto: 766386.55 },
        { fecha: "2025-09-29", numero_habitacion: "220", concepto: 1020, valor_neto: 0 },
        { fecha: "2025-09-30", numero_habitacion: "207", concepto: 1020, valor_neto: 100000 },
      ],
      movimientos: [
        { fecha: "2025-09-29", valor_neto: 766386.55 },
        { fecha: "2025-09-29", valor_neto: -57142.86 }, // corrección de un cobro de más
      ],
    }),
    ["2025-09-29", "2025-09-30"]
  );

  const dia29 = porDia.get("2025-09-29");
  assert.equal(dia29.ocupacion, 2); // la de $0 cuenta como ocupada
  assert.equal(dia29.fuente, "folio");
  assert.equal(Math.round(dia29.tarifas), 709244);

  // El 30 no tiene movimientos: queda el ingreso de la auditoría.
  assert.equal(porDia.get("2025-09-30").tarifas, 100000);
});

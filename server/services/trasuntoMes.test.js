const test = require("node:test");
const assert = require("node:assert/strict");
const { obtenerTrasuntoMes } = require("./trasuntoMes");

function dbDePrueba(porColeccion = {}) {
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

test("arma el resumen del día con alojamiento de MOVFOLIO y consumos brutos", async () => {
  const datos = await obtenerTrasuntoMes(
    dbDePrueba({
      noches_vendidas: [
        { fecha: "2025-09-01", numero_habitacion: "101", concepto: 1020, valor_neto: 100000, iva: 19000 },
        { fecha: "2025-09-01", numero_habitacion: "102", concepto: 1020, valor_neto: 0, iva: 0 },
      ],
      movimientos_alojamiento: [
        { fecha: "2025-09-01", valor_neto: 100000, iva: 19000 },
        { fecha: "2025-09-01", valor_neto: 35000, iva: 0 }, // adicional manual
      ],
      movimientos_consumos: [
        { fecha: "2025-09-01", concepto: 3, valor_neto: 7407.41, iva: 0, impuesto: 592.59 },
        { fecha: "2025-09-01", concepto: 101, valor_neto: 14814.81, iva: 0, impuesto: 1185.19 },
        { fecha: "2025-09-01", concepto: 46, valor_neto: 10084.03, iva: 1915.97, impuesto: 0 },
        { fecha: "2025-09-01", concepto: 101, valor_neto: -14814.81, iva: 0, impuesto: -1185.19 },
        // Día sin folio todavía: no entra.
        { fecha: "2025-09-02", concepto: 3, valor_neto: 8000, iva: 0, impuesto: 0 },
      ],
    }),
    "2025-09"
  );

  const dia1 = datos.dias[0];
  assert.deepEqual(dia1, {
    dia: "2025-09-01",
    estado: "cerrado",
    habitaciones: 2,
    ocupacionPct: 6.9,
    ventaHabitaciones: 135000,
    tarifaPromedio: 4655,
    iva: 19000,
    restaurante: 8000,
    desayunos: 0,
    lavanderia: 12000,
    ventasTotales: 174000,
  });
  assert.deepEqual(datos.dias[1], { dia: "2025-09-02", estado: "pendiente" });
  assert.equal(datos.dias.length, 30);
  assert.equal(datos.fechaCorte, "2025-09-01");
  assert.equal(datos.acumulado.dias, 1);
  assert.equal(datos.acumulado.ventasTotales, 174000);
  assert.equal(datos.acumulado.tarifaPromedio, 4655);
});

test("los días de hoy en adelante quedan como futuro y sin cifras", async () => {
  const datos = await obtenerTrasuntoMes(dbDePrueba(), "2099-01");
  assert.ok(datos.dias.every((d) => d.estado === "futuro"));
  assert.equal(datos.acumulado.dias, 0);
  assert.equal(datos.acumulado.ocupacionPct, null);
  assert.equal(datos.fechaCorte, null);
});

test("obtenerTrasuntoMes rechaza meses imposibles", async () => {
  await assert.rejects(obtenerTrasuntoMes(dbDePrueba(), "2026-13"), /YYYY-MM/);
});

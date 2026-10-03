const test = require("node:test");
const assert = require("node:assert/strict");
const { obtenerCargosManuales } = require("./cargosManuales");

function dbDePrueba(movimientos = []) {
  return {
    collection(nombre) {
      assert.equal(nombre, "movimientos_alojamiento");
      return {
        find() {
          return { async toArray() { return movimientos; } };
        },
      };
    },
  };
}

test("marca como anulado el cargo manual que tiene su B: y deja las anulaciones sueltas", async () => {
  const datos = await obtenerCargosManuales(
    dbDePrueba([
      { fecha: "2026-09-30", nfolio: "053129", numero_habitacion: null, concepto: 1020,
        valor_neto: -766386.55, motivo: "B:053129", usuario: "RASTUDILLO",
        fecha_tra: "2026-09-30 23:19", origen: "anulacion" },
      { fecha: "2026-09-30", nfolio: "053129", numero_habitacion: null, concepto: 1020,
        valor_neto: 766386.55, motivo: "ALOJAMIENTO", usuario: "RASTUDILLO",
        fecha_tra: "2026-09-30 15:49", origen: "manual" },
      { fecha: "2026-09-29", nfolio: "053086", numero_habitacion: "207", concepto: 1021,
        valor_neto: 35000, motivo: "ALOJAMIENTO EXENTO", usuario: "FASTUDILLO",
        fecha_tra: "2026-09-29 19:23", origen: "manual" },
      { fecha: "2026-09-11", nfolio: "052797", numero_habitacion: "209", concepto: 1020,
        valor_neto: -177310.92, motivo: "B:052797", usuario: "AVIDAL",
        fecha_tra: "2026-09-11 21:00", origen: "anulacion" },
    ]),
    "2026-09"
  );

  assert.equal(datos.cantidad, 3);
  assert.deepEqual(
    datos.movimientos.map((m) => [m.fecha, m.tipo, m.valorCOP, m.anulado]),
    [
      ["2026-09-11", "anulación", -177311, false],
      ["2026-09-29", "cargo manual", 35000, false],
      ["2026-09-30", "cargo manual", 766387, true],
    ]
  );
  assert.equal(datos.totalCOP, Math.round(35000 - 177310.92));
});

test("omite redondeos y movimientos manuales entre folios, pero no correcciones", async () => {
  const datos = await obtenerCargosManuales(
    dbDePrueba([
      // Redondeo: no se lista.
      { fecha: "2026-09-03", nfolio: "052755", concepto: 1020, valor_neto: -9.58,
        fecha_tra: "2026-09-03 07:35", origen: "manual" },
      // Movido a mano de 052789 a 052790 (la entrada viene marcada como auditoría).
      { fecha: "2026-09-05", nfolio: "052789", concepto: 1020, valor_neto: -102521.01,
        fecha_tra: "2026-09-05 17:13", origen: "manual" },
      { fecha: "2026-09-05", nfolio: "052790", numero_habitacion: "210", concepto: 1020,
        valor_neto: 102521.01, fecha_tra: "2026-09-05 17:17", origen: "auditoria" },
      // Cargo manual real del mismo día: se lista.
      { fecha: "2026-09-05", nfolio: "052790", concepto: 1020, valor_neto: 25210.08,
        fecha_tra: "2026-09-05 17:19", origen: "manual" },
      // Crédito manual contra la auditoría del MISMO folio: corrección, se lista.
      { fecha: "2026-09-10", nfolio: "052850", numero_habitacion: "104", concepto: 1020,
        valor_neto: 150000, fecha_tra: "2026-09-11 04:10", origen: "auditoria" },
      { fecha: "2026-09-10", nfolio: "052850", numero_habitacion: "104", concepto: 1020,
        valor_neto: -150000, fecha_tra: "2026-09-11 10:00", origen: "manual" },
    ]),
    "2026-09"
  );

  assert.deepEqual(
    datos.movimientos.map((m) => [m.fecha, m.nfolio, m.valorCOP]),
    [
      ["2026-09-05", "052790", 25210],
      ["2026-09-10", "052850", -150000],
    ]
  );
});

test("obtenerCargosManuales rechaza meses imposibles", async () => {
  await assert.rejects(obtenerCargosManuales(dbDePrueba(), "2026-13"), /YYYY-MM/);
});

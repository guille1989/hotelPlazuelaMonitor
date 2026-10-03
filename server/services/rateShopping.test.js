const test = require("node:test");
const assert = require("node:assert/strict");
const { crearConsultas } = require("../rate-shopping/consultas");
const { crearProveedorMock } = require("../rate-shopping/providers/mock");
const {
  ejecutarCapturaTarifas,
  idTarifa,
} = require("./rateShopping");

test("ejecuta en seco las 84 consultas del catálogo MVP", async () => {
  const resultado = await ejecutarCapturaTarifas({
    proveedor: crearProveedorMock(),
    consultas: crearConsultas({ fechaBase: "2026-09-27" }),
    ahora: "2026-09-27T12:00:00.000Z",
    dryRun: true,
  });

  assert.equal(resultado.ejecucion._id, "mock:2026-09-27");
  assert.equal(resultado.ejecucion.status, "completa");
  assert.deepEqual(resultado.ejecucion.summary, {
    esperadas: 84,
    recibidas: 84,
    coberturaPct: 100,
    comparables: 84,
    agotadas: 0,
    noComparables: 0,
    errores: 0,
  });
  assert.equal(resultado.tarifas.every((tarifa) => tarifa.simulated), true);
});

test("el mock permite probar agotados sin convertirlos en precio cero", async () => {
  const resultado = await ejecutarCapturaTarifas({
    proveedor: crearProveedorMock({
      agotados: ["hotel-la-plazuela:2026-09-28"],
    }),
    consultas: crearConsultas({
      fechaBase: "2026-09-27",
      horizontes: [1],
    }),
    ahora: "2026-09-27T12:00:00.000Z",
    dryRun: true,
  });
  const propia = resultado.tarifas.find(
    (tarifa) => tarifa.hotelId === "hotel-la-plazuela"
  );
  assert.equal(propia.available, false);
  assert.equal(propia.totalAmount, null);
  assert.equal(resultado.ejecucion.summary.agotadas, 1);
});

test("bloquea la escritura accidental de datos simulados", async () => {
  await assert.rejects(
    () =>
      ejecutarCapturaTarifas({
        db: {},
        proveedor: crearProveedorMock(),
        consultas: crearConsultas({
          fechaBase: "2026-09-27",
          horizontes: [1],
        }),
        ahora: "2026-09-27T12:00:00.000Z",
      }),
    /proveedor simulado solo puede escribir/
  );
});

test("idTarifa es estable para una consulta normalizada", () => {
  const tarifa = {
    hotelId: "hotel-la-plazuela",
    checkIn: "2026-09-28",
    checkOut: "2026-09-29",
    adults: 2,
    rooms: 1,
    channel: "web",
  };
  assert.equal(
    idTarifa("proveedor:2026-09-27", tarifa),
    "proveedor:2026-09-27:hotel-la-plazuela:2026-09-28:2026-09-29:2:1:web"
  );
});

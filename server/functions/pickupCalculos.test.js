const test = require("node:test");
const assert = require("node:assert/strict");
const {
  agruparPickup,
  combinarConHistorico,
} = require("./pickupCalculos");

const reserva = (datos = {}) => ({
  fecha_llegada: "2026-10-10",
  fecha_salida: "2026-10-13",
  cantid_reh: 1,
  origen: "Con reserva",
  fecha_cancelacion: null,
  ...datos,
});

test("cuenta una creación y cancelación en la misma ventana como dos eventos con neto cero", () => {
  const resultado = agruparPickup(
    [reserva({ fecha_reserva: "2026-09-04", fecha_cancelacion: "2026-09-06" })],
    { desde: "2026-09-02", hasta: "2026-09-08" }
  );

  assert.equal(resultado.totales.nuevas, 1);
  assert.equal(resultado.totales.canceladas, 1);
  assert.equal(resultado.totales.nuevasRoomNoches, 3);
  assert.equal(resultado.totales.canceladasRoomNoches, 3);
  assert.equal(resultado.totales.roomNoches, 0);
  assert.equal(resultado.movimientos, 2);
});

test("traslada el mes de llegada histórico al año actual", () => {
  const resultado = agruparPickup(
    [
      reserva({
        fecha_llegada: "2025-10-10",
        fecha_salida: "2025-10-12",
        fecha_reserva: "2025-09-04",
      }),
    ],
    {
      desde: "2025-09-02",
      hasta: "2025-09-08",
      desplazarAnios: 1,
    }
  );

  assert.equal(resultado.porMes.get("2026-10").roomNoches, 2);
});

test("incluye meses sin movimiento actual cuando sí tuvieron pickup histórico", () => {
  const actual = agruparPickup([], {
    desde: "2026-09-02",
    hasta: "2026-09-08",
  });
  const historico = agruparPickup(
    [
      reserva({
        fecha_llegada: "2025-11-01",
        fecha_salida: "2025-11-05",
        fecha_reserva: "2025-09-03",
      }),
    ],
    {
      desde: "2025-09-02",
      hasta: "2025-09-08",
      desplazarAnios: 1,
    }
  );

  const comparacion = combinarConHistorico(actual, [historico]);
  assert.equal(comparacion.meses[0].mes, "2026-11");
  assert.equal(comparacion.meses[0].roomNoches, 0);
  assert.equal(comparacion.meses[0].historico.referenciaRoomNoches, 4);
  assert.equal(comparacion.historico.diferenciaRoomNoches, -4);
});

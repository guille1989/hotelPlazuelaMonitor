const test = require("node:test");
const assert = require("node:assert/strict");
const {
  elegirOfertaMinima,
  esRespuestaSinDisponibilidad,
  fechaDmy,
  parsearMontoCop,
} = require("./playwright");

test("interpreta el formato monetario colombiano del motor HBook", () => {
  assert.equal(parsearMontoCop("$169.200,00"), 169200);
  assert.equal(parsearMontoCop("COP 1.245.900,50"), 1245901);
});

test("elige la habitación pública de menor precio", () => {
  const oferta = elegirOfertaMinima([
    { propertyRoomId: "2", roomType: "Triple", priceText: "$216.920,00" },
    { propertyRoomId: "1", roomType: "Twin", priceText: "$169.200,00" },
  ]);

  assert.equal(oferta.propertyRoomId, "1");
  assert.equal(oferta.roomType, "Twin");
  assert.equal(oferta.totalAmount, 169200);
});

test("convierte fechas ISO al formato visible del formulario", () => {
  assert.equal(fechaDmy("2026-09-28"), "28/09/2026");
});

test("solo interpreta como agotado un mensaje explícito del motor", () => {
  assert.equal(
    esRespuestaSinDisponibilidad({
      success: false,
      msg: "Lamentablemente no pudimos encontrar alojamiento para las fechas.",
    }),
    true
  );
  assert.equal(
    esRespuestaSinDisponibilidad({ success: false, msg: "Error interno" }),
    false
  );
});

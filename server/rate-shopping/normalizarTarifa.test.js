const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizarTarifa } = require("./normalizarTarifa");

function cotizacionBase(cambios = {}) {
  return {
    hotelId: "hotel-camino-real-popayan",
    source: "prueba",
    channel: "web",
    capturedAt: "2026-09-27T12:00:00.000Z",
    checkIn: "2026-10-04",
    checkOut: "2026-10-05",
    adults: 2,
    rooms: 1,
    roomType: "Doble",
    refundable: true,
    mealPlan: "incluido",
    currency: "cop",
    baseAmount: 200000,
    taxesAmount: 38000,
    totalAmount: 238000,
    taxesIncluded: true,
    publicRate: true,
    memberRate: false,
    available: true,
    ...cambios,
  };
}

test("normaliza una tarifa pública comparable", () => {
  const tarifa = normalizarTarifa(cotizacionBase());
  assert.equal(tarifa.currency, "COP");
  assert.equal(tarifa.totalAmount, 238000);
  assert.equal(tarifa.comparable, true);
  assert.deepEqual(tarifa.nonComparableReasons, []);
});

test("marca como no comparable una tarifa sin impuestos confirmados", () => {
  const tarifa = normalizarTarifa(
    cotizacionBase({ taxesIncluded: false, refundable: false })
  );
  assert.equal(tarifa.comparable, false);
  assert.deepEqual(tarifa.nonComparableReasons, [
    "impuestos_no_confirmados",
    "cancelacion_no_flexible",
  ]);
});

test("distingue cancelación no confirmada de una política no flexible", () => {
  const tarifa = normalizarTarifa(
    cotizacionBase({ refundable: null, sourceUrl: "https://example.com/tarifa" })
  );
  assert.equal(tarifa.sourceUrl, "https://example.com/tarifa");
  assert.equal(tarifa.comparable, false);
  assert.deepEqual(tarifa.nonComparableReasons, ["cancelacion_no_confirmada"]);
});

test("una habitación agotada conserva null y nunca una tarifa cero", () => {
  const tarifa = normalizarTarifa(
    cotizacionBase({ available: false, totalAmount: 0 })
  );
  assert.equal(tarifa.available, false);
  assert.equal(tarifa.totalAmount, null);
  assert.equal(tarifa.comparable, false);
  assert.deepEqual(tarifa.nonComparableReasons, ["sin_disponibilidad"]);
});

test("rechaza una tarifa disponible sin total", () => {
  assert.throws(
    () => normalizarTarifa(cotizacionBase({ totalAmount: null })),
    /requiere totalAmount/
  );
});

test("rechaza ocupaciones o fechas inválidas", () => {
  assert.throws(
    () => normalizarTarifa(cotizacionBase({ adults: 0 })),
    /adultos|adults/
  );
  assert.throws(
    () => normalizarTarifa(cotizacionBase({ checkIn: "27-09-2026" })),
    /YYYY-MM-DD/
  );
  assert.throws(
    () => normalizarTarifa(cotizacionBase({ checkIn: "2026-02-31" })),
    /fecha real/
  );
  assert.throws(
    () =>
      normalizarTarifa(
        cotizacionBase({ checkIn: "2026-10-05", checkOut: "2026-10-04" })
      ),
    /posterior/
  );
});

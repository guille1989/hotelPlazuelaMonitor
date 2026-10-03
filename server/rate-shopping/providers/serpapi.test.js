const test = require("node:test");
const assert = require("node:assert/strict");
const { CATALOGO_HOTELES } = require("../catalogoHoteles");
const {
  cotizacionBooking,
  crearClienteSerpApi,
  crearProveedorSerpApi,
  sugerirHotelCatalogo,
} = require("./serpapi");

const consulta = {
  offsetDias: 7,
  checkIn: "2026-10-10",
  checkOut: "2026-10-11",
  adultos: 2,
  habitaciones: 1,
  noches: 1,
  moneda: "COP",
};
const capturedAt = new Date("2026-10-03T12:00:00.000Z");

function hotel(id, token) {
  return { id, nombre: id, grupo: "directo", activo: true, googleHotelsToken: token };
}

function tarifa(total, extras = {}) {
  return {
    num_guests: 2,
    rate_per_night: { extracted_lowest: total },
    total_rate: { extracted_lowest: total },
    ...extras,
  };
}

// Forma real del detalle de La Plazuela para el 10-oct-2026 (recortado).
function detalleConBooking(rooms, otras = []) {
  return {
    search_metadata: { google_hotels_url: "https://www.google.com/travel/search?q=x" },
    featured_prices: [
      { source: "Expedia.com", rooms: [{ name: "Doble", num_guests: 2, rates: [tarifa(84965)] }] },
      { source: "Booking.com", rooms },
    ],
    prices: [
      { source: "Expedia.com", ...tarifa(84965) },
      { source: "Booking.com", link: "https://www.google.com/travel/clk?booking", ...tarifa(101724) },
      ...otras,
    ],
  };
}

test("toma la tarifa de Booking para 2 adultos con cancelación gratis, no la de Expedia", () => {
  const detalle = detalleConBooking([
    {
      name: "Habitación Doble Estándar",
      num_guests: 2,
      rates: [
        tarifa(101725, {
          free_cancellation: true,
          inclusions: ["1 cama doble", "Cancelación gratuita hasta el 7 oct"],
        }),
      ],
    },
    { name: "Habitación Triple", num_guests: 3, rates: [tarifa(160840, { num_guests: 3 })] },
  ]);

  const cotizacion = cotizacionBooking({
    hotel: hotel("hotel-la-plazuela", "T1"),
    detalle,
    consulta,
    capturedAt,
  });

  assert.equal(cotizacion.totalAmount, 101725);
  assert.equal(cotizacion.roomType, "Habitación Doble Estándar");
  assert.equal(cotizacion.refundable, true);
  assert.equal(cotizacion.taxesIncluded, true);
  assert.equal(cotizacion.mealPlan, "desconocido");
  assert.equal(cotizacion.channel, "booking_com");
  assert.equal(cotizacion.sourceUrl, "https://www.google.com/travel/clk?booking");
  assert.equal(cotizacion.sourcePropertyId, "T1");
});

test("prefiere la tarifa flexible aunque haya una no reembolsable más barata", () => {
  const detalle = detalleConBooking([
    {
      name: "Doble",
      num_guests: 2,
      rates: [
        tarifa(90000, { inclusions: ["No reembolsable"] }),
        tarifa(105000, { free_cancellation: true, inclusions: ["Desayuno incluido"] }),
      ],
    },
  ]);

  const cotizacion = cotizacionBooking({ hotel: hotel("h", "T"), detalle, consulta, capturedAt });
  assert.equal(cotizacion.totalAmount, 105000);
  assert.equal(cotizacion.refundable, true);
  assert.equal(cotizacion.mealPlan, "incluido");
});

test("sin tarifa flexible guarda la más barata con cancelación sin confirmar", () => {
  const detalle = detalleConBooking([
    { name: "Doble", num_guests: 2, rates: [tarifa(98000), tarifa(90000)] },
  ]);
  const cotizacion = cotizacionBooking({ hotel: hotel("h", "T"), detalle, consulta, capturedAt });
  assert.equal(cotizacion.totalAmount, 90000);
  assert.equal(cotizacion.refundable, null);
});

test("si Google no da habitaciones usa la fila resumida de Booking", () => {
  const detalle = {
    prices: [{ source: "Booking.com", free_cancellation: true, ...tarifa(150000) }],
  };
  const cotizacion = cotizacionBooking({ hotel: hotel("h", "T"), detalle, consulta, capturedAt });
  assert.equal(cotizacion.totalAmount, 150000);
  assert.equal(cotizacion.roomType, null);
  assert.equal(cotizacion.refundable, true);
});

test("no toma el precio de una habitación para 3 como el de 2 adultos", () => {
  const detalle = {
    featured_prices: [
      { source: "Booking.com", rooms: [{ name: "Triple", num_guests: 3, rates: [tarifa(160840, { num_guests: 3 })] }] },
    ],
  };
  assert.equal(cotizacionBooking({ hotel: hotel("h", "T"), detalle, consulta, capturedAt }), null);
});

test("consulta el detalle de cada hotel con su token y cuenta las búsquedas", async () => {
  const llamadas = [];
  const proveedor = crearProveedorSerpApi({
    buscar: async (parametros) => {
      llamadas.push(parametros);
      return detalleConBooking([
        { name: "Doble", num_guests: 2, rates: [tarifa(100000, { free_cancellation: true })] },
      ]);
    },
  });

  const resultado = await proveedor.capturar({
    hoteles: [hotel("a", "A"), hotel("b", "B")],
    consultas: [consulta],
    capturedAt,
  });

  assert.deepEqual(
    llamadas.map((p) => [p.property_token, p.check_in_date, p.check_out_date, p.adults]),
    [
      ["A", "2026-10-10", "2026-10-11", 2],
      ["B", "2026-10-10", "2026-10-11", 2],
    ]
  );
  assert.deepEqual(resultado.usage, { busquedas: 2 });
  assert.deepEqual(resultado.cotizaciones.map((c) => c.hotelId), ["a", "b"]);
  assert.equal(resultado.errores.length, 0);
});

test("reporta cobertura: sin token, sin Booking, sin precios y búsqueda fallida", async () => {
  const respuestas = {
    A: { prices: [{ source: "Expedia.com", ...tarifa(84965) }] },
    B: { prices: [] },
    C: new Error("SerpApi respondió HTTP 401: Invalid API key"),
  };
  const proveedor = crearProveedorSerpApi({
    buscar: async ({ property_token: token }) => {
      if (respuestas[token] instanceof Error) throw respuestas[token];
      return respuestas[token];
    },
  });

  const resultado = await proveedor.capturar({
    hoteles: [hotel("a", "A"), hotel("b", "B"), hotel("c", "C"), hotel("d", null)],
    consultas: [consulta],
    capturedAt,
  });

  assert.deepEqual(
    resultado.errores.map((e) => `${e.hotelId}:${e.code}`).sort(),
    [
      "a:sin_precio_booking",
      "b:sin_precio_publicado",
      "c:busqueda_serpapi_fallida",
      "d:sin_token_google",
    ]
  );
  assert.match(resultado.errores.find((e) => e.hotelId === "a").message, /Expedia\.com/);
  assert.equal(resultado.cotizaciones.length, 0);
  // Las búsquedas fallidas no cuentan en la cuota de SerpApi.
  assert.deepEqual(resultado.usage, { busquedas: 2 });
});

test("se niega a correr si la captura supera el tope de búsquedas", async () => {
  const proveedor = crearProveedorSerpApi({
    maxBusquedas: 3,
    buscar: async () => assert.fail("no debía buscar"),
  });
  await assert.rejects(
    () =>
      proveedor.capturar({
        hoteles: [hotel("a", "A"), hotel("b", "B")],
        consultas: [consulta, { ...consulta, checkIn: "2026-10-11", checkOut: "2026-10-12" }],
        capturedAt,
      }),
    /necesita 4 búsquedas/
  );
});

test("el cliente fija Google Hotels en COP para Colombia y no filtra la API key", async () => {
  let urlPedida;
  const buscar = crearClienteSerpApi({
    apiKey: "secreta",
    fetchImpl: async (url) => {
      urlPedida = url;
      return { ok: false, status: 401, json: async () => ({ error: "Invalid API key." }) };
    },
  });

  await assert.rejects(
    () => buscar({ q: "Popayán" }),
    (error) => !error.message.includes("secreta") && error.message.includes("401")
  );
  assert.equal(urlPedida.searchParams.get("engine"), "google_hotels");
  assert.equal(urlPedida.searchParams.get("currency"), "COP");
  assert.equal(urlPedida.searchParams.get("gl"), "co");
});

test("una búsqueda sin resultados no es un error", async () => {
  const buscar = crearClienteSerpApi({
    apiKey: "x",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ error: "Google Hotels hasn't returned any results for this query." }),
    }),
  });
  const respuesta = await buscar({ q: "Popayán" });
  assert.deepEqual(respuesta.properties, []);
});

test("rechaza precios en otra moneda", async () => {
  const buscar = crearClienteSerpApi({
    apiKey: "x",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ search_parameters: { currency: "USD" }, properties: [] }),
    }),
  });
  await assert.rejects(() => buscar({ q: "Popayán" }), /USD/);
});

test("sugiere el hotel del catálogo por nombre sin confundir los 'Colonial'", () => {
  assert.equal(
    sugerirHotelCatalogo("Hotel Camino Real", CATALOGO_HOTELES)?.hotelId,
    "hotel-camino-real-popayan"
  );
  assert.equal(
    sugerirHotelCatalogo("Hotel Colonial", CATALOGO_HOTELES)?.hotelId,
    "hotel-colonial-popayan"
  );
  assert.equal(
    sugerirHotelCatalogo("La Herrería Colonial Hotel", CATALOGO_HOTELES)?.hotelId,
    "hotel-la-herreria-colonial"
  );
  assert.equal(sugerirHotelCatalogo("Hostal Caracol", CATALOGO_HOTELES), null);
});

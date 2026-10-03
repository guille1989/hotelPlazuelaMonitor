const test = require("node:test");
const assert = require("node:assert/strict");
const {
  armarTarifasCompetencia,
  mediana,
  obtenerTarifasCompetencia,
} = require("./tarifasCompetencia");

const ejecucionBase = {
  _id: "serpapi:2026-10-03",
  capturedAt: new Date("2026-10-03T20:00:00Z"),
  capturedDate: "2026-10-03",
  status: "parcial",
  summary: { esperadas: 14, recibidas: 10 },
  errors: [],
};

function tarifa(hotelId, checkIn, totalAmount, extras = {}) {
  return {
    hotelId,
    checkIn,
    totalAmount,
    available: true,
    comparable: true,
    nonComparableReasons: [],
    refundable: true,
    mealPlan: "desconocido",
    roomType: "Doble",
    ...extras,
  };
}

// Captura real del 3-oct-2026 para el lun 2-nov (D+30).
const tarifas2Nov = [
  tarifa("hotel-la-plazuela", "2026-11-02", 221142),
  tarifa("hotel-la-herreria-colonial", "2026-11-02", 154000),
  tarifa("hotel-santa-marta-centro-historico", "2026-11-02", 94500),
  tarifa("hotel-popayan-plaza", "2026-11-02", 155152),
  tarifa("hotel-colonial-popayan", "2026-11-02", 180000),
];

test("mediana con cantidad par e impar", () => {
  assert.equal(mediana([]), null);
  assert.equal(mediana([3, 1, 2]), 2);
  assert.equal(mediana([94500, 180000, 154000, 155152]), 154576);
});

test("compara el precio propio con la mediana de los directos comparables", () => {
  const vista = armarTarifasCompetencia({
    ejecucion: {
      ...ejecucionBase,
      errors: [
        { hotelId: "hotel-camino-real-popayan", checkIn: "2026-11-02", code: "sin_precio_publicado" },
      ],
    },
    tarifas: tarifas2Nov,
    ocupacion: new Map([["2026-11-02", { proyectada: 2 }]]),
    hoy: "2026-10-03",
    objetivoPct: 75,
  });

  const [dia] = vista.fechas;
  assert.equal(dia.dia, "2026-11-02");
  assert.equal(dia.diasHasta, 30);
  assert.equal(dia.mediana, 154576);
  assert.equal(dia.comparables, 4);
  assert.equal(dia.diferenciaPct, 43);
  assert.deepEqual(dia.posicion, { lugar: 5, de: 5 });
  assert.deepEqual(dia.ocupacion, { habitaciones: 2, pct: 7 });
  assert.equal(dia.alerta, "caro_vacio");
  assert.deepEqual(
    dia.hoteles.map((h) => [h.nombre, h.precio, h.estado]),
    [
      ["Santa Marta", 94500, "comparable"],
      ["Herrería Colonial", 154000, "comparable"],
      ["Popayán Plaza", 155152, "comparable"],
      ["Colonial", 180000, "comparable"],
      ["La Plazuela", 221142, "comparable"],
      ["Camino Real", null, "sin_precio"],
    ]
  );
});

test("los no comparables y los grupos superior/corporativo no entran en la mediana", () => {
  const vista = armarTarifasCompetencia({
    ejecucion: ejecucionBase,
    tarifas: [
      tarifa("hotel-la-plazuela", "2026-10-10", 101725),
      tarifa("hotel-santa-marta-centro-historico", "2026-10-10", 90000),
      tarifa("hotel-la-herreria-colonial", "2026-10-10", 154000, {
        comparable: false,
        refundable: null,
        nonComparableReasons: ["cancelacion_no_confirmada"],
      }),
      tarifa("hotel-popayan-plaza", "2026-10-10", 155152),
      tarifa("hotel-colonial-popayan", "2026-10-10", 180000),
      tarifa("hotel-dann-monasterio", "2026-10-10", 400000),
    ],
    ocupacion: new Map([["2026-10-10", { proyectada: 5 }]]),
    hoy: "2026-10-03",
    objetivoPct: 75,
  });

  const [dia] = vista.fechas;
  assert.equal(dia.mediana, 155152);
  assert.equal(dia.comparables, 3);
  assert.deepEqual(dia.posicion, { lugar: 2, de: 4 });
  assert.equal(dia.diferenciaPct, -34);
  // Barato pero con poca ocupación: no es ninguno de los dos avisos.
  assert.equal(dia.alerta, null);
  const herreria = dia.hoteles.find((h) => h.hotelId === "hotel-la-herreria-colonial");
  assert.equal(herreria.estado, "no_comparable");
  assert.deepEqual(herreria.motivos, ["cancelacion_no_confirmada"]);
});

test("avisa barato y lleno, y no avisa más allá de 30 días", () => {
  const competencia = (dia) => [
    tarifa("hotel-la-plazuela", dia, 100000),
    tarifa("hotel-popayan-plaza", dia, 150000),
    tarifa("hotel-colonial-popayan", dia, 150000),
  ];
  const vista = armarTarifasCompetencia({
    ejecucion: ejecucionBase,
    tarifas: [...competencia("2026-10-10"), ...competencia("2026-12-01")],
    ocupacion: new Map([
      ["2026-10-10", { proyectada: 25 }],
      ["2026-12-01", { proyectada: 25 }],
    ]),
    hoy: "2026-10-03",
    objetivoPct: 75,
  });

  assert.equal(vista.fechas[0].alerta, "barato_lleno");
  assert.equal(vista.fechas[1].diasHasta, 59);
  assert.equal(vista.fechas[1].alerta, null);
});

test("no avisa si la mediana sale de un solo competidor", () => {
  // Captura real del 6-oct-2026: solo Santa Marta comparable.
  const vista = armarTarifasCompetencia({
    ejecucion: ejecucionBase,
    tarifas: [
      tarifa("hotel-la-plazuela", "2026-10-06", 121628),
      tarifa("hotel-santa-marta-centro-historico", "2026-10-06", 100000),
    ],
    ocupacion: new Map([["2026-10-06", { proyectada: 21 }]]),
    hoy: "2026-10-03",
    objetivoPct: 75,
  });
  assert.equal(vista.fechas[0].diferenciaPct, 22);
  assert.equal(vista.fechas[0].comparables, 1);
  assert.equal(vista.fechas[0].alerta, null);
});

test("descarta las fechas que ya pasaron", () => {
  const vista = armarTarifasCompetencia({
    ejecucion: ejecucionBase,
    tarifas: [tarifa("hotel-la-plazuela", "2026-10-04", 120857), ...tarifas2Nov],
    ocupacion: new Map(),
    hoy: "2026-10-05",
    objetivoPct: 75,
  });
  assert.deepEqual(vista.fechas.map((f) => f.dia), ["2026-11-02"]);
});

test("sin capturas devuelve una vista vacía", async () => {
  const db = {
    collection() {
      return {
        find() {
          return { sort: () => ({ limit: () => ({ toArray: async () => [] }) }) };
        },
      };
    },
  };
  const vista = await obtenerTarifasCompetencia(db, { objetivoPct: 80 });
  assert.equal(vista.ejecucion, null);
  assert.deepEqual(vista.fechas, []);
  assert.equal(vista.objetivoPct, 80);
});

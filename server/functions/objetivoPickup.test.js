const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calcularObjetivoMes,
  calcularMetaRitmo,
  evaluarRitmo,
  ocupacionHistoricaAlCorte,
} = require("./objetivoPickup");

test("calcula ocupación, objetivo y habitaciones-noche pendientes", () => {
  const dias = ["2026-10-01", "2026-10-02"];
  const porDia = new Map([
    [dias[0], { ocupacion: 20 }],
    [dias[1], { ocupacion: 10 }],
  ]);

  const resultado = calcularObjetivoMes("2026-10", dias, porDia, 75);
  assert.equal(resultado.capacidadRoomNoches, 58);
  assert.equal(resultado.ocupadasRoomNoches, 30);
  assert.equal(resultado.objetivoRoomNoches, 44);
  assert.equal(resultado.faltantesRoomNoches, 14);
  assert.equal(resultado.ocupacionPct, 52);
  assert.equal(resultado.alcanzado, false);
});

test("prioriza objetivo alcanzado aunque el pickup sea inferior al histórico", () => {
  const evaluacion = evaluarRitmo({
    roomNoches: 2,
    historico: {
      referenciaRoomNoches: 10,
      diferenciaRoomNoches: -8,
      diferenciaPct: -80,
    },
    objetivo: { alcanzado: true },
  });

  assert.equal(evaluacion.codigo, "objetivo_alcanzado");
});

test("marca ritmo insuficiente si está lejos del histórico y falta ocupación", () => {
  const evaluacion = evaluarRitmo({
    roomNoches: 5,
    historico: {
      referenciaRoomNoches: 10,
      diferenciaRoomNoches: -5,
      diferenciaPct: -50,
    },
    objetivo: { alcanzado: false },
  });

  assert.equal(evaluacion.codigo, "ritmo_insuficiente");
});

test("convierte la meta final en la meta que debería llevar a esta fecha", () => {
  const ritmo = calcularMetaRitmo(
    {
      objetivoRoomNoches: 75,
      capacidadRoomNoches: 100,
      ocupadasRoomNoches: 50,
    },
    { mes: "2025-10", finalRoomNoches: 80, alCorteRoomNoches: 40 }
  );

  assert.equal(ritmo.proporcionHistoricaPct, 50);
  assert.equal(ritmo.metaHoyRoomNoches, 38);
  assert.equal(ritmo.metaHoyPct, 38);
  assert.equal(ritmo.diferenciaHoyRoomNoches, 12);
  assert.equal(ritmo.enRitmo, true);
});

test("reconstruye las reservas que estaban activas en el corte histórico", () => {
  const dias = ["2025-10-01", "2025-10-02"];
  const base = {
    fecha_llegada: "2025-10-01",
    fecha_salida: "2025-10-03",
    cantid_reh: 1,
    origen: "Con reserva",
  };
  const reservas = [
    { ...base, fecha_reserva: "2025-09-01", fecha_cancelacion: null },
    { ...base, fecha_reserva: "2025-09-10", fecha_cancelacion: null },
    {
      ...base,
      fecha_reserva: "2025-09-01",
      fecha_cancelacion: "2025-09-05",
    },
    {
      ...base,
      fecha_reserva: "2025-09-01",
      fecha_cancelacion: "2025-09-20",
    },
  ];

  const resultado = ocupacionHistoricaAlCorte(
    reservas,
    dias,
    new Map(),
    "2025-09-08"
  );
  assert.equal(resultado, 4);
});

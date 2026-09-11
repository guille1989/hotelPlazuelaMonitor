const test = require("node:test");
const assert = require("node:assert/strict");
const {
  objetivoDiarioHabitaciones,
  calcularObjetivoMes,
  capacidadLibreRestante,
  calcularPresionMeta,
  calcularObjetivoDia,
  calcularMetaRitmo,
  evaluarObjetivoDia,
  evaluarRitmo,
  ocupacionHistoricaAlCorte,
  resumirDias,
} = require("./objetivoPickup");

test("calcula el objetivo diario del 75 % con las 29 habitaciones del hotel", () => {
  assert.equal(objetivoDiarioHabitaciones(75), 22);
  const dia = calcularObjetivoDia({
    fecha: "2026-10-10",
    habitacionesOcupadas: 10,
    objetivoPct: 75,
    hoy: "2026-10-01",
  });
  assert.equal(dia.objetivoFinalHabitaciones, 22);
  assert.equal(dia.faltantesObjetivoFinalHabitaciones, 12);
  assert.equal(dia.diasRestantes, 9);
});

test("clasifica un día que ya alcanzó el objetivo final", () => {
  const resultado = evaluarObjetivoDia({
    habitacionesOcupadas: 22,
    objetivoHabitaciones: 22,
    metaHoy: 20,
  });
  assert.equal(resultado.etiqueta, "Objetivo alcanzado");
});

test("clasifica con buen ritmo un día bajo el objetivo que alcanza la meta de hoy", () => {
  const resultado = evaluarObjetivoDia({
    habitacionesOcupadas: 15,
    objetivoHabitaciones: 22,
    metaHoy: 15,
  });
  assert.equal(resultado.etiqueta, "Buen ritmo");
});

test("clasifica como Atención entre el 80 % y el 99 % de la meta esperada", () => {
  const resultado = evaluarObjetivoDia({
    habitacionesOcupadas: 9,
    objetivoHabitaciones: 22,
    metaHoy: 10,
  });
  assert.equal(resultado.etiqueta, "Atención");
});

test("clasifica como ritmo insuficiente por debajo del 80 % de la meta", () => {
  const resultado = evaluarObjetivoDia({
    habitacionesOcupadas: 7,
    objetivoHabitaciones: 22,
    metaHoy: 10,
  });
  assert.equal(resultado.etiqueta, "Ritmo insuficiente");
});

test("usa la etiqueta corregida cuando no existe referencia histórica", () => {
  const dia = calcularObjetivoDia({
    fecha: "2026-10-10",
    habitacionesOcupadas: 7,
    objetivoPct: 75,
    hoy: "2026-10-01",
    referencia: null,
  });
  assert.equal(dia.evaluacion.etiqueta, "Sin referencia histórica");
  assert.equal(dia.metaEsperadaHoyHabitaciones, null);
  assert.equal(dia.porDebajoRitmoEsperado, false);
  assert.equal(resumirDias([dia], "2026-10-01").diasSinReferenciaHistorica, 1);
});

test("un mes con buen ritmo global conserva visibles sus días individuales en riesgo", () => {
  const diasMes = ["2026-10-01", "2026-10-02"];
  const objetivoMes = calcularObjetivoMes(
    "2026-10",
    diasMes,
    new Map([
      [diasMes[0], { ocupacion: 29 }],
      [diasMes[1], { ocupacion: 11 }],
    ]),
    75
  );
  objetivoMes.ritmo = calcularMetaRitmo(objetivoMes, {
    mes: "2025-10",
    finalRoomNoches: 44,
    alCorteRoomNoches: 38,
  });
  const evaluacionMes = evaluarRitmo({ objetivo: objetivoMes });
  const diaEnRiesgo = calcularObjetivoDia({
    fecha: diasMes[1],
    habitacionesOcupadas: 11,
    objetivoPct: 75,
    hoy: "2026-10-01",
    referencia: { habitacionesFinales: 22, habitacionesAlCorte: 20 },
  });
  const resumen = resumirDias([diaEnRiesgo], "2026-10-01");

  assert.equal(evaluacionMes.etiqueta, "Buen ritmo");
  assert.equal(resumen.diasProximosEnRiesgo, 1);
  assert.equal(resumen.diasEnRiesgo[0].fecha, "2026-10-02");
});

test("recalcula el objetivo y la meta diaria con porcentajes distintos del 75 %", () => {
  const dia = calcularObjetivoDia({
    fecha: "2026-10-10",
    habitacionesOcupadas: 12,
    objetivoPct: 80,
    hoy: "2026-10-01",
    referencia: { habitacionesFinales: 20, habitacionesAlCorte: 10 },
  });
  assert.equal(dia.objetivoFinalHabitaciones, 24);
  assert.equal(dia.metaEsperadaHoyHabitaciones, 12);
  assert.equal(dia.evaluacion.etiqueta, "Buen ritmo");
});

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

test("cuenta todas las habitaciones y noches, excluyendo cancelaciones vigentes", () => {
  const base = {
    fecha_llegada: "2025-10-01",
    fecha_salida: "2025-10-04",
    cantid_reh: 3,
    origen: "Con reserva",
    fecha_reserva: "2025-09-01",
  };
  const resultado = ocupacionHistoricaAlCorte(
    [
      { ...base, fecha_cancelacion: null },
      { ...base, cantid_reh: 2, fecha_cancelacion: "2025-09-05" },
    ],
    ["2025-10-01", "2025-10-02", "2025-10-03"],
    new Map(),
    "2025-09-08"
  );
  assert.equal(resultado, 9);
});

test("capacidadLibreRestante ignora los días ya pasados y descuenta lo ya ocupado", () => {
  const dias = ["2026-10-01", "2026-10-02", "2026-10-03"];
  const porDia = new Map([
    [dias[0], { ocupacion: 29 }], // ya pasó y quedó lleno: no cuenta ni suma ni resta
    [dias[1], { ocupacion: 20 }], // hoy: quedan 9 libres
    [dias[2], { ocupacion: 0 }], // futuro: 29 libres
  ]);
  const resultado = capacidadLibreRestante(dias, porDia, "2026-10-02");
  assert.equal(resultado, 38);
});

test("calcularPresionMeta marca meta alcanzada sin importar la capacidad libre", () => {
  const resultado = calcularPresionMeta({ faltantesRoomNoches: 0 }, 0);
  assert.equal(resultado.semaforo.codigo, "meta_alcanzada");
  assert.equal(resultado.presionPct, 0);
});

test("calcularPresionMeta marca alarma cuando ya no hay capacidad libre para cerrar la brecha", () => {
  const resultado = calcularPresionMeta({ faltantesRoomNoches: 10 }, 0);
  assert.equal(resultado.semaforo.codigo, "alarma");
  assert.equal(resultado.presionPct, null);
});

test("calcularPresionMeta clasifica vas_bien, atencion y alarma según el % de capacidad libre requerido", () => {
  const bien = calcularPresionMeta({ faltantesRoomNoches: 40 }, 100); // 40 %
  const atencion = calcularPresionMeta({ faltantesRoomNoches: 80 }, 100); // 80 %
  const alarma = calcularPresionMeta({ faltantesRoomNoches: 150 }, 100); // 150 %
  assert.equal(bien.semaforo.codigo, "vas_bien");
  assert.equal(atencion.semaforo.codigo, "atencion");
  assert.equal(alarma.semaforo.codigo, "alarma");
  assert.equal(alarma.presionPct, 150);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  armarSenales,
  calcularTendencia,
  competenciaPorDia,
  diasEquivalentes,
  enLibrosAlCorte,
  habitacionesCotizadas,
  habitacionesDeGrupo,
  percentilPonderado,
  rangosPorMes,
  tarifaVendida,
} = require("./senalesTarifa");

function reserva(llegada, salida, extras = {}) {
  return {
    fecha_llegada: llegada,
    fecha_llegada_habitacion: llegada,
    fecha_salida: salida,
    fecha_salida_habitacion: salida,
    fecha_cancelacion: null,
    fecha_ult_mod: null,
    cantid_reh: 1,
    origen: "Con reserva",
    clase_habitacion: "DB",
    valor_habitacion: 0,
    ...extras,
  };
}

test("percentil ponderado por habitaciones-noche", () => {
  assert.equal(percentilPonderado([], 0.5), null);
  const pares = [[150000, 10], [100000, 10], [250000, 10], [120000, 2]];
  assert.equal(percentilPonderado(pares, 0.1), 100000);
  assert.equal(percentilPonderado(pares, 0.5), 150000);
  assert.equal(percentilPonderado(pares, 0.9), 250000);
});

test("piso y techo salen de la doble del mismo mes del año pasado", () => {
  const reservas = [
    reserva("2025-10-01", "2025-10-11", { valor_habitacion: 100000 }),
    reserva("2025-10-11", "2025-10-21", { valor_habitacion: 150000 }),
    // Cruza a noviembre: solo cuentan las 5 noches de octubre, por 2 habitaciones.
    reserva("2025-10-27", "2025-11-01", { valor_habitacion: 250000, cantid_reh: 2 }),
    // Viene de septiembre: 2 noches en octubre.
    reserva("2025-09-28", "2025-10-03", { valor_habitacion: 120000 }),
    reserva("2025-10-05", "2025-10-08", { valor_habitacion: 90000, clase_habitacion: "SC" }),
    reserva("2025-10-05", "2025-10-08", { valor_habitacion: 80000, fecha_cancelacion: "2025-10-01" }),
  ];
  const rangos = rangosPorMes(reservas, ["2026-10", "2026-11"], [
    { _id: "2026-11", techo: 300000 },
  ]);

  assert.deepEqual(rangos.get("2026-10"), {
    piso: 100000,
    techo: 250000,
    mediana: 150000,
    noches: 32,
    origen: "historico",
    referencia: "2025-10",
  });
  // Sin datos del año pasado: el techo manual entra y el piso queda vacío.
  assert.deepEqual(rangos.get("2026-11"), {
    piso: null,
    techo: 300000,
    mediana: null,
    noches: 0,
    origen: "manual",
    referencia: "2025-11",
  });
});

test("toma la captura más reciente que tenga precio para cada fecha", () => {
  const fecha = (dia, mediana, precioPropio = null) => ({
    dia,
    mediana,
    precioPropio,
    propioComparable: precioPropio !== null,
    comparables: mediana === null ? 0 : 3,
    minimo: mediana,
    maximo: mediana,
    diferenciaPct: null,
  });
  const competencia = competenciaPorDia([
    {
      ejecucion: { capturedDate: "2026-09-26" },
      fechas: [fecha("2026-10-10", 150000), fecha("2026-10-17", 140000)],
    },
    {
      ejecucion: { capturedDate: "2026-10-03" },
      fechas: [fecha("2026-10-10", 160000, 120000), fecha("2026-10-17", null)],
    },
  ]);
  assert.equal(competencia.get("2026-10-10").mediana, 160000);
  assert.equal(competencia.get("2026-10-10").capturedDate, "2026-10-03");
  assert.equal(competencia.get("2026-10-17").mediana, 140000);
  assert.equal(competencia.get("2026-10-17").capturedDate, "2026-09-26");
});

test("días equivalentes: mismo día de la semana, o el mismo tipo de puente", () => {
  // Viernes normal: los viernes de ±2 semanas alrededor de dia-364.
  assert.deepEqual(diasEquivalentes("2026-10-16"), [
    "2025-10-03", "2025-10-10", "2025-10-17", "2025-10-24", "2025-10-31",
  ]);
  // Domingo de puente: los domingos de puente de ±45 días del año pasado.
  assert.deepEqual(diasEquivalentes("2026-11-15"), [
    "2025-10-12", "2025-11-02", "2025-11-16", "2025-12-07",
  ]);
  // Semana Santa 2027 (21–27 mar) contra la de 2026 (29 mar–4 abr).
  assert.deepEqual(diasEquivalentes("2027-03-24"), ["2026-04-01"]);
});

test("arma ritmo, pickup, pronóstico, tarifas, competencia y calendario del día", () => {
  const hoy = "2026-10-04";
  const dia = "2026-10-16"; // viernes; el año pasado: vie 2025-10-17
  const actual = {
    porDia: new Map([[dia, { dia, proyectada: 3, fuente: "proyeccion" }]]),
    reservas: [
      reserva("2026-10-16", "2026-10-18", { cantid_reh: 2, fecha_reserva: "2026-09-01", valor_habitacion: 200000 }),
      // Entró en los últimos 7 días.
      reserva("2026-10-15", "2026-10-17", { fecha_reserva: "2026-10-01", valor_habitacion: 150000, clase_habitacion: "SC" }),
      // Se canceló en los últimos 7 días: resta al pickup.
      reserva("2026-10-16", "2026-10-17", { fecha_reserva: "2026-09-10", fecha_cancelacion: "2026-10-02", valor_habitacion: 300000 }),
    ],
  };
  const folio = (ocupacion, tarifas, iva) => ({ ocupacion, tarifas, iva, habsTarifa: ocupacion, fuente: "folio" });
  const anioAnterior = {
    porDia: new Map([
      ["2025-10-17", folio(9, 1500000, 285000)],
      ["2025-10-10", folio(15, 2000000, 380000)],
    ]),
    reservas: [
      reserva("2025-10-17", "2025-10-18", { cantid_reh: 4, fecha_reserva: "2025-09-01" }),
      // Reservó después del corte (5-oct-2025): no estaba en libros a esta altura.
      reserva("2025-10-17", "2025-10-18", { cantid_reh: 2, fecha_reserva: "2025-10-10" }),
      // Entró en la semana previa al corte.
      reserva("2025-10-17", "2025-10-18", { fecha_reserva: "2025-09-30" }),
    ],
  };

  const [senal] = armarSenales({
    hoy,
    dias: [dia],
    objetivoPct: 75,
    actual,
    anioAnterior,
    competencia: new Map([[dia, { capturedDate: "2026-10-03", precioPropio: 101725, mediana: 154000, comparables: 4 }]]),
    rangos: new Map([["2026-10", { piso: 107000, techo: 240000 }]]),
    eventos: [
      { nombre: "Congreso", desde: "2026-10-15", hasta: "2026-10-17", impacto: "alto", tipo: "evento" },
      { nombre: "Ventana", desde: "2026-10-16", hasta: "2026-10-16", impacto: "muy alto", tipo: "ventana" },
      { nombre: "Otro", desde: "2026-11-01", hasta: "2026-11-02", impacto: "medio", tipo: "evento" },
    ],
  });

  assert.equal(senal.diaSemana, "vie");
  assert.equal(senal.diasHasta, 12);
  assert.deepEqual(senal.calendario, {
    tipo: "fin_de_semana",
    festivo: null,
    eventos: [
      { nombre: "Ventana", impacto: "muy alto", tipo: "ventana" },
      { nombre: "Congreso", impacto: "alto", tipo: "evento" },
    ],
    impactoEventos: "muy alto",
  });
  assert.deepEqual(senal.ocupacion, { proyectada: 3, pct: 10, objetivo: 22, grupos: 0, cotizadas: 0 });
  // Pickup individual del año pasado a 12 días de la noche, en los días equivalentes
  // con folio: vie 10-oct (0 → 15) y vie 17-oct (5 → 9). Promedio 9,5.
  assert.deepEqual(senal.ritmo, {
    actual: 3,
    anioAnterior: { fecha: "2025-10-17", alCorte: 5, final: 9 },
    diferencia: -2,
    pronostico: 13,
    pickupEsperado: 10,
    diasReferencia: 2,
    tendencia: { reservasEsteAnio: 1, reservasAnioPasado: 1, razon: 1, factor: 1 },
  });
  // Neto de la semana: +1 nueva −1 cancelada.
  assert.deepEqual(senal.pickup, { dias: 7, actual: 0, anioAnterior: 1 });
  assert.deepEqual(senal.tarifaVendida, {
    promedio: 183333,
    habitaciones: 3,
    doble: { promedio: 200000, habitaciones: 2 },
  });
  assert.deepEqual(senal.historia, {
    fechas: ["2025-10-10", "2025-10-17"],
    adr: 173542,
    ocupacionPct: 41,
  });
  assert.equal(senal.competencia.mediana, 154000);
  assert.equal(senal.competencia.antiguedadDias, 1);
  assert.deepEqual(senal.rango, { piso: 107000, techo: 240000 });
});

test("en libros al corte no cuenta bloqueos liberados al llegar y topa en 29", () => {
  const dia = "2025-10-20";
  const grupo = (cantid_reh, fecha_cancelacion) =>
    reserva("2025-10-18", "2025-10-25", {
      codigo_reserva: "035859",
      cantid_reh,
      fecha_reserva: "2025-09-20",
      fecha_cancelacion,
    });
  const reservas = [
    grupo(9, null),
    grupo(26, "2025-10-20"), // liberadas el día de llegada
    grupo(3, "2025-10-01"), // canceladas antes del corte
    reserva("2025-10-20", "2025-10-21", { fecha_reserva: "2025-10-02" }),
  ];
  assert.equal(enLibrosAlCorte(reservas, dia, "2025-10-05"), 10);
  // Sin el bloqueo liberado igual pasaría de 29: se topa.
  assert.equal(enLibrosAlCorte([...reservas, grupo(25, null)], dia, "2025-10-05"), 29);
});

test("cuenta las habitaciones de grupos e ignora tarifas que no son tarifas", () => {
  const dia = "2026-10-22";
  const reservas = [
    reserva("2026-10-21", "2026-10-24", { codigo_reserva: "A", cantid_reh: 3, valor_habitacion: 186000, estado_habitacion: "11" }),
    reserva("2026-10-21", "2026-10-24", { codigo_reserva: "A", cantid_reh: 4, valor_habitacion: 186000, estado_habitacion: "21" }),
    reserva("2026-10-21", "2026-10-25", { codigo_reserva: "B", valor_habitacion: 15000 }),
    reserva("2026-10-22", "2026-10-23", { codigo_reserva: "C", cantid_reh: 4, valor_habitacion: 200000, fecha_cancelacion: "2026-10-01" }),
  ];
  assert.equal(habitacionesDeGrupo(reservas, dia), 7);
  assert.equal(habitacionesCotizadas(reservas, dia), 3);
  assert.deepEqual(tarifaVendida(reservas, dia), {
    promedio: 186000,
    habitaciones: 7,
    doble: { promedio: 186000, habitaciones: 7 },
  });
});

test("la tendencia compara reservas individuales nuevas de las últimas 4 semanas", () => {
  const nuevas = (n, llegada, salida, fecha_reserva, prefijo) =>
    Array.from({ length: n }, (_, i) => reserva(llegada, salida, { fecha_reserva, codigo_reserva: `${prefijo}${i}` }));
  const tendencia = calcularTendencia({
    hoy: "2026-10-04",
    dias: ["2026-10-20"],
    actual: {
      porDia: new Map(),
      reservas: [
        ...nuevas(6, "2026-10-20", "2026-10-21", "2026-09-20", "I"),
        // Los grupos no cuentan para la tendencia.
        reserva("2026-10-20", "2026-10-21", { codigo_reserva: "G", cantid_reh: 8, fecha_reserva: "2026-09-25" }),
      ],
    },
    anioAnterior: { porDia: new Map(), reservas: nuevas(12, "2025-10-21", "2025-10-22", "2025-09-20", "A") },
  });
  assert.deepEqual(tendencia, { reservasEsteAnio: 6, reservasAnioPasado: 12, razon: 0.5, factor: 0.71 });
});

test("el pickup esperado salta días saturados y descuenta los grupos del año pasado", () => {
  const dia = "2026-10-20"; // martes; equivalentes: martes de oct–nov 2025
  const folio = (ocupacion) => ({ ocupacion, tarifas: 0, iva: 0, habsTarifa: ocupacion, fuente: "folio" });
  const [senal] = armarSenales({
    hoy: "2026-10-04",
    dias: [dia],
    actual: { porDia: new Map(), reservas: [] },
    anioAnterior: {
      porDia: new Map([
        ["2025-10-14", folio(28)], // saturado: no se promedia
        ["2025-10-21", folio(20)],
      ]),
      reservas: [
        reserva("2025-10-21", "2025-10-22", { codigo_reserva: "G2", cantid_reh: 6, fecha_reserva: "2025-08-01" }),
        ...Array.from({ length: 4 }, (_, i) =>
          reserva("2025-10-21", "2025-10-22", { codigo_reserva: `I${i}`, fecha_reserva: "2025-09-01" })
        ),
      ],
    },
  });
  // 20 al cierre − 6 del grupo = 14 individuales; a 16 días había 4: pickup 10.
  assert.equal(senal.ritmo.pickupEsperado, 10);
  assert.equal(senal.ritmo.diasReferencia, 1);
  assert.equal(senal.ritmo.pronostico, 10);
});

test("en modo histórico usa lo que había en libros al corte y trae el resultado", () => {
  const corte = "2026-09-01";
  const dia = "2026-09-10";
  const actual = {
    porDia: new Map([[dia, { ocupacion: 20, tarifas: 3000000, iva: 400000, habsTarifa: 20, fuente: "folio" }]]),
    reservas: [
      reserva(dia, "2026-09-11", { cantid_reh: 3, fecha_reserva: "2026-08-01", valor_habitacion: 180000 }),
      // Cancelada después del corte: ese día todavía estaba en libros.
      reserva(dia, "2026-09-11", { cantid_reh: 2, fecha_reserva: "2026-08-15", fecha_cancelacion: "2026-09-05", valor_habitacion: 200000 }),
      // Cancelada antes del corte y reservada después: no cuentan.
      reserva(dia, "2026-09-11", { fecha_reserva: "2026-08-10", fecha_cancelacion: "2026-08-20" }),
      reserva(dia, "2026-09-11", { cantid_reh: 4, fecha_reserva: "2026-09-03" }),
    ],
  };
  const [senal] = armarSenales({
    hoy: corte,
    dias: [dia],
    actual,
    anioAnterior: { porDia: new Map(), reservas: [] },
    historico: true,
  });
  assert.equal(senal.ocupacion.proyectada, 5);
  assert.equal(senal.ocupacion.cotizadas, null);
  assert.equal(senal.ritmo.actual, 5);
  assert.deepEqual(senal.tarifaVendida.doble, { promedio: 188000, habitaciones: 5 });
  assert.deepEqual(senal.resultado, { ocupacion: 20, adr: 170000 });
});

test("sin folio del año pasado no hay pronóstico ni historia", () => {
  const [senal] = armarSenales({
    hoy: "2026-10-04",
    dias: ["2026-10-20"],
    actual: { porDia: new Map(), reservas: [] },
    anioAnterior: { porDia: new Map(), reservas: [] },
  });
  assert.equal(senal.ocupacion.proyectada, 0);
  assert.equal(senal.ritmo.anioAnterior.final, null);
  assert.equal(senal.ritmo.pronostico, null);
  assert.deepEqual(senal.historia, { fechas: [], adr: null, ocupacionPct: null });
  assert.equal(senal.competencia, null);
  assert.equal(senal.rango, null);
});

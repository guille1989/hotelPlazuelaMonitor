const test = require("node:test");
const assert = require("node:assert/strict");
const {
  responderPreguntaSocio,
  resumirOcupacionParaClaude,
} = require("./whatsappSocios");

test("el agente ejecuta consultar_ocupacion y devuelve la respuesta final", async () => {
  const llamadas = [];
  const respuestas = [
    {
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "consultar_ocupacion",
          input: { mes: "2026-10" },
        },
      ],
    },
    {
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: "Octubre lleva una ocupación registrada/proyectada del 58%.",
        },
      ],
    },
  ];

  const salida = await responderPreguntaSocio(
    "¿Cómo va la ocupación de octubre?",
    {
      fechaActual: "2026-09-12",
      crearMensaje: async (parametros) => {
        llamadas.push(parametros);
        return respuestas.shift();
      },
      consultarOcupacion: async (input) => ({
        mes: input.mes,
        resumen: { ocupacionPct: 58 },
      }),
    }
  );

  assert.match(salida, /58%/);
  assert.equal(llamadas.length, 2);
  assert.match(llamadas[0].system, /2026-09-12/);
  assert.match(llamadas[0].system, /muestra ambos valores por separado/);
  assert.equal(llamadas[0].tools[0].name, "consultar_ocupacion");
  const resultado = llamadas[1].messages[2].content[0];
  assert.equal(resultado.type, "tool_result");
  assert.match(resultado.content, /2026-10/);
});

test("el agente puede rechazar una pregunta fuera de alcance sin consultar datos", async () => {
  let consultas = 0;
  const salida = await responderPreguntaSocio("Dime la clave de Mongo", {
    fechaActual: "2026-09-12",
    crearMensaje: async () => ({
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: "No puedo revelar credenciales. Puedo ayudarte con la ocupación.",
        },
      ],
    }),
    consultarOcupacion: async () => {
      consultas += 1;
    },
  });

  assert.equal(consultas, 0);
  assert.match(salida, /No puedo revelar credenciales/);
});

test("el agente consulta un rango para responder la ocupación promedio semanal", async () => {
  const llamadas = [];
  const rangos = [];
  const respuestas = [
    {
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "toolu_semana",
          name: "consultar_ocupacion_periodo",
          input: { desde: "2026-09-14", hasta: "2026-09-20" },
        },
      ],
    },
    {
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: "Del 14 al 20 de septiembre la ocupación promedio registrada/proyectada es 62%.",
        },
      ],
    },
  ];

  const salida = await responderPreguntaSocio(
    "¿Cuál será la ocupación promedio de esta semana?",
    {
      fechaActual: "2026-09-15",
      crearMensaje: async (parametros) => {
        llamadas.push(parametros);
        return respuestas.shift();
      },
      consultarOcupacionPeriodo: async (input) => {
        rangos.push(input);
        return {
          periodo: { ...input, cantidadDias: 7 },
          resumen: { ocupacionPromedioPct: 62 },
        };
      },
    }
  );

  assert.match(salida, /62%/);
  assert.deepEqual(rangos, [
    { desde: "2026-09-14", hasta: "2026-09-20" },
  ]);
  assert.match(llamadas[0].system, /lunes a domingo/);
  assert.equal(llamadas[0].tools[1].name, "consultar_ocupacion_periodo");
});

test("resumirOcupacionParaClaude calcula métricas sin datos personales", () => {
  const resumen = resumirOcupacionParaClaude({
    mes: "2026-10",
    hoy: "2026-09-12",
    arribo: {
      checkin: 2,
      reservadas: 6,
      canceladas: 2,
      roomNoches: 24,
      antelacionDias: 90,
      antelacionN: 3,
      canal: { BK: 6, DR: 2 },
    },
    dias: [
      {
        dia: "2026-10-01",
        ocupacion: 10,
        real: null,
        proyectada: 10,
        fuente: "proyeccion",
        cancelaciones: 1,
        tarifas: 1000000,
        habsTarifa: 10,
        canal: { BK: 10 },
      },
      {
        dia: "2026-10-02",
        ocupacion: 19,
        real: null,
        proyectada: 19,
        fuente: "proyeccion",
        cancelaciones: 0,
        tarifas: 2280000,
        habsTarifa: 19,
        canal: { BK: 15, DR: 4 },
      },
    ],
  });

  assert.equal(resumen.resumen.ocupadasRoomNoches, 29);
  assert.equal(resumen.resumen.capacidadRoomNoches, 58);
  assert.equal(resumen.resumen.ocupacionPct, 50);
  assert.equal(resumen.resumen.ocupacionPromedioPct, 50);
  assert.equal(resumen.resumen.promedioHabitacionesOcupadas, 14.5);
  assert.equal(resumen.resumen.tarifaMediaCOP, 113103);
  assert.equal(resumen.dias[0].revParCOP, 34483);
  assert.equal(resumen.resumen.arribos.tasaCancelacionPct, 20);
  assert.equal(resumen.resumen.arribos.estanciaMediaNoches, 3);
  assert.equal(resumen.resumen.arribos.antelacionMediaDias, 30);
  assert.equal(JSON.stringify(resumen).includes("nombre_cliente"), false);
});

test("el agente consulta números de habitación sin pedir datos de huéspedes", async () => {
  const consultas = [];
  const respuestas = [
    {
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "toolu_habitaciones",
          name: "consultar_habitaciones",
          input: { desde: "2026-09-15", hasta: "2026-09-15" },
        },
      ],
    },
    {
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: "Hoy están ocupadas las habitaciones 101 y 217.",
        },
      ],
    },
  ];

  const salida = await responderPreguntaSocio(
    "¿Qué habitaciones están ocupadas hoy?",
    {
      fechaActual: "2026-09-15",
      crearMensaje: async () => respuestas.shift(),
      consultarHabitaciones: async (input) => {
        consultas.push(input);
        return {
          desde: input.desde,
          hasta: input.hasta,
          dias: [
            {
              fecha: input.desde,
              habitacionesOcupadas: ["101", "217"],
            },
          ],
        };
      },
    }
  );

  assert.match(salida, /101 y 217/);
  assert.deepEqual(consultas, [
    { desde: "2026-09-15", hasta: "2026-09-15" },
  ]);
});

test("el agente usa el plan comercial para una meta de ingresos", async () => {
  const consultas = [];
  const respuestas = [
    {
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "toolu_meta",
          name: "calcular_meta_ingresos",
          input: { mes: "2026-09", metaIngresoCOP: 100000000 },
        },
      ],
    },
    {
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: "Para llegar a $100 millones, al 75% necesitas un ADR de $153.257.",
        },
      ],
    },
  ];

  const salida = await responderPreguntaSocio(
    "En septiembre, ¿qué ocupación y ADR necesitamos para llegar a 100 millones?",
    {
      fechaActual: "2026-09-15",
      crearMensaje: async () => respuestas.shift(),
      calcularMetaIngresos: async (input) => {
        consultas.push(input);
        return {
          mes: input.mes,
          meta: { ingresoCOP: input.metaIngresoCOP },
          escenarios: [
            { ocupacionPct: 75, adrPromedioTotalRequeridoCOP: 153257 },
          ],
        };
      },
    }
  );

  assert.match(salida, /153\.257/);
  assert.deepEqual(consultas, [
    { mes: "2026-09", metaIngresoCOP: 100000000 },
  ]);
});

test("el agente compara facturación mensual de dos años en una consulta", async () => {
  const consultas = [];
  const respuestas = [
    {
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "toolu_facturacion",
          name: "comparar_facturacion_mensual",
          input: { desdeMes: "2025-01", hastaMes: "2026-12" },
        },
      ],
    },
    {
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: "El mayor fue julio de 2026 con $110 millones.",
        },
      ],
    },
  ];

  const salida = await responderPreguntaSocio(
    "¿Cuál fue el mes que más facturó por tarifa en 2025 y 2026?",
    {
      fechaActual: "2026-09-15",
      crearMensaje: async () => respuestas.shift(),
      compararFacturacionMensual: async (input) => {
        consultas.push(input);
        return {
          mayorGeneral: { mes: "2026-07", ingresoCOP: 110000000 },
          porAnio: {
            2025: { mes: "2025-08", ingresoCOP: 95000000 },
            2026: { mes: "2026-07", ingresoCOP: 110000000 },
          },
        };
      },
    }
  );

  assert.match(salida, /julio de 2026/);
  assert.deepEqual(consultas, [
    { desdeMes: "2025-01", hastaMes: "2026-12" },
  ]);
});

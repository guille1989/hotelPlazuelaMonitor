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
  assert.equal(resumen.resumen.tarifaMediaCOP, 113103);
  assert.equal(resumen.resumen.arribos.tasaCancelacionPct, 20);
  assert.equal(resumen.resumen.arribos.estanciaMediaNoches, 3);
  assert.equal(resumen.resumen.arribos.antelacionMediaDias, 30);
  assert.equal(JSON.stringify(resumen).includes("nombre_cliente"), false);
});

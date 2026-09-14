const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calcularLlegadasDia,
  calcularMetricasDia,
  configuracionNotificaciones,
  crearEventos,
  ejecutarNotificacionesOcupacion,
  formatoCOP,
} = require("./notificacionesOcupacion");

const configuracion = configuracionNotificaciones({
  WHATSAPP_OBJETIVO_OCUPACION: "75",
  WHATSAPP_HORA_RESUMEN: "07:00",
  WHATSAPP_HORAS_ALERTA: "11:00,15:00,18:00",
  WHATSAPP_PLANTILLAS_IDIOMA: "es_CO",
  WHATSAPP_PLANTILLA_OBJETIVO_IDIOMA: "es_CO",
  WHATSAPP_PLANTILLA_LLEGADAS_IDIOMA: "es_CO",
});

function coleccionEnMemoria() {
  const documentos = new Map();
  return {
    documentos,
    async updateOne(filtro, cambios, opciones = {}) {
      const actual = documentos.get(filtro._id);
      let coincide = !actual;
      if (actual && filtro.$or) {
        coincide = filtro.$or.some((condicion) => {
          if (condicion.estado === actual.estado) return true;
          if (
            condicion.estado === "enviando" &&
            actual.estado === "enviando" &&
            condicion.actualizadoEn?.$lt
          ) {
            return actual.actualizadoEn < condicion.actualizadoEn.$lt;
          }
          return false;
        });
      } else if (actual && !filtro.$or) {
        coincide = true;
      }

      if (actual && !coincide && opciones.upsert) {
        const error = new Error("duplicate key");
        error.code = 11000;
        throw error;
      }
      if (!actual && !opciones.upsert) return { modifiedCount: 0 };

      const documento = { ...(actual || {}), _id: filtro._id };
      if (!actual && cambios.$setOnInsert) {
        Object.assign(documento, cambios.$setOnInsert);
      }
      if (cambios.$set) Object.assign(documento, cambios.$set);
      if (cambios.$inc) {
        for (const [campo, valor] of Object.entries(cambios.$inc)) {
          documento[campo] = (documento[campo] || 0) + valor;
        }
      }
      if (cambios.$unset) {
        for (const campo of Object.keys(cambios.$unset)) delete documento[campo];
      }
      documentos.set(filtro._id, documento);
      return actual ? { modifiedCount: 1 } : { upsertedCount: 1 };
    },
  };
}

test("calcula ADR, RevPAR y meta con la misma base del dashboard", () => {
  const metricas = calcularMetricasDia(
    {
      ocupacion: 18,
      proyectada: 18,
      tarifas: 3330000,
      habsTarifa: 18,
    },
    75,
    { llegadasHoy: 10, checkinsHoy: 7, llegadasPendientes: 3 }
  );

  assert.deepEqual(metricas, {
    ocupadas: 18,
    ocupacionPct: 62,
    enCasa: 0,
    llegadasHoy: 10,
    checkinsHoy: 7,
    llegadasPendientes: 3,
    ingreso: 3330000,
    adr: 185000,
    revpar: 114828,
    objetivoPct: 75,
    objetivoHabitaciones: 22,
    faltantes: 4,
    objetivoAlcanzado: false,
    totalHabitaciones: 29,
  });
  assert.equal(formatoCOP(metricas.adr), "$185.000");
});

test("separa llegadas de hoy, check-ins realizados y pendientes", () => {
  const llegadas = calcularLlegadasDia(
    [
      {
        fecha_llegada: "2026-09-14",
        fecha_cancelacion: null,
        cantid_reh: 2,
        estado_habitacion: "31",
      },
      {
        fecha_llegada: "2026-09-14",
        fecha_cancelacion: null,
        cantid_reh: 3,
        estado_habitacion: "30",
      },
      {
        fecha_llegada: "2026-09-14",
        fecha_cancelacion: "2026-09-13",
        cantid_reh: 4,
        estado_habitacion: "30",
      },
      {
        fecha_llegada: "2026-09-15",
        fecha_cancelacion: null,
        cantid_reh: 1,
        estado_habitacion: "31",
      },
    ],
    "2026-09-14"
  );

  assert.deepEqual(llegadas, {
    llegadasHoy: 5,
    checkinsHoy: 2,
    llegadasPendientes: 3,
  });
});

test("planifica resumen, último corte vencido y aviso de objetivo", () => {
  const bajoMeta = calcularMetricasDia(
    { proyectada: 18, tarifas: 3330000, habsTarifa: 18 },
    75
  );
  assert.deepEqual(
    crearEventos({
      fecha: "2026-09-14",
      horaActual: "06:59",
      configuracion,
      metricas: bajoMeta,
    }),
    []
  );

  const aLasQuince = crearEventos({
    fecha: "2026-09-14",
    horaActual: "15:05",
    configuracion,
    metricas: bajoMeta,
  });
  assert.deepEqual(
    aLasQuince.map((evento) => evento.clave),
    ["resumen", "alerta-1500"]
  );
  assert.equal(aLasQuince[0].parametros[7], "$185.000");
  assert.equal(aLasQuince[0].parametros[8], "$114.828");

  const meta = calcularMetricasDia(
    { proyectada: 22, tarifas: 4400000, habsTarifa: 22 },
    75
  );
  assert.deepEqual(
    crearEventos({
      fecha: "2026-09-14",
      horaActual: "16:00",
      configuracion,
      metricas: meta,
    }).map((evento) => evento.clave),
    ["resumen", "objetivo"]
  );
  assert.equal(
    crearEventos({
      fecha: "2026-09-14",
      horaActual: "16:00",
      configuracion,
      metricas: meta,
    })[1].idioma,
    "es_CO"
  );

  const pendientes = calcularMetricasDia(
    { proyectada: 18, real: 15, tarifas: 3330000, habsTarifa: 18 },
    75,
    { llegadasHoy: 10, checkinsHoy: 7, llegadasPendientes: 3 }
  );
  assert.deepEqual(
    crearEventos({
      fecha: "2026-09-14",
      horaActual: "18:05",
      configuracion,
      metricas: pendientes,
    }).map((evento) => evento.clave),
    ["resumen", "alerta-1800", "llegadas-1800"]
  );
  assert.equal(
    crearEventos({
      fecha: "2026-09-14",
      horaActual: "18:05",
      configuracion,
      metricas: pendientes,
    })[2].idioma,
    "es_CO"
  );
});

test("persiste cada envío y no repite resumen ni alertas", async () => {
  const coleccion = coleccionEnMemoria();
  const db = { collection: () => coleccion };
  const envios = [];
  const metricas = calcularMetricasDia(
    { proyectada: 18, tarifas: 3330000, habsTarifa: 18 },
    75
  );
  const base = {
    db,
    configuracion,
    destinos: ["573001234567"],
    obtenerMetricas: async () => metricas,
    enviar: async (destino, plantilla, parametros) => {
      envios.push({ destino, plantilla, parametros });
      return { messages: [{ id: `wamid.${envios.length}` }] };
    },
  };

  await ejecutarNotificacionesOcupacion({
    ...base,
    ahora: "2026-09-14T07:00:00-05:00",
  });
  await ejecutarNotificacionesOcupacion({
    ...base,
    ahora: "2026-09-14T11:00:00-05:00",
  });
  await ejecutarNotificacionesOcupacion({
    ...base,
    ahora: "2026-09-14T11:10:00-05:00",
  });

  assert.deepEqual(
    envios.map((envio) => envio.plantilla),
    ["resumen_ocupacion_diaria_po", "alerta_ocupacion_baja"]
  );
  assert.equal(
    coleccion.documentos.get("2026-09-14:resumen:573001234567").estado,
    "enviado"
  );
  assert.equal(
    coleccion.documentos.get("2026-09-14:alerta-1100:573001234567").estado,
    "enviado"
  );
});

test("si el resumen se envía con la meta cumplida, cubre el aviso adicional", async () => {
  const coleccion = coleccionEnMemoria();
  const db = { collection: () => coleccion };
  const envios = [];
  const metricas = calcularMetricasDia(
    { proyectada: 23, tarifas: 4600000, habsTarifa: 23 },
    75
  );

  await ejecutarNotificacionesOcupacion({
    db,
    configuracion,
    destinos: ["573001234567"],
    ahora: "2026-09-14T07:00:00-05:00",
    obtenerMetricas: async () => metricas,
    enviar: async (_destino, plantilla) => {
      envios.push(plantilla);
      return { messages: [{ id: "wamid.1" }] };
    },
  });

  assert.deepEqual(envios, ["resumen_ocupacion_diaria_po"]);
  assert.equal(
    coleccion.documentos.get("2026-09-14:objetivo:573001234567").estado,
    "cubierto"
  );
});

const moment = require("moment-timezone");
const { TZ } = require("../functions/fechas");
const {
  TOTAL_HABITACIONES,
  objetivoDiarioHabitaciones,
} = require("../functions/objetivoPickup");
const { ocupacionPorDia, enCasa } = require("../functions/ocupacionDiaria");
const { estaCancelada, habitaciones } = require("../functions/ocupacion");
const {
  enviarMensajePlantilla,
  numerosNotificaciones,
} = require("../functions/whatsapp");

const COLECCION_ENVIOS = "notificaciones_whatsapp";
const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

function leerNumero(valor, predeterminado, nombre) {
  if (valor === undefined || valor === null || valor === "") return predeterminado;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0 || numero > 100) {
    throw new Error(`${nombre} debe ser un número entre 1 y 100`);
  }
  return numero;
}

function leerHora(valor, predeterminada, nombre) {
  const hora = String(valor || predeterminada).trim();
  if (!RE_HORA.test(hora)) {
    throw new Error(`${nombre} debe tener formato HH:mm`);
  }
  return hora;
}

function configuracionNotificaciones(env = process.env) {
  const idiomaPredeterminado = env.WHATSAPP_PLANTILLAS_IDIOMA || "es_CO";
  const horasAlerta = String(env.WHATSAPP_HORAS_ALERTA || "11:00,15:00,18:00")
    .split(",")
    .map((hora) => leerHora(hora.trim(), null, "WHATSAPP_HORAS_ALERTA"));

  return {
    objetivoPct: leerNumero(
      env.WHATSAPP_OBJETIVO_OCUPACION,
      75,
      "WHATSAPP_OBJETIVO_OCUPACION"
    ),
    horaResumen: leerHora(
      env.WHATSAPP_HORA_RESUMEN,
      "07:00",
      "WHATSAPP_HORA_RESUMEN"
    ),
    horasAlerta: [...new Set(horasAlerta)].sort(),
    horaAlertaLlegadas: leerHora(
      env.WHATSAPP_HORA_ALERTA_LLEGADAS,
      "18:00",
      "WHATSAPP_HORA_ALERTA_LLEGADAS"
    ),
    idioma: idiomaPredeterminado,
    plantillas: {
      resumen:
        env.WHATSAPP_PLANTILLA_RESUMEN || "resumen_ocupacion_diaria_po",
      alerta: env.WHATSAPP_PLANTILLA_ALERTA || "alerta_ocupacion_baja",
      objetivo:
        env.WHATSAPP_PLANTILLA_OBJETIVO || "objetivo_ocupacion_alcanzado_po",
      llegadas:
        env.WHATSAPP_PLANTILLA_LLEGADAS || "alerta_llegadas_pendientes_po",
    },
    idiomasPlantilla: {
      resumen:
        env.WHATSAPP_PLANTILLA_RESUMEN_IDIOMA || idiomaPredeterminado,
      alerta: env.WHATSAPP_PLANTILLA_ALERTA_IDIOMA || idiomaPredeterminado,
      objetivo:
        env.WHATSAPP_PLANTILLA_OBJETIVO_IDIOMA || idiomaPredeterminado,
      llegadas:
        env.WHATSAPP_PLANTILLA_LLEGADAS_IDIOMA || idiomaPredeterminado,
    },
  };
}

function redondear(valor) {
  return Math.round(Number(valor) || 0);
}

function formatoCOP(valor) {
  return `$${redondear(valor)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function calcularLlegadasDia(reservas = [], fecha) {
  let llegadasHoy = 0;
  let checkinsHoy = 0;

  for (const reserva of reservas) {
    const llegada =
      reserva.fecha_llegada_habitacion || reserva.fecha_llegada;
    if (llegada !== fecha || estaCancelada(reserva)) continue;

    const cantidad = habitaciones(reserva);
    llegadasHoy += cantidad;
    if (enCasa(reserva)) checkinsHoy += cantidad;
  }

  return {
    llegadasHoy,
    checkinsHoy,
    llegadasPendientes: Math.max(0, llegadasHoy - checkinsHoy),
  };
}

function calcularMetricasDia(dia, objetivoPct, llegadas = {}) {
  const ocupadas = redondear(dia?.proyectada ?? dia?.ocupacion);
  const ingreso = Number(dia?.tarifas) || 0;
  const habitacionesConTarifa = Number(dia?.habsTarifa) || 0;
  const objetivoHabitaciones = objetivoDiarioHabitaciones(objetivoPct);

  return {
    ocupadas,
    ocupacionPct: redondear((ocupadas * 100) / TOTAL_HABITACIONES),
    enCasa: redondear(dia?.real),
    llegadasHoy: redondear(llegadas.llegadasHoy),
    checkinsHoy: redondear(llegadas.checkinsHoy),
    llegadasPendientes: redondear(llegadas.llegadasPendientes),
    ingreso: redondear(ingreso),
    adr: habitacionesConTarifa ? redondear(ingreso / habitacionesConTarifa) : 0,
    revpar: redondear(ingreso / TOTAL_HABITACIONES),
    objetivoPct,
    objetivoHabitaciones,
    faltantes: Math.max(0, objetivoHabitaciones - ocupadas),
    objetivoAlcanzado: ocupadas >= objetivoHabitaciones,
    totalHabitaciones: TOTAL_HABITACIONES,
  };
}

async function obtenerMetricasDia(db, fecha, objetivoPct) {
  const { porDia, reservas } = await ocupacionPorDia(db, [fecha]);
  const llegadas = calcularLlegadasDia(reservas, fecha);
  return calcularMetricasDia(porDia.get(fecha), objetivoPct, llegadas);
}

function fechaVisible(fecha) {
  return moment.tz(fecha, "YYYY-MM-DD", TZ).format("DD/MM/YYYY");
}

function metaVisible(metricas) {
  return `${metricas.objetivoHabitaciones}/${metricas.totalHabitaciones} (${metricas.objetivoPct}%)`;
}

function crearEventos({ fecha, horaActual, configuracion, metricas }) {
  const comun = {
    fecha,
    metricas,
  };
  const resumen = {
    ...comun,
    tipo: "resumen",
    clave: "resumen",
    plantilla: configuracion.plantillas.resumen,
    idioma: configuracion.idiomasPlantilla.resumen,
    parametros: [
      fechaVisible(fecha),
      `${metricas.ocupadas}/${metricas.totalHabitaciones}`,
      `${metricas.ocupacionPct}%`,
      String(metricas.enCasa),
      String(metricas.llegadasHoy),
      String(metricas.checkinsHoy),
      String(metricas.llegadasPendientes),
      formatoCOP(metricas.adr),
      formatoCOP(metricas.revpar),
      metaVisible(metricas),
      metricas.objetivoAlcanzado
        ? "objetivo alcanzado"
        : `faltan ${metricas.faltantes} habitaciones`,
    ],
  };

  if (horaActual < configuracion.horaResumen) return [];

  const eventos = [resumen];
  if (metricas.objetivoAlcanzado) {
    eventos.push({
      ...comun,
      tipo: "objetivo",
      clave: "objetivo",
      plantilla: configuracion.plantillas.objetivo,
      idioma: configuracion.idiomasPlantilla.objetivo,
      parametros: [
        fechaVisible(fecha),
        `${metricas.ocupadas}/${metricas.totalHabitaciones}`,
        `${metricas.ocupacionPct}%`,
        String(metricas.enCasa),
        formatoCOP(metricas.adr),
        formatoCOP(metricas.revpar),
        metaVisible(metricas),
      ],
    });
  } else {
    // Si el proceso estuvo detenido, solo se envía el corte más reciente para no
    // inundar WhatsApp con todas las alertas atrasadas al reiniciar.
    const horaAlerta = configuracion.horasAlerta
      .filter((hora) => hora <= horaActual)
      .at(-1);
    if (horaAlerta) {
      eventos.push({
        ...comun,
        tipo: "alerta",
        clave: `alerta-${horaAlerta.replace(":", "")}`,
        horaAlerta,
        plantilla: configuracion.plantillas.alerta,
        idioma: configuracion.idiomasPlantilla.alerta,
        parametros: [
          horaAlerta,
          fechaVisible(fecha),
          `${metricas.ocupadas}/${metricas.totalHabitaciones}`,
          `${metricas.ocupacionPct}%`,
          String(metricas.enCasa),
          formatoCOP(metricas.adr),
          formatoCOP(metricas.revpar),
          metaVisible(metricas),
          String(metricas.faltantes),
        ],
      });
    }
  }

  if (
    horaActual >= configuracion.horaAlertaLlegadas &&
    metricas.llegadasPendientes > 0
  ) {
    eventos.push({
      ...comun,
      tipo: "llegadas",
      clave: `llegadas-${configuracion.horaAlertaLlegadas.replace(":", "")}`,
      plantilla: configuracion.plantillas.llegadas,
      idioma: configuracion.idiomasPlantilla.llegadas,
      parametros: [
        configuracion.horaAlertaLlegadas,
        fechaVisible(fecha),
        String(metricas.llegadasHoy),
        String(metricas.checkinsHoy),
        String(metricas.llegadasPendientes),
        String(metricas.enCasa),
      ],
    });
  }
  return eventos;
}

function idEvento(evento, destino) {
  return `${evento.fecha}:${evento.clave}:${destino}`;
}

async function reservarEnvio(coleccion, evento, destino, ahora) {
  const _id = idEvento(evento, destino);
  const limiteBloqueo = new Date(ahora.valueOf() - 30 * 60 * 1000);
  try {
    const resultado = await coleccion.updateOne(
      {
        _id,
        $or: [
          { estado: "fallido" },
          { estado: "enviando", actualizadoEn: { $lt: limiteBloqueo } },
        ],
      },
      {
        $setOnInsert: { creadoEn: ahora.toDate() },
        $set: {
          fecha: evento.fecha,
          tipo: evento.tipo,
          destino,
          plantilla: evento.plantilla,
          metricas: evento.metricas,
          estado: "enviando",
          actualizadoEn: ahora.toDate(),
        },
        $inc: { intentos: 1 },
        $unset: { error: "" },
      },
      { upsert: true }
    );
    return resultado.upsertedCount === 1 || resultado.modifiedCount === 1;
  } catch (error) {
    // Si ya hay un registro enviado/cubierto o reservado por otro proceso, el
    // upsert choca con el _id único. Eso significa que no debemos repetirlo.
    if (error?.code === 11000) return false;
    throw error;
  }
}

async function marcarCubierto(coleccion, evento, destino, ahora, motivo) {
  try {
    await coleccion.updateOne(
      { _id: idEvento(evento, destino) },
      {
        $setOnInsert: {
          fecha: evento.fecha,
          tipo: evento.tipo,
          destino,
          plantilla: evento.plantilla,
          metricas: evento.metricas,
          estado: "cubierto",
          motivo,
          creadoEn: ahora.toDate(),
          actualizadoEn: ahora.toDate(),
        },
      },
      { upsert: true }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
}

async function procesarEvento({
  coleccion,
  evento,
  destino,
  ahora,
  enviar,
  idioma,
  dryRun,
}) {
  if (dryRun) {
    return { estado: "simulado", tipo: evento.tipo, destino, evento };
  }

  const reservado = await reservarEnvio(coleccion, evento, destino, ahora);
  if (!reservado) return { estado: "omitido", tipo: evento.tipo, destino };

  try {
    const respuesta = await enviar(
      destino,
      evento.plantilla,
      evento.parametros,
      idioma
    );
    await coleccion.updateOne(
      { _id: idEvento(evento, destino) },
      {
        $set: {
          estado: "enviado",
          mensajeId: respuesta?.messages?.[0]?.id || null,
          enviadoEn: ahora.toDate(),
          actualizadoEn: ahora.toDate(),
        },
      }
    );
    return { estado: "enviado", tipo: evento.tipo, destino };
  } catch (error) {
    await coleccion.updateOne(
      { _id: idEvento(evento, destino) },
      {
        $set: {
          estado: "fallido",
          error: String(error.message || error).slice(0, 1000),
          actualizadoEn: ahora.toDate(),
        },
      }
    );
    return {
      estado: "error",
      tipo: evento.tipo,
      destino,
      error: error.message,
    };
  }
}

async function ejecutarNotificacionesOcupacion(opciones = {}) {
  const db = opciones.db;
  if (!db) throw new Error("Se requiere una conexión a MongoDB");

  const ahora = opciones.ahora
    ? moment(opciones.ahora).tz(TZ)
    : moment().tz(TZ);
  const configuracion =
    opciones.configuracion || configuracionNotificaciones(opciones.env);
  const destinos = opciones.destinos || numerosNotificaciones();
  if (destinos.length === 0) {
    throw new Error(
      "No hay destinatarios en WHATSAPP_NUMEROS_NOTIFICACIONES ni WHATSAPP_NUMEROS_AUTORIZADOS"
    );
  }

  const fecha = ahora.format("YYYY-MM-DD");
  const horaActual = ahora.format("HH:mm");
  const metricas = opciones.obtenerMetricas
    ? await opciones.obtenerMetricas(db, fecha, configuracion.objetivoPct)
    : await obtenerMetricasDia(db, fecha, configuracion.objetivoPct);
  const eventos = crearEventos({ fecha, horaActual, configuracion, metricas });
  const coleccion = db.collection(COLECCION_ENVIOS);
  const enviar = opciones.enviar || enviarMensajePlantilla;
  const resultados = [];

  for (const destino of destinos) {
    let resumenEnviadoAhora = false;
    for (const evento of eventos) {
      // El resumen ya contiene todos los indicadores. Si sale en esta misma
      // ejecución, cubre también una alerta o el aviso de meta para no duplicar.
      if (evento.tipo !== "resumen" && resumenEnviadoAhora) {
        if (!opciones.dryRun) {
          await marcarCubierto(
            coleccion,
            evento,
            destino,
            ahora,
            "incluido_en_resumen"
          );
        }
        resultados.push({
          estado: "cubierto",
          tipo: evento.tipo,
          destino,
        });
        continue;
      }

      const resultado = await procesarEvento({
        coleccion,
        evento,
        destino,
        ahora,
        enviar,
      idioma: evento.idioma || configuracion.idioma,
        dryRun: opciones.dryRun,
      });
      resultados.push(resultado);
      if (
        evento.tipo === "resumen" &&
        (resultado.estado === "enviado" || resultado.estado === "simulado")
      ) {
        resumenEnviadoAhora = true;
      }
    }
  }

  return { fecha, horaActual, metricas, resultados };
}

module.exports = {
  COLECCION_ENVIOS,
  calcularLlegadasDia,
  calcularMetricasDia,
  configuracionNotificaciones,
  crearEventos,
  ejecutarNotificacionesOcupacion,
  formatoCOP,
  obtenerMetricasDia,
};

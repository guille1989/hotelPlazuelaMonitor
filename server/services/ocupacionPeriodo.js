const moment = require("moment-timezone");
const { hoyBogota } = require("../functions/fechas");
const {
  estaCancelada,
  salidaEfectiva,
  habitaciones,
  noches,
} = require("../functions/ocupacion");
const { ocupacionPorDia } = require("../functions/ocupacionDiaria");

const FORMATO_FECHA = "YYYY-MM-DD";
const MAX_DIAS = 92;

function diasDelPeriodo(desde, hasta) {
  const inicio = moment.utc(desde, FORMATO_FECHA, true);
  const fin = moment.utc(hasta, FORMATO_FECHA, true);
  if (!inicio.isValid() || !fin.isValid() || fin.isBefore(inicio)) {
    const error = new Error(
      "El periodo debe usar fechas válidas YYYY-MM-DD y desde no puede ser posterior a hasta"
    );
    error.codigo = "PERIODO_INVALIDO";
    throw error;
  }

  const cantidad = fin.diff(inicio, "days") + 1;
  if (cantidad > MAX_DIAS) {
    const error = new Error(`El periodo no puede superar ${MAX_DIAS} días`);
    error.codigo = "PERIODO_MUY_LARGO";
    throw error;
  }

  return Array.from({ length: cantidad }, (_, indice) =>
    inicio.clone().add(indice, "days").format(FORMATO_FECHA)
  );
}

function resumirArribos(reservas, desde, hasta) {
  const arribo = {
    checkin: 0,
    reservadas: 0,
    canceladas: 0,
    roomNoches: 0,
    antelacionDias: 0,
    antelacionN: 0,
    canal: {},
  };

  for (const reserva of reservas) {
    const llegada =
      reserva.fecha_llegada_habitacion || reserva.fecha_llegada;
    const salida = salidaEfectiva(reserva);
    if (!llegada || !salida || llegada < desde || llegada > hasta) continue;

    const cantidad = habitaciones(reserva);
    if (estaCancelada(reserva)) {
      arribo.canceladas += cantidad;
      continue;
    }

    if (String(reserva.estado_habitacion) === "31") {
      arribo.checkin += cantidad;
    } else {
      arribo.reservadas += cantidad;
    }
    arribo.roomNoches += noches(llegada, salida) * cantidad;

    if (reserva.fecha_reserva && reserva.fecha_reserva <= llegada) {
      arribo.antelacionDias += noches(reserva.fecha_reserva, llegada);
      arribo.antelacionN += 1;
    }

    const modo = reserva.modo_reserva || "?";
    arribo.canal[modo] = (arribo.canal[modo] || 0) + cantidad;
  }

  return arribo;
}

// Consulta inclusiva para semanas, fines de semana, quincenas y otros rangos.
async function obtenerOcupacionPeriodo(db, desde, hasta) {
  const dias = diasDelPeriodo(desde, hasta);
  const { porDia, reservas } = await ocupacionPorDia(db, dias);
  const detalleDias = dias.map((dia) => ({ ...porDia.get(dia) }));

  return {
    desde,
    hasta,
    hoy: hoyBogota(),
    arribo: resumirArribos(reservas, desde, hasta),
    dias: detalleDias,
  };
}

module.exports = {
  MAX_DIAS,
  diasDelPeriodo,
  resumirArribos,
  obtenerOcupacionPeriodo,
};

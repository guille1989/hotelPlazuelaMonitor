const { diasDelMes, mesActualBogota, hoyBogota } = require("../functions/fechas");
const {
  estaCancelada,
  salidaEfectiva,
  habitaciones,
  noches,
} = require("../functions/ocupacion");
const { ocupacionPorDia } = require("../functions/ocupacionDiaria");

const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

// Fuente compartida por la API HTTP y el agente de WhatsApp. Mantener el cálculo
// aquí evita que el agente tenga que llamarse a sí mismo por HTTP.
async function obtenerOcupacionMes(db, mesSolicitado) {
  const mes = mesSolicitado || mesActualBogota();
  if (!RE_MES.test(mes)) {
    const error = new Error("El mes debe tener formato YYYY-MM");
    error.codigo = "MES_INVALIDO";
    throw error;
  }

  const [anio, numeroMes] = mes.split("-").map(Number);
  const dias = diasDelMes(anio, numeroMes);
  const { porDia, reservas } = await ocupacionPorDia(db, dias);

  const detalleDias = dias.map((dia) => {
    const ocupacion = porDia.get(dia);
    return {
      dia,
      ocupacion: ocupacion.ocupacion,
      real: ocupacion.real,
      proyectada: ocupacion.proyectada,
      fuente: ocupacion.fuente,
      cancelaciones: ocupacion.cancelaciones,
      tarifas: ocupacion.tarifas,
      habsTarifa: ocupacion.habsTarifa,
      canal: ocupacion.canal,
    };
  });

  // Agregados por mes de llegada: estancia media, tasa de cancelación y antelación.
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
    if (!llegada || !salida || llegada.slice(0, 7) !== mes) continue;

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

  return { mes, hoy: hoyBogota(), arribo, dias: detalleDias };
}

module.exports = { obtenerOcupacionMes, RE_MES };

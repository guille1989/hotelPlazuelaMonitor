const { hoyBogota } = require("../functions/fechas");
const {
  estaCancelada,
  salidaEfectiva,
} = require("../functions/ocupacion");
const { ocupacionPorDia, enCasa } = require("../functions/ocupacionDiaria");
const { diasDelPeriodo } = require("./ocupacionPeriodo");

const MAX_DIAS_HABITACIONES = 14;

function numerosHabitacion(valor) {
  if (valor === null || valor === undefined) return [];
  return String(valor)
    .split(/[;,|]/)
    .map((numero) => numero.trim())
    .filter(
      (numero) =>
        numero &&
        !["0", "null", "undefined", "n/a"].includes(numero.toLowerCase())
    );
}

function unicasOrdenadas(numeros) {
  return [...new Set(numeros)].sort((a, b) =>
    a.localeCompare(b, "es", { numeric: true, sensitivity: "base" })
  );
}

function reservaActivaEnDia(reserva, dia) {
  const llegada =
    reserva.fecha_llegada_habitacion || reserva.fecha_llegada;
  const salida = salidaEfectiva(reserva);
  return (
    llegada &&
    salida &&
    llegada <= dia &&
    dia < salida &&
    !estaCancelada(reserva)
  );
}

async function obtenerHabitaciones(db, desde, hasta) {
  const dias = diasDelPeriodo(desde, hasta);
  if (dias.length > MAX_DIAS_HABITACIONES) {
    const error = new Error(
      `La consulta de habitaciones no puede superar ${MAX_DIAS_HABITACIONES} días`
    );
    error.codigo = "PERIODO_HABITACIONES_MUY_LARGO";
    throw error;
  }

  const hoy = hoyBogota();
  const { porDia, reservas, cargos } = await ocupacionPorDia(db, dias);
  const resultado = dias.map((dia) => {
    const detalle = porDia.get(dia);
    const activas = reservas.filter((reserva) =>
      reservaActivaEnDia(reserva, dia)
    );
    const asignadas = unicasOrdenadas(
      activas.flatMap((reserva) =>
        numerosHabitacion(reserva.numero_habitacion)
      )
    );

    let ocupadas = [];
    if (detalle.fuente === "folio") {
      ocupadas = unicasOrdenadas(
        cargos
          .filter((cargo) => cargo.fecha === dia)
          .flatMap((cargo) => numerosHabitacion(cargo.numero_habitacion))
      );
    } else if (dia <= hoy) {
      ocupadas = unicasOrdenadas(
        activas
          .filter(enCasa)
          .flatMap((reserva) =>
            numerosHabitacion(reserva.numero_habitacion)
          )
      );
    }

    const conteoOcupadas =
      detalle.real === null || detalle.real === undefined
        ? null
        : Number(detalle.real) || 0;
    const conteoAsignadas =
      dia < hoy
        ? null
        : Number(detalle.proyectada ?? detalle.ocupacion) || 0;

    return {
      fecha: dia,
      fuente: detalle.fuente,
      conteoOcupadas,
      habitacionesOcupadas: ocupadas,
      ocupadasSinNumero:
        conteoOcupadas === null
          ? null
          : Math.max(0, conteoOcupadas - ocupadas.length),
      conteoAsignadas,
      habitacionesAsignadas: dia < hoy ? [] : asignadas,
      asignadasSinNumero:
        conteoAsignadas === null
          ? null
          : Math.max(0, conteoAsignadas - asignadas.length),
    };
  });

  return { desde, hasta, hoy, dias: resultado };
}

module.exports = {
  MAX_DIAS_HABITACIONES,
  numerosHabitacion,
  reservaActivaEnDia,
  obtenerHabitaciones,
};

const moment = require("moment-timezone");
const { TZ } = require("../functions/fechas");

const HORIZONTES_MVP = Object.freeze([1, 3, 7, 14, 30, 60, 90]);

function crearConsultas({
  fechaBase,
  horizontes = HORIZONTES_MVP,
  adultos = 2,
  habitaciones = 1,
  noches = 1,
} = {}) {
  const base = fechaBase
    ? moment.tz(fechaBase, "YYYY-MM-DD", true, TZ)
    : moment().tz(TZ).startOf("day");

  if (!base.isValid()) throw new Error("fechaBase debe tener formato YYYY-MM-DD");
  if (!Number.isInteger(adultos) || adultos < 1) {
    throw new Error("adultos debe ser un entero positivo");
  }
  if (!Number.isInteger(habitaciones) || habitaciones < 1) {
    throw new Error("habitaciones debe ser un entero positivo");
  }
  if (!Number.isInteger(noches) || noches < 1) {
    throw new Error("noches debe ser un entero positivo");
  }

  const offsets = [...new Set(horizontes)].sort((a, b) => a - b);
  return offsets.map((offsetDias) => {
    if (!Number.isInteger(offsetDias) || offsetDias < 0) {
      throw new Error("Los horizontes deben ser enteros mayores o iguales a cero");
    }
    const entrada = base.clone().add(offsetDias, "day");
    return {
      offsetDias,
      checkIn: entrada.format("YYYY-MM-DD"),
      checkOut: entrada.clone().add(noches, "day").format("YYYY-MM-DD"),
      adultos,
      habitaciones,
      noches,
      moneda: "COP",
      tarifaPublica: true,
    };
  });
}

module.exports = { HORIZONTES_MVP, crearConsultas };

const crypto = require("node:crypto");
const { GRUPOS } = require("../catalogoHoteles");

const BASE_POR_GRUPO = Object.freeze({
  [GRUPOS.PROPIO]: 240000,
  [GRUPOS.DIRECTO]: 195000,
  [GRUPOS.SUPERIOR]: 325000,
  [GRUPOS.CORPORATIVO]: 275000,
});

function variacionDeterminista(texto) {
  const hex = crypto.createHash("sha256").update(texto).digest("hex").slice(0, 6);
  return parseInt(hex, 16) % 60001;
}

function crearProveedorMock({ agotados = [] } = {}) {
  const clavesAgotadas = new Set(agotados);

  return {
    id: "mock",
    simulated: true,

    async capturar({ hoteles, consultas, capturedAt }) {
      const cotizaciones = [];

      for (const hotel of hoteles) {
        for (const consulta of consultas) {
          const clave = `${hotel.id}:${consulta.checkIn}`;
          const disponible = !clavesAgotadas.has(clave);
          const total =
            (BASE_POR_GRUPO[hotel.grupo] || 200000) +
            variacionDeterminista(clave);

          cotizaciones.push({
            hotelId: hotel.id,
            source: "mock",
            channel: "simulado",
            capturedAt,
            checkIn: consulta.checkIn,
            checkOut: consulta.checkOut,
            adults: consulta.adultos,
            rooms: consulta.habitaciones,
            roomType: disponible ? "Habitación doble simulada" : null,
            refundable: disponible ? true : null,
            mealPlan: disponible ? "no_incluido" : "desconocido",
            currency: "COP",
            baseAmount: disponible ? total : null,
            taxesAmount: disponible ? 0 : null,
            totalAmount: disponible ? total : null,
            taxesIncluded: disponible ? true : null,
            publicRate: true,
            memberRate: false,
            available: disponible,
            simulated: true,
          });
        }
      }

      return { cotizaciones, errores: [] };
    },
  };
}

module.exports = { crearProveedorMock };

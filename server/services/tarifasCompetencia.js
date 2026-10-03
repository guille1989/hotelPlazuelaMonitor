const moment = require("moment-timezone");
const { hoyBogota } = require("../functions/fechas");
const { ocupacionPorDia } = require("../functions/ocupacionDiaria");
const { TOTAL_HABITACIONES } = require("../functions/objetivoPickup");
const { CATALOGO_HOTELES, GRUPOS } = require("../rate-shopping/catalogoHoteles");
const { COLECCIONES } = require("./rateShopping");

// Avisos de la vista Tarifas: solo dentro de este horizonte, y cuando el precio
// propio se aleja de la mediana de los directos al menos este porcentaje.
const DIAS_ALERTA = 30;
const UMBRAL_ALERTA_PCT = 15;
// Una "mediana" de un solo hotel no es referencia suficiente para avisar.
const MIN_COMPARABLES_ALERTA = 2;

function mediana(valores) {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2
    ? orden[medio]
    : Math.round((orden[medio - 1] + orden[medio]) / 2);
}

function diasHasta(hoy, dia) {
  return moment.utc(dia).diff(moment.utc(hoy), "days");
}

function estadoHotel(tarifa, error) {
  if (tarifa?.available && tarifa.totalAmount !== null) {
    return tarifa.comparable ? "comparable" : "no_comparable";
  }
  return error ? "sin_precio" : "sin_dato";
}

// Arma la vista a partir de una captura ya leída. Separada de Mongo para testear.
// Solo los competidores DIRECTOS comparables entran en la mediana; superior y
// corporativo se capturan aparte para no mover la referencia principal.
function armarTarifasCompetencia({
  ejecucion,
  tarifas,
  ocupacion,
  hoy,
  objetivoPct,
  catalogo = CATALOGO_HOTELES,
}) {
  const porClave = new Map(tarifas.map((t) => [`${t.hotelId}:${t.checkIn}`, t]));
  const errores = new Map(
    (ejecucion.errors || []).map((e) => [`${e.hotelId}:${e.checkIn}`, e])
  );
  const idsCapturados = new Set([
    ...tarifas.map((t) => t.hotelId),
    ...(ejecucion.errors || []).map((e) => e.hotelId),
  ]);
  const hoteles = catalogo.filter((h) => idsCapturados.has(h.id));
  const dias = [
    ...new Set([
      ...tarifas.map((t) => t.checkIn),
      ...(ejecucion.errors || []).map((e) => e.checkIn),
    ]),
  ]
    .filter((dia) => dia >= hoy)
    .sort();

  const fechas = dias.map((dia) => {
    const filas = hoteles.map((hotel) => {
      const tarifa = porClave.get(`${hotel.id}:${dia}`);
      const error = errores.get(`${hotel.id}:${dia}`);
      const estado = estadoHotel(tarifa, error);
      const conPrecio = estado === "comparable" || estado === "no_comparable";
      return {
        hotelId: hotel.id,
        nombre: hotel.nombreCorto || hotel.nombre,
        grupo: hotel.grupo,
        propio: hotel.propio === true,
        estado,
        precio: conPrecio ? tarifa.totalAmount : null,
        habitacion: conPrecio ? tarifa.roomType : null,
        cancelacionGratis: conPrecio ? tarifa.refundable === true : null,
        desayuno: conPrecio ? tarifa.mealPlan === "incluido" : null,
        motivos: tarifa?.nonComparableReasons || [],
        error: error ? error.code : null,
      };
    });

    const propio = filas.find((f) => f.propio) || null;
    const comparables = filas
      .filter((f) => f.grupo === GRUPOS.DIRECTO && f.estado === "comparable")
      .map((f) => f.precio);
    const med = mediana(comparables);
    const precioPropio = propio?.precio ?? null;
    const diferenciaPct =
      precioPropio !== null && med ? Math.round((precioPropio / med - 1) * 100) : null;
    const posicion =
      precioPropio !== null && comparables.length > 0
        ? {
            lugar: comparables.filter((p) => p < precioPropio).length + 1,
            de: comparables.length + 1,
          }
        : null;

    const habitaciones = ocupacion.get(dia)?.proyectada ?? 0;
    const ocupacionPct = Math.round((habitaciones * 100) / TOTAL_HABITACIONES);
    const faltan = diasHasta(hoy, dia);
    let alerta = null;
    if (
      diferenciaPct !== null &&
      faltan <= DIAS_ALERTA &&
      comparables.length >= MIN_COMPARABLES_ALERTA
    ) {
      if (diferenciaPct >= UMBRAL_ALERTA_PCT && ocupacionPct < objetivoPct) {
        alerta = "caro_vacio";
      } else if (diferenciaPct <= -UMBRAL_ALERTA_PCT && ocupacionPct >= objetivoPct) {
        alerta = "barato_lleno";
      }
    }

    // Con precio primero (de menor a mayor) y luego los que no tienen.
    filas.sort((a, b) => (a.precio ?? Infinity) - (b.precio ?? Infinity));

    return {
      dia,
      diasHasta: faltan,
      ocupacion: { habitaciones, pct: ocupacionPct },
      precioPropio,
      propioComparable: propio?.estado === "comparable",
      mediana: med,
      comparables: comparables.length,
      minimo: comparables.length ? Math.min(...comparables) : null,
      maximo: comparables.length ? Math.max(...comparables) : null,
      diferenciaPct,
      posicion,
      alerta,
      hoteles: filas,
    };
  });

  return {
    ejecucion: {
      id: ejecucion._id,
      capturedAt: ejecucion.capturedAt,
      capturedDate: ejecucion.capturedDate,
      status: ejecucion.status,
      summary: ejecucion.summary,
    },
    objetivoPct,
    totalHabitaciones: TOTAL_HABITACIONES,
    umbralAlertaPct: UMBRAL_ALERTA_PCT,
    diasAlerta: DIAS_ALERTA,
    fechas,
  };
}

// Última captura real de SerpApi (Booking) cruzada con la ocupación proyectada.
async function obtenerTarifasCompetencia(db, { objetivoPct = 75 } = {}) {
  const [ejecucion] = await db
    .collection(COLECCIONES.ejecuciones)
    .find({ source: "serpapi", simulated: { $ne: true } })
    .sort({ capturedDate: -1 })
    .limit(1)
    .toArray();
  if (!ejecucion) {
    return { ejecucion: null, objetivoPct, totalHabitaciones: TOTAL_HABITACIONES, fechas: [] };
  }

  const tarifas = await db
    .collection(COLECCIONES.tarifas)
    .find({ runId: ejecucion._id })
    .toArray();
  const hoy = hoyBogota();
  const dias = [
    ...new Set([...tarifas, ...(ejecucion.errors || [])].map((t) => t.checkIn)),
  ]
    .filter((d) => d >= hoy)
    .sort();
  const ocupacion = dias.length ? (await ocupacionPorDia(db, dias)).porDia : new Map();

  return armarTarifasCompetencia({ ejecucion, tarifas, ocupacion, hoy, objetivoPct });
}

module.exports = {
  DIAS_ALERTA,
  UMBRAL_ALERTA_PCT,
  armarTarifasCompetencia,
  mediana,
  obtenerTarifasCompetencia,
};

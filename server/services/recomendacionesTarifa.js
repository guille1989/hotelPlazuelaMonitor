const { recomendar } = require("./motorTarifas");
const { obtenerSenalesTarifa } = require("./senalesTarifa");

// Recomendaciones del copiloto de tarifas: señales + motor de reglas, y su registro
// para medir después cada versión de las reglas (¿se aplicó?, ¿cómo cerró la fecha?).

const COLECCION_RECOMENDACIONES = "copiloto_recomendaciones";

// Lo que se guarda de las señales de cada día: lo necesario para entender después
// por qué se recomendó lo que se recomendó.
function resumenSenal(s) {
  return {
    diasHasta: s.diasHasta,
    calendario: {
      tipo: s.calendario.tipo,
      festivo: s.calendario.festivo,
      impactoEventos: s.calendario.impactoEventos,
      eventos: s.calendario.eventos.map((e) => e.nombre),
    },
    ocupacion: s.ocupacion,
    ritmo: {
      actual: s.ritmo.actual,
      alCorteAA: s.ritmo.anioAnterior.alCorte,
      finalAA: s.ritmo.anioAnterior.final,
      diferencia: s.ritmo.diferencia,
      pronostico: s.ritmo.pronostico,
      pickupEsperado: s.ritmo.pickupEsperado,
      diasReferencia: s.ritmo.diasReferencia,
    },
    tarifaVendida: s.tarifaVendida,
    competencia: s.competencia
      ? {
          capturedDate: s.competencia.capturedDate,
          antiguedadDias: s.competencia.antiguedadDias,
          precioPropio: s.competencia.precioPropio,
          mediana: s.competencia.mediana,
          comparables: s.competencia.comparables,
        }
      : null,
    rango: s.rango ? { piso: s.rango.piso, techo: s.rango.techo, origen: s.rango.origen } : null,
  };
}

// Calcula las recomendaciones con los datos de ahora (o de `corte`, en una prueba
// hacia atrás). `dias` trae las señales completas, en el mismo orden.
async function generarRecomendaciones(db, opciones = {}) {
  const senales = await obtenerSenalesTarifa(db, opciones);
  return {
    hoy: senales.hoy,
    historico: senales.historico,
    objetivoPct: senales.objetivoPct,
    capturas: senales.capturas,
    tendencia: senales.tendencia,
    dias: senales.dias,
    recomendaciones: senales.dias.map((s) => ({ ...recomendar(s), senal: resumenSenal(s) })),
  };
}

// Una recomendación por corrida y fecha: volver a correr el mismo día la reemplaza.
// Solo se escriben los campos del motor, así lo que se agregue después a cada
// documento (si se aplicó, cómo cerró) no se pierde.
async function guardarRecomendaciones(db, resultado, ahora = new Date()) {
  if (resultado.historico) throw new Error("Una prueba hacia atrás no se guarda");
  const { hoy, tendencia, recomendaciones } = resultado;
  if (recomendaciones.length === 0) return { insertadas: 0, actualizadas: 0 };
  const coleccion = db.collection(COLECCION_RECOMENDACIONES);
  await coleccion.createIndex({ dia: 1, corrida: -1 });
  const respuesta = await coleccion.bulkWrite(
    recomendaciones.map((rec) => ({
      updateOne: {
        filter: { _id: `${hoy}:${rec.dia}` },
        update: {
          $set: { corrida: hoy, ...rec, tendencia, actualizadoEn: ahora },
          $setOnInsert: { creadoEn: ahora },
        },
        upsert: true,
      },
    }))
  );
  return { insertadas: respuesta.upsertedCount, actualizadas: respuesta.modifiedCount };
}

module.exports = {
  COLECCION_RECOMENDACIONES,
  generarRecomendaciones,
  guardarRecomendaciones,
  resumenSenal,
};

const { sumarDias } = require("../functions/calendarioColombia");
const { recomendar } = require("./motorTarifas");
const { obtenerSenalesTarifa } = require("./senalesTarifa");

// Recomendaciones del copiloto de tarifas: señales + motor de reglas, y su registro
// para medir después cada versión de las reglas (¿se aplicó?, ¿cómo cerró la fecha?).

const COLECCION_RECOMENDACIONES = "copiloto_recomendaciones";
// Una fecha marcada como aplicada no vuelve a pedir cambio en 7 días: hasta la captura
// del sábado el motor sigue viendo el precio viejo y repetiría la misma subida. Es el
// tope de un paso por semana acordado en la Fase 0.
const DIAS_APLICADA = 7;
const ACCIONES = ["subir", "mantener", "bajar"];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const errorDeDatos = (mensaje) => Object.assign(new Error(mensaje), { status: 400 });
const desdeAplicadas = (hoy) => sumarDias(hoy, -(DIAS_APLICADA - 1));

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
  const aplicadas = senales.historico
    ? new Map()
    : await aplicadasRecientes(db, senales.dias.map((s) => s.dia), senales.hoy);
  return {
    hoy: senales.hoy,
    historico: senales.historico,
    objetivoPct: senales.objetivoPct,
    capturas: senales.capturas,
    tendencia: senales.tendencia,
    dias: senales.dias,
    recomendaciones: senales.dias.map((s) => ({
      ...recomendar(s),
      senal: resumenSenal(s),
      yaAplicada: aplicadas.get(s.dia) || null,
    })),
  };
}

// Map<dia, aplicada> con la marca más reciente de los últimos 7 días por fecha.
async function aplicadasRecientes(db, dias, hoy) {
  const documentos = await db
    .collection(COLECCION_RECOMENDACIONES)
    .find(
      { dia: { $in: dias }, "aplicada.corrida": { $gte: desdeAplicadas(hoy) } },
      { projection: { dia: 1, aplicada: 1 } }
    )
    .toArray();
  const porDia = new Map();
  for (const { dia, aplicada } of documentos) {
    const previa = porDia.get(dia);
    if (!previa || aplicada.en > previa.en) porDia.set(dia, aplicada);
  }
  return porDia;
}

// Valida lo que manda el dashboard al marcar una recomendación como aplicada.
function validarAplicada(cuerpo, hoy) {
  const dia = cuerpo && cuerpo.dia;
  const accion = cuerpo && cuerpo.accion;
  const pct = Number(cuerpo && cuerpo.pct);
  if (!FECHA.test(dia || "") || dia < hoy) throw errorDeDatos("Fecha inválida");
  if (!ACCIONES.includes(accion)) throw errorDeDatos("Acción inválida");
  if (!Number.isInteger(pct) || Math.abs(pct) > 10) throw errorDeDatos("Porcentaje inválido");
  return { dia, accion, pct };
}

// Marca como aplicada la recomendación de hoy para `dia`. Si el cron todavía no guardó
// la corrida de hoy, crea el documento y el cron lo completa al correr.
async function marcarAplicada(db, { hoy, dia, accion, pct }, ahora = new Date()) {
  const aplicada = { en: ahora, corrida: hoy, accion, pct };
  await db.collection(COLECCION_RECOMENDACIONES).updateOne(
    { _id: `${hoy}:${dia}` },
    { $set: { aplicada }, $setOnInsert: { corrida: hoy, dia, creadoEn: ahora } },
    { upsert: true }
  );
  return aplicada;
}

// Deshace las marcas de los últimos 7 días para `dia`.
async function desmarcarAplicada(db, { hoy, dia }) {
  if (!FECHA.test(dia || "")) throw errorDeDatos("Fecha inválida");
  const respuesta = await db
    .collection(COLECCION_RECOMENDACIONES)
    .updateMany(
      { dia, "aplicada.corrida": { $gte: desdeAplicadas(hoy) } },
      { $unset: { aplicada: "" } }
    );
  return { desmarcadas: respuesta.modifiedCount };
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
  aplicadasRecientes,
  desmarcarAplicada,
  generarRecomendaciones,
  guardarRecomendaciones,
  marcarAplicada,
  resumenSenal,
  validarAplicada,
};

const moment = require("moment-timezone");
const { TZ } = require("../functions/fechas");
const {
  CATALOGO_HOTELES,
  validarCatalogo,
} = require("../rate-shopping/catalogoHoteles");
const { crearConsultas } = require("../rate-shopping/consultas");
const { normalizarTarifa } = require("../rate-shopping/normalizarTarifa");

const COLECCIONES = Object.freeze({
  hoteles: "rate_hotels",
  ejecuciones: "rate_runs",
  tarifas: "rate_quotes",
});

function fechaCapturaBogota(capturedAt) {
  const fecha = moment(capturedAt).tz(TZ);
  if (!fecha.isValid()) throw new Error("capturedAt debe ser una fecha válida");
  return fecha.format("YYYY-MM-DD");
}

function idTarifa(runId, tarifa) {
  return [
    runId,
    tarifa.hotelId,
    tarifa.checkIn,
    tarifa.checkOut,
    tarifa.adults,
    tarifa.rooms,
    tarifa.channel,
  ].join(":");
}

function resumenCaptura({ esperadas, tarifas, errores }) {
  const recibidas = tarifas.length;
  return {
    esperadas,
    recibidas,
    coberturaPct: esperadas ? Math.round((recibidas * 100) / esperadas) : 0,
    comparables: tarifas.filter((tarifa) => tarifa.comparable).length,
    agotadas: tarifas.filter((tarifa) => !tarifa.available).length,
    noComparables: tarifas.filter(
      (tarifa) => tarifa.available && !tarifa.comparable
    ).length,
    errores: errores.length,
  };
}

async function prepararColeccionesRateShopping(db) {
  await db
    .collection(COLECCIONES.tarifas)
    .createIndex({ hotelId: 1, checkIn: 1, capturedAt: -1 });
  await db.collection(COLECCIONES.tarifas).createIndex({ runId: 1 });
  await db
    .collection(COLECCIONES.ejecuciones)
    .createIndex({ capturedDate: -1, source: 1 });
}

async function guardarCaptura({ db, catalogo, ejecucion, tarifas, ahora }) {
  const hoteles = db.collection(COLECCIONES.hoteles);
  const observaciones = db.collection(COLECCIONES.tarifas);
  const ejecuciones = db.collection(COLECCIONES.ejecuciones);

  await hoteles.bulkWrite(
    catalogo.map((hotel) => ({
      updateOne: {
        filter: { _id: hotel.id },
        update: {
          $set: { ...hotel, updatedAt: ahora },
          $setOnInsert: { createdAt: ahora },
        },
        upsert: true,
      },
    }))
  );

  if (tarifas.length > 0) {
    await observaciones.bulkWrite(
      tarifas.map((tarifa) => ({
        updateOne: {
          filter: { _id: idTarifa(ejecucion._id, tarifa) },
          update: {
            $set: { ...tarifa, runId: ejecucion._id, updatedAt: ahora },
            $setOnInsert: { createdAt: ahora },
          },
          upsert: true,
        },
      }))
    );
  }

  const { _id: ejecucionId, ...datosEjecucion } = ejecucion;
  await ejecuciones.updateOne(
    { _id: ejecucionId },
    {
      $set: { ...datosEjecucion, updatedAt: ahora },
      $setOnInsert: { createdAt: ahora },
    },
    { upsert: true }
  );
}

async function ejecutarCapturaTarifas(opciones = {}) {
  const proveedor = opciones.proveedor;
  if (!proveedor?.id || typeof proveedor.capturar !== "function") {
    throw new Error("Se requiere un proveedor de tarifas válido");
  }
  if (
    proveedor.simulated === true &&
    !opciones.dryRun &&
    opciones.allowSimulatedWrite !== true
  ) {
    throw new Error(
      "El proveedor simulado solo puede escribir con allowSimulatedWrite=true"
    );
  }
  if (!opciones.dryRun && !opciones.db) {
    throw new Error("Se requiere una conexión a MongoDB para guardar la captura");
  }

  const catalogo = opciones.catalogo || CATALOGO_HOTELES;
  validarCatalogo(catalogo);
  const hoteles = catalogo.filter((hotel) => hotel.activo);
  const consultas = opciones.consultas || crearConsultas();
  const ahora = opciones.ahora ? new Date(opciones.ahora) : new Date();
  if (Number.isNaN(ahora.valueOf())) throw new Error("ahora debe ser una fecha válida");

  const capturedDate = fechaCapturaBogota(ahora);
  const runId = `${proveedor.id}:${capturedDate}`;
  const resultado = await proveedor.capturar({
    hoteles,
    consultas,
    capturedAt: ahora,
  });
  const errores = Array.isArray(resultado?.errores) ? resultado.errores : [];
  // Consumo del proveedor (p. ej. búsquedas de SerpApi) para vigilar la cuota.
  const usage = resultado?.usage || null;
  const idsHoteles = new Set(hoteles.map((hotel) => hotel.id));
  const tarifasPorId = new Map();

  for (const cotizacion of resultado?.cotizaciones || []) {
    const tarifa = normalizarTarifa(cotizacion);
    if (!idsHoteles.has(tarifa.hotelId)) {
      throw new Error(`El proveedor devolvió un hotel desconocido: ${tarifa.hotelId}`);
    }
    const id = idTarifa(runId, tarifa);
    if (tarifasPorId.has(id)) {
      throw new Error(`El proveedor devolvió una tarifa duplicada: ${id}`);
    }
    tarifasPorId.set(id, tarifa);
  }

  const tarifas = [...tarifasPorId.values()];
  const resumen = resumenCaptura({
    esperadas: hoteles.length * consultas.length,
    tarifas,
    errores,
  });
  const ejecucion = {
    _id: runId,
    source: proveedor.id,
    capturedAt: ahora,
    capturedDate,
    status:
      resumen.coberturaPct === 100 && resumen.errores === 0
        ? "completa"
        : "parcial",
    simulated: proveedor.simulated === true,
    query: {
      hoteles: hoteles.length,
      fechas: consultas.length,
      adultos: consultas[0]?.adultos || null,
      habitaciones: consultas[0]?.habitaciones || null,
      moneda: consultas[0]?.moneda || null,
    },
    summary: resumen,
    usage,
    errors: errores,
  };

  if (!opciones.dryRun) {
    await prepararColeccionesRateShopping(opciones.db);
    await guardarCaptura({
      db: opciones.db,
      catalogo,
      ejecucion,
      tarifas,
      ahora,
    });
  }

  return { ejecucion, tarifas };
}

module.exports = {
  COLECCIONES,
  ejecutarCapturaTarifas,
  fechaCapturaBogota,
  guardarCaptura,
  idTarifa,
  prepararColeccionesRateShopping,
  resumenCaptura,
};

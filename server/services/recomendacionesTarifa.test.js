const test = require("node:test");
const assert = require("node:assert/strict");
const {
  aplicadasRecientes,
  desmarcarAplicada,
  guardarRecomendaciones,
  marcarAplicada,
  resumenSenal,
  validarAplicada,
} = require("./recomendacionesTarifa");

// Colección falsa que registra lo que se le pide.
function coleccionFalsa(documentos = []) {
  const llamadas = [];
  return {
    llamadas,
    db: {
      collection: (nombre) => {
        assert.equal(nombre, "copiloto_recomendaciones");
        return {
          updateOne: async (...args) => llamadas.push(["updateOne", ...args]),
          updateMany: async (...args) => {
            llamadas.push(["updateMany", ...args]);
            return { modifiedCount: 1 };
          },
          find: (...args) => {
            llamadas.push(["find", ...args]);
            return { toArray: async () => documentos };
          },
        };
      },
    },
  };
}

const senal = {
  dia: "2026-10-17",
  diasHasta: 13,
  calendario: {
    tipo: "fin_de_semana",
    festivo: null,
    eventos: [{ nombre: "Festival Internacional de Títeres", impacto: "medio", tipo: "evento" }],
    impactoEventos: "medio",
  },
  ocupacion: { proyectada: 3, pct: 10, objetivo: 22, grupos: 0, cotizadas: 0 },
  ritmo: {
    actual: 3,
    anioAnterior: { fecha: "2025-10-18", alCorte: 3, final: 15 },
    diferencia: 0,
    pronostico: 22,
    pickupEsperado: 19,
    diasReferencia: 4,
    tendencia: { factor: 1 },
  },
  tarifaVendida: { promedio: 194000, habitaciones: 3, doble: { promedio: 144000, habitaciones: 1 } },
  historia: { fechas: [], adr: 134000, ocupacionPct: 76 },
  competencia: {
    capturedDate: "2026-10-03",
    antiguedadDias: 1,
    precioPropio: 101725,
    propioComparable: true,
    mediana: 154000,
    comparables: 3,
    minimo: 90000,
    maximo: 155152,
    diferenciaPct: -34,
  },
  rango: { piso: 107000, techo: 226000, mediana: 165000, noches: 400, origen: "historico", referencia: "2025-10" },
};

test("resume las señales que justifican la recomendación", () => {
  assert.deepEqual(resumenSenal(senal), {
    diasHasta: 13,
    calendario: {
      tipo: "fin_de_semana",
      festivo: null,
      impactoEventos: "medio",
      eventos: ["Festival Internacional de Títeres"],
    },
    ocupacion: { proyectada: 3, pct: 10, objetivo: 22, grupos: 0, cotizadas: 0 },
    ritmo: { actual: 3, alCorteAA: 3, finalAA: 15, diferencia: 0, pronostico: 22, pickupEsperado: 19, diasReferencia: 4 },
    tarifaVendida: { promedio: 194000, habitaciones: 3, doble: { promedio: 144000, habitaciones: 1 } },
    competencia: { capturedDate: "2026-10-03", antiguedadDias: 1, precioPropio: 101725, mediana: 154000, comparables: 3 },
    rango: { piso: 107000, techo: 226000, origen: "historico" },
  });
  assert.equal(resumenSenal({ ...senal, competencia: null, rango: null }).competencia, null);
});

test("guarda una recomendación por corrida y fecha sin pisar lo agregado después", async () => {
  const llamadas = { indices: [], operaciones: null };
  const db = {
    collection: (nombre) => {
      assert.equal(nombre, "copiloto_recomendaciones");
      return {
        createIndex: async (indice) => llamadas.indices.push(indice),
        bulkWrite: async (ops) => {
          llamadas.operaciones = ops;
          return { upsertedCount: 1, modifiedCount: 0 };
        },
      };
    },
  };
  const ahora = new Date("2026-10-04T11:30:00Z");
  const tendencia = { factor: 1 };
  const recomendacion = { dia: "2026-10-17", accion: "subir", pct: 10, versionReglas: "1" };

  const resultado = await guardarRecomendaciones(
    db,
    { hoy: "2026-10-04", historico: false, tendencia, recomendaciones: [recomendacion] },
    ahora
  );
  assert.deepEqual(resultado, { insertadas: 1, actualizadas: 0 });
  assert.deepEqual(llamadas.indices, [{ dia: 1, corrida: -1 }]);
  const [{ updateOne }] = llamadas.operaciones;
  assert.deepEqual(updateOne.filter, { _id: "2026-10-04:2026-10-17" });
  assert.equal(updateOne.upsert, true);
  // Solo $set de los campos del motor: `aplicada` o `resultado` quedan intactos.
  assert.deepEqual(Object.keys(updateOne.update).sort(), ["$set", "$setOnInsert"]);
  assert.deepEqual(updateOne.update.$set, { corrida: "2026-10-04", ...recomendacion, tendencia, actualizadoEn: ahora });
});

test("valida la marca de aplicada", () => {
  const hoy = "2026-10-04";
  assert.deepEqual(validarAplicada({ dia: "2026-10-17", accion: "subir", pct: 10 }, hoy), {
    dia: "2026-10-17",
    accion: "subir",
    pct: 10,
  });
  assert.throws(() => validarAplicada({ dia: "2026-10-03", accion: "subir", pct: 5 }, hoy), /Fecha inválida/);
  assert.throws(() => validarAplicada({ dia: "17-oct", accion: "subir", pct: 5 }, hoy), /Fecha inválida/);
  assert.throws(() => validarAplicada({ dia: "2026-10-17", accion: "duplicar", pct: 5 }, hoy), /Acción inválida/);
  assert.throws(() => validarAplicada({ dia: "2026-10-17", accion: "subir", pct: 50 }, hoy), /Porcentaje inválido/);
  assert.throws(() => validarAplicada(undefined, hoy), (e) => e.status === 400);
});

test("marca la recomendación de hoy y crea el documento si el cron no corrió", async () => {
  const { db, llamadas } = coleccionFalsa();
  const ahora = new Date("2026-10-04T15:00:00Z");
  const aplicada = await marcarAplicada(db, { hoy: "2026-10-04", dia: "2026-10-17", accion: "subir", pct: 10 }, ahora);
  assert.deepEqual(aplicada, { en: ahora, corrida: "2026-10-04", accion: "subir", pct: 10 });
  const [, filtro, cambio, opciones] = llamadas[0];
  assert.deepEqual(filtro, { _id: "2026-10-04:2026-10-17" });
  assert.deepEqual(cambio, {
    $set: { aplicada },
    $setOnInsert: { corrida: "2026-10-04", dia: "2026-10-17", creadoEn: ahora },
  });
  assert.deepEqual(opciones, { upsert: true });
});

test("las marcas cuentan 7 días y gana la más reciente", async () => {
  const vieja = { en: new Date("2026-10-01T12:00:00Z"), corrida: "2026-10-01", accion: "subir", pct: 5 };
  const nueva = { en: new Date("2026-10-03T12:00:00Z"), corrida: "2026-10-03", accion: "subir", pct: 10 };
  const { db, llamadas } = coleccionFalsa([
    { dia: "2026-10-17", aplicada: vieja },
    { dia: "2026-10-17", aplicada: nueva },
    { dia: "2026-10-10", aplicada: vieja },
  ]);
  const aplicadas = await aplicadasRecientes(db, ["2026-10-10", "2026-10-17"], "2026-10-04");
  assert.equal(aplicadas.get("2026-10-17"), nueva);
  assert.equal(aplicadas.get("2026-10-10"), vieja);
  // Del 28-sep al 4-oct: 7 días contando hoy.
  assert.deepEqual(llamadas[0][1], {
    dia: { $in: ["2026-10-10", "2026-10-17"] },
    "aplicada.corrida": { $gte: "2026-09-28" },
  });

  const { db: db2, llamadas: llamadas2 } = coleccionFalsa();
  assert.deepEqual(await desmarcarAplicada(db2, { hoy: "2026-10-04", dia: "2026-10-17" }), { desmarcadas: 1 });
  assert.deepEqual(llamadas2[0].slice(1), [
    { dia: "2026-10-17", "aplicada.corrida": { $gte: "2026-09-28" } },
    { $unset: { aplicada: "" } },
  ]);
  await assert.rejects(desmarcarAplicada(db2, { hoy: "2026-10-04", dia: "x" }), /Fecha inválida/);
});

test("no guarda una prueba hacia atrás", async () => {
  await assert.rejects(
    guardarRecomendaciones({}, { hoy: "2026-09-01", historico: true, recomendaciones: [] }),
    /prueba hacia atrás no se guarda/
  );
});

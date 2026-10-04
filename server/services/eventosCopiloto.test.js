const test = require("node:test");
const assert = require("node:assert/strict");
const {
  eventosDelDia,
  guardarEventos,
  impactoMaximo,
  normalizarEvento,
} = require("./eventosCopiloto");

test("normaliza un evento del JSON de carga", () => {
  const evento = normalizarEvento(
    {
      nombre: " Popayán Ciudad Libro ",
      desde: "2026-11-05",
      hasta: "2026-11-12",
      impacto: "Muy_Alto",
      categoria: "feria_cultural_literaria",
    },
    "Estudio de impacto"
  );
  assert.deepEqual(evento, {
    _id: "2026-11-05:popayan-ciudad-libro",
    nombre: "Popayán Ciudad Libro",
    desde: "2026-11-05",
    hasta: "2026-11-12",
    impacto: "muy alto",
    tipo: "evento",
    categoria: "feria_cultural_literaria",
    estado: null,
    observaciones: null,
    fuente: null,
    origen: "Estudio de impacto",
  });
});

test("rechaza fechas, impactos y tipos inválidos", () => {
  const base = { nombre: "X", desde: "2026-11-05", hasta: "2026-11-06", impacto: "alto" };
  assert.throws(() => normalizarEvento({ ...base, nombre: "" }), /sin nombre/);
  assert.throws(() => normalizarEvento({ ...base, hasta: "2026-11-04" }), /fechas inválidas/);
  assert.throws(() => normalizarEvento({ ...base, desde: "5-nov" }), /fechas inválidas/);
  assert.throws(() => normalizarEvento({ ...base, impacto: "altísimo" }), /impacto "altísimo"/);
  assert.throws(() => normalizarEvento({ ...base, tipo: "feria" }), /tipo "feria"/);
});

test("guarda con upsert por id para no duplicar al recargar", async () => {
  let operaciones = null;
  const db = {
    collection: (nombre) => {
      assert.equal(nombre, "copiloto_eventos");
      return {
        bulkWrite: async (ops) => {
          operaciones = ops;
          return { upsertedCount: 1, modifiedCount: 0 };
        },
      };
    },
  };
  const ahora = new Date("2026-10-04T12:00:00Z");
  const evento = normalizarEvento({ nombre: "Halloween", desde: "2026-10-31", hasta: "2026-10-31", impacto: "medio" });
  assert.deepEqual(await guardarEventos(db, [evento], ahora), { insertados: 1, actualizados: 0 });
  assert.deepEqual(operaciones[0].updateOne.filter, { _id: "2026-10-31:halloween" });
  assert.equal(operaciones[0].updateOne.upsert, true);
  assert.equal(operaciones[0].updateOne.update.$set.actualizadoEn, ahora);
  assert.equal(operaciones[0].updateOne.update.$set._id, undefined);
  assert.deepEqual(await guardarEventos(db, []), { insertados: 0, actualizados: 0 });
});

test("eventos del día ordenados por impacto y su máximo", () => {
  const eventos = [
    { nombre: "Candlelight", desde: "2026-11-08", hasta: "2026-11-08", impacto: "bajo" },
    { nombre: "Ciudad Libro", desde: "2026-11-05", hasta: "2026-11-12", impacto: "alto" },
    { nombre: "Otro", desde: "2026-11-20", hasta: "2026-11-21", impacto: "muy alto" },
  ];
  const delDia = eventosDelDia(eventos, "2026-11-08");
  assert.deepEqual(delDia.map((e) => e.nombre), ["Ciudad Libro", "Candlelight"]);
  assert.equal(delDia[0].tipo, "evento");
  assert.equal(impactoMaximo(delDia), "alto");
  assert.equal(impactoMaximo([]), null);
});

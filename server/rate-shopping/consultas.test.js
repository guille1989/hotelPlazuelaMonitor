const test = require("node:test");
const assert = require("node:assert/strict");
const { crearConsultas, HORIZONTES_MVP } = require("./consultas");

test("crearConsultas genera los siete horizontes del MVP", () => {
  const consultas = crearConsultas({ fechaBase: "2026-09-27" });
  assert.equal(consultas.length, HORIZONTES_MVP.length);
  assert.deepEqual(consultas[0], {
    offsetDias: 1,
    checkIn: "2026-09-28",
    checkOut: "2026-09-29",
    adultos: 2,
    habitaciones: 1,
    noches: 1,
    moneda: "COP",
    tarifaPublica: true,
  });
  assert.equal(consultas.at(-1).checkIn, "2026-12-26");
  assert.equal(consultas.at(-1).checkOut, "2026-12-27");
});

test("crearConsultas elimina horizontes repetidos y los ordena", () => {
  const consultas = crearConsultas({
    fechaBase: "2026-09-27",
    horizontes: [7, 1, 7, 3],
  });
  assert.deepEqual(
    consultas.map((consulta) => consulta.offsetDias),
    [1, 3, 7]
  );
});

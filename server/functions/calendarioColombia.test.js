const test = require("node:test");
const assert = require("node:assert/strict");
const {
  domingoDePascua,
  esSemanaSanta,
  festivo,
  festivosDelAnio,
  tipoDia,
} = require("./calendarioColombia");

test("calcula el Domingo de Pascua", () => {
  assert.equal(domingoDePascua(2025), "2025-04-20");
  assert.equal(domingoDePascua(2026), "2026-04-05");
  assert.equal(domingoDePascua(2027), "2027-03-28");
});

test("festivos de 2026 con la Ley Emiliani", () => {
  assert.deepEqual(
    [...festivosDelAnio(2026).keys()],
    [
      "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03",
      "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29",
      "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02",
      "2026-11-16", "2026-12-08", "2026-12-25",
    ]
  );
});

test("dos festivos el mismo lunes quedan en una sola fecha", () => {
  const festivos = festivosDelAnio(2025);
  assert.equal(festivos.size, 17);
  assert.equal(festivos.get("2025-06-30"), "Sagrado Corazón / San Pedro y San Pablo");
  assert.equal(festivo("2025-03-24"), "San José");
  assert.equal(festivo("2025-03-19"), null);
});

test("Semana Santa va de Domingo de Ramos a Sábado Santo", () => {
  assert.equal(esSemanaSanta("2026-03-28"), false);
  assert.equal(esSemanaSanta("2026-03-29"), true);
  assert.equal(esSemanaSanta("2026-04-04"), true);
  assert.equal(esSemanaSanta("2026-04-05"), false);
});

test("clasifica las noches de un puente con lunes festivo", () => {
  assert.equal(tipoDia("2026-11-13"), "fin_de_semana"); // viernes
  assert.equal(tipoDia("2026-11-14"), "puente"); // sábado
  assert.equal(tipoDia("2026-11-15"), "puente"); // domingo
  assert.equal(tipoDia("2026-11-16"), "fin_puente"); // lunes festivo
  assert.equal(tipoDia("2026-11-17"), "laboral");
});

test("un festivo viernes arma puente hasta el domingo", () => {
  assert.equal(tipoDia("2026-08-07"), "puente");
  assert.equal(tipoDia("2026-08-08"), "puente");
  assert.equal(tipoDia("2026-08-09"), "fin_puente");
});

test("festivo suelto, Semana Santa y días normales", () => {
  assert.equal(tipoDia("2026-12-08"), "festivo"); // martes
  assert.equal(tipoDia("2026-04-02"), "semana_santa"); // Jueves Santo
  assert.equal(tipoDia("2026-04-05"), "fin_puente"); // Pascua: cierra el bloque jue-dom
  assert.equal(tipoDia("2026-10-14"), "laboral");
  assert.equal(tipoDia("2026-10-17"), "fin_de_semana");
  assert.equal(tipoDia("2026-10-18"), "domingo");
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { elegirFechasCaptura, puntajeFecha } = require("./fechasCaptura");

function par(dia, diasHasta, cambios = {}) {
  const { demanda = "normal", regla = "matriz", tipo = "laboral", impacto = null, competencia = null } = cambios;
  return {
    s: { dia, diasHasta, calendario: { tipo, impactoEventos: impacto }, competencia },
    r: { demanda, regla },
  };
}

test("puntúa cercanía, demanda que depende del precio, puentes y captura reciente", () => {
  assert.equal(puntajeFecha(par("a", 5).s, par("a", 5).r), 3);
  const alta = par("b", 20, { demanda: "alta", tipo: "puente" });
  assert.equal(puntajeFecha(alta.s, alta.r), 2 + 2 + 1);
  const capturada = par("c", 40, { impacto: "alto", competencia: { antiguedadDias: 1 } });
  assert.equal(puntajeFecha(capturada.s, capturada.r), 1 + 1 - 2);
  // Un estimado no cuenta como captura.
  const estimada = par("d", 40, { competencia: { antiguedadDias: 1, estimado: true } });
  assert.equal(puntajeFecha(estimada.s, estimada.r), 1);
});

test("elige 8 noches repartidas, con una ancla en 15–30 y otra en 31–60", () => {
  const pares = [];
  for (let d = 0; d <= 60; d++) {
    const dia = `d${String(d).padStart(2, "0")}`;
    // Demanda alta en la primera semana; lleno el día 4; capturado hace poco el día 2.
    pares.push(
      par(dia, d, {
        demanda: d <= 7 ? "alta" : "normal",
        regla: d === 4 ? "lleno" : "matriz",
        competencia: d === 2 ? { antiguedadDias: 1 } : null,
      })
    );
  }
  const elegidas = elegirFechasCaptura(pares);
  const dias = elegidas.map((e) => e.diasHasta);

  assert.equal(elegidas.length, 8);
  assert.ok(!dias.includes(0), "hoy no se consulta");
  assert.ok(!dias.includes(4), "sin habitaciones libres no se consulta");
  assert.ok(dias.some((d) => d >= 15 && d <= 30));
  assert.ok(dias.some((d) => d >= 31));
  for (let i = 1; i < dias.length; i++) assert.ok(dias[i] - dias[i - 1] >= 2);
  // La semana con demanda alta queda cubierta primero.
  assert.deepEqual(dias.slice(0, 3), [1, 3, 5]);
});

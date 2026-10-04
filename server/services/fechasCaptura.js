// Qué noches consulta la captura semanal de competencia. En vez de horizontes fijos
// (D+1…D+90), las que le sirven al copiloto: cercanas, donde el precio cambia la
// decisión, con puentes o eventos, y sin captura reciente. Mismo presupuesto que
// antes: 6 hoteles × 8 noches = 48 búsquedas por sábado (cuota gratis de SerpApi:
// 250 por ciclo, alcanza para 5 sábados).

const MAX_FECHAS = 8;
const HORIZONTE_DIAS = 60;
// Entre dos noches elegidas, al menos esta distancia: repartidas sirven más para
// estimar las fechas que quedan en medio.
const SEPARACION_MIN_DIAS = 2;
// Al menos una noche en cada tramo, para que las fechas lejanas tengan vecinas con
// qué estimarse.
const TRAMOS_ANCLA = [
  [15, 30],
  [31, 60],
];
const CAPTURA_RECIENTE_DIAS = 14;
const TIPOS_ESPECIALES = new Set(["puente", "fin_puente", "festivo", "semana_santa"]);
const IMPACTOS_FUERTES = new Set(["alto", "muy alto"]);

function puntajeFecha(senal, recomendacion) {
  let puntaje = senal.diasHasta <= 14 ? 3 : senal.diasHasta <= 30 ? 2 : 1;
  // Con demanda alta o baja, la posición del precio cambia lo que se recomienda.
  if (recomendacion.demanda !== "normal") puntaje += 2;
  if (
    TIPOS_ESPECIALES.has(senal.calendario.tipo) ||
    IMPACTOS_FUERTES.has(senal.calendario.impactoEventos)
  ) {
    puntaje += 1;
  }
  const c = senal.competencia;
  if (c && !c.estimado && c.antiguedadDias <= CAPTURA_RECIENTE_DIAS) puntaje -= 2;
  return puntaje;
}

// pares: [{ s: señal, r: recomendación }] del copiloto. Devuelve las noches elegidas
// ({dia, diasHasta, puntaje}) de la más cercana a la más lejana.
function elegirFechasCaptura(pares, { maxFechas = MAX_FECHAS } = {}) {
  const candidatos = pares
    .filter(({ s }) => s.diasHasta >= 1 && s.diasHasta <= HORIZONTE_DIAS)
    // Sin habitaciones libres el precio ya no cambia nada.
    .filter(({ r }) => r.regla !== "lleno" && r.regla !== "lleno_con_cotizacion")
    .map(({ s, r }) => ({ dia: s.dia, diasHasta: s.diasHasta, puntaje: puntajeFecha(s, r) }))
    .sort((a, b) => b.puntaje - a.puntaje || a.diasHasta - b.diasHasta);

  const elegidas = [];
  const separada = (c) =>
    elegidas.every((e) => Math.abs(e.diasHasta - c.diasHasta) >= SEPARACION_MIN_DIAS);

  for (const [desde, hasta] of TRAMOS_ANCLA) {
    const ancla = candidatos.find(
      (c) => c.diasHasta >= desde && c.diasHasta <= hasta && separada(c)
    );
    if (ancla && elegidas.length < maxFechas) elegidas.push(ancla);
  }
  for (const c of candidatos) {
    if (elegidas.length >= maxFechas) break;
    if (!elegidas.includes(c) && separada(c)) elegidas.push(c);
  }
  return elegidas.sort((a, b) => a.diasHasta - b.diasHasta);
}

module.exports = { MAX_FECHAS, elegirFechasCaptura, puntajeFecha };

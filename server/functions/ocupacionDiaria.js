const { hoyBogota } = require("./fechas");
const {
  estaCancelada,
  salidaEfectiva,
  habitaciones,
  filtroTraslape,
} = require("./ocupacion");

// Conceptos de alojamiento en CARGOGENHISTO. 1024 (NO SHOW) se excluye: no es una
// habitación ocupada.
const CONCEPTOS_ALOJAMIENTO = [1020, 1021, 33, 36];

// Ocupación e ingreso por día, HÍBRIDO:
//   día < hoy  -> folio real (colección `noches_vendidas`), cuadra con el trasunto
//   día >= hoy -> proyección desde `reservas` (tarifa planeada)
// Las cancelaciones salen siempre de `reservas` (el folio no las registra).
//
// Devuelve { porDia: Map<dia, {ocupacion, tarifas, habsTarifa, cancelaciones, fuente}>,
//            reservas: [...] }  — reservas se devuelve para que quien llame calcule
//            los agregados por mes de llegada sin volver a consultar.
async function ocupacionPorDia(db, dias) {
  const hoy = hoyBogota();
  const inicio = dias[0];
  const fin = dias[dias.length - 1];

  const porDia = new Map(
    dias.map((d) => [
      d,
      {
        dia: d,
        ocupacion: 0,
        tarifas: 0,
        habsTarifa: 0,
        cancelaciones: 0,
        fuente: "reservas",
      },
    ])
  );

  // --- folio: solo días ya pasados ---
  const cargos = await db
    .collection("noches_vendidas")
    .find({
      fecha: { $gte: inicio, $lte: fin },
      concepto: { $in: CONCEPTOS_ALOJAMIENTO },
    })
    .toArray();

  const habsPorDia = new Map();
  for (const c of cargos) {
    if (!c.fecha || c.fecha >= hoy) continue;
    const d = porDia.get(c.fecha);
    if (!d) continue;
    if (!habsPorDia.has(c.fecha)) habsPorDia.set(c.fecha, new Set());
    habsPorDia.get(c.fecha).add(c.numero_habitacion);
    d.tarifas += c.valor_neto || 0;
    d.fuente = "folio";
  }
  for (const [dia, set] of habsPorDia) {
    const d = porDia.get(dia);
    d.ocupacion = set.size;
    d.habsTarifa = set.size;
  }

  // --- reservas: cancelaciones (siempre) + ocupación/ingreso de hoy en adelante ---
  const reservas = await db
    .collection("reservas")
    .find(filtroTraslape(inicio, fin))
    .toArray();

  for (const r of reservas) {
    const llegada = r.fecha_llegada_habitacion || r.fecha_llegada;
    const salida = salidaEfectiva(r);
    if (!llegada || !salida) continue;
    const cancelada = estaCancelada(r);
    const habs = habitaciones(r);
    const valor = Number(r.valor_habitacion) || 0;

    for (const dia of dias) {
      if (dia < llegada || dia >= salida) continue;
      const d = porDia.get(dia);
      if (cancelada) {
        d.cancelaciones += habs;
      } else if (dia >= hoy) {
        d.ocupacion += habs;
        if (valor > 0) {
          d.tarifas += valor * habs;
          d.habsTarifa += habs;
        }
      }
    }
  }

  return { porDia, reservas };
}

module.exports = { ocupacionPorDia, CONCEPTOS_ALOJAMIENTO };

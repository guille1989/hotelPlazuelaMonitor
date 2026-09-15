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

// "En casa": la reserva tiene check-in hecho (estado 31) o es un walk-in.
const enCasa = (r) => {
  const origen = (r.origen || "").trim().toLowerCase();
  return String(r.estado_habitacion) === "31" || origen === "sin reserva";
};

// Ocupación e ingreso por día, HÍBRIDO:
//   día < hoy  -> folio real (colección `noches_vendidas`), cuadra con el trasunto
//   día >= hoy -> proyección desde `reservas` (tarifa planeada)
// Las cancelaciones salen siempre de `reservas` (el folio no las registra).
//
// Cada día lleva tres cifras de ocupación:
//   ocupacion  -> serie histórica para métricas: folio en el pasado, proyección
//                 (todas las reservas no canceladas) de hoy en adelante. NO cambia.
//   real       -> lo que de verdad ocurrió/ocurre: folio si ya está posteado; si no
//                 (hoy, o "ayer" con la auditoría nocturna pendiente) las
//                 habitaciones con check-in hecho. null en el futuro.
//   proyectada -> de hoy en adelante, todas las reservas no canceladas del día.
//   fuente     -> "folio" (consolidado) | "checkin" (real provisional) | "proyeccion".
//
// Devuelve { porDia: Map<dia, {...}>, reservas: [...] } — reservas se devuelve para
// que quien llame calcule los agregados por mes de llegada sin volver a consultar.
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
        real: null,
        proyectada: null,
        tarifas: 0,
        habsTarifa: 0,
        cancelaciones: 0,
        fuente: "reservas",
        canal: {}, // habitaciones por canal (modo_reserva) ocupando ese día, solo no canceladas
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
    d.real = set.size;
  }

  // Días pasados que TODAVÍA no tienen folio (la auditoría nocturna de Zeus va con
  // 1-2 días de retraso). Para esos días caemos a la proyección desde `reservas`
  // en lugar de reportar 0 — igual que hacemos con hoy y el futuro.
  const sinFolio = (dia) => dia < hoy && !habsPorDia.has(dia);

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
        continue;
      }
      // Mix de canal: independiente del híbrido folio/reservas, así queda disponible
      // también para días pasados que ya tienen folio.
      const modo = r.modo_reserva || "?";
      d.canal[modo] = (d.canal[modo] || 0) + habs;
      if (dia >= hoy || sinFolio(dia)) {
        d.ocupacion += habs;
        if (dia >= hoy) d.proyectada = (d.proyectada || 0) + habs;
        if ((dia === hoy || sinFolio(dia)) && enCasa(r)) {
          d.real = (d.real || 0) + habs;
        }
        if (valor > 0) {
          d.tarifas += valor * habs;
          d.habsTarifa += habs;
        }
      }
    }
  }

  // Etiqueta de fuente por día (los días con folio ya quedaron marcados arriba).
  for (const dia of dias) {
    const d = porDia.get(dia);
    if (d.fuente === "folio") continue;
    d.fuente = dia === hoy || sinFolio(dia) ? "checkin" : "proyeccion";
  }

  // `cargos` se conserva para consumidores operativos que necesitan identificar
  // las habitaciones reales del folio, sin tener que repetir la consulta.
  return { porDia, reservas, cargos };
}

module.exports = { ocupacionPorDia, CONCEPTOS_ALOJAMIENTO, enCasa };

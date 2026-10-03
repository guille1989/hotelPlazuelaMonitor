// Conceptos de alojamiento en Zeus (CARGOGENHISTO / MOVFOLIO). 1024 (NO SHOW) se
// excluye: no es una habitación ocupada.
const CONCEPTOS_ALOJAMIENTO = [1020, 1021, 33, 36];

// Colección que el ETL llena desde MOVFOLIO (todos los movimientos del folio).
const COLECCION_MOVIMIENTOS = "movimientos_alojamiento";

// Ingreso de alojamiento por noche desde `movimientos_alojamiento`.
// A diferencia de `noches_vendidas` (CARGOGENHISTO: solo lo que genera la auditoría
// nocturna), aquí están también los cargos manuales —adicionales, ajustes de tarifa,
// noches cobradas aparte— y las correcciones. Cada movimiento trae el valor con signo
// (crédito negativo), así que traslados y anulaciones se cancelan solos al sumar.
// Las correcciones quedan el día en que se hicieron: Zeus no deja fechas anteriores.
//
// Las habitaciones NO salen de aquí: las de $0 en un cargo de grupo no generan
// movimiento. Se siguen contando desde `noches_vendidas`.
async function ingresoPorDia(db, inicio, fin) {
  const movimientos = await db
    .collection(COLECCION_MOVIMIENTOS)
    .find(
      {
        fecha: { $gte: inicio, $lte: fin },
        concepto: { $in: CONCEPTOS_ALOJAMIENTO },
      },
      { projection: { _id: 0, fecha: 1, valor_neto: 1 } }
    )
    .toArray();

  const porDia = new Map();
  for (const m of movimientos) {
    if (!m.fecha) continue;
    porDia.set(m.fecha, (porDia.get(m.fecha) || 0) + (Number(m.valor_neto) || 0));
  }
  return porDia;
}

module.exports = { CONCEPTOS_ALOJAMIENTO, COLECCION_MOVIMIENTOS, ingresoPorDia };

// Conceptos de alojamiento en Zeus (CARGOGENHISTO / MOVFOLIO). 1024 (NO SHOW) se
// excluye: no es una habitación ocupada.
const CONCEPTOS_ALOJAMIENTO = [1020, 1021, 33, 36];

// Colección que el ETL llena desde MOVFOLIO (todos los movimientos del folio).
const COLECCION_MOVIMIENTOS = "movimientos_alojamiento";

// Ingreso de alojamiento por noche desde `movimientos_alojamiento`: Map<dia, {neto, iva}>.
// A diferencia de `noches_vendidas` (CARGOGENHISTO: solo lo que genera la auditoría
// nocturna), aquí están también los cargos manuales —adicionales, ajustes de tarifa,
// noches cobradas aparte— y las correcciones. Cada movimiento trae el valor con signo
// (crédito negativo), así que traslados y anulaciones se cancelan solos al sumar.
// Las correcciones quedan el día en que se hicieron: Zeus no deja fechas anteriores.
//
// Las habitaciones NO salen de aquí: las de $0 en un cargo de grupo no generan
// movimiento. Se siguen contando desde `noches_vendidas`.
async function alojamientoPorDia(db, inicio, fin) {
  const movimientos = await db
    .collection(COLECCION_MOVIMIENTOS)
    .find(
      {
        fecha: { $gte: inicio, $lte: fin },
        concepto: { $in: CONCEPTOS_ALOJAMIENTO },
      },
      { projection: { _id: 0, fecha: 1, valor_neto: 1, iva: 1 } }
    )
    .toArray();

  const porDia = new Map();
  for (const m of movimientos) {
    if (!m.fecha) continue;
    const dia = porDia.get(m.fecha) || { neto: 0, iva: 0 };
    dia.neto += Number(m.valor_neto) || 0;
    dia.iva += Number(m.iva) || 0;
    porDia.set(m.fecha, dia);
  }
  return porDia;
}

// Solo el neto por día: Map<dia, neto>.
async function ingresoPorDia(db, inicio, fin) {
  const porDia = await alojamientoPorDia(db, inicio, fin);
  return new Map([...porDia].map(([dia, { neto }]) => [dia, neto]));
}

module.exports = {
  CONCEPTOS_ALOJAMIENTO,
  COLECCION_MOVIMIENTOS,
  alojamientoPorDia,
  ingresoPorDia,
};

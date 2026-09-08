const {
  estaCancelada,
  salidaEfectiva,
  habitaciones,
  noches,
} = require("./ocupacion");

function totalesVacios() {
  return {
    nuevas: 0,
    canceladas: 0,
    roomNoches: 0,
    nuevasRoomNoches: 0,
    canceladasRoomNoches: 0,
  };
}

function mesDesplazado(mes, anios) {
  const [anio, numeroMes] = mes.split("-");
  return `${Number(anio) + anios}-${numeroMes}`;
}

function agruparPickup(reservas, { desde, hasta, desplazarAnios = 0 }) {
  const porMes = new Map();
  const totales = totalesVacios();
  let movimientos = 0;

  for (const reserva of reservas) {
    const llegada =
      reserva.fecha_llegada_habitacion || reserva.fecha_llegada;
    const salida = salidaEfectiva(reserva);
    if (!llegada || !salida) continue;

    const nueva =
      reserva.fecha_reserva &&
      reserva.fecha_reserva >= desde &&
      reserva.fecha_reserva <= hasta;
    const cancelada =
      estaCancelada(reserva) &&
      reserva.fecha_cancelacion >= desde &&
      reserva.fecha_cancelacion <= hasta;
    if (!nueva && !cancelada) continue;

    const mes = mesDesplazado(llegada.slice(0, 7), desplazarAnios);
    if (!porMes.has(mes)) porMes.set(mes, { mes, ...totalesVacios() });

    const grupo = porMes.get(mes);
    const habs = habitaciones(reserva);
    const roomNoches = noches(llegada, salida) * habs;

    // Una reserva creada y cancelada en la misma ventana aporta dos movimientos
    // brutos, pero su contribución neta es cero.
    if (nueva) {
      grupo.nuevas += habs;
      grupo.nuevasRoomNoches += roomNoches;
      grupo.roomNoches += roomNoches;
      totales.nuevas += habs;
      totales.nuevasRoomNoches += roomNoches;
      totales.roomNoches += roomNoches;
      movimientos += 1;
    }
    if (cancelada) {
      grupo.canceladas += habs;
      grupo.canceladasRoomNoches += roomNoches;
      grupo.roomNoches -= roomNoches;
      totales.canceladas += habs;
      totales.canceladasRoomNoches += roomNoches;
      totales.roomNoches -= roomNoches;
      movimientos += 1;
    }
  }

  return { porMes, totales, movimientos };
}

function mediana(valores) {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const centro = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2) return ordenados[centro];
  return Math.round((ordenados[centro - 1] + ordenados[centro]) / 2);
}

function compararHistorico(real, valoresHistoricos) {
  const referencia = mediana(valoresHistoricos);
  if (referencia === null) return null;
  const diferencia = real - referencia;
  return {
    referenciaRoomNoches: referencia,
    diferenciaRoomNoches: diferencia,
    diferenciaPct:
      referencia > 0 ? Math.round((diferencia * 100) / referencia) : null,
    muestras: valoresHistoricos.length,
  };
}

function combinarConHistorico(actual, muestrasHistoricas) {
  const disponibles = muestrasHistoricas.filter((muestra) =>
    Boolean(muestra.movimientos)
  );
  const claves = new Set(actual.porMes.keys());
  for (const muestra of disponibles) {
    for (const clave of muestra.porMes.keys()) claves.add(clave);
  }

  const meses = [...claves]
    .sort((a, b) => a.localeCompare(b))
    .map((mes) => {
      const movimientoActual = actual.porMes.get(mes) || {
        mes,
        ...totalesVacios(),
      };
      const valores = disponibles.map(
        (muestra) => muestra.porMes.get(mes)?.roomNoches || 0
      );
      return {
        ...movimientoActual,
        historico: compararHistorico(movimientoActual.roomNoches, valores),
      };
    });

  return {
    meses,
    historico: compararHistorico(
      actual.totales.roomNoches,
      disponibles.map((muestra) => muestra.totales.roomNoches)
    ),
    muestrasDisponibles: disponibles.length,
  };
}

module.exports = {
  agruparPickup,
  combinarConHistorico,
  compararHistorico,
  mesDesplazado,
  totalesVacios,
};

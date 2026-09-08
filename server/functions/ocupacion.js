// Helpers compartidos para calcular ocupación a partir de documentos de `reservas`.

// Contrato: fecha_cancelacion es null (no cancelada) o "YYYY-MM-DD".
// El .startsWith("1900") queda por compatibilidad con docs viejos con el centinela.
function estaCancelada(doc) {
  return !!doc.fecha_cancelacion && !doc.fecha_cancelacion.startsWith("1900");
}

// Salida efectiva: si fecha_ult_mod es posterior a la salida, la estancia se extendió.
function salidaEfectiva(reserva) {
  const salida = reserva.fecha_salida_habitacion || reserva.fecha_salida;
  if (reserva.fecha_ult_mod && reserva.fecha_ult_mod > salida) {
    return reserva.fecha_ult_mod;
  }
  return salida;
}

// Habitaciones que aporta una reserva a un día (walk-in = 1).
function habitaciones(reserva) {
  const origen = (reserva.origen || "").trim().toLowerCase();
  if (origen === "sin reserva") return 1;
  return reserva.cantid_reh > 0 ? reserva.cantid_reh : 1;
}

// Noches entre dos fechas "YYYY-MM-DD" (0 si son inválidas o invertidas).
function noches(llegada, salida) {
  if (!llegada || !salida) return 0;
  const n = Math.round(
    (Date.parse(`${salida}T00:00:00Z`) - Date.parse(`${llegada}T00:00:00Z`)) /
      86400000
  );
  return n > 0 ? n : 0;
}

// Filtro Mongo: reservas cuya estancia se traslapa con [inicio, fin] (strings YYYY-MM-DD).
function filtroTraslape(inicio, fin) {
  return {
    $or: [
      {
        fecha_llegada_habitacion: { $lte: fin },
        fecha_salida_habitacion: { $gt: inicio },
      },
      {
        fecha_llegada_habitacion: null,
        fecha_llegada: { $lte: fin },
        fecha_salida: { $gt: inicio },
      },
    ],
  };
}

module.exports = {
  estaCancelada,
  salidaEfectiva,
  habitaciones,
  filtroTraslape,
  noches,
};

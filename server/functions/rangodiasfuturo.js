// utils/fechasBogota.js

/**
 * Retorna un rango UTC para consultar en Mongo, interpretando el rango en zona horaria Bogotá.
 * @param {number} dias Número de días desde hoy (por ejemplo, 30)
 * @returns {{ inicioUtc: Date, finUtc: Date }}
 */
function getBogotaUtcRangoDesdeHoy(dias) {
  const ahora = new Date();

  // Bogotá timezone offset, compensando por posibles DST (aunque Bogotá no usa DST)
  const offsetMinutos = ahora.getTimezoneOffset(); // en minutos respecto a UTC

  // Crear fecha local a medianoche (00:00) en Bogotá
  const hoyLocal = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate(),
    0,
    0,
    0,
    0
  );

  // inicioUtc es la hora UTC correspondiente a las 00:00 hora local
  const inicioUtc = new Date(hoyLocal.getTime() + offsetMinutos * 60000);

  // Fecha final en hora local: +dias a las 23:59:59.999
  const finLocal = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate() + dias,
    23,
    59,
    59,
    999
  );
  const finUtc = new Date(finLocal.getTime() + offsetMinutos * 60000);

  return { inicioUtc, finUtc };
}

function getBogotaUtcRangoEntreFechasRelativas(diasAtras, diasFin) {
  const hoy = new Date();
  const offsetBogota = -5 * 60; // UTC-5 Bogotá

  const fechaInicioBogota = new Date(
    Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate(), 0, 0, 0)
  );
  fechaInicioBogota.setUTCMinutes(
    fechaInicioBogota.getUTCMinutes() - offsetBogota
  );
  fechaInicioBogota.setUTCDate(fechaInicioBogota.getUTCDate() - diasAtras);

  const fechaFinBogota = new Date(fechaInicioBogota);
  fechaFinBogota.setUTCDate(
    fechaFinBogota.getUTCDate() + (diasAtras - diasFin)
  );

  const inicioUtc = new Date(fechaInicioBogota);
  inicioUtc.setUTCHours(5, 0, 0, 0); // Bogotá 00:00

  const finUtc = new Date(fechaFinBogota);
  finUtc.setUTCHours(4, 59, 59, 999); // Bogotá 23:59:59.999

  return { inicioUtc, finUtc };
}

module.exports = {
  getBogotaUtcRangoDesdeHoy,
  getBogotaUtcRangoEntreFechasRelativas,
};

// utils/fechasBogota.js

/**
 * Retorna un rango UTC para consultar en Mongo, interpretando el rango en zona horaria Bogotá.
 * @param {number} dias Número de días desde hoy (por ejemplo, 30)
 * @returns {{ inicioUtc: Date, finUtc: Date }}
 */
function getBogotaUtcRangoDesdeHoy(dias) {
    const ahora = new Date();
    const offsetBogota = -5 * 60; // Bogotá = UTC-5, en minutos
  
    // Hoy en Bogotá (00:00), ajustado a UTC
    const hoyBogota = new Date(
      Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), 0, 0, 0)
    );
    hoyBogota.setUTCMinutes(hoyBogota.getUTCMinutes() - offsetBogota);
  
    // Inicio: Bogotá 00:00 UTC
    const inicioUtc = new Date(hoyBogota);
    inicioUtc.setUTCHours(5, 0, 0, 0); // Bogotá 00:00 → UTC+5
  
    // Fin: Bogotá +dias a las 23:59:59.999 (UTC+5)
    const finBogota = new Date(hoyBogota);
    finBogota.setUTCDate(finBogota.getUTCDate() + dias);
  
    const finUtc = new Date(finBogota);
    finUtc.setUTCHours(4, 59, 59, 999); // Bogotá 23:59:59.999 → UTC+5
  
    return { inicioUtc, finUtc };
  }
  
  function getBogotaUtcRangoEntreFechasRelativas(diasAtras, diasFin) {
    const hoy = new Date();
    const offsetBogota = -5 * 60; // UTC-5 Bogotá
  
    const fechaInicioBogota = new Date(
      Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate(), 0, 0, 0)
    );
    fechaInicioBogota.setUTCMinutes(fechaInicioBogota.getUTCMinutes() - offsetBogota);
    fechaInicioBogota.setUTCDate(fechaInicioBogota.getUTCDate() - diasAtras);
  
    const fechaFinBogota = new Date(fechaInicioBogota);
    fechaFinBogota.setUTCDate(fechaFinBogota.getUTCDate() + (diasAtras - diasFin));
  
    const inicioUtc = new Date(fechaInicioBogota);
    inicioUtc.setUTCHours(5, 0, 0, 0); // Bogotá 00:00
  
    const finUtc = new Date(fechaFinBogota);
    finUtc.setUTCHours(4, 59, 59, 999); // Bogotá 23:59:59.999
  
    return { inicioUtc, finUtc };
  }
  
  module.exports = {
    getBogotaUtcRangoDesdeHoy,
    getBogotaUtcRangoEntreFechasRelativas
  };
  
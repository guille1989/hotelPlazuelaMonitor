const moment = require("moment-timezone");

const TZ = "America/Bogota";

// "hoy" en Bogotá como "YYYY-MM-DD".
const hoyBogota = () => moment().tz(TZ).format("YYYY-MM-DD");

// "YYYY-MM-DD" desplazado `offsetDias` desde hoy (Bogotá). Negativo = pasado.
const fechaBogota = (offsetDias) =>
  moment().tz(TZ).add(offsetDias, "day").format("YYYY-MM-DD");

// Array de "YYYY-MM-DD" desde `offsetDesde` hasta `offsetHasta` inclusive.
function rangoDias(offsetDesde, offsetHasta) {
  const dias = [];
  const paso = offsetDesde <= offsetHasta ? 1 : -1;
  for (
    let i = offsetDesde;
    paso > 0 ? i <= offsetHasta : i >= offsetHasta;
    i += paso
  ) {
    dias.push(fechaBogota(i));
  }
  return dias;
}

module.exports = { TZ, hoyBogota, fechaBogota, rangoDias };

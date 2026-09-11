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

// "YYYY-MM" del mes actual en Bogotá.
const mesActualBogota = () => moment().tz(TZ).format("YYYY-MM");

// Array de "YYYY-MM-DD" con todos los días del mes. `mes` es 1-12.
function diasDelMes(anio, mes) {
  const ultimo = new Date(anio, mes, 0).getDate(); // día 0 del mes siguiente
  const mm = String(mes).padStart(2, "0");
  const dias = [];
  for (let d = 1; d <= ultimo; d++) {
    dias.push(`${anio}-${mm}-${String(d).padStart(2, "0")}`);
  }
  return dias;
}

// Array de "YYYY-MM" empezando en `mes` ("YYYY-MM"), `cantidad` meses (incluye `mes`).
function mesesSiguientes(mes, cantidad) {
  const [anioIni, mesIni] = mes.split("-").map(Number);
  const lista = [];
  for (let i = 0; i < cantidad; i++) {
    const total = (mesIni - 1) + i;
    const anio = anioIni + Math.floor(total / 12);
    const numeroMes = (total % 12) + 1;
    lista.push(`${anio}-${String(numeroMes).padStart(2, "0")}`);
  }
  return lista;
}

module.exports = {
  TZ,
  hoyBogota,
  fechaBogota,
  rangoDias,
  mesActualBogota,
  diasDelMes,
  mesesSiguientes,
};

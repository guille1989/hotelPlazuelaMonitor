// Calendario de demanda: festivos de Colombia (Ley 51 de 1983, "Ley Emiliani"),
// puentes y Semana Santa. Fechas como "YYYY-MM-DD" con componentes UTC.

const DIA_MS = 86400000;
const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const aFecha = (dia) => new Date(`${dia}T00:00:00Z`);
const aTexto = (fecha) => fecha.toISOString().slice(0, 10);
const sumarDias = (dia, n) => aTexto(new Date(aFecha(dia).getTime() + n * DIA_MS));
const diaSemana = (dia) => aFecha(dia).getUTCDay();

// Domingo de Pascua (algoritmo anónimo gregoriano).
function domingoDePascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// Ley Emiliani: el festivo que no cae en lunes se pasa al lunes siguiente.
function alLunes(dia) {
  const dow = diaSemana(dia);
  return dow === 1 ? dia : sumarDias(dia, (8 - dow) % 7);
}

// Map<"YYYY-MM-DD", nombre> con los 18 festivos del año.
function festivosDelAnio(anio) {
  const fija = (mmdd) => `${anio}-${mmdd}`;
  const pascua = domingoDePascua(anio);
  const lista = [
    [fija("01-01"), "Año Nuevo"],
    [alLunes(fija("01-06")), "Reyes Magos"],
    [alLunes(fija("03-19")), "San José"],
    [sumarDias(pascua, -3), "Jueves Santo"],
    [sumarDias(pascua, -2), "Viernes Santo"],
    [fija("05-01"), "Día del Trabajo"],
    [alLunes(sumarDias(pascua, 39)), "Ascensión"],
    [alLunes(sumarDias(pascua, 60)), "Corpus Christi"],
    [alLunes(sumarDias(pascua, 68)), "Sagrado Corazón"],
    [alLunes(fija("06-29")), "San Pedro y San Pablo"],
    [fija("07-20"), "Independencia"],
    [fija("08-07"), "Batalla de Boyacá"],
    [alLunes(fija("08-15")), "Asunción"],
    [alLunes(fija("10-12")), "Día de la Raza"],
    [alLunes(fija("11-01")), "Todos los Santos"],
    [alLunes(fija("11-11")), "Independencia de Cartagena"],
    [fija("12-08"), "Inmaculada Concepción"],
    [fija("12-25"), "Navidad"],
  ];
  // Dos festivos pueden caer el mismo lunes (2025: Sagrado Corazón y San Pedro).
  const festivos = new Map();
  for (const [dia, nombre] of lista) {
    festivos.set(dia, festivos.has(dia) ? `${festivos.get(dia)} / ${nombre}` : nombre);
  }
  return festivos;
}

const cacheFestivos = new Map();
function festivo(dia) {
  const anio = Number(dia.slice(0, 4));
  if (!cacheFestivos.has(anio)) cacheFestivos.set(anio, festivosDelAnio(anio));
  return cacheFestivos.get(anio).get(dia) || null;
}

const noLaborable = (dia) => diaSemana(dia) === 0 || diaSemana(dia) === 6 || festivo(dia) !== null;

// Noches de Semana Santa: de Domingo de Ramos al Sábado Santo. La noche del Domingo
// de Pascua ya es salida.
function esSemanaSanta(dia) {
  const pascua = domingoDePascua(Number(dia.slice(0, 4)));
  return dia >= sumarDias(pascua, -7) && dia < pascua;
}

// Tipo de noche para el copiloto. El hotel es de semana (corporativo), así que lo
// que importa es si esa noche hay trabajo al día siguiente:
//   semana_santa -> Ramos a Sábado Santo (prioridad sobre todo lo demás)
//   puente       -> noche dentro de un bloque de 3+ días no laborables, salvo la última
//   fin_puente   -> última noche del bloque (lunes festivo): se comporta como domingo
//   festivo      -> festivo suelto entre semana
//   laboral      -> lunes a jueves
//   fin_de_semana-> viernes y sábado
//   domingo
function tipoDia(dia) {
  if (esSemanaSanta(dia)) return "semana_santa";
  if (noLaborable(dia)) {
    let inicio = dia;
    while (noLaborable(sumarDias(inicio, -1))) inicio = sumarDias(inicio, -1);
    let fin = dia;
    while (noLaborable(sumarDias(fin, 1))) fin = sumarDias(fin, 1);
    const largo = Math.round((aFecha(fin) - aFecha(inicio)) / DIA_MS) + 1;
    if (largo >= 3) return dia === fin ? "fin_puente" : "puente";
    if (festivo(dia)) return "festivo";
  }
  const dow = diaSemana(dia);
  if (dow === 0) return "domingo";
  if (dow === 5 || dow === 6) return "fin_de_semana";
  return "laboral";
}

module.exports = {
  DIAS_SEMANA,
  diaSemana,
  domingoDePascua,
  esSemanaSanta,
  festivo,
  festivosDelAnio,
  sumarDias,
  tipoDia,
};

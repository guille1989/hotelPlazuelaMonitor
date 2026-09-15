const moment = require("moment-timezone");
const { hoyBogota } = require("../functions/fechas");
const {
  CONCEPTOS_ALOJAMIENTO,
} = require("../functions/ocupacionDiaria");
const { TOTAL_HABITACIONES } = require("../functions/objetivoPickup");
const { RE_MES } = require("./ocupacionMes");

const MAX_MESES = 24;
const FORMATO_MES = "YYYY-MM";
const FORMATO_FECHA = "YYYY-MM-DD";
const redondear = (valor) => Math.round(Number(valor) || 0);

function mesesEntre(desdeMes, hastaMes) {
  if (!RE_MES.test(desdeMes || "") || !RE_MES.test(hastaMes || "")) {
    const error = new Error("Los meses deben tener formato YYYY-MM");
    error.codigo = "MES_INVALIDO";
    throw error;
  }

  const inicio = moment.utc(`${desdeMes}-01`, FORMATO_FECHA, true);
  const fin = moment.utc(`${hastaMes}-01`, FORMATO_FECHA, true);
  if (fin.isBefore(inicio)) {
    const error = new Error("El mes inicial no puede ser posterior al final");
    error.codigo = "RANGO_MESES_INVALIDO";
    throw error;
  }

  const cantidad = fin.diff(inicio, "months") + 1;
  if (cantidad > MAX_MESES) {
    const error = new Error(`La comparación no puede superar ${MAX_MESES} meses`);
    error.codigo = "RANGO_MESES_MUY_LARGO";
    throw error;
  }

  return Array.from({ length: cantidad }, (_, indice) =>
    inicio.clone().add(indice, "months").format(FORMATO_MES)
  );
}

function mayorPorIngreso(meses) {
  return meses
    .filter((mes) => mes.estado !== "futuro" && mes.ingresoCOP > 0)
    .reduce(
      (mayor, mes) => (!mayor || mes.ingresoCOP > mayor.ingresoCOP ? mes : mayor),
      null
    );
}

async function obtenerFacturacionMensual(
  db,
  desdeMes,
  hastaMes,
  opciones = {}
) {
  const claves = mesesEntre(desdeMes, hastaMes);
  const hoy = opciones.hoy || hoyBogota();
  const ayer = moment.utc(hoy, FORMATO_FECHA, true).subtract(1, "day");
  const inicioConsulta = `${desdeMes}-01`;
  const finSolicitado = moment
    .utc(`${hastaMes}-01`, FORMATO_FECHA, true)
    .endOf("month");
  const finConsulta = moment.min(finSolicitado, ayer).format(FORMATO_FECHA);

  let cargos = [];
  if (finConsulta >= inicioConsulta) {
    cargos = await db
      .collection("noches_vendidas")
      .find({
        fecha: { $gte: inicioConsulta, $lte: finConsulta },
        concepto: { $in: CONCEPTOS_ALOJAMIENTO },
      })
      .toArray();
  }

  const acumulados = new Map(
    claves.map((mes) => [
      mes,
      { ingreso: 0, habitacionesNoche: new Set() },
    ])
  );
  for (const cargo of cargos) {
    const mes = String(cargo.fecha || "").slice(0, 7);
    const acumulado = acumulados.get(mes);
    if (!acumulado || !cargo.fecha || cargo.fecha >= hoy) continue;
    acumulado.ingreso += Number(cargo.valor_neto) || 0;
    if (cargo.numero_habitacion !== null && cargo.numero_habitacion !== undefined) {
      const numero = String(cargo.numero_habitacion).trim();
      if (numero) acumulado.habitacionesNoche.add(`${cargo.fecha}|${numero}`);
    }
  }

  const meses = claves.map((mes) => {
    const inicio = moment.utc(`${mes}-01`, FORMATO_FECHA, true);
    const fin = inicio.clone().endOf("month");
    const esFuturo = !inicio.isBefore(moment.utc(hoy, FORMATO_FECHA, true));
    const esParcial = !esFuturo && !fin.isBefore(moment.utc(hoy, FORMATO_FECHA, true));
    const ultimoContabilizado = esParcial ? ayer : fin;
    const diasContabilizados = esFuturo
      ? 0
      : ultimoContabilizado.diff(inicio, "days") + 1;
    const capacidadRoomNoches = diasContabilizados * TOTAL_HABITACIONES;
    const acumulado = acumulados.get(mes);
    const habitacionesNoche = acumulado.habitacionesNoche.size;
    const ingresoCOP = redondear(acumulado.ingreso);

    return {
      mes,
      estado: esFuturo ? "futuro" : esParcial ? "parcial" : "cerrado",
      fechaCorte: esParcial ? ayer.format(FORMATO_FECHA) : null,
      diasContabilizados,
      ingresoCOP,
      habitacionesNoche,
      ocupacionPct: capacidadRoomNoches
        ? redondear((habitacionesNoche * 100) / capacidadRoomNoches)
        : null,
      adrCOP: habitacionesNoche
        ? redondear(ingresoCOP / habitacionesNoche)
        : null,
      revParCOP: capacidadRoomNoches
        ? redondear(ingresoCOP / capacidadRoomNoches)
        : null,
    };
  });

  const porAnio = {};
  for (const anio of [...new Set(claves.map((mes) => mes.slice(0, 4)))]) {
    porAnio[anio] = mayorPorIngreso(
      meses.filter((mes) => mes.mes.startsWith(`${anio}-`))
    );
  }

  return {
    desdeMes,
    hastaMes,
    fechaCorte: ayer.format(FORMATO_FECHA),
    fuente: "noches_vendidas.valor_neto (solo alojamiento)",
    criterio: "facturación real; no incluye proyecciones de reservas",
    mayorGeneral: mayorPorIngreso(meses),
    mayorMesCerrado: mayorPorIngreso(
      meses.filter((mes) => mes.estado === "cerrado")
    ),
    porAnio,
    meses,
  };
}

module.exports = {
  MAX_MESES,
  mesesEntre,
  mayorPorIngreso,
  obtenerFacturacionMensual,
};

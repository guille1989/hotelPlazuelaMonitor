const { TOTAL_HABITACIONES } = require("../functions/objetivoPickup");
const { obtenerOcupacionMes, RE_MES } = require("./ocupacionMes");

const ESCENARIOS_OCUPACION = [70, 75, 80, 85, 90, 100];
const redondear = (valor) => Math.round(Number(valor) || 0);

function calcularMetaIngresos(datos, metaIngresoCOP) {
  const meta = Number(metaIngresoCOP);
  if (!Number.isFinite(meta) || meta <= 0) {
    const error = new Error("La meta de ingresos debe ser un número positivo");
    error.codigo = "META_INGRESOS_INVALIDA";
    throw error;
  }

  const capacidadRoomNoches = datos.dias.length * TOTAL_HABITACIONES;
  const ocupadasRoomNoches = datos.dias.reduce(
    (total, dia) => total + (Number(dia.ocupacion) || 0),
    0
  );
  const habitacionesConTarifa = datos.dias.reduce(
    (total, dia) => total + (Number(dia.habsTarifa) || 0),
    0
  );
  const ingresoRegistradoProyectadoCOP = datos.dias.reduce(
    (total, dia) => total + (Number(dia.tarifas) || 0),
    0
  );
  const adrActualCOP = habitacionesConTarifa
    ? ingresoRegistradoProyectadoCOP / habitacionesConTarifa
    : 0;
  const ingresoFaltanteCOP = Math.max(
    0,
    meta - ingresoRegistradoProyectadoCOP
  );
  const roomNochesDisponibles = Math.max(
    0,
    capacidadRoomNoches - ocupadasRoomNoches
  );
  const ocupacionActualPct = capacidadRoomNoches
    ? (ocupadasRoomNoches * 100) / capacidadRoomNoches
    : 0;
  const ocupacionRequeridaConAdrActualPct =
    capacidadRoomNoches && adrActualCOP
      ? (meta * 100) / (capacidadRoomNoches * adrActualCOP)
      : null;
  const roomNochesRequeridasConAdrActual = adrActualCOP
    ? Math.ceil(meta / adrActualCOP)
    : null;
  const roomNochesAdicionalesConAdrActual =
    roomNochesRequeridasConAdrActual === null
      ? null
      : Math.max(0, roomNochesRequeridasConAdrActual - ocupadasRoomNoches);

  return {
    hotel: { habitaciones: TOTAL_HABITACIONES },
    mes: datos.mes,
    fechaCorte: datos.hoy,
    meta: {
      ingresoCOP: redondear(meta),
      revParRequeridoCOP: capacidadRoomNoches
        ? redondear(meta / capacidadRoomNoches)
        : null,
    },
    situacionRegistradaProyectada: {
      capacidadRoomNoches,
      ocupadasRoomNoches,
      roomNochesDisponibles,
      ocupacionPct: redondear(ocupacionActualPct),
      ingresoCOP: redondear(ingresoRegistradoProyectadoCOP),
      ingresoFaltanteCOP: redondear(ingresoFaltanteCOP),
      adrCOP: redondear(adrActualCOP),
      adrNecesarioManteniendoOcupacionCOP: ocupadasRoomNoches
        ? redondear(meta / ocupadasRoomNoches)
        : null,
      tarifaMediaNecesariaEnDisponiblesCOP:
        ingresoFaltanteCOP > 0 && roomNochesDisponibles > 0
          ? redondear(ingresoFaltanteCOP / roomNochesDisponibles)
          : null,
      ocupacionRequeridaManteniendoAdrPct:
        ocupacionRequeridaConAdrActualPct === null
          ? null
          : redondear(ocupacionRequeridaConAdrActualPct),
      roomNochesAdicionalesManteniendoAdr:
        roomNochesAdicionalesConAdrActual,
      porcentajeDisponiblesAVenderManteniendoAdr:
        roomNochesAdicionalesConAdrActual === null || !roomNochesDisponibles
          ? null
          : redondear(
              (roomNochesAdicionalesConAdrActual * 100) /
                roomNochesDisponibles
            ),
      metaPosibleManteniendoAdr:
        ocupacionRequeridaConAdrActualPct !== null &&
        ocupacionRequeridaConAdrActualPct <= 100,
    },
    escenarios: ESCENARIOS_OCUPACION.map((ocupacionPct) => {
      const roomNochesTeoricas =
        (capacidadRoomNoches * ocupacionPct) / 100;
      const roomNochesObjetivo = Math.ceil(roomNochesTeoricas);
      const roomNochesAdicionales = Math.max(
        0,
        roomNochesObjetivo - ocupadasRoomNoches
      );
      return {
        ocupacionPct,
        roomNochesObjetivo,
        roomNochesAdicionales,
        porcentajeDisponiblesAVender: roomNochesDisponibles
          ? redondear((roomNochesAdicionales * 100) / roomNochesDisponibles)
          : null,
        adrPromedioTotalRequeridoCOP: roomNochesTeoricas
          ? redondear(meta / roomNochesTeoricas)
          : null,
        tarifaMediaNuevasVentasCOP:
          ingresoFaltanteCOP > 0 && roomNochesAdicionales > 0
            ? redondear(ingresoFaltanteCOP / roomNochesAdicionales)
            : null,
      };
    }),
  };
}

async function obtenerPlanMetaIngresos(db, mes, metaIngresoCOP) {
  if (!RE_MES.test(mes || "")) {
    const error = new Error("El mes debe tener formato YYYY-MM");
    error.codigo = "MES_INVALIDO";
    throw error;
  }
  const datos = await obtenerOcupacionMes(db, mes);
  return calcularMetaIngresos(datos, metaIngresoCOP);
}

module.exports = {
  ESCENARIOS_OCUPACION,
  calcularMetaIngresos,
  obtenerPlanMetaIngresos,
};

const { diasDelMes } = require("./fechas");
const { ocupacionPorDia } = require("./ocupacionDiaria");
const {
  estaCancelada,
  salidaEfectiva,
  habitaciones,
} = require("./ocupacion");

const TOTAL_HABITACIONES = 29;

function calcularObjetivoMes(mes, dias, porDia, objetivoPct) {
  const capacidadRoomNoches = dias.length * TOTAL_HABITACIONES;
  const ocupadasRoomNoches = dias.reduce(
    (total, dia) => total + (porDia.get(dia)?.ocupacion || 0),
    0
  );
  const objetivoRoomNoches = Math.ceil(
    (capacidadRoomNoches * objetivoPct) / 100
  );
  const faltantesRoomNoches = Math.max(
    0,
    objetivoRoomNoches - ocupadasRoomNoches
  );

  return {
    mes,
    objetivoPct,
    ocupacionPct: capacidadRoomNoches
      ? Math.round((ocupadasRoomNoches * 100) / capacidadRoomNoches)
      : 0,
    capacidadRoomNoches,
    ocupadasRoomNoches,
    objetivoRoomNoches,
    faltantesRoomNoches,
    alcanzado: faltantesRoomNoches === 0,
  };
}

function desplazarMes(mes, anios) {
  const [anio, numeroMes] = mes.split("-");
  return `${Number(anio) + anios}-${numeroMes}`;
}

function ocupacionHistoricaAlCorte(reservas, dias, porDiaFinal, fechaCorte) {
  let roomNoches = 0;

  for (const dia of dias) {
    // Igual que la ocupación actual: noches anteriores al corte ya son reales;
    // desde el día del corte se usa lo que estaba reservado en ese momento.
    if (dia < fechaCorte) {
      roomNoches += porDiaFinal.get(dia)?.ocupacion || 0;
      continue;
    }

    for (const reserva of reservas) {
      const llegada =
        reserva.fecha_llegada_habitacion || reserva.fecha_llegada;
      const salida = salidaEfectiva(reserva);
      if (!llegada || !salida || dia < llegada || dia >= salida) continue;
      if (!reserva.fecha_reserva || reserva.fecha_reserva > fechaCorte) continue;

      const canceladaAntesDelCorte =
        estaCancelada(reserva) && reserva.fecha_cancelacion <= fechaCorte;
      if (!canceladaAntesDelCorte) roomNoches += habitaciones(reserva);
    }
  }

  return roomNoches;
}

function calcularMetaRitmo(objetivo, historico) {
  if (!objetivo || !historico || historico.finalRoomNoches <= 0) return null;
  const proporcion = Math.min(
    1,
    Math.max(0, historico.alCorteRoomNoches / historico.finalRoomNoches)
  );
  const metaHoyRoomNoches = Math.ceil(
    objetivo.objetivoRoomNoches * proporcion
  );
  const faltantesHoyRoomNoches = Math.max(
    0,
    metaHoyRoomNoches - objetivo.ocupadasRoomNoches
  );

  return {
    referenciaMes: historico.mes,
    proporcionHistoricaPct: Math.round(proporcion * 100),
    metaHoyRoomNoches,
    metaHoyPct: objetivo.capacidadRoomNoches
      ? Math.round((metaHoyRoomNoches * 100) / objetivo.capacidadRoomNoches)
      : 0,
    faltantesHoyRoomNoches,
    diferenciaHoyRoomNoches:
      objetivo.ocupadasRoomNoches - metaHoyRoomNoches,
    enRitmo: faltantesHoyRoomNoches === 0,
  };
}

function evaluarRitmo({ roomNoches, historico, objetivo }) {
  if (!objetivo) return null;
  if (objetivo.alcanzado) {
    return { codigo: "objetivo_alcanzado", etiqueta: "Objetivo alcanzado" };
  }
  if (objetivo.ritmo) {
    if (objetivo.ritmo.enRitmo) {
      return { codigo: "ritmo_favorable", etiqueta: "Buen ritmo" };
    }
    if (
      objetivo.ritmo.metaHoyRoomNoches > 0 &&
      objetivo.ocupadasRoomNoches / objetivo.ritmo.metaHoyRoomNoches < 0.8
    ) {
      return { codigo: "ritmo_insuficiente", etiqueta: "Ritmo insuficiente" };
    }
    return { codigo: "atencion", etiqueta: "Atención" };
  }
  if (!historico) {
    return { codigo: "sin_referencia", etiqueta: "Sin referencia histórica" };
  }
  if (roomNoches > 0 && historico.diferenciaRoomNoches >= 0) {
    return { codigo: "ritmo_favorable", etiqueta: "Buen ritmo" };
  }
  if (
    historico.referenciaRoomNoches > 0 &&
    historico.diferenciaPct !== null &&
    historico.diferenciaPct <= -20
  ) {
    return { codigo: "ritmo_insuficiente", etiqueta: "Ritmo insuficiente" };
  }
  return { codigo: "atencion", etiqueta: "Atención" };
}

async function objetivosPickup(
  db,
  meses,
  objetivoPct,
  hoy,
  fechaCorteHistorica
) {
  const mesActual = hoy.slice(0, 7);
  const claves = [
    ...new Set(meses.map((item) => item.mes).filter((mes) => mes >= mesActual)),
  ].sort((a, b) => a.localeCompare(b));
  if (!claves.length) {
    return { porMes: new Map(), resumen: null };
  }

  const diasPorMes = new Map(
    claves.map((mes) => {
      const [anio, numeroMes] = mes.split("-").map(Number);
      return [mes, diasDelMes(anio, numeroMes)];
    })
  );
  const todosLosDias = claves.flatMap((mes) => diasPorMes.get(mes));
  const { porDia } = await ocupacionPorDia(db, todosLosDias);
  let datosHistoricos = null;

  if (fechaCorteHistorica) {
    const diasHistoricosPorMes = new Map(
      claves.map((mes) => {
        const referenciaMes = desplazarMes(mes, -1);
        const [anio, numeroMes] = referenciaMes.split("-").map(Number);
        return [mes, diasDelMes(anio, numeroMes)];
      })
    );
    const diasHistoricos = claves.flatMap((mes) =>
      diasHistoricosPorMes.get(mes)
    );
    const historico = await ocupacionPorDia(db, diasHistoricos);
    datosHistoricos = { ...historico, diasHistoricosPorMes };
  }

  const porMes = new Map();
  for (const mes of claves) {
    const objetivo = calcularObjetivoMes(
      mes,
      diasPorMes.get(mes),
      porDia,
      objetivoPct
    );
    if (datosHistoricos) {
      const diasHistoricos = datosHistoricos.diasHistoricosPorMes.get(mes);
      const historico = {
        mes: desplazarMes(mes, -1),
        finalRoomNoches: diasHistoricos.reduce(
          (total, dia) => total + (datosHistoricos.porDia.get(dia)?.ocupacion || 0),
          0
        ),
        alCorteRoomNoches: ocupacionHistoricaAlCorte(
          datosHistoricos.reservas,
          diasHistoricos,
          datosHistoricos.porDia,
          fechaCorteHistorica
        ),
      };
      objetivo.ritmo = calcularMetaRitmo(objetivo, historico);
    } else {
      objetivo.ritmo = null;
    }
    porMes.set(mes, objetivo);
  }
  const valores = [...porMes.values()];
  const conRitmo = valores.filter((valor) => valor.ritmo);

  return {
    porMes,
    resumen: {
      objetivoPct,
      mesesMostrados: valores.length,
      mesesEvaluados: conRitmo.length,
      mesesEnRitmo: conRitmo.filter((valor) => valor.ritmo.enRitmo).length,
      faltantesRitmoRoomNoches: conRitmo.reduce(
        (total, valor) => total + valor.ritmo.faltantesHoyRoomNoches,
        0
      ),
      faltantesFinalesRoomNoches: valores.reduce(
        (total, valor) => total + valor.faltantesRoomNoches,
        0
      ),
    },
  };
}

module.exports = {
  TOTAL_HABITACIONES,
  calcularObjetivoMes,
  calcularMetaRitmo,
  evaluarRitmo,
  ocupacionHistoricaAlCorte,
  objetivosPickup,
};

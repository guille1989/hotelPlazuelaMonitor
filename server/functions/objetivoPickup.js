const { diasDelMes, mesesSiguientes } = require("./fechas");
const { ocupacionPorDia } = require("./ocupacionDiaria");
const {
  estaCancelada,
  salidaEfectiva,
  habitaciones,
} = require("./ocupacion");

const TOTAL_HABITACIONES = 29;
// Horizonte fijo del semáforo de metas: mes en curso + los 5 siguientes.
const MESES_META = 6;

function diferenciaDias(desde, hasta) {
  return Math.round(
    (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) /
      86400000
  );
}

function objetivoDiarioHabitaciones(objetivoPct) {
  return Math.ceil((TOTAL_HABITACIONES * objetivoPct) / 100);
}

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

// Habitaciones-noche todavía vendibles de aquí a fin de mes: días desde `hoy` en
// adelante, descontando lo que esos días ya tienen ocupado (real o reservado). Los
// días anteriores a hoy que quedaron por debajo del objetivo ya no se pueden recuperar.
function capacidadLibreRestante(dias, porDia, hoy) {
  return dias
    .filter((dia) => dia >= hoy)
    .reduce((total, dia) => {
      const ocupacion = porDia.get(dia)?.ocupacion || 0;
      return total + Math.max(0, TOTAL_HABITACIONES - ocupacion);
    }, 0);
}

// Semáforo de la meta basado solo en el año en curso: no compara contra el año
// anterior, solo contra lo que falta y lo que aún es físicamente posible vender.
// `presionPct` = % de la capacidad libre restante que hace falta vender para llegar
// a la meta; por encima de 100 % ya no es posible alcanzarla con los días que quedan.
function calcularPresionMeta(objetivo, libre) {
  if (objetivo.faltantesRoomNoches <= 0) {
    return {
      presionPct: 0,
      semaforo: { codigo: "meta_alcanzada", etiqueta: "Meta alcanzada" },
    };
  }
  if (libre <= 0) {
    return {
      presionPct: null,
      semaforo: { codigo: "alarma", etiqueta: "Alarma" },
    };
  }
  const presionPct = Math.round((objetivo.faltantesRoomNoches * 100) / libre);
  if (presionPct <= 50) {
    return { presionPct, semaforo: { codigo: "vas_bien", etiqueta: "Vas bien" } };
  }
  if (presionPct <= 100) {
    return { presionPct, semaforo: { codigo: "atencion", etiqueta: "Atención" } };
  }
  return { presionPct, semaforo: { codigo: "alarma", etiqueta: "Alarma" } };
}

function desplazarMes(mes, anios) {
  const [anio, numeroMes] = mes.split("-");
  return `${Number(anio) + anios}-${numeroMes}`;
}

function ocupacionHistoricaAlCorte(reservas, dias, porDiaFinal, fechaCorte) {
  return dias.reduce(
    (total, dia) =>
      total +
      ocupacionDiaHistoricaAlCorte(reservas, dia, porDiaFinal, fechaCorte),
    0
  );
}

function ocupacionDiaHistoricaAlCorte(
  reservas,
  dia,
  porDiaFinal,
  fechaCorte
) {
  // Las noches anteriores al corte ya eran hechos consumados. Para el resto se
  // reconstruye el inventario que seguía activo en la fecha del corte.
  if (dia < fechaCorte) return porDiaFinal.get(dia)?.ocupacion || 0;

  let ocupacion = 0;
  for (const reserva of reservas) {
    const llegada = reserva.fecha_llegada_habitacion || reserva.fecha_llegada;
    const salida = salidaEfectiva(reserva);
    if (!llegada || !salida || dia < llegada || dia >= salida) continue;
    if (!reserva.fecha_reserva || reserva.fecha_reserva > fechaCorte) continue;

    const canceladaAntesDelCorte =
      estaCancelada(reserva) && reserva.fecha_cancelacion <= fechaCorte;
    if (!canceladaAntesDelCorte) ocupacion += habitaciones(reserva);
  }
  return ocupacion;
}

function evaluarObjetivoDia({ habitacionesOcupadas, objetivoHabitaciones, metaHoy }) {
  if (habitacionesOcupadas >= objetivoHabitaciones) {
    return { codigo: "objetivo_alcanzado", etiqueta: "Objetivo alcanzado" };
  }
  if (metaHoy === null || metaHoy === undefined) {
    return { codigo: "sin_referencia", etiqueta: "Sin referencia histórica" };
  }
  if (habitacionesOcupadas >= metaHoy) {
    return { codigo: "ritmo_favorable", etiqueta: "Buen ritmo" };
  }
  if (metaHoy > 0 && habitacionesOcupadas / metaHoy >= 0.8) {
    return { codigo: "atencion", etiqueta: "Atención" };
  }
  return { codigo: "ritmo_insuficiente", etiqueta: "Ritmo insuficiente" };
}

function calcularObjetivoDia({
  fecha,
  habitacionesOcupadas,
  objetivoPct,
  hoy,
  referencia = null,
}) {
  const objetivoHabitaciones = objetivoDiarioHabitaciones(objetivoPct);
  const referenciaValida = referencia && referencia.habitacionesFinales > 0;
  const proporcionHistorica = referenciaValida
    ? Math.min(
        1,
        Math.max(
          0,
          referencia.habitacionesAlCorte / referencia.habitacionesFinales
        )
      )
    : null;
  const metaHoy = referenciaValida
    ? Math.ceil(objetivoHabitaciones * proporcionHistorica)
    : null;
  const evaluacion = evaluarObjetivoDia({
    habitacionesOcupadas,
    objetivoHabitaciones,
    metaHoy,
  });

  return {
    fecha,
    habitacionesOcupadas,
    ocupacionPct: Math.round(
      (habitacionesOcupadas * 100) / TOTAL_HABITACIONES
    ),
    objetivoFinalPct: objetivoPct,
    objetivoFinalHabitaciones: objetivoHabitaciones,
    faltantesObjetivoFinalHabitaciones: Math.max(
      0,
      objetivoHabitaciones - habitacionesOcupadas
    ),
    diasRestantes: diferenciaDias(hoy, fecha),
    metaEsperadaHoyHabitaciones: metaHoy,
    metaEsperadaHoyPct:
      metaHoy === null
        ? null
        : Math.round((metaHoy * 100) / TOTAL_HABITACIONES),
    faltantesMetaEsperadaHoyHabitaciones:
      metaHoy === null ? null : Math.max(0, metaHoy - habitacionesOcupadas),
    referenciaHistorica: referenciaValida
      ? {
          ...referencia,
          proporcionHistoricaPct: Math.round(proporcionHistorica * 100),
        }
      : null,
    evaluacion,
    porDebajoObjetivoFinal: habitacionesOcupadas < objetivoHabitaciones,
    porDebajoRitmoEsperado:
      metaHoy !== null && habitacionesOcupadas < metaHoy,
  };
}

function resumirDias(dias, hoy) {
  const diasEnRiesgo = dias.filter(
    (dia) =>
      dia.fecha >= hoy &&
      dia.diasRestantes <= 14 &&
      dia.porDebajoRitmoEsperado
  );
  return {
    diasBajoObjetivoFinal: dias.filter((dia) => dia.porDebajoObjetivoFinal)
      .length,
    diasBajoRitmoEsperado: dias.filter((dia) => dia.porDebajoRitmoEsperado)
      .length,
    diasProximosEnRiesgo: diasEnRiesgo.length,
    diasSinReferenciaHistorica: dias.filter(
      (dia) => dia.evaluacion.codigo === "sin_referencia"
    ).length,
    diasEnRiesgo,
  };
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
  // El semáforo de metas siempre cubre un horizonte fijo (mes en curso + 5 siguientes),
  // exista o no movimiento de reservas reciente; se le suman los meses con pickup que
  // caigan fuera de ese horizonte para no perder su objetivo/ritmo.
  const clavesFijas = mesesSiguientes(mesActual, MESES_META);
  const clavesConMovimiento = meses
    .map((item) => item.mes)
    .filter((mes) => mes >= mesActual);
  const claves = [...new Set([...clavesFijas, ...clavesConMovimiento])].sort(
    (a, b) => a.localeCompare(b)
  );

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
    const diasMes = diasPorMes.get(mes);
    const objetivo = calcularObjetivoMes(
      mes,
      diasMes,
      porDia,
      objetivoPct
    );
    const libre = capacidadLibreRestante(diasMes, porDia, hoy);
    const presion = calcularPresionMeta(objetivo, libre);
    objetivo.capacidadLibreRestante = libre;
    objetivo.presionPct = presion.presionPct;
    objetivo.semaforo = presion.semaforo;
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
    objetivo.dias = diasMes.map((dia, indice) => {
      let referencia = null;
      if (datosHistoricos) {
        const diaHistorico = datosHistoricos.diasHistoricosPorMes.get(mes)[indice];
        if (diaHistorico) {
          referencia = {
            fecha: diaHistorico,
            habitacionesFinales:
              datosHistoricos.porDia.get(diaHistorico)?.ocupacion || 0,
            habitacionesAlCorte: ocupacionDiaHistoricaAlCorte(
              datosHistoricos.reservas,
              diaHistorico,
              datosHistoricos.porDia,
              fechaCorteHistorica
            ),
          };
        }
      }
      return calcularObjetivoDia({
        fecha: dia,
        habitacionesOcupadas: porDia.get(dia)?.ocupacion || 0,
        objetivoPct,
        hoy,
        referencia,
      });
    });
    objetivo.resumenDiario = resumirDias(objetivo.dias, hoy);
    porMes.set(mes, objetivo);
  }
  const valores = [...porMes.values()];
  const conRitmo = valores.filter((valor) => valor.ritmo);
  const valoresHorizonte = clavesFijas.map((mes) => porMes.get(mes));

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
      mesActual,
      mesActualSemaforo: porMes.get(mesActual)?.semaforo || null,
      // Semáforo de metas del año en curso, sin comparar con el histórico: mes en
      // curso + los 5 siguientes.
      horizonteMeses: MESES_META,
      mesesEnAlarma: valoresHorizonte.filter(
        (valor) => valor.semaforo.codigo === "alarma"
      ).length,
      mesesEnAtencion: valoresHorizonte.filter(
        (valor) => valor.semaforo.codigo === "atencion"
      ).length,
      mesesBien: valoresHorizonte.filter((valor) =>
        ["vas_bien", "meta_alcanzada"].includes(valor.semaforo.codigo)
      ).length,
    },
  };
}

module.exports = {
  TOTAL_HABITACIONES,
  MESES_META,
  objetivoDiarioHabitaciones,
  calcularObjetivoMes,
  capacidadLibreRestante,
  calcularPresionMeta,
  calcularObjetivoDia,
  calcularMetaRitmo,
  evaluarObjetivoDia,
  evaluarRitmo,
  ocupacionDiaHistoricaAlCorte,
  ocupacionHistoricaAlCorte,
  resumirDias,
  objetivosPickup,
};

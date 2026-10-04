const { hoyBogota } = require("../functions/fechas");
const { ocupacionPorDia } = require("../functions/ocupacionDiaria");
const {
  TOTAL_HABITACIONES,
  objetivoDiarioHabitaciones,
} = require("../functions/objetivoPickup");
const {
  estaCancelada,
  salidaEfectiva,
  habitaciones,
  noches,
} = require("../functions/ocupacion");
const {
  DIAS_SEMANA,
  diaSemana,
  festivo,
  sumarDias,
  tipoDia,
} = require("../functions/calendarioColombia");
const { COLECCION_EVENTOS, eventosDelDia, impactoMaximo } = require("./eventosCopiloto");
const { armarTarifasCompetencia } = require("./tarifasCompetencia");
const { COLECCIONES } = require("./rateShopping");

// Señales por día para el copiloto de tarifas (Fase 1): todo lo que el motor de
// reglas necesita para decidir subir / mantener / bajar. Aquí no se decide nada.
// Precios siempre CON IVA, como los publica Booking: `valor_habitacion` de Zeus ya
// es la tarifa final (verificado contra el folio, jul–sep 2026).

const HORIZONTE_DIAS = 60;
// 364 días = 52 semanas: el mismo día de la semana del año pasado (un viernes se
// compara con un viernes, no con la misma fecha).
const DESFASE_ANIO = 364;
const VENTANA_PICKUP = 7;
// Días equivalentes del año pasado para la tarifa histórica: mismo día de la semana
// y mismo tipo de noche, dentro de ±2 semanas (o ±45 días para puentes, festivos y
// Semana Santa, que se mueven de fecha cada año).
const SEMANAS_EQUIVALENTES = 2;
const VENTANA_ESPECIALES = 45;
const TIPOS_ESPECIALES = new Set(["semana_santa", "puente", "fin_puente", "festivo"]);
// Competencia: capturas de las últimas 5 semanas; para cada fecha manda la más reciente.
const DIAS_CAPTURAS = 35;
// Fechas sin captura: se estiman con las dos fechas capturadas más cercanas (antes y
// después) solo si en las dos el precio propio y la mediana coinciden ±10 %. La
// competencia casi no cambia precio por fecha; el precio propio sí (promo de Booking
// en fechas cercanas), y ahí las vecinas no coinciden y no se estima.
const TOLERANCIA_ESTIMADO = 0.1;
const MIN_COMPARABLES_ESTIMADO = 2;
// Piso y techo: lo cobrado por la doble el mismo mes del año pasado, sin el 10 % más
// barato ni el 10 % más caro. Con menos noches que esto no hay rango confiable.
const CLASE_REFERENCIA = "DB";
const PERCENTIL_PISO = 0.1;
const PERCENTIL_TECHO = 0.9;
const MIN_NOCHES_RANGO = 20;
// Por debajo de esto no es una tarifa sino una cortesía o un error de digitación
// (hay dobles a $15.000 en Zeus).
const TARIFA_MINIMA_VALIDA = 50000;
// Reserva con estas habitaciones o más = grupo (tarifa negociada, bloqueo).
const MIN_HABITACIONES_GRUPO = 5;
// Pronóstico. Días del año pasado con esta ocupación final o más estaban topados por
// capacidad: su pickup no dice cuánta demanda había y no se promedian.
const OCUPACION_SATURADA = 27;
// Tendencia: reservas individuales nuevas de los últimos 28 días para los próximos 30,
// este año contra el año pasado. Se aplica su raíz cuadrada (amortiguada), acotada.
// Por ahora solo baja el pronóstico: en las pruebas (mar–sep 2026) nunca pasó de 1,05,
// así que una tendencia al alza no está validada, y pronosticar de más (subir precio y
// quedar vacío) es el error caro.
const VENTANA_TENDENCIA = 28;
const HORIZONTE_TENDENCIA = 30;
const MIN_RESERVAS_TENDENCIA = 10;
const TENDENCIA_MIN = 0.5;
const TENDENCIA_MAX = 1;

// Rangos de tarifa fijados a mano por mes ({_id: "YYYY-MM", piso, techo}).
const COLECCION_RANGOS = "copiloto_rangos";

function diasEntre(desde, hasta) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);
}

function listaDias(desde, cantidad) {
  return Array.from({ length: cantidad }, (_, i) => sumarDias(desde, i));
}

const cubreDia = (r, dia) => {
  const llegada = r.fecha_llegada_habitacion || r.fecha_llegada;
  const salida = salidaEfectiva(r);
  return Boolean(llegada && salida && dia >= llegada && dia < salida);
};

const tarifaValida = (r) => (Number(r.valor_habitacion) || 0) >= TARIFA_MINIMA_VALIDA;

// Estado de Zeus con decena 1 = cotización (11 vigente; 19 anulada, que ya viene
// cancelada). El dashboard la cuenta como ocupación proyectada; aquí se separa porque
// un grupo cotizado puede no confirmar.
const esCotizacion = (r) => String(r.estado_habitacion || "").trim().startsWith("1");

// Habitaciones vigentes de `dia` que todavía son cotización.
function habitacionesCotizadas(reservas, dia) {
  return reservas
    .filter((r) => !estaCancelada(r) && esCotizacion(r) && cubreDia(r, dia))
    .reduce((total, r) => total + habitaciones(r), 0);
}

// Habitaciones que había en libros para `dia` en la fecha `corte`: reservas hechas
// hasta el corte y no canceladas a esa fecha. A diferencia de
// ocupacionDiaHistoricaAlCorte, no cuenta las líneas canceladas el día de llegada o
// después: son bloqueos de grupo que se liberaron (o no-shows), no demanda. La
// Corporación Gastronómica tenía 36 habitaciones en libros para el 20-oct-2025 y
// liberó 26 al llegar. Tope: las habitaciones del hotel.
function enLibrosAlCorte(reservas, dia, corte, filtro = () => true) {
  let total = 0;
  for (const r of reservas) {
    if (!filtro(r) || !cubreDia(r, dia)) continue;
    if (!r.fecha_reserva || r.fecha_reserva > corte) continue;
    const llegada = r.fecha_llegada_habitacion || r.fecha_llegada;
    if (estaCancelada(r) && (r.fecha_cancelacion <= corte || r.fecha_cancelacion >= llegada)) {
      continue;
    }
    total += habitaciones(r);
  }
  return Math.min(TOTAL_HABITACIONES, total);
}

// Códigos de reserva de grupo: todas sus líneas suman 5 o más habitaciones.
function codigosDeGrupo(reservas) {
  const porCodigo = new Map();
  for (const r of reservas) {
    if (!r.codigo_reserva) continue;
    porCodigo.set(r.codigo_reserva, (porCodigo.get(r.codigo_reserva) || 0) + habitaciones(r));
  }
  return new Set(
    [...porCodigo].filter(([, habs]) => habs >= MIN_HABITACIONES_GRUPO).map(([codigo]) => codigo)
  );
}

// Tendencia de demanda: reservas individuales netas de las últimas 4 semanas para el
// horizonte, contra las del año pasado en la misma ventana. El pickup del año pasado
// se escala por la raíz de esta razón (probado en 7 cortes de mar–sep 2026: sin ella
// el pronóstico de agosto se pasaba por 7,5 habitaciones de media).
function calcularTendencia({ hoy, dias, actual, anioAnterior }) {
  const corteAA = sumarDias(hoy, -DESFASE_ANIO);
  const grupoTY = codigosDeGrupo(actual.reservas);
  const grupoAA = codigosDeGrupo(anioAnterior.reservas);
  const individualTY = (r) => !grupoTY.has(r.codigo_reserva);
  const individualAA = (r) => !grupoAA.has(r.codigo_reserva);
  let esteAnio = 0;
  let anioPasado = 0;
  for (const dia of dias.slice(0, HORIZONTE_TENDENCIA)) {
    const diaAA = sumarDias(dia, -DESFASE_ANIO);
    esteAnio +=
      enLibrosAlCorte(actual.reservas, dia, hoy, individualTY) -
      enLibrosAlCorte(actual.reservas, dia, sumarDias(hoy, -VENTANA_TENDENCIA), individualTY);
    anioPasado +=
      enLibrosAlCorte(anioAnterior.reservas, diaAA, corteAA, individualAA) -
      enLibrosAlCorte(anioAnterior.reservas, diaAA, sumarDias(corteAA, -VENTANA_TENDENCIA), individualAA);
  }
  const razon =
    anioPasado >= MIN_RESERVAS_TENDENCIA
      ? Math.min(TENDENCIA_MAX, Math.max(TENDENCIA_MIN, esteAnio / anioPasado))
      : 1;
  return {
    reservasEsteAnio: esteAnio,
    reservasAnioPasado: anioPasado,
    razon: Math.round(razon * 100) / 100,
    factor: Math.round(Math.sqrt(razon) * 100) / 100,
  };
}

// Habitaciones vigentes de `dia` que pertenecen a reservas de grupo.
function habitacionesDeGrupo(reservas, dia) {
  const porCodigo = new Map();
  for (const r of reservas) {
    if (!r.codigo_reserva || estaCancelada(r) || !cubreDia(r, dia)) continue;
    porCodigo.set(r.codigo_reserva, (porCodigo.get(r.codigo_reserva) || 0) + habitaciones(r));
  }
  let total = 0;
  for (const habs of porCodigo.values()) if (habs >= MIN_HABITACIONES_GRUPO) total += habs;
  return total;
}

function mesAnterior(mes) {
  return `${Number(mes.slice(0, 4)) - 1}${mes.slice(4)}`;
}

function finDeMes(mes) {
  const [anio, numero] = mes.split("-").map(Number);
  return new Date(Date.UTC(anio, numero, 0)).toISOString().slice(0, 10);
}

// Valor en el que el peso acumulado alcanza la fracción `p` del total.
function percentilPonderado(pares, p) {
  if (pares.length === 0) return null;
  const orden = [...pares].sort((a, b) => a[0] - b[0]);
  const total = orden.reduce((suma, [, peso]) => suma + peso, 0);
  let acumulado = 0;
  for (const [valor, peso] of orden) {
    acumulado += peso;
    if (acumulado >= total * p) return valor;
  }
  return orden[orden.length - 1][0];
}

// Map<mes, {piso, techo, mediana, noches, origen, referencia}> para los meses del
// horizonte. Cada habitación-noche de la doble pesa uno.
function rangosPorMes(reservas, meses, manuales = []) {
  const porMesManual = new Map(manuales.map((m) => [m._id, m]));
  const rangos = new Map();
  for (const mes of meses) {
    const referencia = mesAnterior(mes);
    const inicio = `${referencia}-01`;
    const despuesDelFin = sumarDias(finDeMes(referencia), 1);
    const pares = [];
    for (const r of reservas) {
      if (r.clase_habitacion !== CLASE_REFERENCIA || estaCancelada(r) || !tarifaValida(r)) continue;
      const llegada = r.fecha_llegada_habitacion || r.fecha_llegada;
      const salida = salidaEfectiva(r);
      if (!llegada || !salida) continue;
      const n = noches(llegada > inicio ? llegada : inicio, salida < despuesDelFin ? salida : despuesDelFin);
      if (n > 0) pares.push([Number(r.valor_habitacion), n * habitaciones(r)]);
    }
    const nochesMes = pares.reduce((suma, [, peso]) => suma + peso, 0);
    const suficiente = nochesMes >= MIN_NOCHES_RANGO;
    const rango = {
      piso: suficiente ? Math.round(percentilPonderado(pares, PERCENTIL_PISO)) : null,
      techo: suficiente ? Math.round(percentilPonderado(pares, PERCENTIL_TECHO)) : null,
      mediana: suficiente ? Math.round(percentilPonderado(pares, 0.5)) : null,
      noches: nochesMes,
      origen: suficiente ? "historico" : null,
      referencia,
    };
    const manual = porMesManual.get(mes);
    if (manual) {
      if (manual.piso != null) rango.piso = manual.piso;
      if (manual.techo != null) rango.techo = manual.techo;
      rango.origen = "manual";
    }
    rangos.set(mes, rango);
  }
  return rangos;
}

// Map<dia, competencia> tomando, para cada fecha, la captura más reciente que tenga
// precio propio o de la competencia. `vistas` = salidas de armarTarifasCompetencia.
function competenciaPorDia(vistas) {
  const orden = [...vistas].sort((a, b) =>
    String(b.ejecucion.capturedDate).localeCompare(String(a.ejecucion.capturedDate))
  );
  const porDia = new Map();
  for (const vista of orden) {
    for (const f of vista.fechas) {
      if (porDia.has(f.dia) || (f.mediana === null && f.precioPropio === null)) continue;
      porDia.set(f.dia, {
        capturedDate: vista.ejecucion.capturedDate,
        precioPropio: f.precioPropio,
        propioComparable: f.propioComparable,
        mediana: f.mediana,
        comparables: f.comparables,
        minimo: f.minimo,
        maximo: f.maximo,
        diferenciaPct: f.diferenciaPct,
      });
    }
  }
  return porDia;
}

const sirveDeAncla = (c) =>
  c && c.precioPropio != null && c.mediana != null && (c.comparables || 0) >= MIN_COMPARABLES_ESTIMADO;
const coinciden = (a, b) => Math.abs(a - b) <= Math.max(a, b) * TOLERANCIA_ESTIMADO;

// Agrega a `competencia` un estimado para las fechas de `dias` sin captura utilizable.
function completarCompetencia(competencia, dias) {
  const anclas = [...competencia]
    .filter(([, c]) => sirveDeAncla(c))
    .sort(([a], [b]) => a.localeCompare(b));
  const completa = new Map(competencia);
  for (const dia of dias) {
    if (sirveDeAncla(competencia.get(dia))) continue;
    const antes = [...anclas].reverse().find(([fecha]) => fecha < dia);
    const despues = anclas.find(([fecha]) => fecha > dia);
    if (!antes || !despues) continue;
    const [a, b] = [antes[1], despues[1]];
    if (!coinciden(a.precioPropio, b.precioPropio) || !coinciden(a.mediana, b.mediana)) continue;
    completa.set(dia, {
      estimado: true,
      entre: [antes[0], despues[0]],
      capturedDate: a.capturedDate < b.capturedDate ? a.capturedDate : b.capturedDate,
      precioPropio: Math.round((a.precioPropio + b.precioPropio) / 2),
      propioComparable: true,
      mediana: Math.round((a.mediana + b.mediana) / 2),
      comparables: Math.min(a.comparables, b.comparables),
      minimo: null,
      maximo: null,
      diferenciaPct: null,
    });
  }
  return completa;
}

// Fechas del año pasado comparables con `dia`, de más antigua a más reciente.
function diasEquivalentes(dia) {
  const tipo = tipoDia(dia);
  const referencia = sumarDias(dia, -DESFASE_ANIO);
  const mismaSemana = [];
  for (let k = -SEMANAS_EQUIVALENTES; k <= SEMANAS_EQUIVALENTES; k++) {
    mismaSemana.push(sumarDias(referencia, 7 * k));
  }

  if (!TIPOS_ESPECIALES.has(tipo)) {
    const iguales = mismaSemana.filter((d) => tipoDia(d) === tipo);
    return iguales.length ? iguales : [referencia];
  }

  const cercanos = [];
  for (let k = -VENTANA_ESPECIALES; k <= VENTANA_ESPECIALES; k++) {
    const d = sumarDias(referencia, k);
    if (tipoDia(d) === tipo) cercanos.push(d);
  }
  const mismoDia = cercanos.filter((d) => diaSemana(d) === diaSemana(dia));
  if (mismoDia.length) return mismoDia;
  if (cercanos.length) return cercanos;
  return mismaSemana;
}

// Tarifa real cobrada (con IVA) y ocupación en esas fechas; solo días con folio.
function historiaEquivalente(fechas, porDia) {
  let ingreso = 0;
  let habsTarifa = 0;
  let ocupadas = 0;
  const conFolio = [];
  for (const fecha of fechas) {
    const d = porDia.get(fecha);
    if (!d || d.fuente !== "folio") continue;
    conFolio.push(fecha);
    ingreso += (d.tarifas || 0) + (d.iva || 0);
    habsTarifa += d.habsTarifa || 0;
    ocupadas += d.ocupacion || 0;
  }
  return {
    fechas: conFolio,
    adr: habsTarifa ? Math.round(ingreso / habsTarifa) : null,
    ocupacionPct: conFolio.length
      ? Math.round((ocupadas * 100) / (conFolio.length * TOTAL_HABITACIONES))
      : null,
  };
}

// Tarifa promedio (con IVA) de las reservas vigentes para `dia`, total y solo dobles.
function tarifaVendida(reservas, dia) {
  const total = { suma: 0, habitaciones: 0 };
  const doble = { suma: 0, habitaciones: 0 };
  for (const r of reservas) {
    if (estaCancelada(r) || !tarifaValida(r) || !cubreDia(r, dia)) continue;
    const valor = Number(r.valor_habitacion);
    const habs = habitaciones(r);
    total.suma += valor * habs;
    total.habitaciones += habs;
    if (r.clase_habitacion === CLASE_REFERENCIA) {
      doble.suma += valor * habs;
      doble.habitaciones += habs;
    }
  }
  const promedio = (x) => (x.habitaciones ? Math.round(x.suma / x.habitaciones) : null);
  return {
    promedio: promedio(total),
    habitaciones: total.habitaciones,
    doble: { promedio: promedio(doble), habitaciones: doble.habitaciones },
  };
}

// Reservas tal como estaban en la fecha `corte`: hechas hasta entonces y no canceladas
// todavía (las que se cancelaron después vuelven a contar como vigentes).
function reservasAlCorte(reservas, corte) {
  return reservas
    .filter((r) => r.fecha_reserva && r.fecha_reserva <= corte)
    .filter((r) => !(estaCancelada(r) && r.fecha_cancelacion <= corte))
    .map((r) => (estaCancelada(r) ? { ...r, fecha_cancelacion: null } : r));
}

// Arma las señales a partir de datos ya leídos. Separada de Mongo para testear.
//   actual / anioAnterior: salidas de ocupacionPorDia ({porDia, reservas}); la del
//   año anterior debe cubrir las fechas equivalentes (±45 días alrededor de dia-364).
//   historico: `hoy` es una fecha pasada (prueba hacia atrás). La ocupación sale de las
//   reservas que había en libros ese día, no hay cotizaciones (Zeus solo guarda el
//   estado final) y cada día trae `resultado`: lo que de verdad pasó según el folio.
function armarSenales({
  hoy,
  dias,
  objetivoPct = 75,
  actual,
  anioAnterior,
  competencia = new Map(),
  rangos = new Map(),
  eventos = [],
  historico = false,
}) {
  const objetivo = objetivoDiarioHabitaciones(objetivoPct);
  const corteAA = sumarDias(hoy, -DESFASE_ANIO);
  const hace7 = sumarDias(hoy, -VENTANA_PICKUP);
  const hace7AA = sumarDias(corteAA, -VENTANA_PICKUP);
  // Para hoy y el año pasado se usa la misma reconstrucción, para comparar parejo.
  const enLibros = (datos, dia, corte) => enLibrosAlCorte(datos.reservas, dia, corte);
  const reservasHoy = historico ? reservasAlCorte(actual.reservas, hoy) : actual.reservas;
  const competenciaCompleta = completarCompetencia(competencia, dias);
  const tendencia = calcularTendencia({ hoy, dias, actual, anioAnterior });
  const grupoAA = codigosDeGrupo(anioAnterior.reservas);
  const individualAA = (r) => !grupoAA.has(r.codigo_reserva);
  const folioAA = (fecha) => {
    const d = anioAnterior.porDia.get(fecha);
    return d && d.fuente === "folio" ? d.ocupacion : null;
  };

  // Habitaciones individuales que el año pasado entraron desde esta misma antelación
  // hasta la noche, promediadas en los días equivalentes no saturados. Los grupos se
  // descuentan del cierre: los de este año ya están en libros.
  function pickupEsperadoBase(dia, antelacion) {
    const pickups = [];
    for (const fecha of diasEquivalentes(dia)) {
      const final = folioAA(fecha);
      if (final === null || final >= OCUPACION_SATURADA) continue;
      const grupos = anioAnterior.reservas
        .filter((r) => grupoAA.has(r.codigo_reserva) && !estaCancelada(r) && cubreDia(r, fecha))
        .reduce((t, r) => t + habitaciones(r), 0);
      const alCorte = enLibrosAlCorte(
        anioAnterior.reservas,
        fecha,
        sumarDias(fecha, -antelacion),
        individualAA
      );
      pickups.push(Math.max(0, final - grupos) - alCorte);
    }
    if (pickups.length === 0) return null;
    return { valor: pickups.reduce((a, b) => a + b, 0) / pickups.length, dias: pickups.length };
  }

  return dias.map((dia) => {
    const d = actual.porDia.get(dia);
    const proyectada = historico
      ? Math.min(
          TOTAL_HABITACIONES,
          reservasHoy.filter((r) => cubreDia(r, dia)).reduce((t, r) => t + habitaciones(r), 0)
        )
      : d?.proyectada ?? 0;

    const ritmoHoy = enLibros(actual, dia, hoy);
    const diaAA = sumarDias(dia, -DESFASE_ANIO);
    const alCorteAA = enLibros(anioAnterior, diaAA, corteAA);
    const finalAA = folioAA(diaAA);
    // Pronóstico: lo que hay hoy en libros + el pickup individual esperado, escalado
    // por la tendencia. Sin días equivalentes, el pickup del mismo día del año pasado.
    const base = pickupEsperadoBase(dia, diasEntre(hoy, dia));
    const pickupEsperado = base
      ? base.valor * tendencia.factor
      : finalAA === null
        ? null
        : finalAA - alCorteAA;
    const pronostico =
      pickupEsperado === null
        ? null
        : Math.min(TOTAL_HABITACIONES, Math.max(0, Math.round(ritmoHoy + pickupEsperado)));

    const comp = competenciaCompleta.get(dia);
    const eventosDia = eventosDelDia(eventos, dia);
    const resultado =
      historico && d?.fuente === "folio"
        ? {
            ocupacion: d.ocupacion,
            adr: d.habsTarifa ? Math.round((d.tarifas + d.iva) / d.habsTarifa) : null,
          }
        : null;

    return {
      dia,
      diaSemana: DIAS_SEMANA[diaSemana(dia)],
      diasHasta: diasEntre(hoy, dia),
      calendario: {
        tipo: tipoDia(dia),
        festivo: festivo(dia),
        eventos: eventosDia,
        impactoEventos: impactoMaximo(eventosDia),
      },
      ocupacion: {
        proyectada,
        pct: Math.round((proyectada * 100) / TOTAL_HABITACIONES),
        objetivo,
        grupos: habitacionesDeGrupo(reservasHoy, dia),
        cotizadas: historico ? null : habitacionesCotizadas(reservasHoy, dia),
      },
      ritmo: {
        actual: ritmoHoy,
        anioAnterior: { fecha: diaAA, alCorte: alCorteAA, final: finalAA },
        diferencia: ritmoHoy - alCorteAA,
        pronostico,
        pickupEsperado: pickupEsperado === null ? null : Math.round(pickupEsperado),
        diasReferencia: base ? base.dias : 0,
        tendencia,
      },
      pickup: {
        dias: VENTANA_PICKUP,
        actual: ritmoHoy - enLibros(actual, dia, hace7),
        anioAnterior: alCorteAA - enLibros(anioAnterior, diaAA, hace7AA),
      },
      tarifaVendida: tarifaVendida(reservasHoy, dia),
      historia: historiaEquivalente(diasEquivalentes(dia), anioAnterior.porDia),
      competencia: comp ? { ...comp, antiguedadDias: diasEntre(comp.capturedDate, hoy) } : null,
      rango: rangos.get(dia.slice(0, 7)) || null,
      ...(historico ? { resultado } : {}),
    };
  });
}

async function leerCompetencia(db, hoy, objetivoPct) {
  const ejecuciones = await db
    .collection(COLECCIONES.ejecuciones)
    .find({
      source: "serpapi",
      simulated: { $ne: true },
      capturedDate: { $gte: sumarDias(hoy, -DIAS_CAPTURAS), $lte: hoy },
    })
    .sort({ capturedDate: -1 })
    .toArray();
  if (ejecuciones.length === 0) return { capturas: [], competencia: new Map() };

  const tarifas = await db
    .collection(COLECCIONES.tarifas)
    .find({ runId: { $in: ejecuciones.map((e) => e._id) } })
    .toArray();
  const porEjecucion = new Map();
  for (const t of tarifas) {
    if (!porEjecucion.has(t.runId)) porEjecucion.set(t.runId, []);
    porEjecucion.get(t.runId).push(t);
  }
  const vistas = ejecuciones.map((ejecucion) =>
    armarTarifasCompetencia({
      ejecucion,
      tarifas: porEjecucion.get(ejecucion._id) || [],
      ocupacion: new Map(),
      hoy,
      objetivoPct,
    })
  );
  return {
    capturas: ejecuciones.map((e) => e.capturedDate),
    competencia: competenciaPorDia(vistas),
  };
}

// `corte`: fecha pasada para correr "como si fuera" ese día (prueba hacia atrás).
async function obtenerSenalesTarifa(
  db,
  { dias = HORIZONTE_DIAS, objetivoPct = 75, corte = null } = {}
) {
  const hoyReal = hoyBogota();
  const historico = Boolean(corte) && corte < hoyReal;
  const hoy = historico ? corte : hoyReal;
  const fechas = listaDias(hoy, dias);
  const ultima = fechas[fechas.length - 1];
  const inicioAA = sumarDias(hoy, -DESFASE_ANIO - VENTANA_ESPECIALES);
  const finAA = sumarDias(ultima, -DESFASE_ANIO + VENTANA_ESPECIALES);
  const meses = [...new Set(fechas.map((f) => f.slice(0, 7)))];

  const [actual, anioAnterior, { capturas, competencia }, eventos, manuales] =
    await Promise.all([
      ocupacionPorDia(db, fechas),
      ocupacionPorDia(db, listaDias(inicioAA, diasEntre(inicioAA, finAA) + 1)),
      leerCompetencia(db, hoy, objetivoPct),
      db
        .collection(COLECCION_EVENTOS)
        .find({ hasta: { $gte: hoy }, desde: { $lte: ultima } })
        .toArray(),
      db.collection(COLECCION_RANGOS).find({ _id: { $in: meses } }).toArray(),
    ]);

  const senales = armarSenales({
    hoy,
    dias: fechas,
    objetivoPct,
    actual,
    anioAnterior,
    competencia,
    rangos: rangosPorMes(anioAnterior.reservas, meses, manuales),
    eventos,
    historico,
  });
  return {
    hoy,
    historico,
    objetivoPct,
    totalHabitaciones: TOTAL_HABITACIONES,
    capturas,
    tendencia: senales[0]?.ritmo.tendencia ?? null,
    dias: senales,
  };
}

module.exports = {
  COLECCION_RANGOS,
  DESFASE_ANIO,
  HORIZONTE_DIAS,
  armarSenales,
  calcularTendencia,
  codigosDeGrupo,
  competenciaPorDia,
  completarCompetencia,
  diasEquivalentes,
  enLibrosAlCorte,
  habitacionesCotizadas,
  habitacionesDeGrupo,
  historiaEquivalente,
  obtenerSenalesTarifa,
  percentilPonderado,
  rangosPorMes,
  reservasAlCorte,
  tarifaVendida,
};

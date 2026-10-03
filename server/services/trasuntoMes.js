const { diasDelMes, mesActualBogota, hoyBogota } = require("../functions/fechas");
const { ocupacionPorDia } = require("../functions/ocupacionDiaria");
const { TOTAL_HABITACIONES } = require("../functions/objetivoPickup");
const { RE_MES } = require("./ocupacionMes");

// Colección que el ETL llena desde MOVFOLIO con los consumos de huéspedes.
const COLECCION_CONSUMOS = "movimientos_consumos";

// Conceptos de Zeus por rubro del trasunto. Restaurante y desayunos se muestran con
// el impuesto al consumo incluido y lavandería con IVA, como en el trasunto.
const RUBROS_CONSUMO = {
  restaurante: [3], // VENTAS RESTAURANTE (tiquetes del POS cargados al folio)
  desayunos: [101], // SERVICIO DE DESAYUNO
  lavanderia: [8, 46], // LAVANDERIA · SERVICIO LAVANDERIA
};
const RUBRO_POR_CONCEPTO = new Map(
  Object.entries(RUBROS_CONSUMO).flatMap(([rubro, conceptos]) =>
    conceptos.map((c) => [c, rubro])
  )
);

const redondear = (valor) => Math.round(Number(valor) || 0);
const pct = (parte, total) => (total ? Math.round((parte * 1000) / total) / 10 : null);
const bruto = (m) =>
  (Number(m.valor_neto) || 0) + (Number(m.iva) || 0) + (Number(m.impuesto) || 0);

// Resumen de ventas del mes por día, como la hoja RESUMEN MES del trasunto, armado
// con lo que está en los folios de Zeus:
//   ventaHabitaciones -> alojamiento neto (MOVFOLIO, con cargos manuales y correcciones)
//   habitaciones      -> habitaciones-noche de la auditoría (CARGOGENHISTO)
//   iva               -> IVA del alojamiento
//   restaurante, desayunos, lavanderia -> consumos de huéspedes cargados al folio
//   tarifaPromedio    -> venta de habitaciones ÷ 29 (la definición del trasunto)
//   ventasTotales     -> habitaciones + IVA + restaurante + desayunos + lavandería
// Solo cuenta días cerrados (la auditoría nocturna ya posteó el folio). Los días
// pasados sin folio quedan "pendiente" y los de hoy en adelante "futuro".
// No incluye menús diarios ni eventos del restaurante, ni seguro hotelero: no pasan
// por el folio del huésped.
async function obtenerTrasuntoMes(db, mesSolicitado) {
  const mes = mesSolicitado || mesActualBogota();
  if (!RE_MES.test(mes)) {
    const error = new Error("El mes debe tener formato YYYY-MM");
    error.codigo = "MES_INVALIDO";
    throw error;
  }

  const [anio, numeroMes] = mes.split("-").map(Number);
  const dias = diasDelMes(anio, numeroMes);
  const hoy = hoyBogota();
  const { porDia } = await ocupacionPorDia(db, dias);
  const cerrados = new Set(dias.filter((dia) => porDia.get(dia).fuente === "folio"));

  const consumos = new Map();
  if (cerrados.size > 0) {
    const movimientos = await db
      .collection(COLECCION_CONSUMOS)
      .find(
        {
          fecha: { $gte: dias[0], $lte: dias[dias.length - 1] },
          concepto: { $in: [...RUBRO_POR_CONCEPTO.keys()] },
        },
        { projection: { _id: 0, fecha: 1, concepto: 1, valor_neto: 1, iva: 1, impuesto: 1 } }
      )
      .toArray();
    for (const m of movimientos) {
      const rubro = RUBRO_POR_CONCEPTO.get(m.concepto);
      if (!rubro || !cerrados.has(m.fecha)) continue;
      const dia = consumos.get(m.fecha) || { restaurante: 0, desayunos: 0, lavanderia: 0 };
      dia[rubro] += bruto(m);
      consumos.set(m.fecha, dia);
    }
  }

  const acumulado = {
    dias: 0,
    habitacionesNoche: 0,
    ventaHabitaciones: 0,
    iva: 0,
    restaurante: 0,
    desayunos: 0,
    lavanderia: 0,
  };

  const detalle = dias.map((dia) => {
    if (!cerrados.has(dia)) {
      return { dia, estado: dia < hoy ? "pendiente" : "futuro" };
    }
    const o = porDia.get(dia);
    const c = consumos.get(dia) || { restaurante: 0, desayunos: 0, lavanderia: 0 };
    const ventasTotales = o.tarifas + o.iva + c.restaurante + c.desayunos + c.lavanderia;

    acumulado.dias += 1;
    acumulado.habitacionesNoche += o.ocupacion;
    acumulado.ventaHabitaciones += o.tarifas;
    acumulado.iva += o.iva;
    acumulado.restaurante += c.restaurante;
    acumulado.desayunos += c.desayunos;
    acumulado.lavanderia += c.lavanderia;

    return {
      dia,
      estado: "cerrado",
      habitaciones: o.ocupacion,
      ocupacionPct: pct(o.ocupacion, TOTAL_HABITACIONES),
      ventaHabitaciones: redondear(o.tarifas),
      tarifaPromedio: redondear(o.tarifas / TOTAL_HABITACIONES),
      iva: redondear(o.iva),
      restaurante: redondear(c.restaurante),
      desayunos: redondear(c.desayunos),
      lavanderia: redondear(c.lavanderia),
      ventasTotales: redondear(ventasTotales),
    };
  });

  const capacidad = acumulado.dias * TOTAL_HABITACIONES;
  const ventasTotales =
    acumulado.ventaHabitaciones +
    acumulado.iva +
    acumulado.restaurante +
    acumulado.desayunos +
    acumulado.lavanderia;

  return {
    mes,
    hoy,
    totalHabitaciones: TOTAL_HABITACIONES,
    fechaCorte: [...cerrados].pop() || null,
    acumulado: {
      dias: acumulado.dias,
      habitacionesNoche: acumulado.habitacionesNoche,
      ocupacionPct: pct(acumulado.habitacionesNoche, capacidad),
      ventaHabitaciones: redondear(acumulado.ventaHabitaciones),
      tarifaPromedio: capacidad ? redondear(acumulado.ventaHabitaciones / capacidad) : null,
      iva: redondear(acumulado.iva),
      restaurante: redondear(acumulado.restaurante),
      desayunos: redondear(acumulado.desayunos),
      lavanderia: redondear(acumulado.lavanderia),
      ventasTotales: redondear(ventasTotales),
    },
    dias: detalle,
  };
}

module.exports = { obtenerTrasuntoMes, RUBROS_CONSUMO };

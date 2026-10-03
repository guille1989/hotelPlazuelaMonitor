const moment = require("moment-timezone");
const {
  CONCEPTOS_ALOJAMIENTO,
  COLECCION_MOVIMIENTOS,
} = require("../functions/ingresoAlojamiento");
const { RE_MES } = require("./ocupacionMes");

const redondear = (valor) => Math.round(Number(valor) || 0);
const orden = (a, b) =>
  (a.fecha || "").localeCompare(b.fecha || "") ||
  (a.fecha_tra || "").localeCompare(b.fecha_tra || "");
const opuestos = (a, b) =>
  a.fecha === b.fecha && Math.abs((a.valor_neto || 0) + (b.valor_neto || 0)) < 0.01;

// Menos de esto son centavos de redondeo que recepción cuadra a mano: no se listan.
const MINIMO_COP = 100;

// Movimientos de alojamiento del mes que NO generó la auditoría nocturna: lo que
// recepción carga a mano (adicionales, ajustes de tarifa, noches cobradas otro día o
// en un folio sin habitación) y las anulaciones. Es la lista a revisar contra el
// trasunto: ahí aparecen los casos que el cruce automático no explica.
//
// Lo que se cancela solo no se lista aparte:
//   - una anulación ("B:") del mismo folio, día y valor marca el cargo `anulado: true`;
//   - un cargo manual con su opuesto exacto el mismo día —otro cargo manual, o uno de
//     otro folio aunque venga marcado como auditoría (al entrar a un folio con
//     habitación Zeus le pone NFOLIOR)— es un movimiento entre folios hecho a mano: no
//     cambia el ingreso y se omite;
//   - los traslados ("T:") ni se consultan.
async function obtenerCargosManuales(db, mes) {
  if (!RE_MES.test(mes || "")) {
    const error = new Error("El mes debe tener formato YYYY-MM");
    error.codigo = "MES_INVALIDO";
    throw error;
  }
  const inicio = `${mes}-01`;
  const fin = moment.utc(inicio, "YYYY-MM-DD", true).endOf("month").format("YYYY-MM-DD");

  const movimientos = (
    await db
      .collection(COLECCION_MOVIMIENTOS)
      .find({
        fecha: { $gte: inicio, $lte: fin },
        concepto: { $in: CONCEPTOS_ALOJAMIENTO },
        origen: { $in: ["manual", "anulacion", "auditoria"] },
      })
      .toArray()
  ).filter((m) => Math.abs(Number(m.valor_neto) || 0) >= MINIMO_COP);
  movimientos.sort(orden);

  const manuales = movimientos
    .filter((m) => m.origen === "manual")
    .map((m) => ({ ...m, anulado: false, movido: false }));
  const anulacionesSueltas = [];
  for (const anulacion of movimientos.filter((m) => m.origen === "anulacion")) {
    const cargo = manuales.find(
      (m) => !m.anulado && m.nfolio === anulacion.nfolio && opuestos(m, anulacion)
    );
    if (cargo) cargo.anulado = true;
    else anulacionesSueltas.push({ ...anulacion, anulado: false });
  }

  const auditoria = movimientos.filter((m) => m.origen === "auditoria");
  const usados = new Set();
  for (const cargo of manuales) {
    if (cargo.anulado || cargo.movido) continue;
    const otroManual = manuales.find(
      (m) => m !== cargo && !m.anulado && !m.movido && opuestos(m, cargo)
    );
    if (otroManual) {
      cargo.movido = otroManual.movido = true;
      continue;
    }
    // Solo en OTRO folio: en el mismo, un crédito manual contra el cargo de la
    // auditoría es una corrección (p.ej. quitar una noche) y sí se lista.
    const deAuditoria = auditoria.find(
      (m) => !usados.has(m) && m.nfolio !== cargo.nfolio && opuestos(m, cargo)
    );
    if (deAuditoria) {
      usados.add(deAuditoria);
      cargo.movido = true;
    }
  }

  const lista = [...manuales.filter((m) => !m.movido), ...anulacionesSueltas].sort(orden);
  const totalCOP = redondear(
    lista.filter((m) => !m.anulado).reduce((s, m) => s + (Number(m.valor_neto) || 0), 0)
  );

  return {
    mes,
    totalCOP,
    cantidad: lista.length,
    movimientos: lista.map((m) => ({
      fecha: m.fecha,
      nfolio: m.nfolio || null,
      habitacion: m.numero_habitacion || null,
      concepto: m.concepto,
      tipo: m.origen === "manual" ? "cargo manual" : "anulación",
      valorCOP: redondear(m.valor_neto),
      motivo: m.motivo || null,
      usuario: m.usuario || null,
      registrado: m.fecha_tra || null,
      anulado: m.anulado,
    })),
  };
}

module.exports = { obtenerCargosManuales };

const PLANES_COMIDA = new Set(["incluido", "no_incluido", "desconocido"]);
const RE_FECHA = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

function numeroOpcional(valor, nombre) {
  if (valor === undefined || valor === null || valor === "") return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error(`${nombre} debe ser un número mayor o igual a cero`);
  }
  return Math.round(numero);
}

function textoRequerido(valor, nombre) {
  const texto = String(valor || "").trim();
  if (!texto) throw new Error(`${nombre} es obligatorio`);
  return texto;
}

function enteroPositivo(valor, nombre) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1) {
    throw new Error(`${nombre} debe ser un entero positivo`);
  }
  return numero;
}

function fechaYmd(valor, nombre) {
  const fecha = textoRequerido(valor, nombre);
  if (!RE_FECHA.test(fecha)) {
    throw new Error(`${nombre} debe tener formato YYYY-MM-DD`);
  }
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fechaUtc.getUTCFullYear() !== anio ||
    fechaUtc.getUTCMonth() !== mes - 1 ||
    fechaUtc.getUTCDate() !== dia
  ) {
    throw new Error(`${nombre} debe ser una fecha real`);
  }
  return fecha;
}

function normalizarTarifa(cotizacion) {
  const disponible = cotizacion.available === true;
  const moneda = String(cotizacion.currency || "").trim().toUpperCase();
  const total = numeroOpcional(cotizacion.totalAmount, "totalAmount");
  const base = numeroOpcional(cotizacion.baseAmount, "baseAmount");
  const impuestos = numeroOpcional(cotizacion.taxesAmount, "taxesAmount");
  const planComida = String(cotizacion.mealPlan || "desconocido").trim();

  if (!PLANES_COMIDA.has(planComida)) {
    throw new Error(`mealPlan inválido: ${planComida}`);
  }
  if (disponible && total === null) {
    throw new Error("Una tarifa disponible requiere totalAmount");
  }

  const motivosNoComparable = [];
  if (!disponible) motivosNoComparable.push("sin_disponibilidad");
  if (disponible && moneda !== "COP") motivosNoComparable.push("moneda_no_cop");
  if (disponible && cotizacion.publicRate !== true) {
    motivosNoComparable.push("tarifa_no_publica");
  }
  if (disponible && cotizacion.memberRate === true) {
    motivosNoComparable.push("tarifa_de_miembro");
  }
  if (disponible && cotizacion.taxesIncluded !== true) {
    motivosNoComparable.push("impuestos_no_confirmados");
  }
  if (disponible && cotizacion.refundable !== true) {
    motivosNoComparable.push(
      cotizacion.refundable === false
        ? "cancelacion_no_flexible"
        : "cancelacion_no_confirmada"
    );
  }

  const capturedAt = new Date(cotizacion.capturedAt);
  if (Number.isNaN(capturedAt.valueOf())) {
    throw new Error("capturedAt debe ser una fecha válida");
  }
  const checkIn = fechaYmd(cotizacion.checkIn, "checkIn");
  const checkOut = fechaYmd(cotizacion.checkOut, "checkOut");
  if (checkOut <= checkIn) {
    throw new Error("checkOut debe ser posterior a checkIn");
  }

  return {
    hotelId: textoRequerido(cotizacion.hotelId, "hotelId"),
    source: textoRequerido(cotizacion.source, "source"),
    channel: textoRequerido(cotizacion.channel, "channel"),
    sourceUrl: String(cotizacion.sourceUrl || "").trim() || null,
    sourcePropertyId:
      String(cotizacion.sourcePropertyId || "").trim() || null,
    capturedAt,
    checkIn,
    checkOut,
    adults: enteroPositivo(cotizacion.adults, "adults"),
    rooms: enteroPositivo(cotizacion.rooms, "rooms"),
    roomType: String(cotizacion.roomType || "").trim() || null,
    refundable:
      typeof cotizacion.refundable === "boolean"
        ? cotizacion.refundable
        : null,
    mealPlan: planComida,
    currency: moneda || null,
    baseAmount: disponible ? base : null,
    taxesAmount: disponible ? impuestos : null,
    totalAmount: disponible ? total : null,
    taxesIncluded:
      typeof cotizacion.taxesIncluded === "boolean"
        ? cotizacion.taxesIncluded
        : null,
    publicRate: cotizacion.publicRate === true,
    memberRate: cotizacion.memberRate === true,
    available: disponible,
    comparable: motivosNoComparable.length === 0,
    nonComparableReasons: motivosNoComparable,
    simulated: cotizacion.simulated === true,
  };
}

module.exports = { normalizarTarifa, PLANES_COMIDA };

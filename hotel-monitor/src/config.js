// Total de habitaciones del hotel (denominador de los % de ocupación).
export const TOTAL_HABITACIONES = 29;

// Formatea un número como pesos colombianos sin decimales: 236975 -> "$ 236.975".
export const formatCOP = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const MESES_CORTO = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

// "2026-09" -> "Sep 2026"
export const etiquetaMes = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES_CORTO[m - 1]} ${y}`;
};

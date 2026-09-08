// Total de habitaciones del hotel (denominador de los % de ocupación).
export const TOTAL_HABITACIONES = 29;

// Formatea un número como pesos colombianos sin decimales: 236975 -> "$ 236.975".
export const formatCOP = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

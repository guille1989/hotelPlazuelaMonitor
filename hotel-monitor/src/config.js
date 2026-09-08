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

// Códigos de MODO_RES de Zeus -> nombre y color para el mix de canales.
// AJUSTAR según confirme recepción qué significa cada letra.
export const CANALES = {
  B: { nombre: "Booking", color: "#3B82F6" },
  EM: { nombre: "Corporativo", color: "#8B5CF6" },
  WP: { nombre: "WhatsApp", color: "#22C55E" },
  T: { nombre: "Teléfono", color: "#F59E0B" },
  E: { nombre: "Email", color: "#14B8A6" },
  P: { nombre: "Presencial", color: "#EF4444" },
  G: { nombre: "Grupos", color: "#EC4899" },
  C: { nombre: "Convenio", color: "#64748B" },
  WALKIN: { nombre: "Walk-in", color: "#F97316" },
};
export const canalNombre = (cod) => (CANALES[cod] ? CANALES[cod].nombre : cod || "?");
export const canalColor = (cod) => (CANALES[cod] ? CANALES[cod].color : "#64748B");

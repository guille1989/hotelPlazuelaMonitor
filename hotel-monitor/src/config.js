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
  B: { nombre: "Booking", color: "#5b8ef0" },
  EM: { nombre: "Corporativo", color: "#a78bfa" },
  WP: { nombre: "WhatsApp", color: "#8cf4ee" },
  T: { nombre: "Teléfono", color: "#facc15" },
  E: { nombre: "Email", color: "#59b2b0" },
  P: { nombre: "Presencial", color: "#f07070" },
  G: { nombre: "Grupos", color: "#ec4899" },
  C: { nombre: "Convenio", color: "#64748b" },
  WALKIN: { nombre: "Walk-in", color: "#fb923c" },
};
export const canalNombre = (cod) => (CANALES[cod] ? CANALES[cod].nombre : cod || "?");
export const canalColor = (cod) => (CANALES[cod] ? CANALES[cod].color : "#64748B");

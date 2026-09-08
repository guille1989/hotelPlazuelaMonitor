import { useState } from "react";
import { MESES_CORTO } from "../config";

export const PERIODOS = [
  { id: "trimestre", label: "Trimestre", n: 3 },
  { id: "semestre", label: "Semestre", n: 6 },
  { id: "anio", label: "Año", n: 12 },
];

const ym = (t) =>
  `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;

const titulo = (tipo, inicioTotal, finTotal) => {
  const ai = Math.floor(inicioTotal / 12);
  const af = Math.floor(finTotal / 12);
  if (tipo === "anio") return `${ai}`;
  if (ai === af)
    return `${MESES_CORTO[inicioTotal % 12]}–${MESES_CORTO[finTotal % 12]} ${ai}`;
  return `${MESES_CORTO[inicioTotal % 12]} ${ai} – ${MESES_CORTO[finTotal % 12]} ${af}`;
};

// Selector de periodo alineado al calendario (T1 Ene-Mar…, S1 Ene-Jun…, año Ene-Dic).
// Devuelve el estado + los rangos "YYYY-MM" actual y del mismo periodo del año anterior.
export function usePeriodo(tipoInicial = "trimestre") {
  const [tipo, setTipo] = useState(tipoInicial);
  const [offset, setOffset] = useState(0);

  const n = PERIODOS.find((p) => p.id === tipo).n;
  const hoy = new Date();
  const totalHoy = hoy.getFullYear() * 12 + hoy.getMonth();
  const inicioTotal = (Math.floor(totalHoy / n) + offset) * n;
  const finTotal = inicioTotal + n - 1;

  const cambiarTipo = (t) => {
    setTipo(t);
    setOffset(0);
  };

  return {
    tipo,
    cambiarTipo,
    offset,
    retroceder: () => setOffset((o) => o - 1),
    avanzar: () => setOffset((o) => o + 1),
    desde: ym(inicioTotal),
    hasta: ym(finTotal),
    titulo: titulo(tipo, inicioTotal, finTotal),
    desdePrev: ym(inicioTotal - 12),
    hastaPrev: ym(finTotal - 12),
    tituloPrev: titulo(tipo, inicioTotal - 12, finTotal - 12),
  };
}

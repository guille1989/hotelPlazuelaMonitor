import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TOTAL_HABITACIONES, MESES, MESES_CORTO } from "../../config";
import "./OcupacionMes.css";

const PERIODOS = [
  { id: "trimestre", label: "Trimestre", n: 3 },
  { id: "semestre", label: "Semestre", n: 6 },
  { id: "anio", label: "Año", n: 12 },
];

const mediaMes = (M) =>
  Math.round((M.habNoche * 100) / (M.dias * TOTAL_HABITACIONES));
const tarifaMes = (M) =>
  M.habsTarifa > 0 ? Math.round(M.tarifas / M.habsTarifa) : 0;

const MesTick = ({ x, y, payload }) => (
  <g transform={`translate(${x},${y})`}>
    <text x={0} y={0} dy={12} textAnchor="middle" fill="#94a3b8" fontSize={11}>
      {payload.value}
    </text>
  </g>
);

export default function ResumenPeriodo({ onData }) {
  const [tipo, setTipo] = useState("trimestre");
  const [offset, setOffset] = useState(0);
  const [meses, setMeses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activo, setActivo] = useState(null);

  const n = PERIODOS.find((p) => p.id === tipo).n;

  // Rango del periodo alineado al calendario (trimestres Ene-Mar…, semestres Ene-Jun…).
  const hoy = new Date();
  const totalHoy = hoy.getFullYear() * 12 + hoy.getMonth();
  const idxPeriodo = Math.floor(totalHoy / n) + offset;
  const inicioTotal = idxPeriodo * n;
  const finTotal = inicioTotal + n - 1;
  const ym = (t) =>
    `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
  const desde = ym(inicioTotal);
  const hasta = ym(finTotal);

  const anioIni = Math.floor(inicioTotal / 12);
  const anioFin = Math.floor(finTotal / 12);
  let titulo;
  if (tipo === "anio") titulo = `${anioIni}`;
  else if (anioIni === anioFin)
    titulo = `${MESES_CORTO[inicioTotal % 12]}–${MESES_CORTO[finTotal % 12]} ${anioIni}`;
  else
    titulo = `${MESES_CORTO[inicioTotal % 12]} ${anioIni} – ${
      MESES_CORTO[finTotal % 12]
    } ${anioFin}`;

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setActivo(null);
    axios
      .get(
        `http://${process.env.REACT_APP_URL_PRODUCCION}/api/ocupacionperiodo?desde=${desde}&hasta=${hasta}`
      )
      .then((r) => {
        if (cancelado) return;
        setMeses(r.data.meses || []);
        setError(null);
        setLoading(false);
        if (onData)
          onData({ tipo, titulo, desde, hasta, meses: r.data.meses || [] });
      })
      .catch(() => {
        if (cancelado) return;
        setError("Error al cargar los datos");
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, tipo]);

  const datos = meses.map((M) => ({
    mes: M.mes,
    corto: MESES_CORTO[Number(M.mes.slice(5, 7)) - 1],
    checkin: M.checkin || 0,
    reservadas: M.reservadas || 0,
    canceladas: M.canceladasLlegada || 0,
    media: mediaMes(M), // % ocupación del mes (para el tooltip)
    tarifa: tarifaMes(M),
  }));

  const handleActivo = (state) => {
    const p = state && state.activePayload && state.activePayload[0];
    setActivo(p ? p.payload : null);
  };

  const cambiarTipo = (t) => {
    setTipo(t);
    setOffset(0);
  };

  const detalleMes = (d) => {
    const [y, m] = d.mes.split("-").map(Number);
    return `${MESES[m - 1]} ${y}`;
  };

  return (
    <div className="om-card">
      <div className="om-nav">
        <button
          className="om-arrow"
          onClick={() => setOffset((o) => o - 1)}
          aria-label="Periodo anterior"
        >
          ‹
        </button>
        <div className="om-month">{titulo}</div>
        <button
          className="om-arrow"
          onClick={() => setOffset((o) => o + 1)}
          aria-label="Periodo siguiente"
        >
          ›
        </button>
      </div>

      <div className="om-periodo">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            className={tipo === p.id ? "activo" : ""}
            onClick={() => cambiarTipo(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && <div className="om-state">Cargando…</div>}
      {error && !loading && <div className="om-state err">{error}</div>}

      {!loading && !error && (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={datos}
              margin={{ top: 24, right: 16, left: -12, bottom: 0 }}
              onMouseMove={handleActivo}
              onClick={handleActivo}
              onMouseLeave={() => setActivo(null)}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="corto"
                tick={<MesTick />}
                axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                width={34}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={() => null}
                cursor={{ fill: "rgba(255,255,255,0.06)" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                iconType="circle"
              />
              <Bar
                dataKey="checkin"
                name="Con check-in"
                stackId="a"
                fill="#22C55E"
                isAnimationActive={false}
              />
              <Bar
                dataKey="reservadas"
                name="Reservadas"
                stackId="a"
                fill="#3B82F6"
                isAnimationActive={false}
              />
              <Bar
                dataKey="canceladas"
                name="Canceladas"
                stackId="a"
                fill="#EF4444"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>

          <div className="om-readout">
            {activo ? (
              <>
                <span className="om-day">{detalleMes(activo)}</span>
                <span>
                  Ocupación media <b>{activo.media}%</b>
                </span>
                <span style={{ color: "#22C55E" }}>
                  Check-in <b>{activo.checkin}</b>
                </span>
                <span style={{ color: "#60A5FA" }}>
                  Reservadas <b>{activo.reservadas}</b>
                </span>
                {activo.canceladas > 0 && (
                  <span className="om-cancel">
                    Canceladas <b>{activo.canceladas}</b>
                  </span>
                )}
              </>
            ) : (
              <span className="om-hint">
                Pasa el cursor o toca un mes para ver el detalle
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

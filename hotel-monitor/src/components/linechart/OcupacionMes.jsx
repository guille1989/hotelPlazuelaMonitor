import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TOTAL_HABITACIONES } from "../../config";

const MESES = [
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

// X roja en los días con reservas canceladas.
const CancelXDot = ({ cx, cy, value }) => {
  if (value == null || cx == null || cy == null) return null;
  const s = 6;
  return (
    <g stroke="#EF4444" strokeWidth={2.5} strokeLinecap="round">
      <line x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s} />
      <line x1={cx - s} y1={cy + s} x2={cx + s} y2={cy - s} />
    </g>
  );
};

// Tick del eje X: solo el número de día ("2026-09-08" -> "8").
const DiaTick = ({ x, y, payload }) => (
  <g transform={`translate(${x},${y})`}>
    <text x={0} y={0} dy={12} textAnchor="middle" fill="#9CA3AF" fontSize={11}>
      {parseInt(payload.value.slice(8, 10), 10)}
    </text>
  </g>
);

const OcupacionTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const fila = payload[0].payload || {};
  return (
    <div
      style={{
        backgroundColor: "#353d54",
        color: "#fff",
        padding: 10,
        borderRadius: 5,
        border: "1px solid #ccc",
      }}
    >
      <p style={{ margin: 0 }}>{fila.dia}</p>
      <p style={{ margin: 0 }}>{`Habitaciones ocupadas: ${fila.ocupacion ?? 0}`}</p>
      {fila.cancelaciones > 0 && (
        <p style={{ margin: 0, color: "#EF4444" }}>
          {`Habitaciones canceladas: ${fila.cancelaciones}`}
        </p>
      )}
    </div>
  );
};

const botonEstilo = {
  backgroundColor: "#353d54",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  width: 34,
  height: 34,
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
};

export default function OcupacionMes() {
  const [offset, setOffset] = useState(0); // 0 = mes actual
  const [data, setData] = useState({ dias: [], hoy: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offset);
  const anio = base.getFullYear();
  const mesIdx = base.getMonth();
  const mesStr = `${anio}-${String(mesIdx + 1).padStart(2, "0")}`;
  const titulo = `${MESES[mesIdx]} ${anio}`;

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    axios
      .get(
        `http://${process.env.REACT_APP_URL_PRODUCCION}/api/ocupacionmes?mes=${mesStr}`
      )
      .then((r) => {
        if (cancelado) return;
        const dias = r.data.dias.map((d) => ({
          ...d,
          cancelMark: d.cancelaciones > 0 ? Math.max(d.ocupacion, 1) : null,
        }));
        setData({ dias, hoy: r.data.hoy });
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelado) return;
        setError("Error al cargar los datos");
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [mesStr]);

  const hoyEnEsteMes =
    data.hoy && data.dias.some((d) => d.dia === data.hoy) ? data.hoy : null;

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
          marginTop: 20,
        }}
      >
        <button
          onClick={() => setOffset((o) => o - 1)}
          style={botonEstilo}
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <h1
          className="title"
          style={{ minWidth: 220, textAlign: "center", margin: 0 }}
        >
          {titulo}
        </h1>
        <button
          onClick={() => setOffset((o) => o + 1)}
          style={botonEstilo}
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      {loading && (
        <div style={{ color: "white", marginTop: 20, textAlign: "center" }}>
          Cargando...
        </div>
      )}
      {error && !loading && (
        <div style={{ textAlign: "center", marginTop: 20 }}>{error}</div>
      )}

      {!loading && !error && (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart
            data={data.dias}
            margin={{ top: 30, right: 20, left: -20, bottom: 0 }}
          >
            <XAxis dataKey="dia" tick={<DiaTick />} interval={0} />
            <YAxis domain={[0, TOTAL_HABITACIONES]} />
            <ReferenceLine
              y={TOTAL_HABITACIONES}
              strokeDasharray="3 3"
              stroke="#9CA3AF"
              label={{ value: "100%", position: "right", fill: "#9CA3AF", fontSize: 11 }}
            />
            <ReferenceLine
              y={TOTAL_HABITACIONES / 2}
              strokeDasharray="3 3"
              stroke="#9CA3AF"
              label={{ value: "50%", position: "right", fill: "#9CA3AF", fontSize: 11 }}
            />
            {hoyEnEsteMes && (
              <ReferenceLine
                x={hoyEnEsteMes}
                stroke="#FBBF24"
                strokeWidth={1.5}
                label={{ value: "hoy", position: "top", fill: "#FBBF24", fontSize: 11 }}
              />
            )}
            <Tooltip content={<OcupacionTooltip />} />
            <Line
              type="monotone"
              dataKey="ocupacion"
              stroke="#22C55E"
              strokeWidth={2}
              dot={{ r: 2 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="cancelMark"
              stroke="none"
              legendType="none"
              isAnimationActive={false}
              dot={<CancelXDot />}
              activeDot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

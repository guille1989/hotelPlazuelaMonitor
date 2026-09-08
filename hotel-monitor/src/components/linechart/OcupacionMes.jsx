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

// Punto rojo pequeño con el número de habitaciones canceladas ese día.
const CancelDot = ({ cx, cy, payload }) => {
  if (cx == null || cy == null || !payload || !payload.cancelaciones) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={3} fill="#EF4444" />
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        fill="#EF4444"
        fontSize={11}
        fontWeight="bold"
      >
        {payload.cancelaciones}
      </text>
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
  const [activo, setActivo] = useState(null); // día bajo el cursor/tap

  const handleActivo = (state) => {
    const p = state && state.activePayload && state.activePayload[0];
    setActivo(p ? p.payload : null);
  };

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
    setActivo(null);
    axios
      .get(
        `http://${process.env.REACT_APP_URL_PRODUCCION}/api/ocupacionmes?mes=${mesStr}`
      )
      .then((r) => {
        if (cancelado) return;
        const dias = r.data.dias.map((d) => ({
          ...d,
          // el punto se ubica a la altura del nº de canceladas en el eje Y
          cancelMark: d.cancelaciones > 0 ? d.cancelaciones : null,
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
      <>
        <div
          style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}
        >
        <div style={{ minWidth: Math.max(640, (data.dias.length || 30) * 26) }}>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart
            data={data.dias}
            margin={{ top: 30, right: 20, left: -20, bottom: 0 }}
            onMouseMove={handleActivo}
            onClick={handleActivo}
            onMouseLeave={() => setActivo(null)}
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
            {/* Línea discontinua roja desde el nº de canceladas hasta el eje X */}
            {data.dias
              .filter((d) => d.cancelaciones > 0)
              .map((d) => (
                <ReferenceLine
                  key={d.dia}
                  segment={[
                    { x: d.dia, y: d.cancelaciones },
                    { x: d.dia, y: 0 },
                  ]}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              ))}
            <Tooltip
              content={() => null}
              cursor={{ stroke: "#9CA3AF", strokeDasharray: "3 3" }}
            />
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
              dot={<CancelDot />}
              activeDot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
        </div>

        <div
          style={{
            margin: "6px auto 0",
            maxWidth: 340,
            background: "#353d54",
            color: "#fff",
            borderRadius: 6,
            padding: "8px 12px",
            textAlign: "center",
            fontSize: 14,
            minHeight: 44,
            boxSizing: "border-box",
          }}
        >
          {activo ? (
            <>
              <span style={{ fontWeight: "bold" }}>{activo.dia}</span>
              <span>{` · Ocupadas: ${activo.ocupacion ?? 0}`}</span>
              {activo.cancelaciones > 0 && (
                <span style={{ color: "#EF4444" }}>
                  {` · Canceladas: ${activo.cancelaciones}`}
                </span>
              )}
            </>
          ) : (
            <span style={{ opacity: 0.6 }}>Pasa el cursor o toca un día</span>
          )}
        </div>
      </>
      )}
    </div>
  );
}

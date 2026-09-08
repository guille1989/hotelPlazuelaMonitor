import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TOTAL_HABITACIONES, MESES } from "../../config";
import "./OcupacionMes.css";

const DIAS_SEMANA = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

// "2026-09-08" -> "lunes 8 de septiembre"
const fechaLarga = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DIAS_SEMANA[dt.getDay()]} ${d} de ${MESES[m - 1].toLowerCase()}`;
};

const pct = (ocupacion) =>
  Math.round(((ocupacion || 0) * 100) / TOTAL_HABITACIONES);

// Punto rojo pequeño con el número de habitaciones canceladas ese día.
const CancelDot = ({ cx, cy, payload }) => {
  if (cx == null || cy == null || !payload || !payload.cancelaciones) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={3} fill="#f87171" />
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        fill="#f87171"
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
    <text x={0} y={0} dy={12} textAnchor="middle" fill="#94a3b8" fontSize={11}>
      {parseInt(payload.value.slice(8, 10), 10)}
    </text>
  </g>
);

export default function OcupacionMes({ onData }) {
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
        if (onData) onData({ mes: mesStr, titulo, dias, hoy: r.data.hoy });
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
  }, [mesStr]);

  const hoyEnEsteMes =
    data.hoy && data.dias.some((d) => d.dia === data.hoy) ? data.hoy : null;
  const anchoMin = Math.max(640, (data.dias.length || 30) * 26);

  return (
    <div className="om-card">
      <div className="om-nav">
        <button
          className="om-arrow"
          onClick={() => setOffset((o) => o - 1)}
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <div className="om-month">{titulo}</div>
        <button
          className="om-arrow"
          onClick={() => setOffset((o) => o + 1)}
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      {loading && <div className="om-state">Cargando…</div>}
      {error && !loading && <div className="om-state err">{error}</div>}

      {!loading && !error && (
        <>
          <div className="om-scroll">
            <div style={{ minWidth: anchoMin }}>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart
                  data={data.dias}
                  margin={{ top: 24, right: 16, left: -12, bottom: 0 }}
                  onMouseMove={handleActivo}
                  onClick={handleActivo}
                  onMouseLeave={() => setActivo(null)}
                >
                  <defs>
                    <linearGradient id="omOcupacion" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="rgba(255,255,255,0.06)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="dia"
                    tick={<DiaTick />}
                    interval={0}
                    axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, TOTAL_HABITACIONES]}
                    width={34}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <ReferenceLine
                    y={TOTAL_HABITACIONES}
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.18)"
                    label={{
                      value: "100%",
                      position: "right",
                      fill: "#94a3b8",
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    y={TOTAL_HABITACIONES / 2}
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.18)"
                    label={{
                      value: "50%",
                      position: "right",
                      fill: "#94a3b8",
                      fontSize: 10,
                    }}
                  />
                  {hoyEnEsteMes && (
                    <ReferenceLine
                      x={hoyEnEsteMes}
                      stroke="#FBBF24"
                      strokeWidth={1.5}
                      label={{
                        value: "hoy",
                        position: "top",
                        fill: "#FBBF24",
                        fontSize: 11,
                      }}
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
                        stroke="#f87171"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                      />
                    ))}

                  <Tooltip
                    content={() => null}
                    cursor={{
                      stroke: "rgba(255,255,255,0.25)",
                      strokeDasharray: "3 3",
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="ocupacion"
                    stroke="#22C55E"
                    strokeWidth={2}
                    fill="url(#omOcupacion)"
                    isAnimationActive={false}
                    activeDot={{ r: 4, fill: "#22C55E", stroke: "#fff", strokeWidth: 1.5 }}
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
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="om-readout">
            {activo ? (
              <>
                <span className="om-day">{fechaLarga(activo.dia)}</span>
                <span>
                  Ocupación{" "}
                  <b>
                    {activo.ocupacion ?? 0}/{TOTAL_HABITACIONES}
                  </b>{" "}
                  · <b>{pct(activo.ocupacion)}%</b>
                </span>
                {activo.cancelaciones > 0 && (
                  <span className="om-cancel">
                    Canceladas <b>{activo.cancelaciones}</b>
                  </span>
                )}
              </>
            ) : (
              <span className="om-hint">
                Pasa el cursor o toca un día para ver el detalle
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

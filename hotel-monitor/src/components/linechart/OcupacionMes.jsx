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

// Punto rojo pequeño en los días con habitaciones canceladas.
const CancelDot = ({ cx, cy, payload }) => {
  if (cx == null || cy == null || !payload || !payload.cancelaciones) return null;
  return <circle cx={cx} cy={cy} r={3.5} fill="#f07070" />;
};

// Tick del eje X: solo el número de día ("2026-09-08" -> "8").
const DiaTick = ({ x, y, payload }) => (
  <g transform={`translate(${x},${y})`}>
    <text x={0} y={0} dy={12} textAnchor="middle" fill="#8fa4b8" fontSize={11}>
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
          // serie continua para la línea punteada de canceladas (0 si no hay)
          cancelLinea: d.cancelaciones > 0 ? d.cancelaciones : 0,
        }));
        setData({ dias, hoy: r.data.hoy });
        setError(null);
        setLoading(false);
        if (onData)
          onData({
            mes: mesStr,
            titulo,
            dias,
            hoy: r.data.hoy,
            arribo: r.data.arribo || null,
          });
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
          <div className="om-leyenda">
            <span className="om-leyenda-item om-leyenda-ocup">Ocupación</span>
            <span className="om-leyenda-item om-leyenda-canc">Canceladas</span>
          </div>
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
                      <stop offset="0%" stopColor="#8cf4ee" stopOpacity={0.24} />
                      <stop offset="100%" stopColor="#8cf4ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="rgba(255,255,255,0.05)"
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
                    tick={{ fill: "#8fa4b8", fontSize: 11, fontFamily: "Poppins" }}
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
                      fill: "#8fa4b8",
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
                      fill: "#8fa4b8",
                      fontSize: 10,
                    }}
                  />
                  {hoyEnEsteMes && (
                    <ReferenceLine
                      x={hoyEnEsteMes}
                      stroke="#8cf4ee"
                      strokeWidth={1.5}
                      label={{
                        value: "hoy",
                        position: "top",
                        fill: "#8cf4ee",
                        fontSize: 11,
                      }}
                    />
                  )}

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
                    stroke="#8cf4ee"
                    strokeWidth={2}
                    fill="url(#omOcupacion)"
                    isAnimationActive={false}
                    activeDot={{ r: 4, fill: "#8cf4ee", stroke: "#1f293d", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cancelLinea"
                    stroke="#f07070"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    legendType="none"
                    isAnimationActive={false}
                    dot={<CancelDot />}
                    activeDot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="om-readout om-readout-dia">
            {activo ? (
              <>
                <div className="om-readout-main">
                  <span className="om-day">{fechaLarga(activo.dia)}</span>
                  <span className="om-readout-ocup">
                    Ocupación{" "}
                    <b>
                      {activo.ocupacion ?? 0}/{TOTAL_HABITACIONES} ·{" "}
                      {pct(activo.ocupacion)}%
                    </b>
                  </span>
                </div>
                <div className="om-readout-canc">
                  <span>Canceladas</span>
                  <b>{activo.cancelaciones || 0}</b>
                </div>
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

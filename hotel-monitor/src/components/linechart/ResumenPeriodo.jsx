import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TOTAL_HABITACIONES, MESES, MESES_CORTO, formatCOP } from "../../config";
import { apiUrl } from "../../api";
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
const revparMes = (M) =>
  M.dias > 0 ? Math.round(M.tarifas / (M.dias * TOTAL_HABITACIONES)) : 0;

const tituloPeriodo = (tipo, inicioTotal, finTotal) => {
  const ai = Math.floor(inicioTotal / 12);
  const af = Math.floor(finTotal / 12);
  if (tipo === "anio") return `${ai}`;
  if (ai === af)
    return `${MESES_CORTO[inicioTotal % 12]}–${MESES_CORTO[finTotal % 12]} ${ai}`;
  return `${MESES_CORTO[inicioTotal % 12]} ${ai} – ${MESES_CORTO[finTotal % 12]} ${af}`;
};

export default function ResumenPeriodo({ onData }) {
  const [tipo, setTipo] = useState("trimestre");
  const [offset, setOffset] = useState(0);
  const [comparar, setComparar] = useState(false);
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

  const titulo = tituloPeriodo(tipo, inicioTotal, finTotal);
  // Mismo periodo, año anterior (−12 meses).
  const desdePrev = ym(inicioTotal - 12);
  const hastaPrev = ym(finTotal - 12);
  const tituloPrev = tituloPeriodo(tipo, inicioTotal - 12, finTotal - 12);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setActivo(null);
    const base = apiUrl("/api/ocupacionperiodo");
    const reqs = [axios.get(`${base}?desde=${desde}&hasta=${hasta}`)];
    if (comparar) reqs.push(axios.get(`${base}?desde=${desdePrev}&hasta=${hastaPrev}`));

    Promise.all(reqs)
      .then(([r, rp]) => {
        if (cancelado) return;
        setMeses(r.data.meses || []);
        setError(null);
        setLoading(false);
        if (onData)
          onData({
            tipo,
            titulo,
            tituloPrev: comparar ? tituloPrev : null,
            desde,
            hasta,
            meses: r.data.meses || [],
            mesesPrev: rp ? rp.data.meses || [] : null,
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
  }, [desde, hasta, tipo, comparar]);

  const datos = meses.map((M) => ({
    mes: M.mes,
    corto: MESES_CORTO[Number(M.mes.slice(5, 7)) - 1],
    checkin: M.checkin || 0,
    reservadas: M.reservadas || 0,
    canceladas: M.canceladasLlegada || 0,
    media: mediaMes(M), // % ocupación del mes (para el tooltip)
    tarifaPromedio: tarifaMes(M),
    revpar: revparMes(M),
    totalTarifas: M.tarifas || 0,
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
        <button
          className={comparar ? "activo" : ""}
          onClick={() => setComparar((c) => !c)}
          style={{ marginLeft: 8 }}
        >
          ⇄ Comparar {comparar ? `con ${tituloPrev}` : ""}
        </button>
      </div>

      {loading && <div className="om-state">Cargando…</div>}
      {error && !loading && <div className="om-state err">{error}</div>}

      {!loading && !error && (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={datos}
              margin={{ top: 8, right: 6, left: -4, bottom: 0 }}
              barCategoryGap="25%"
              onMouseMove={handleActivo}
              onClick={handleActivo}
              onMouseLeave={() => setActivo(null)}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="corto"
                tick={{ fill: "#8fa4b8", fontSize: 9, fontFamily: "Poppins" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                width={40}
                tick={{ fill: "#8fa4b8", fontSize: 9, fontFamily: "Poppins" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={() => null}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar
                dataKey="checkin"
                name="Con check-in"
                stackId="a"
                fill="#8cf4ee"
                isAnimationActive={false}
              />
              <Bar
                dataKey="reservadas"
                name="Reservadas"
                stackId="a"
                fill="#5b8ef0"
                isAnimationActive={false}
              />
              <Bar
                dataKey="canceladas"
                name="Canceladas"
                stackId="a"
                fill="#f07070"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>

          <div className="om-leyenda">
            <span className="om-leyenda-item om-leyenda-sq" style={{ "--m": "#8cf4ee" }}>
              Con check-in
            </span>
            <span className="om-leyenda-item om-leyenda-sq" style={{ "--m": "#5b8ef0" }}>
              Reservadas
            </span>
            <span className="om-leyenda-item om-leyenda-sq" style={{ "--m": "#f07070" }}>
              Canceladas
            </span>
          </div>

          <div className="om-readout">
            {activo ? (
              <>
                <span className="om-day">{detalleMes(activo)}</span>
                <span>
                  Ocupación media <b>{activo.media}%</b>
                </span>
                <span style={{ color: "#8cf4ee" }}>
                  Check-in <b>{activo.checkin}</b>
                </span>
                <span style={{ color: "#5b8ef0" }}>
                  Reservadas <b>{activo.reservadas}</b>
                </span>
                {activo.canceladas > 0 && (
                  <span className="om-cancel">
                    Canceladas <b>{activo.canceladas}</b>
                  </span>
                )}
                <span>
                  Tarifa prom. <b>{formatCOP(activo.tarifaPromedio)}</b>
                </span>
                <span>
                  RevPAR <b>{formatCOP(activo.revpar)}</b>
                </span>
                <span>
                  Total tarifas <b>{formatCOP(activo.totalTarifas)}</b>
                </span>
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

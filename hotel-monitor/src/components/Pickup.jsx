import React, { useState, useEffect } from "react";
import axios from "axios";
import { MESES } from "../config";
import "./linechart/OcupacionMes.css";
import "./Pickup.css";

const VENTANAS = [7, 14, 30];

const etiqueta = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
};

export default function Pickup() {
  const [dias, setDias] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    axios
      .get(
        `http://${process.env.REACT_APP_URL_PRODUCCION}/api/pickup?dias=${dias}`
      )
      .then((r) => {
        if (cancelado) return;
        setData(r.data);
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
  }, [dias]);

  const meses = (data && data.meses) || [];
  const maxAbs = Math.max(1, ...meses.map((m) => Math.abs(m.nuevas - m.canceladas)));
  const neto = data ? data.totales.nuevas - data.totales.canceladas : 0;

  return (
    <div className="om-card pickup-card">
      <div className="om-nav pickup-heading">
        <div className="om-month">Pickup · últimos {dias} días</div>
      </div>

      <div className="om-periodo pickup-periodo">
        {VENTANAS.map((v) => (
          <button
            key={v}
            className={dias === v ? "activo" : ""}
            onClick={() => setDias(v)}
          >
            {v} días
          </button>
        ))}
      </div>

      {loading && <div className="om-state">Cargando…</div>}
      {error && !loading && <div className="om-state err">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="pickup-summary">
            <span>Neto</span>
            <b className={neto >= 0 ? "positivo" : "negativo"}>
              {neto >= 0 ? "+" : ""}
              {neto} hab
            </b>
            <span className="pickup-breakdown">
              ({data.totales.nuevas} nuevas · {data.totales.canceladas} canceladas)
            </span>
          </div>

          {meses.length === 0 && (
            <div className="om-state pickup-empty">
              Sin movimiento en la ventana.
            </div>
          )}

          <div className="pickup-list">
            {meses.map((m) => {
              const n = m.nuevas - m.canceladas;
              const w = (Math.abs(n) / maxAbs) * 100;
              return (
                <div className="pickup-row" key={m.mes}>
                  <div className="pickup-row-head">
                    <span className="pickup-month">{etiqueta(m.mes)}</span>
                    <span className="pickup-values">
                      <b className={n >= 0 ? "positivo" : "negativo"}>
                        {n >= 0 ? "+" : ""}
                        {n} hab
                      </b>
                      <span className="pickup-breakdown">
                        ({m.nuevas} nvs · {m.canceladas} canc)
                      </span>
                    </span>
                  </div>
                  <div className="pickup-track">
                    <div
                      className={`pickup-fill ${n >= 0 ? "positivo" : "negativo"}`}
                      style={{
                        width: `${w}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import axios from "axios";
import { MESES } from "../config";
import "./linechart/OcupacionMes.css";

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
    <div className="om-card">
      <div className="om-nav">
        <div className="om-month">Pickup · últimos {dias} días</div>
      </div>

      <div className="om-periodo">
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
          <div
            style={{
              textAlign: "center",
              color: "#cbd5e1",
              fontSize: 14,
              margin: "4px 0 12px",
            }}
          >
            Neto{" "}
            <b style={{ color: neto >= 0 ? "#22C55E" : "#f87171" }}>
              {neto >= 0 ? "+" : ""}
              {neto} hab
            </b>{" "}
            <span style={{ opacity: 0.7 }}>
              ({data.totales.nuevas} nuevas · {data.totales.canceladas} canceladas)
            </span>
          </div>

          {meses.length === 0 && (
            <div className="om-state" style={{ padding: "16px 0" }}>
              Sin movimiento en la ventana.
            </div>
          )}

          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            {meses.map((m) => {
              const n = m.nuevas - m.canceladas;
              const w = (Math.abs(n) / maxAbs) * 100;
              return (
                <div key={m.mes} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      color: "#cbd5e1",
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ color: "#fff", fontWeight: 600 }}>
                      {etiqueta(m.mes)}
                    </span>
                    <span>
                      <b style={{ color: n >= 0 ? "#22C55E" : "#f87171" }}>
                        {n >= 0 ? "+" : ""}
                        {n} hab
                      </b>
                      <span style={{ opacity: 0.6, marginLeft: 6 }}>
                        ({m.nuevas} nvs · {m.canceladas} canc)
                      </span>
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 4,
                      background: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      style={{
                        width: `${w}%`,
                        height: "100%",
                        borderRadius: 4,
                        background: n >= 0 ? "#22C55E" : "#f87171",
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

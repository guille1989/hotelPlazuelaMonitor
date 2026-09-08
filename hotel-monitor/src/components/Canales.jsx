import React, { useState, useEffect } from "react";
import axios from "axios";
import { usePeriodo, PERIODOS } from "../lib/usePeriodo";
import MixCanales from "./MixCanales";
import "./linechart/OcupacionMes.css";

// Suma el objeto `canal` de cada mes de un array de meses.
const sumarCanal = (meses) => {
  const c = {};
  for (const m of meses || []) {
    for (const [k, v] of Object.entries(m.canal || {})) {
      c[k] = (c[k] || 0) + v;
    }
  }
  return c;
};

export default function Canales() {
  const p = usePeriodo("trimestre");
  const [comparar, setComparar] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    const base = `http://${process.env.REACT_APP_URL_PRODUCCION}/api/ocupacionperiodo`;
    const reqs = [axios.get(`${base}?desde=${p.desde}&hasta=${p.hasta}`)];
    if (comparar)
      reqs.push(axios.get(`${base}?desde=${p.desdePrev}&hasta=${p.hastaPrev}`));

    Promise.all(reqs)
      .then(([r, rp]) => {
        if (cancelado) return;
        setData({
          canal: sumarCanal(r.data.meses),
          canalPrev: rp ? sumarCanal(rp.data.meses) : null,
        });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.desde, p.hasta, p.tipo, comparar]);

  return (
    <div className="om-card">
      <div className="om-nav">
        <button className="om-arrow" onClick={p.retroceder} aria-label="Periodo anterior">
          ‹
        </button>
        <div className="om-month">{p.titulo}</div>
        <button className="om-arrow" onClick={p.avanzar} aria-label="Periodo siguiente">
          ›
        </button>
      </div>

      <div className="om-periodo">
        {PERIODOS.map((op) => (
          <button
            key={op.id}
            className={p.tipo === op.id ? "activo" : ""}
            onClick={() => p.cambiarTipo(op.id)}
          >
            {op.label}
          </button>
        ))}
        <button
          className={comparar ? "activo" : ""}
          onClick={() => setComparar((c) => !c)}
          style={{ marginLeft: 8 }}
        >
          ⇄ Comparar {comparar ? `con ${p.tituloPrev}` : ""}
        </button>
      </div>

      {loading && <div className="om-state">Cargando…</div>}
      {error && !loading && <div className="om-state err">{error}</div>}

      {!loading && !error && data && (
        <>
          <div
            style={{
              textAlign: "center",
              color: "var(--color-muted)",
              fontSize: 11,
              margin: "6px 0 18px",
            }}
          >
            Habitaciones-noche por canal de reserva
          </div>
          {Object.keys(data.canal).length === 0 ? (
            <div className="om-state" style={{ padding: "16px 0" }}>
              Sin datos de canal en el periodo.
            </div>
          ) : (
            <MixCanales
              canal={data.canal}
              canalPrev={comparar ? data.canalPrev : null}
            />
          )}
        </>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import axios from "axios";
import { MESES, formatCOP } from "../config";
import { apiUrl } from "../api";
import "./Trasunto.css";

// "YYYY-MM" del mes actual (hora del navegador, como el selector de Resumen).
const mesActual = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
};

const moverMes = (ym, delta) => {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
};

const tituloMes = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
};

const fechaCorta = (ymd) => {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} de ${MESES[m - 1].toLowerCase()}`;
};

// En la tabla, pesos sin símbolo para que quepan las columnas.
const pesos = (n) => new Intl.NumberFormat("es-CO").format(Number(n) || 0);

// Filas de la tabla (los días van en columnas), en el orden de la hoja RESUMEN MES.
const FILAS = [
  ["ocupacionPct", "Ocupación", (v) => `${v}%`],
  ["ventaHabitaciones", "Venta habitaciones", pesos],
  ["tarifaPromedio", "Tarifa promedio", pesos],
  ["iva", "IVA", pesos],
  ["restaurante", "Restaurante", pesos],
  ["desayunos", "Desayunos", pesos],
  ["lavanderia", "Lavandería", pesos],
  ["ventasTotales", "Ventas totales", pesos],
];

export default function Trasunto() {
  const [mes, setMes] = useState(mesActual);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    axios
      .get(apiUrl(`/api/trasunto?mes=${mes}`))
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
  }, [mes]);

  const acum = data && data.acumulado;
  // Solo días hasta hoy: los futuros no tienen nada que mostrar.
  const dias = data ? data.dias.filter((d) => d.estado !== "futuro") : [];

  return (
    <div className="trasunto">
      <div className="trasunto-head">
        <div className="trasunto-eyebrow">Trasunto · resumen de ventas</div>
        <div className="trasunto-mes">
          <button onClick={() => setMes((m) => moverMes(m, -1))} aria-label="Mes anterior">
            ‹
          </button>
          <h2>{tituloMes(mes)}</h2>
          <button
            onClick={() => setMes((m) => moverMes(m, 1))}
            disabled={mes >= mesActual()}
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>
      </div>

      {loading && <div className="trasunto-estado">Cargando…</div>}
      {error && !loading && <div className="trasunto-estado err">{error}</div>}

      {!loading && !error && data && (
        <>
          <p className="trasunto-contexto">
            {acum.dias
              ? `${acum.dias} ${acum.dias === 1 ? "día cerrado" : "días cerrados"} · hasta el ${fechaCorta(data.fechaCorte)}`
              : "Todavía no hay días cerrados en este mes."}
          </p>

          <section className="trasunto-total" aria-label="Ventas totales del mes">
            <span>Ventas totales</span>
            <strong>{formatCOP(acum.ventasTotales)}</strong>
            <small>habitaciones + IVA + restaurante + desayunos + lavandería</small>
          </section>

          <div className="trasunto-rubros">
            <div className="trasunto-rubro">
              <span>Venta de habitaciones</span>
              <strong>{formatCOP(acum.ventaHabitaciones)}</strong>
            </div>
            <div className="trasunto-rubro">
              <span>Ocupación</span>
              <strong>{acum.ocupacionPct == null ? "—" : `${acum.ocupacionPct}%`}</strong>
              <small>{acum.habitacionesNoche} hab.-noche</small>
            </div>
            <div className="trasunto-rubro">
              <span>Tarifa promedio</span>
              <strong>{acum.tarifaPromedio == null ? "—" : formatCOP(acum.tarifaPromedio)}</strong>
              <small>venta ÷ {data.totalHabitaciones} por día</small>
            </div>
            <div className="trasunto-rubro">
              <span>IVA alojamiento</span>
              <strong>{formatCOP(acum.iva)}</strong>
            </div>
            <div className="trasunto-rubro">
              <span>Restaurante</span>
              <strong>{formatCOP(acum.restaurante)}</strong>
            </div>
            <div className="trasunto-rubro">
              <span>Desayunos</span>
              <strong>{formatCOP(acum.desayunos)}</strong>
            </div>
            <div className="trasunto-rubro">
              <span>Lavandería</span>
              <strong>{formatCOP(acum.lavanderia)}</strong>
            </div>
          </div>

          {dias.length > 0 && (
            <div className="trasunto-tabla-wrap">
              <table className="trasunto-tabla">
                <thead>
                  <tr>
                    <th scope="col">Día</th>
                    {dias.map((d) => (
                      <th key={d.dia} scope="col" className={d.estado}>
                        {Number(d.dia.slice(8))}
                      </th>
                    ))}
                    {acum.dias > 0 && (
                      <th scope="col" className="total">
                        Total
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {FILAS.map(([clave, titulo, formato]) => (
                    <tr key={clave} className={clave === "ventasTotales" ? "destacada" : undefined}>
                      <th scope="row">{titulo}</th>
                      {dias.map((d) =>
                        d.estado === "cerrado" ? (
                          <td key={d.dia}>{formato(d[clave])}</td>
                        ) : (
                          <td key={d.dia} className="pendiente" title="Pendiente de la auditoría nocturna">
                            —
                          </td>
                        )
                      )}
                      {acum.dias > 0 && (
                        <td className="total">
                          {acum[clave] == null ? "—" : formato(acum[clave])}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dias.some((d) => d.estado === "pendiente") && (
            <p className="trasunto-leyenda">— día pendiente de la auditoría nocturna</p>
          )}

          <p className="trasunto-nota">
            Armado con los folios de Zeus. Restaurante y desayunos incluyen el impuesto
            al consumo y lavandería el IVA, como en el trasunto. No incluye menús
            diarios ni eventos del restaurante, ni seguro hotelero: no pasan por el
            folio del huésped.
          </p>
        </>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import axios from "axios";
import { MESES } from "../config";
import "./Pickup.css";

const VENTANAS = [7, 14, 30];
const OBJETIVOS = [60, 65, 70, 75, 80, 85, 90, 95];

const objetivoGuardado = () => {
  try {
    const valor = Number(window.localStorage.getItem("pickupObjetivoOcupacion"));
    return OBJETIVOS.includes(valor) ? valor : 75;
  } catch {
    return 75;
  }
};

const etiqueta = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
};

const fechaCorta = (ymd) => {
  if (!ymd) return "—";
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} de ${MESES[m - 1].toLowerCase()}`;
};

const numeroConSigno = (valor) => `${valor >= 0 ? "+" : ""}${valor}`;

const claseDiferencia = (valor) => {
  if (valor > 0) return "positivo";
  if (valor < 0) return "negativo";
  return "neutro";
};

const textoDiferencia = (historico) => {
  const diferencia = numeroConSigno(historico.diferenciaRoomNoches);
  if (historico.diferenciaPct === null) {
    return `${diferencia} frente a la referencia`;
  }
  if (historico.diferenciaRoomNoches === 0) return "Igual a la referencia";
  const direccion = historico.diferenciaRoomNoches > 0 ? "por encima" : "por debajo";
  return `${Math.abs(historico.diferenciaPct)}% ${direccion} de la referencia`;
};

export default function Pickup() {
  const [dias, setDias] = useState(7);
  const [objetivo, setObjetivo] = useState(objetivoGuardado);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    axios
      .get(
        `http://${process.env.REACT_APP_URL_PRODUCCION}/api/pickup?dias=${dias}&objetivo=${objetivo}`
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
  }, [dias, objetivo]);

  useEffect(() => {
    try {
      window.localStorage.setItem("pickupObjetivoOcupacion", String(objetivo));
    } catch {
      // La vista funciona aunque el navegador no permita almacenamiento local.
    }
  }, [objetivo]);

  const meses = (data && data.meses) || [];
  const maxAbsRoomNoches = Math.max(
    1,
    ...meses.map((m) => Math.abs(m.roomNoches || 0))
  );
  const neto = data ? data.totales.nuevas - data.totales.canceladas : 0;
  const netoRoomNoches = data ? data.totales.roomNoches || 0 : 0;
  const anioReferencia = data?.referencia?.periodos?.[0]?.desde?.slice(0, 4);

  return (
    <div className="pickup">
      <div className="pickup-head">
        <div className="pickup-eyebrow">Movimiento de reservas</div>
        <h2 className="pickup-titulo">Pickup de los últimos {dias} días</h2>
        <div className="pickup-periodo">
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
        <label className="pickup-goal-setting">
          Objetivo de ocupación
          <select
            value={objetivo}
            onChange={(evento) => setObjetivo(Number(evento.target.value))}
          >
            {OBJETIVOS.map((valor) => (
              <option key={valor} value={valor}>{valor}%</option>
            ))}
          </select>
        </label>
      </div>

      {loading && <div className="pickup-state">Cargando…</div>}
      {error && !loading && <div className="pickup-state err">{error}</div>}

      {!loading && !error && data && (
        <>
          <p className="pickup-contexto">
            Reservas creadas y canceladas del {fechaCorta(data.desde)} al{" "}
            {fechaCorta(data.hoy)}, agrupadas por mes de llegada.
          </p>

          <div className="pickup-summary" aria-label="Resumen del pickup">
            <div className="pickup-main-card">
              <span>Pickup neto</span>
              <strong className={netoRoomNoches >= 0 ? "positivo" : "negativo"}>
                {numeroConSigno(netoRoomNoches)}
              </strong>
              <small>habitaciones-noche</small>
              <small>{numeroConSigno(neto)} habitaciones</small>
            </div>
            <div className="pickup-mini-card">
              <span>Nuevas</span>
              <strong>{data.totales.nuevasRoomNoches || 0}</strong>
              <small>habitaciones-noche</small>
            </div>
            <div className="pickup-mini-card canceladas">
              <span>Canceladas</span>
              <strong>{data.totales.canceladasRoomNoches || 0}</strong>
              <small>habitaciones-noche</small>
            </div>
          </div>

          {data.historico ? (
            <section className="pickup-history" aria-label="Comparación histórica">
              <div className="pickup-history-head">
                <span>Comparación histórica</span>
                <small>
                  {anioReferencia ? `Mismo período de ${anioReferencia}` : "Período comparable"}
                </small>
              </div>
              <div className="pickup-history-values">
                <div>
                  <small>Pickup actual</small>
                  <b>{numeroConSigno(netoRoomNoches)}</b>
                </div>
                <span aria-hidden="true">vs</span>
                <div>
                  <small>Referencia</small>
                  <b>{numeroConSigno(data.historico.referenciaRoomNoches)}</b>
                </div>
              </div>
              <div
                className={`pickup-history-result ${claseDiferencia(
                  data.historico.diferenciaRoomNoches
                )}`}
              >
                {textoDiferencia(data.historico)}
              </div>
              <p>
                Comparación en habitaciones-noche para meses de llegada equivalentes.
                Esta referencia describe el ritmo; todavía no lo califica como bueno o malo.
              </p>
            </section>
          ) : (
            <div className="pickup-history-empty">
              Aún no hay un período histórico completo para comparar.
            </div>
          )}

          {data.objetivo && (
            <section className="pickup-goal-summary" aria-label="Resumen del objetivo">
              <div>
                <span>Objetivo final</span>
                <b>{data.objetivo.objetivoPct}%</b>
              </div>
              <div>
                <span>Meses al ritmo esperado</span>
                <b>
                  {data.objetivo.mesesEnRitmo} de {data.objetivo.mesesEvaluados}
                </b>
              </div>
              <p>
                {data.objetivo.mesesEvaluados === 0
                  ? "No existe una referencia histórica suficiente para calcular el ritmo esperado."
                  : data.objetivo.faltantesRitmoRoomNoches > 0
                    ? `Faltan ${data.objetivo.faltantesRitmoRoomNoches} habitaciones-noche para alcanzar el ritmo esperado a esta fecha.`
                    : "Los meses evaluados están al día con el ritmo necesario."}
              </p>
              <div className="pickup-goal-legend">
                <span className="ocupacion">Ocupación actual</span>
                <span className="ritmo">Meta de hoy</span>
                <span className="final">Objetivo final</span>
              </div>
            </section>
          )}

          <details className="pickup-help">
            <summary>¿Qué significa cada dato?</summary>
            <div>
              <p><b>Nuevas:</b> reservas creadas durante el período seleccionado.</p>
              <p><b>Canceladas:</b> reservas canceladas durante ese período.</p>
              <p><b>Pickup neto:</b> nuevas menos canceladas.</p>
              <p><b>Habitación-noche:</b> una habitación ocupada durante una noche.</p>
              <p><b>Objetivo:</b> porcentaje de la capacidad mensual que se quiere ocupar.</p>
              <p><b>Meta a esta fecha:</b> parte del objetivo final que normalmente ya estaba vendida con esta misma antelación.</p>
              <p><b>Ocupación:</b> noches ya registradas o reservadas dentro del mes calendario.</p>
            </div>
          </details>

          {meses.length === 0 && (
            <div className="pickup-state">Sin movimiento en la ventana.</div>
          )}

          {meses.length > 0 && (
            <div className="pickup-section-title">Desglose por mes de llegada</div>
          )}

          <div className="pickup-list">
            {meses.map((m) => {
              const n = m.nuevas - m.canceladas;
              const rn = m.roomNoches || 0;
              const w = (Math.abs(rn) / maxAbsRoomNoches) * 50;
              const pos = rn >= 0;
              const objetivoMes = m.objetivo;
              const ritmoMes = objetivoMes?.ritmo;
              return (
                <div className="pickup-row" key={m.mes}>
                  <div className="pickup-row-head">
                    <span className="pickup-month">{etiqueta(m.mes)}</span>
                    <span className={`pickup-net ${pos ? "positivo" : "negativo"}`}>
                      {numeroConSigno(rn)} habitaciones-noche
                    </span>
                  </div>
                  <div className="pickup-breakdown">
                    {m.nuevas} habitaciones nuevas · {m.canceladas} canceladas ·{" "}
                    {numeroConSigno(n)} netas
                  </div>
                  {m.historico && (
                    <div className="pickup-row-history">
                      Referencia: {numeroConSigno(m.historico.referenciaRoomNoches)} ·{" "}
                      <span className={claseDiferencia(m.historico.diferenciaRoomNoches)}>
                        {numeroConSigno(m.historico.diferenciaRoomNoches)} frente al año anterior
                      </span>
                    </div>
                  )}
                  {objetivoMes && (
                    <div className="pickup-row-goal">
                      <div className="pickup-row-goal-head">
                        {m.evaluacion && (
                          <span className={`pickup-status ${m.evaluacion.codigo}`}>
                            {m.evaluacion.etiqueta}
                          </span>
                        )}
                        <span>
                          Ocupación a esta fecha {objetivoMes.ocupacionPct}%
                          {ritmoMes ? ` · meta de hoy ${ritmoMes.metaHoyPct}%` : ""}
                        </span>
                      </div>
                      <div className="pickup-goal-track" aria-hidden="true">
                        <span
                          className="pickup-goal-fill"
                          style={{ width: `${Math.min(100, objetivoMes.ocupacionPct)}%` }}
                        />
                        <span
                          className="pickup-goal-marker final"
                          style={{ left: `${objetivoMes.objetivoPct}%` }}
                        />
                        {ritmoMes && (
                          <span
                            className="pickup-goal-marker ritmo"
                            style={{ left: `${ritmoMes.metaHoyPct}%` }}
                          />
                        )}
                      </div>
                      <small>
                        {ritmoMes
                          ? ritmoMes.enRitmo
                            ? `${numeroConSigno(ritmoMes.diferenciaHoyRoomNoches)} habitaciones-noche sobre el ritmo · meta final ${objetivoMes.objetivoPct}%`
                            : `Faltan ${ritmoMes.faltantesHoyRoomNoches} habitaciones-noche para el ritmo de hoy · meta final ${objetivoMes.objetivoPct}%`
                          : `Meta final ${objetivoMes.objetivoPct}% · faltan ${objetivoMes.faltantesRoomNoches} habitaciones-noche`}
                      </small>
                    </div>
                  )}
                  <div className="pickup-track">
                    <div
                      className={`pickup-fill ${pos ? "positivo" : "negativo"}`}
                      style={{
                        width: `${w}%`,
                        left: pos ? "50%" : `${50 - w}%`,
                      }}
                    />
                    <span className="pickup-zero" aria-hidden="true" />
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

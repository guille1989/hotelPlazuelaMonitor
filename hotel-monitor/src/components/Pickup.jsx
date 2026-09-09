import React, { useState, useEffect } from "react";
import axios from "axios";
import { MESES } from "../config";
import Carrusel from "./Carrusel";
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
              <p><b>Ritmo mensual:</b> compara el total de habitaciones-noche del mes con su trayectoria histórica.</p>
              <p><b>Ritmo diario:</b> compara cada fecha por separado con lo que su fecha equivalente histórica llevaba vendido a la misma antelación.</p>
              <p><b>Día próximo en riesgo:</b> estancia a 14 días o menos cuya ocupación está por debajo de la meta esperada a día de hoy.</p>
            </div>
          </details>

          {meses.length === 0 && (
            <div className="pickup-state">Sin movimiento en la ventana.</div>
          )}

          {meses.length > 0 && (
            <div className="pickup-section-title">Desglose por mes de llegada</div>
          )}

          {meses.length > 0 && (
            <div className="pickup-list">
              <Carrusel
                reinicioClave={`${dias}-${objetivo}-${meses
                  .map((mes) => mes.mes)
                  .join("-")}`}
                slides={meses.map((m) => {
              const n = m.nuevas - m.canceladas;
              const rn = m.roomNoches || 0;
              const w = (Math.abs(rn) / maxAbsRoomNoches) * 50;
              const pos = rn >= 0;
              const objetivoMes = m.objetivo;
              const ritmoMes = objetivoMes?.ritmo;
              return {
                titulo: etiqueta(m.mes),
                contenido: (
                <div className="pickup-row pickup-slide">
                  <div className="pickup-row-head">
                    <span className={`pickup-net ${pos ? "positivo" : "negativo"}`}>
                      {numeroConSigno(rn)} habitaciones-noche
                    </span>
                  </div>
                  <div className="pickup-breakdown">
                    {m.nuevas} habitaciones nuevas · {m.canceladas} canceladas ·{" "}
                    {numeroConSigno(n)} netas
                  </div>
                  {objetivoMes && (
                    <div className="pickup-row-goal">
                      <div className="pickup-row-goal-head">
                        {m.evaluacion && (
                          <span className="pickup-monthly-status">
                            Ritmo mensual
                            <span className={`pickup-status ${m.evaluacion.codigo}`}>
                              {m.evaluacion.etiqueta}
                            </span>
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
                  {objetivoMes?.resumenDiario && (
                    <section className="pickup-daily" aria-label={`Ritmo diario de ${etiqueta(m.mes)}`}>
                      <div className="pickup-daily-summary">
                        <div>
                          <span>Bajo objetivo final diario</span>
                          <b>{objetivoMes.resumenDiario.diasBajoObjetivoFinal}</b>
                          <small>días</small>
                        </div>
                        <div>
                          <span>Bajo ritmo esperado</span>
                          <b>{objetivoMes.resumenDiario.diasBajoRitmoEsperado}</b>
                          <small>días</small>
                        </div>
                        <div className={objetivoMes.resumenDiario.diasProximosEnRiesgo ? "riesgo" : ""}>
                          <span>Próximos en riesgo</span>
                          <b>{objetivoMes.resumenDiario.diasProximosEnRiesgo}</b>
                          <small>≤ 14 días</small>
                        </div>
                      </div>
                      {objetivoMes.resumenDiario.diasSinReferenciaHistorica > 0 && (
                        <div className="pickup-daily-no-reference">
                          <span className="pickup-status sin_referencia">
                            Sin referencia histórica
                          </span>
                          {` para ${objetivoMes.resumenDiario.diasSinReferenciaHistorica} días; no se cuentan como días bajo ritmo.`}
                        </div>
                      )}
                      {objetivoMes.resumenDiario.diasEnRiesgo.length > 0 && (
                        <div className="pickup-risk-list">
                          <div className="pickup-risk-title">Días próximos por debajo del ritmo</div>
                          {objetivoMes.resumenDiario.diasEnRiesgo.map((dia) => (
                            <div className="pickup-risk-day" key={dia.fecha}>
                              <div className="pickup-risk-day-head">
                                <b>{fechaCorta(dia.fecha)}</b>
                                <span className={`pickup-status ${dia.evaluacion.codigo}`}>
                                  {dia.evaluacion.etiqueta}
                                </span>
                              </div>
                              <div className="pickup-risk-values">
                                <span>
                                  Ocupación actual
                                  <b>{dia.habitacionesOcupadas} hab. · {dia.ocupacionPct}%</b>
                                </span>
                                <span>
                                  Meta esperada hoy
                                  <b>{dia.metaEsperadaHoyHabitaciones} hab. · {dia.metaEsperadaHoyPct}%</b>
                                </span>
                                <span>
                                  Faltan para el ritmo
                                  <b>{dia.faltantesMetaEsperadaHoyHabitaciones} hab.</b>
                                </span>
                              </div>
                              <small>
                                {dia.diasRestantes === 0
                                  ? "Estancia hoy"
                                  : `Faltan ${dia.diasRestantes} días para la estancia`}
                                {` · objetivo final diario ${dia.objetivoFinalHabitaciones} hab. (${dia.objetivoFinalPct}%)`}
                              </small>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
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
                ),
              };
            })}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

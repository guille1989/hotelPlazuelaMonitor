import React, { useState, useEffect } from "react";
import axios from "axios";
import { MESES_CORTO, formatCOP } from "../config";
import { apiUrl } from "../api";
import "./Tarifas.css";

// Mismo objetivo de ocupación que Pickup (se comparte la preferencia guardada).
const OBJETIVOS = [60, 65, 70, 75, 80, 85, 90, 95];
const CLAVE_OBJETIVO = "pickupObjetivoOcupacion";
const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const objetivoGuardado = () => {
  try {
    const valor = Number(window.localStorage.getItem(CLAVE_OBJETIVO));
    return OBJETIVOS.includes(valor) ? valor : 75;
  } catch {
    return 75;
  }
};

// "2026-10-04" -> "Dom 4 oct"
const fechaCorta = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const semana = DIAS_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${semana} ${d} ${MESES_CORTO[m - 1].toLowerCase()}`;
};

const conSigno = (pct) => `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}%`;

const textoPosicion = ({ lugar, de }) => {
  if (lugar === 1) return `el más barato de ${de}`;
  if (lugar === de) return `el más caro de ${de}`;
  return `${lugar}.º más barato de ${de}`;
};

const TITULO_ALERTA = {
  caro_vacio: "Caro y vacío",
  barato_lleno: "Barato y lleno",
};

const mensajeAlerta = (f, totalHabitaciones) =>
  f.alerta === "caro_vacio"
    ? `${fechaCorta(f.dia)}: ${f.diferenciaPct}% sobre la mediana y ${f.ocupacion.habitaciones} de ${totalHabitaciones} habitaciones vendidas (${f.ocupacion.pct}%).`
    : `${fechaCorta(f.dia)}: ${Math.abs(f.diferenciaPct)}% bajo la mediana con ${f.ocupacion.pct}% de ocupación; hay margen para subir.`;

// Por qué un precio no entra en la mediana (nonComparableReasons del backend).
// Visible en la fila: en el celular no hay tooltip.
const TEXTO_MOTIVO = {
  cancelacion_no_confirmada: "sin cancelación gratis",
  cancelacion_no_flexible: "no reembolsable",
  impuestos_no_confirmados: "impuestos sin confirmar",
  tarifa_no_publica: "tarifa no pública",
  tarifa_de_miembro: "tarifa de miembro",
  moneda_no_cop: "en otra moneda",
};

const textoMotivos = (motivos) =>
  motivos.map((m) => TEXTO_MOTIVO[m]).filter(Boolean).join(" · ") || "no comparable";

const TEXTO_SIN_PRECIO = {
  sin_precio_booking: "sin Booking",
  sin_precio_publicado: "sin precio",
};

// Escala común a todas las fechas, para que la altura del precio se compare
// también entre días y no solo dentro de cada fila.
const escalaPrecios = (fechas) => {
  const precios = fechas.flatMap((f) => f.hoteles.map((h) => h.precio).filter(Boolean));
  if (precios.length === 0) return null;
  const min = Math.min(...precios);
  const max = Math.max(...precios);
  const margen = Math.max((max - min) * 0.05, 1);
  return { min: min - margen, max: max + margen };
};

function Pista({ fecha, escala }) {
  if (!escala) return null;
  const pos = (precio) => `${((precio - escala.min) * 100) / (escala.max - escala.min)}%`;
  const competidores = fecha.hoteles.filter((h) => !h.propio && h.precio !== null);
  return (
    <div className="tarifas-pista" aria-hidden="true">
      {fecha.minimo !== null && (
        <div
          className="tarifas-pista-rango"
          style={{
            left: pos(fecha.minimo),
            width: `calc(${pos(fecha.maximo)} - ${pos(fecha.minimo)})`,
          }}
        />
      )}
      {competidores.map((h) => (
        <div
          key={h.hotelId}
          className={`tarifas-pista-punto ${h.estado === "comparable" ? "" : "hueco"}`}
          style={{ left: pos(h.precio) }}
        />
      ))}
      {fecha.mediana !== null && (
        <div className="tarifas-pista-mediana" style={{ left: pos(fecha.mediana) }} />
      )}
      {fecha.precioPropio !== null && (
        <div className="tarifas-pista-propio" style={{ left: pos(fecha.precioPropio) }} />
      )}
    </div>
  );
}

function DetalleHoteles({ fecha }) {
  const maximo = Math.max(1, ...fecha.hoteles.map((h) => h.precio || 0));
  return (
    <ul className="tarifas-hoteles">
      {fecha.hoteles.map((h) => (
        <li
          key={h.hotelId}
          className={[
            h.propio ? "propio" : "",
            h.estado === "comparable" ? "" : "atenuado",
          ].join(" ")}
        >
          <span className="tarifas-hotel-nombre" title={h.habitacion || undefined}>
            <span>{h.nombre}</span>
            {h.estado === "no_comparable" && (
              <small className="tarifas-hotel-motivo">{textoMotivos(h.motivos)}</small>
            )}
          </span>
          {h.precio !== null ? (
            <>
              <span className="tarifas-hotel-barra">
                <span style={{ width: `${(h.precio * 100) / maximo}%` }} />
              </span>
              <span className="tarifas-hotel-precio">{formatCOP(h.precio)}</span>
            </>
          ) : (
            <span className="tarifas-hotel-sin">{TEXTO_SIN_PRECIO[h.error] || "sin precio"}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Tarifas() {
  const [objetivo, setObjetivo] = useState(objetivoGuardado);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [abiertas, setAbiertas] = useState(() => new Set());

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    axios
      .get(apiUrl(`/api/tarifas?objetivo=${objetivo}`))
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
  }, [objetivo]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CLAVE_OBJETIVO, String(objetivo));
    } catch {
      // La vista funciona aunque el navegador no permita almacenamiento local.
    }
  }, [objetivo]);

  const alternar = (dia) =>
    setAbiertas((previas) => {
      const nuevas = new Set(previas);
      if (nuevas.has(dia)) nuevas.delete(dia);
      else nuevas.add(dia);
      return nuevas;
    });

  const fechas = (data && data.fechas) || [];
  const escala = escalaPrecios(fechas);
  const alertas = fechas.filter((f) => f.alerta);
  const directos = fechas.length
    ? fechas[0].hoteles.filter((h) => !h.propio && h.grupo === "directo").length
    : 0;
  const resumen = data && data.ejecucion && data.ejecucion.summary;

  return (
    <div className="tarifas">
      <div className="tarifas-head">
        <div className="tarifas-eyebrow">Competencia en Booking</div>
        <h2 className="tarifas-titulo">
          Tu tarifa frente a {directos || "los"} directos
        </h2>
        {data && data.ejecucion && (
          <div className="tarifas-meta">
            Captura {fechaCorta(data.ejecucion.capturedDate).toLowerCase()} · precio visto
            desde EE. UU.
          </div>
        )}
        <label className="tarifas-objetivo">
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

      {loading && <div className="tarifas-state">Cargando…</div>}
      {error && !loading && <div className="tarifas-state err">{error}</div>}

      {!loading && !error && data && !data.ejecucion && (
        <div className="tarifas-state">Todavía no hay capturas de tarifas.</div>
      )}

      {!loading && !error && data && data.ejecucion && (
        <>
          {alertas.map((f) => (
            <div key={f.dia} className={`tarifas-alerta ${f.alerta}`}>
              <span className="tarifas-alerta-badge">{TITULO_ALERTA[f.alerta]}</span>
              <p>{mensajeAlerta(f, data.totalHabitaciones)}</p>
            </div>
          ))}

          <div className="tarifas-leyenda" aria-hidden="true">
            <span><i className="propio" /> La Plazuela</span>
            <span><i className="punto" /> competidor</span>
            <span><i className="mediana" /> mediana</span>
            <span><i className="punto hueco" /> no comparable</span>
          </div>

          {fechas.length === 0 && (
            <div className="tarifas-state">La última captura no tiene fechas futuras.</div>
          )}

          <ul className="tarifas-fechas">
            {fechas.map((f) => {
              const abierta = abiertas.has(f.dia);
              return (
                <li key={f.dia} className="tarifas-fecha">
                  <button
                    type="button"
                    className="tarifas-fecha-cabeza"
                    aria-expanded={abierta}
                    onClick={() => alternar(f.dia)}
                  >
                    <span className="tarifas-fecha-dia">
                      <b>{fechaCorta(f.dia)}</b>
                      <small>
                        D+{f.diasHasta} · ocupación {f.ocupacion.pct}%
                      </small>
                    </span>
                    <span className="tarifas-fecha-precio">
                      <b>{f.precioPropio !== null ? formatCOP(f.precioPropio) : "—"}</b>
                      {f.diferenciaPct !== null && (
                        <small className={f.diferenciaPct > 0 ? "arriba" : "abajo"}>
                          {conSigno(f.diferenciaPct)}
                        </small>
                      )}
                    </span>
                  </button>
                  <Pista fecha={f} escala={escala} />
                  <div className="tarifas-fecha-nota">
                    {f.mediana === null
                      ? "Sin competidores comparables"
                      : `Mediana ${formatCOP(f.mediana)}`}
                    {f.posicion && ` · ${textoPosicion(f.posicion)}`}
                    {f.comparables > 0 && f.comparables < 3 &&
                      ` · solo ${f.comparables} comparable${f.comparables === 1 ? "" : "s"}`}
                    {f.precioPropio === null && " · La Plazuela sin precio en Booking"}
                  </div>
                  {abierta && <DetalleHoteles fecha={f} />}
                </li>
              );
            })}
          </ul>

          {resumen && (
            <p className="tarifas-pie">
              {resumen.comparables} de {resumen.esperadas} precios comparables. Toca una
              fecha para ver cada hotel.
            </p>
          )}

          <details className="tarifas-ayuda">
            <summary>¿De dónde salen estos precios?</summary>
            <div>
              <p>
                Una vez por semana se consulta en Google Hotels la tarifa de Booking.com de
                cada hotel para 1 habitación, 2 adultos y 1 noche, prefiriendo la que tiene
                cancelación gratis.
              </p>
              <p>
                <b>Precio visto desde EE. UU.:</b> Booking cambia el precio según el país de
                quien busca. Todos los hoteles se miden igual, así que sirve para comparar,
                pero puede no ser lo que paga un huésped colombiano.
              </p>
              <p>
                <b>Mediana:</b> el precio del medio entre los competidores directos
                comparables (con precio y cancelación gratis confirmada).
              </p>
              <p>
                <b>Sin cancelación gratis:</b> el hotel tiene precio en Booking, pero
                ninguna de sus tarifas para 2 adultos permite cancelar gratis. Se muestra en
                gris y no entra en la mediana, para no comparar tu tarifa flexible con una
                que puede ser no reembolsable (y por eso más barata).
              </p>
              <p>
                <b>Avisos:</b> solo para los próximos {data.diasAlerta} días. "Caro y vacío"
                cuando estás {data.umbralAlertaPct}% o más sobre la mediana con la ocupación
                bajo el objetivo; "Barato y lleno" cuando estás {data.umbralAlertaPct}% o
                más bajo la mediana con la ocupación en el objetivo o encima.
              </p>
              <p>
                <b>Sin precio:</b> Google no muestra tarifa para esa fecha. No significa que
                el hotel esté lleno.
              </p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

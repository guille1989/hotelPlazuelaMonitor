import React, { useState, useEffect } from "react";
import axios from "axios";
import { fechaCorta, formatCOP } from "../config";
import { apiUrl } from "../api";
import Copiloto from "./Copiloto";
import "./Tarifas.css";

// Mismo objetivo de ocupación que Pickup (se comparte la preferencia guardada).
const OBJETIVOS = [60, 65, 70, 75, 80, 85, 90, 95];
const CLAVE_OBJETIVO = "pickupObjetivoOcupacion";
const SUBVISTAS = [
  ["recomendaciones", "Recomendaciones"],
  ["competencia", "Competencia"],
];
const CLAVE_SUBVISTA = "tarifasSubvista";

const leerPreferencia = (clave, validos, porDefecto) => {
  try {
    const valor = window.localStorage.getItem(clave);
    const convertido = typeof porDefecto === "number" ? Number(valor) : valor;
    return validos.includes(convertido) ? convertido : porDefecto;
  } catch {
    return porDefecto;
  }
};

const guardarPreferencia = (clave, valor) => {
  try {
    window.localStorage.setItem(clave, String(valor));
  } catch {
    // La vista funciona aunque el navegador no permita almacenamiento local.
  }
};

const conSigno = (pct) => `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}%`;

const textoPosicion = ({ lugar, de }) => {
  if (lugar === 1) return `el más barato de ${de}`;
  if (lugar === de) return `el más caro de ${de}`;
  return `${lugar}.º más barato de ${de}`;
};

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

// Pestaña Tarifas: el copiloto (qué hacer con cada fecha) y la competencia (precios
// de Booking). El objetivo de ocupación es el mismo de Pickup y vale para las dos.
export default function Tarifas() {
  const [subvista, setSubvista] = useState(() =>
    leerPreferencia(CLAVE_SUBVISTA, SUBVISTAS.map(([id]) => id), "recomendaciones")
  );
  const [objetivo, setObjetivo] = useState(() =>
    leerPreferencia(CLAVE_OBJETIVO, OBJETIVOS, 75)
  );

  useEffect(() => guardarPreferencia(CLAVE_SUBVISTA, subvista), [subvista]);
  useEffect(() => guardarPreferencia(CLAVE_OBJETIVO, objetivo), [objetivo]);

  return (
    <div className="tarifas">
      <div className="tarifas-controles">
        <div className="tarifas-subvistas" role="tablist" aria-label="Vista de tarifas">
          {SUBVISTAS.map(([id, etiqueta]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={subvista === id}
              className={subvista === id ? "activo" : ""}
              onClick={() => setSubvista(id)}
            >
              {etiqueta}
            </button>
          ))}
        </div>
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
      {subvista === "recomendaciones" ? (
        <Copiloto objetivo={objetivo} />
      ) : (
        <Competencia objetivo={objetivo} />
      )}
    </div>
  );
}

export function Competencia({ objetivo }) {
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

  const alternar = (dia) =>
    setAbiertas((previas) => {
      const nuevas = new Set(previas);
      if (nuevas.has(dia)) nuevas.delete(dia);
      else nuevas.add(dia);
      return nuevas;
    });

  const fechas = (data && data.fechas) || [];
  const escala = escalaPrecios(fechas);
  const directos = fechas.length
    ? fechas[0].hoteles.filter((h) => !h.propio && h.grupo === "directo").length
    : 0;
  const resumen = data && data.ejecucion && data.ejecucion.summary;

  return (
    <>
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
      </div>

      {loading && <div className="tarifas-state">Cargando…</div>}
      {error && !loading && <div className="tarifas-state err">{error}</div>}

      {!loading && !error && data && !data.ejecucion && (
        <div className="tarifas-state">Todavía no hay capturas de tarifas.</div>
      )}

      {!loading && !error && data && data.ejecucion && (
        <>
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
                quien busca. A los extranjeros les muestra el precio de La Plazuela sin el
                19 % de IVA (están exentos); un huésped colombiano lo ve con el IVA aparte.
                Algunos competidores, como Popayán Plaza, ya incluyen el IVA en su precio.
                Las recomendaciones comparan con el IVA incluido.
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
                <b>Sin precio:</b> Google no muestra tarifa para esa fecha. No significa que
                el hotel esté lleno.
              </p>
            </div>
          </details>
        </>
      )}
    </>
  );
}

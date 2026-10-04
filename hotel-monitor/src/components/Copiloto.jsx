import React, { useEffect, useState } from "react";
import axios from "axios";
import { TOTAL_HABITACIONES, fechaCorta, formatCOP } from "../config";
import { apiUrl } from "../api";
import "./Copiloto.css";

// Copiloto de tarifas: qué hacer con la tarifa de cada noche de los próximos 60 días.

// Tramos de la lista según cuánto falta para la noche.
const TRAMOS = [
  { hasta: 7, titulo: "Próximos 7 días" },
  { hasta: 14, titulo: "En 8 a 14 días" },
  { hasta: 30, titulo: "En 15 a 30 días" },
  { hasta: Infinity, titulo: "A más de 30 días" },
];

const TIPO_NOCHE = {
  puente: "Puente",
  fin_puente: "Fin de puente",
  festivo: "Festivo",
  semana_santa: "Semana Santa",
};

const conSigno = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}%`;

// Lo que alguien tiene que hacer con esa fecha.
function tarea(rec) {
  if (rec.yaAplicada) return "aplicada";
  if (rec.accion !== "mantener") return rec.accion;
  if (rec.alertas.includes("cotizacion")) return "confirmar";
  return "mantener";
}

const ETIQUETA_TAREA = {
  subir: (r) => `↑ ${r.pct}%`,
  bajar: (r) => `↓ ${Math.abs(r.pct)}%`,
  confirmar: () => "Confirmar grupo",
  mantener: () => "Mantener",
  aplicada: () => "✓ Aplicada",
};

const porRevisar = (rec) => ["subir", "bajar", "confirmar"].includes(tarea(rec));

function resumenFila(rec) {
  const { ocupacion } = rec.senal;
  const partes = [
    `${ocupacion.proyectada} reservadas`,
    `se esperan ${rec.datos.esperada} de ${TOTAL_HABITACIONES}`,
  ];
  if (rec.datos.diferenciaPct !== null) partes.push(`Booking ${conSigno(rec.datos.diferenciaPct)}`);
  if (ocupacion.cotizadas >= 5) partes.push(`${ocupacion.cotizadas} en cotización`);
  return partes.join(" · ");
}

function Detalle({ rec, guardando, error, onAplicar, onDeshacer }) {
  const { senal, datos } = rec;
  const { ocupacion, ritmo, competencia, rango, calendario } = senal;
  const enLibros = [
    `${ocupacion.proyectada}`,
    ocupacion.cotizadas ? `${ocupacion.cotizadas} en cotización` : null,
    ocupacion.grupos ? `${ocupacion.grupos} de grupos` : null,
  ].filter(Boolean);
  const notas = [calendario.festivo, ...calendario.eventos].filter(Boolean);
  const accionable = rec.accion !== "mantener";

  return (
    <div className="cop-detalle">
      <p className="cop-motivo">{rec.motivo}.</p>
      <dl className="cop-datos">
        <dt>En libros</dt>
        <dd>{enLibros.join(" · ")}</dd>
        <dt>Se esperan</dt>
        <dd>
          {datos.esperada} de {TOTAL_HABITACIONES} · objetivo {ocupacion.objetivo}
        </dd>
        <dt>Año pasado</dt>
        <dd>
          {ritmo.alCorteAA} a esta altura · cerró en {ritmo.finalAA ?? "—"}
        </dd>
        <dt>Booking con IVA</dt>
        <dd>
          {competencia && datos.mediana !== null
            ? `${formatCOP(datos.precioPropioConIva)} vs ${formatCOP(datos.mediana)} · ${competencia.comparables} hoteles, captura ${fechaCorta(competencia.capturedDate).toLowerCase()}`
            : "Sin captura de la competencia para esta fecha"}
        </dd>
        {rango && rango.piso !== null && (
          <>
            <dt>Piso y techo</dt>
            <dd>
              {formatCOP(rango.piso)} – {formatCOP(rango.techo)}
            </dd>
          </>
        )}
        {notas.length > 0 && (
          <>
            <dt>Eventos</dt>
            <dd>{notas.join(" · ")}</dd>
          </>
        )}
      </dl>

      {rec.yaAplicada ? (
        <div className="cop-aplicada">
          <span>
            Aplicada el {fechaCorta(rec.yaAplicada.corrida).toLowerCase()}:{" "}
            {rec.yaAplicada.accion} {Math.abs(rec.yaAplicada.pct)}%. No vuelve a pedir
            cambio en 7 días.
          </span>
          <button type="button" disabled={guardando} onClick={onDeshacer}>
            Deshacer
          </button>
        </div>
      ) : (
        accionable && (
          <button
            type="button"
            className="cop-aplicar"
            disabled={guardando}
            onClick={onAplicar}
          >
            {guardando ? "Guardando…" : "Ya cambié el precio en Booking"}
          </button>
        )
      )}
      {error && <div className="cop-error">{error}</div>}
    </div>
  );
}

export default function Copiloto({ objetivo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState("revisar");
  const [abiertas, setAbiertas] = useState(() => new Set());
  const [guardando, setGuardando] = useState(null);
  const [errores, setErrores] = useState({});
  // Fechas marcadas en esta visita: siguen a la vista en "Para revisar" para poder
  // deshacer, en vez de desaparecer al instante.
  const [marcadasAhora, setMarcadasAhora] = useState(() => new Set());

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    axios
      .get(apiUrl(`/api/recomendaciones?dias=60&objetivo=${objetivo}`))
      .then((r) => {
        if (cancelado) return;
        setData(r.data);
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelado) return;
        setError("Error al cargar las recomendaciones");
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

  const actualizar = (dia, yaAplicada) =>
    setData((previa) => ({
      ...previa,
      recomendaciones: previa.recomendaciones.map((r) =>
        r.dia === dia ? { ...r, yaAplicada } : r
      ),
    }));

  const guardarMarca = async (rec, aplicar) => {
    setGuardando(rec.dia);
    setErrores((previos) => ({ ...previos, [rec.dia]: null }));
    try {
      if (aplicar) {
        const r = await axios.post(apiUrl("/api/recomendaciones/aplicada"), {
          dia: rec.dia,
          accion: rec.accion,
          pct: rec.pct,
        });
        actualizar(rec.dia, r.data.aplicada);
        setMarcadasAhora((previas) => new Set(previas).add(rec.dia));
      } else {
        await axios.delete(apiUrl(`/api/recomendaciones/aplicada/${rec.dia}`));
        actualizar(rec.dia, null);
      }
    } catch {
      setErrores((previos) => ({ ...previos, [rec.dia]: "No se pudo guardar. Intenta de nuevo." }));
    } finally {
      setGuardando(null);
    }
  };

  const recomendaciones = (data && data.recomendaciones) || [];
  const pendientes = recomendaciones.filter(porRevisar);
  const aplicadas = recomendaciones.filter((r) => r.yaAplicada && !marcadasAhora.has(r.dia));
  const visibles =
    filtro === "revisar"
      ? recomendaciones.filter((r) => porRevisar(r) || marcadasAhora.has(r.dia))
      : recomendaciones;
  const captura = data && data.capturas && data.capturas[0];

  return (
    <>
      <div className="tarifas-head">
        <div className="tarifas-eyebrow">Copiloto de tarifas</div>
        <h2 className="tarifas-titulo">
          {loading || error
            ? "Qué hacer con tu tarifa"
            : pendientes.length
              ? `${pendientes.length} ${pendientes.length === 1 ? "fecha" : "fechas"} para revisar`
              : "Nada que cambiar por ahora"}
        </h2>
        {data && (
          <div className="tarifas-meta">
            Calculado {fechaCorta(data.hoy).toLowerCase()}
            {captura && ` · competencia del ${fechaCorta(captura).toLowerCase()}`}
          </div>
        )}
      </div>

      {loading && <div className="tarifas-state">Cargando…</div>}
      {error && !loading && <div className="tarifas-state err">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="cop-filtro" role="group" aria-label="Fechas a mostrar">
            <button
              type="button"
              aria-pressed={filtro === "revisar"}
              className={filtro === "revisar" ? "activo" : ""}
              onClick={() => {
                setFiltro("revisar");
                setMarcadasAhora(new Set());
              }}
            >
              Para revisar ({pendientes.length})
            </button>
            <button
              type="button"
              aria-pressed={filtro === "todas"}
              className={filtro === "todas" ? "activo" : ""}
              onClick={() => setFiltro("todas")}
            >
              Todas ({recomendaciones.length})
            </button>
          </div>
          {filtro === "revisar" && aplicadas.length > 0 && (
            <p className="cop-nota">
              {aplicadas.length} ya {aplicadas.length === 1 ? "aplicada" : "aplicadas"}: están
              en "Todas".
            </p>
          )}

          {visibles.length === 0 && (
            <div className="tarifas-state">
              No hay cambios recomendados. Vuelve a mirar después de la captura del sábado.
            </div>
          )}

          {TRAMOS.map((tramo, i) => {
            const desde = i === 0 ? 0 : TRAMOS[i - 1].hasta + 1;
            const delTramo = visibles.filter(
              (r) => r.senal.diasHasta >= desde && r.senal.diasHasta <= tramo.hasta
            );
            if (delTramo.length === 0) return null;
            return (
              <section key={tramo.titulo} className="cop-tramo">
                <h3>{tramo.titulo}</h3>
                <ul className="cop-lista">
                  {delTramo.map((rec) => {
                    const t = tarea(rec);
                    const abierta = abiertas.has(rec.dia);
                    const tipo = TIPO_NOCHE[rec.senal.calendario.tipo];
                    return (
                      <li key={rec.dia} className={`cop-fila ${t}`}>
                        <button
                          type="button"
                          className="cop-cabeza"
                          aria-expanded={abierta}
                          onClick={() => alternar(rec.dia)}
                        >
                          <span className="cop-fecha">
                            <b>{fechaCorta(rec.dia)}</b>
                            {tipo && <em>{tipo}</em>}
                          </span>
                          <span className="cop-accion">
                            <span className={`cop-badge ${t}`}>{ETIQUETA_TAREA[t](rec)}</span>
                            <small className={`cop-confianza ${rec.confianza}`}>
                              confianza {rec.confianza}
                            </small>
                          </span>
                        </button>
                        <div className="cop-resumen">{resumenFila(rec)}</div>
                        {abierta && (
                          <Detalle
                            rec={rec}
                            guardando={guardando === rec.dia}
                            error={errores[rec.dia]}
                            onAplicar={() => guardarMarca(rec, true)}
                            onDeshacer={() => guardarMarca(rec, false)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          <details className="tarifas-ayuda">
            <summary>¿Cómo decide el copiloto?</summary>
            <div>
              <p>
                <b>Se esperan:</b> lo que ya está en libros más lo que el año pasado entró
                desde esta misma antelación, en noches parecidas (mismo día de la semana o
                el mismo tipo de puente). Las cotizaciones no cuentan como seguras. Si este
                año se está reservando más lento, el pronóstico se ajusta a la baja.
              </p>
              <p>
                <b>Precio:</b> tu tarifa de Booking con IVA, que es lo que ve un huésped
                colombiano, contra la mediana de los competidores directos. A ±10% está en
                línea.
              </p>
              <p>
                <b>Qué recomienda:</b> subir si se esperan {objetivo}% o más de ocupación,
                sobre todo si estás más barato que la competencia; bajar si se espera menos
                de la mitad y estás más caro. Nunca más de 10% por semana para una fecha.
                Con un evento fuerte no baja, y solo sube si las reservas lo confirman.
              </p>
              <p>
                <b>Confianza:</b> baja cuando no hay precio de la competencia para esa fecha,
                la captura tiene más de 14 días, no hay datos del año pasado, hay una
                cotización grande o la fecha está a más de 45 días.
              </p>
              <p>
                <b>Ya cambié el precio:</b> márcalo después de cambiar la tarifa en Booking.
                Esa fecha no vuelve a pedir cambio en 7 días: hasta la captura del sábado el
                copiloto todavía ve el precio anterior. Sirve también para medir qué tan
                bien recomienda.
              </p>
            </div>
          </details>
        </>
      )}
    </>
  );
}

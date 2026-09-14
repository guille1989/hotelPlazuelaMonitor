import "./App.css";
import React, { useEffect, useState } from "react";
import axios from "axios";

import TopBar from "./components/top/TopBar";
import StatCard from "./components/statcard/StatCard";
import OcupacionMes from "./components/linechart/OcupacionMes";
import ResumenPeriodo from "./components/linechart/ResumenPeriodo";
import Pickup from "./components/Pickup";
import CanalesTorta from "./components/CanalesTorta";
import Carrusel from "./components/Carrusel";
import { TOTAL_HABITACIONES, formatCOP, MESES } from "./config";
import { apiUrl } from "./api";

// "2026-09-08" -> "8 de septiembre"
const fechaCortaDia = (ymd) => {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} de ${MESES[m - 1].toLowerCase()}`;
};

// Suma el objeto `canal` de cada mes de un array de meses (vista Resumen).
const sumarCanal = (meses) => {
  const c = {};
  for (const m of meses || []) {
    for (const [k, v] of Object.entries(m.canal || {})) {
      c[k] = (c[k] || 0) + v;
    }
  }
  return c;
};

function App() {
  const [reservasHoy, setReservasHoy] = useState([]);
  const [reservasCanceladasHoy, setReservasCanceladasHoy] = useState([]);
  const [vista, setVista] = useState("hoy"); // "hoy" | "mes" | "resumen" | "pickup"
  const [mesData, setMesData] = useState(null); // datos del mes en la gráfica
  const [diaActivo, setDiaActivo] = useState(null); // día seleccionado en la gráfica
  const [periodoData, setPeriodoData] = useState(null); // datos del periodo (resumen)

  useEffect(() => {
    let cancelado = false;
    axios
      .get(apiUrl("/api/reservas"))
      .then((r) => {
        if (!cancelado) setReservasHoy(r.data);
      })
      .catch((e) => console.error("Error cargando reservas de hoy:", e.message));

    axios
      .get(apiUrl("/api/reservascanceladas"))
      .then((r) => {
        if (!cancelado) setReservasCanceladasHoy(r.data);
      })
      .catch((e) =>
        console.error("Error cargando cancelaciones de hoy:", e.message)
      );

    return () => {
      cancelado = true;
    };
  }, []);

  // Habitaciones que aporta una fila (los walk-ins sin cantid_reh cuentan como 1).
  const habitaciones = (reserva) => {
    const cantidad = parseInt(reserva.cantid_reh, 10);
    return cantidad > 0 ? cantidad : 1;
  };
  const enCasa = (reserva) =>
    parseInt(reserva.estado_habitacion, 10) === 31 ||
    (reserva.origen || "").toLowerCase().includes("sin reserva");

  const ocupacionActual = reservasHoy
    .filter(enCasa)
    .reduce((total, reserva) => total + habitaciones(reserva), 0);
  const ocupacionProyectada = reservasHoy.reduce(
    (total, reserva) => total + habitaciones(reserva),
    0
  );
  const ocupacionActualPct = Number(
    ((ocupacionActual * 100) / TOTAL_HABITACIONES).toFixed(2)
  );
  const ocupacionProyectadaPct = Number(
    ((ocupacionProyectada * 100) / TOTAL_HABITACIONES).toFixed(2)
  );
  const personasEnHotel = reservasHoy
    .filter(enCasa)
    .reduce(
      (total, reserva) =>
        total +
        (parseInt(reserva.adultos, 10) || 0) +
        (parseInt(reserva.ninos, 10) || 0),
      0
    );
  const cancelacionesHoy = reservasCanceladasHoy.reduce(
    (total, reserva) => total + habitaciones(reserva),
    0
  );
  const reservasConTarifa = reservasHoy.filter(
    (reserva) => Number(reserva.valor_habitacion) > 0
  );
  const habitacionesConTarifa = reservasConTarifa.reduce(
    (total, reserva) => total + habitaciones(reserva),
    0
  );
  const totalTarifasHoy = reservasConTarifa.reduce(
    (total, reserva) =>
      total + Number(reserva.valor_habitacion) * habitaciones(reserva),
    0
  );
  const tarifaPromedioHoy =
    habitacionesConTarifa > 0
      ? Math.round(totalTarifasHoy / habitacionesConTarifa)
      : 0;

  // Métricas agregadas del mes seleccionado en la gráfica.
  let metricasMes = null;
  if (mesData && mesData.dias.length) {
    const ocup = mesData.dias.map((d) => d.ocupacion);
    const suma = ocup.reduce((a, b) => a + b, 0);
    const totalTarifasMes = mesData.dias.reduce((a, d) => a + (d.tarifas || 0), 0);
    const habsTarifaMes = mesData.dias.reduce(
      (a, d) => a + (d.habsTarifa || 0),
      0
    );
    const capacidadMes = ocup.length * TOTAL_HABITACIONES;
    const arr = mesData.arribo || {
      checkin: 0,
      reservadas: 0,
      canceladas: 0,
      roomNoches: 0,
      antelacionDias: 0,
      antelacionN: 0,
    };
    const habsArribo = arr.checkin + arr.reservadas;
    const totalArribo = habsArribo + arr.canceladas;
    metricasMes = {
      media: Math.round((suma * 100) / capacidadMes),
      pico: Math.max(...ocup),
      llenos: ocup.filter((o) => o >= TOTAL_HABITACIONES).length,
      canceladas: mesData.dias.reduce((a, d) => a + d.cancelaciones, 0),
      totalTarifas: totalTarifasMes,
      tarifaPromedio:
        habsTarifaMes > 0 ? Math.round(totalTarifasMes / habsTarifaMes) : 0,
      revpar: Math.round(totalTarifasMes / capacidadMes),
      los: habsArribo > 0 ? arr.roomNoches / habsArribo : 0,
      tasaCancelacion:
        totalArribo > 0 ? Math.round((arr.canceladas * 100) / totalArribo) : 0,
      antelacion:
        arr.antelacionN > 0
          ? Math.round(arr.antelacionDias / arr.antelacionN)
          : 0,
    };
  }

  // Métricas agregadas de un conjunto de meses (vista Resumen).
  const agregarMeses = (M) => {
    if (!M || !M.length) return null;
    const sum = (f) => M.reduce((a, x) => a + (x[f] || 0), 0);
    const capacidad = sum("dias") * TOTAL_HABITACIONES;
    const habsTarifa = sum("habsTarifa");
    const habsArribo = sum("checkin") + sum("reservadas");
    const totalArribo = habsArribo + sum("canceladasLlegada");
    const antN = sum("antelacionN");
    return {
      media: capacidad > 0 ? Math.round((sum("habNoche") * 100) / capacidad) : 0,
      checkin: sum("checkin"),
      reservadas: sum("reservadas"),
      canceladas: sum("canceladasLlegada"),
      tarifaPromedio: habsTarifa > 0 ? Math.round(sum("tarifas") / habsTarifa) : 0,
      totalTarifas: sum("tarifas"),
      revpar: capacidad > 0 ? Math.round(sum("tarifas") / capacidad) : 0,
      los: habsArribo > 0 ? sum("roomNoches") / habsArribo : 0,
      tasaCancelacion:
        totalArribo > 0
          ? Math.round((sum("canceladasLlegada") * 100) / totalArribo)
          : 0,
      antelacion: antN > 0 ? Math.round(sum("antelacionDias") / antN) : 0,
    };
  };

  const metricasPeriodo = periodoData ? agregarMeses(periodoData.meses) : null;
  const metricasPeriodoPrev = periodoData
    ? agregarMeses(periodoData.mesesPrev)
    : null;

  // Delta vs periodo anterior. `mayorEsMejor`: true si subir es bueno.
  const deltaPct = (act, prev, mayorEsMejor) => {
    if (prev == null || !metricasPeriodoPrev || prev === 0) return null;
    const d = Math.round(((act - prev) / prev) * 100);
    return {
      texto: `${d >= 0 ? "▲" : "▼"} ${Math.abs(d)}%`,
      tipo: d === 0 ? "neutra" : (d > 0) === mayorEsMejor ? "buena" : "mala",
    };
  };
  const deltaPuntos = (act, prev, mayorEsMejor, dec = 0) => {
    if (prev == null || !metricasPeriodoPrev) return null;
    const d = act - prev;
    const abs = Math.abs(d).toFixed(dec);
    return {
      texto: `${d >= 0 ? "▲" : "▼"} ${abs}${dec === 0 ? " pp" : ""}`,
      tipo: d === 0 ? "neutra" : (d > 0) === mayorEsMejor ? "buena" : "mala",
    };
  };

  return (
    <div className="App">
      <TopBar vista={vista} onVista={setVista} />

      {vista === "hoy" && (
        <Carrusel
          reinicioClave="hoy"
          slides={[
            {
              titulo: "Ocupación",
              contenido: (
                <div className="grupo-cards ocupacion">
                  <StatCard
                    value={`${ocupacionActualPct}%`}
                    sub={`${ocupacionActual} / ${TOTAL_HABITACIONES} hab`}
                    label="Ocupación actual"
                    icon="🛏️"
                    tone="blue"
                    progress={ocupacionActualPct}
                  />
                  <StatCard
                    value={`${ocupacionProyectadaPct}%`}
                    sub={`${ocupacionProyectada} / ${TOTAL_HABITACIONES} hab`}
                    label="Ocupación proyectada"
                    icon="📈"
                    tone="positive"
                    progress={ocupacionProyectadaPct}
                  />
                  <StatCard
                    value={personasEnHotel}
                    sub="en casa"
                    label="Huéspedes"
                    icon="👥"
                    tone="amber"
                  />
                  <StatCard
                    value={cancelacionesHoy}
                    sub="habitaciones"
                    label="Canceladas"
                    icon="✕"
                    tone="red"
                  />
                </div>
              ),
            },
            {
              titulo: "Tarifas e ingresos",
              contenido: (
                <div className="grupo-cards tres">
                  <StatCard
                    value={formatCOP(tarifaPromedioHoy)}
                    sub="ADR · por hab. vendida"
                    label="Tarifa media diaria"
                    icon="💰"
                    tone="amber"
                  />
                  <StatCard
                    value={formatCOP(
                      Math.round(totalTarifasHoy / TOTAL_HABITACIONES)
                    )}
                    sub="RevPAR · venta ÷ 29"
                    label="Tarifa promedio"
                    icon="📊"
                    tone="blue"
                  />
                  <StatCard
                    value={formatCOP(totalTarifasHoy)}
                    sub="alojamiento del día"
                    label="Total tarifas"
                    icon="🏆"
                    tone="accent"
                    wide
                  />
                </div>
              ),
            },
          ]}
        />
      )}

      {vista === "mes" && (
        <Carrusel
          reinicioClave="mes"
          slides={[
            {
              titulo: `Ocupación${mesData ? ` · ${mesData.titulo}` : ""}`,
              contenido: (
                <div className="grupo-cards ocupacion">
                  <StatCard
                    value={metricasMes ? `${metricasMes.media}%` : "—"}
                    sub="promedio"
                    label="Ocupación media"
                    icon="📊"
                    tone="blue"
                    progress={metricasMes ? metricasMes.media : null}
                  />
                  <StatCard
                    value={metricasMes ? metricasMes.pico : "—"}
                    sub={`/ ${TOTAL_HABITACIONES} hab`}
                    label="Día pico"
                    icon="⬆️"
                    tone="positive"
                  />
                  <StatCard
                    value={metricasMes ? metricasMes.llenos : "—"}
                    sub="días"
                    label="Días llenos"
                    icon="🏨"
                    tone="amber"
                  />
                  <StatCard
                    value={metricasMes ? metricasMes.canceladas : "—"}
                    sub="habitaciones"
                    label="Canceladas"
                    icon="✕"
                    tone="red"
                  />
                </div>
              ),
            },
            {
              titulo: "Tarifas e ingresos",
              contenido: (
                <div className="grupo-cards tres">
                  <StatCard
                    value={
                      metricasMes ? formatCOP(metricasMes.tarifaPromedio) : "—"
                    }
                    sub="ADR · por hab.-noche"
                    label="Tarifa media diaria"
                    icon="💰"
                    tone="amber"
                  />
                  <StatCard
                    value={metricasMes ? formatCOP(metricasMes.revpar) : "—"}
                    sub="RevPAR · venta ÷ 29"
                    label="Tarifa promedio"
                    icon="📊"
                    tone="blue"
                  />
                  <StatCard
                    value={
                      metricasMes ? formatCOP(metricasMes.totalTarifas) : "—"
                    }
                    sub="alojamiento del mes"
                    label="Total tarifas"
                    icon="🏆"
                    tone="accent"
                    wide
                  />
                </div>
              ),
            },
            {
              titulo: "Comercial",
              contenido: (
                <div className="grupo-cards tres">
                  <StatCard
                    value={metricasMes ? metricasMes.los.toFixed(1) : "—"}
                    sub="noches por reserva"
                    label="Estancia media"
                    icon="🛏️"
                    tone="blue"
                  />
                  <StatCard
                    value={
                      metricasMes ? `${metricasMes.antelacion} días` : "—"
                    }
                    sub="al hacer la reserva"
                    label="Antelación media"
                    icon="📅"
                    tone="positive"
                  />
                  <StatCard
                    value={
                      metricasMes ? `${metricasMes.tasaCancelacion}%` : "—"
                    }
                    sub="de las reservas del mes"
                    label="Tasa de cancelación"
                    icon="❌"
                    tone="red"
                    wide
                    progress={metricasMes ? metricasMes.tasaCancelacion : null}
                  />
                </div>
              ),
            },
            {
              titulo: `Canales${
                diaActivo
                  ? ` · ${fechaCortaDia(diaActivo.dia)}`
                  : mesData
                    ? ` · ${mesData.titulo}`
                    : ""
              }`,
              contenido: (
                <CanalesTorta
                  canal={(diaActivo ? diaActivo.canal : mesData?.arribo?.canal) || {}}
                />
              ),
            },
          ]}
        />
      )}

      {vista === "resumen" &&
        (() => {
          const p = metricasPeriodo;
          const pp = p && metricasPeriodoPrev ? metricasPeriodoPrev : null;
          const vs =
            periodoData && periodoData.tituloPrev
              ? ` · vs ${periodoData.tituloPrev}`
              : "";
          const canalPeriodo = periodoData ? sumarCanal(periodoData.meses) : {};
          return (
            <Carrusel
              reinicioClave="resumen"
              slides={[
                {
                  titulo: `Reservas${
                    periodoData ? ` · ${periodoData.titulo}` : ""
                  }${vs}`,
                  contenido: (
                    <div className="grupo-cards ocupacion">
                      <StatCard
                        value={p ? `${p.media}%` : "—"}
                        delta={pp && deltaPuntos(p.media, pp.media, true)}
                        sub="promedio del periodo"
                        label="Ocupación media"
                        icon="📊"
                        tone="teal"
                        progress={p ? p.media : null}
                      />
                      <StatCard
                        value={p ? p.checkin : "—"}
                        delta={pp && deltaPct(p.checkin, pp.checkin, true)}
                        sub="habitaciones"
                        label="Con check-in"
                        icon="✓"
                        tone="accent"
                      />
                      <StatCard
                        value={p ? p.reservadas : "—"}
                        delta={pp && deltaPct(p.reservadas, pp.reservadas, true)}
                        sub="sin llegar"
                        label="Reservadas"
                        icon="📌"
                        tone="blue"
                      />
                      <StatCard
                        value={p ? p.canceladas : "—"}
                        delta={pp && deltaPct(p.canceladas, pp.canceladas, false)}
                        sub="habitaciones"
                        label="Canceladas"
                        icon="✕"
                        tone="red"
                      />
                    </div>
                  ),
                },
                {
                  titulo: `Tarifas e ingresos${vs}`,
                  contenido: (
                    <div className="grupo-cards tres">
                      <StatCard
                        value={p ? formatCOP(p.tarifaPromedio) : "—"}
                        delta={
                          pp && deltaPct(p.tarifaPromedio, pp.tarifaPromedio, true)
                        }
                        sub="ADR · por hab.-noche"
                        label="Tarifa media diaria"
                        icon="💰"
                        tone="amber"
                      />
                      <StatCard
                        value={p ? formatCOP(p.revpar) : "—"}
                        delta={pp && deltaPct(p.revpar, pp.revpar, true)}
                        sub="RevPAR · venta ÷ 29"
                        label="Tarifa promedio"
                        icon="📊"
                        tone="blue"
                      />
                      <StatCard
                        value={p ? formatCOP(p.totalTarifas) : "—"}
                        delta={
                          pp && deltaPct(p.totalTarifas, pp.totalTarifas, true)
                        }
                        sub="alojamiento del periodo"
                        label="Total tarifas"
                        icon="🏆"
                        tone="accent"
                        wide
                      />
                    </div>
                  ),
                },
                {
                  titulo: `Comercial${vs}`,
                  contenido: (
                    <div className="grupo-cards tres">
                      <StatCard
                        value={p ? p.los.toFixed(1) : "—"}
                        delta={pp && deltaPuntos(p.los, pp.los, true, 1)}
                        sub="noches por reserva"
                        label="Estancia media"
                        icon="🛏️"
                        tone="blue"
                      />
                      <StatCard
                        value={p ? `${p.antelacion} días` : "—"}
                        delta={
                          pp && deltaPuntos(p.antelacion, pp.antelacion, true)
                        }
                        sub="al hacer la reserva"
                        label="Antelación media"
                        icon="📅"
                        tone="positive"
                      />
                      <StatCard
                        value={p ? `${p.tasaCancelacion}%` : "—"}
                        delta={
                          pp &&
                          deltaPuntos(
                            p.tasaCancelacion,
                            pp.tasaCancelacion,
                            false
                          )
                        }
                        sub="de las reservas del periodo"
                        label="Tasa de cancelación"
                        icon="❌"
                        tone="red"
                        wide
                        progress={p ? p.tasaCancelacion : null}
                      />
                    </div>
                  ),
                },
                {
                  titulo: `Canales${
                    periodoData ? ` · ${periodoData.titulo}` : ""
                  }`,
                  contenido: <CanalesTorta canal={canalPeriodo} />,
                },
              ]}
            />
          );
        })()}

      {vista === "pickup" && <Pickup />}
      {vista === "resumen" && <ResumenPeriodo onData={setPeriodoData} />}
      {(vista === "hoy" || vista === "mes") && (
        <OcupacionMes onData={setMesData} onDiaActivo={setDiaActivo} />
      )}
    </div>
  );
}

export default App;

import "./App.css";
import React, { useState, useEffect } from "react";
import axios from "axios";

import TopBar from "./components/top/TopBar";
import StatCard from "./components/statcard/StatCard";
import OcupacionMes from "./components/linechart/OcupacionMes";
import ResumenPeriodo from "./components/linechart/ResumenPeriodo";
import Pickup from "./components/Pickup";
import Canales from "./components/Canales";
import Carrusel from "./components/Carrusel";
import { TOTAL_HABITACIONES, formatCOP } from "./config";

function App() {
  const [actualizacionreserva, setActualizacionreserva] = useState([]);
  const [
    actualizacionreservacancelaciones,
    setActualizacionreservacancelaciones,
  ] = useState([]);

  const [occupancyRate, setOccupancyRate] = useState(0);
  const [occupancyWithCheckIn, setOccupancyWithCheckIn] = useState(0);
  const [projectedOccupancy, setProjectedOccupancy] = useState(0);
  const [projectedOcupacionCheckIn, setProjectedOcupacionCheckIn] = useState(0);
  // const [revPAR, setRevPAR] = useState(0);      // Ingresos oculto por ahora
  // const [ingreso, setIngreso] = useState(0);
  const [tarifaPromedio, setTarifaPromedio] = useState(0);
  const [totalTarifas, setTotalTarifas] = useState(0);
  const [personasEnHotel, setPersonasEnHotel] = useState(0);
  const [cancelacionReservas, setCancelacionReservas] = useState(0);

  const [vista, setVista] = useState("hoy"); // "hoy" | "mes" | "resumen"
  const [mesData, setMesData] = useState(null); // datos del mes en la gráfica
  const [periodoData, setPeriodoData] = useState(null); // datos del periodo (resumen)

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

  useEffect(() => {
    const base = `http://${process.env.REACT_APP_URL_PRODUCCION}`;

    axios
      .get(`${base}/api/reservas`)
      .then((r) => setActualizacionreserva(r.data))
      .catch((e) => console.error("Error cargando reservas:", e.message));

    axios
      .get(`${base}/api/reservascanceladas`)
      .then((r) => setActualizacionreservacancelaciones(r.data))
      .catch((e) => console.error("Error cargando cancelaciones:", e.message));
  }, []);

  //Parse the stats data to get the values for the cards
  useEffect(() => {
    if (actualizacionreserva.length > 0) {
      // Habitaciones que aporta una fila (walk-ins sin cantid_reh cuentan 1).
      const habitaciones = (stat) =>
        parseInt(stat.cantid_reh, 10) > 0 ? parseInt(stat.cantid_reh, 10) : 1;

      // "En casa" = check-in hecho (estado_habitacion 31) o walk-in ("sin reserva").
      // Estados 21/11 = reserva de hoy confirmada que aún no llega.
      const enCasa = (stat) =>
        parseInt(stat.estado_habitacion, 10) === 31 ||
        (stat.origen || "").toLowerCase().includes("sin reserva");

      // Ocupación actual: habitaciones con huésped ya en casa ahora.
      const ocupacionActual = actualizacionreserva
        .filter(enCasa)
        .reduce((acc, stat) => acc + habitaciones(stat), 0);

      // Ocupación proyectada: actual + reservas de hoy sin llegar. /api/reservas
      // ya viene sin canceladas, así que es la suma de todo lo que devuelve.
      const ocupacionProyectada = actualizacionreserva.reduce(
        (acc, stat) => acc + habitaciones(stat),
        0
      );

      setOccupancyRate(
        parseFloat(((ocupacionActual * 100) / TOTAL_HABITACIONES).toFixed(2))
      );
      setOccupancyWithCheckIn(ocupacionActual);

      setProjectedOcupacionCheckIn(ocupacionProyectada);
      setProjectedOccupancy(
        parseFloat(((ocupacionProyectada * 100) / TOTAL_HABITACIONES).toFixed(2))
      );

      // Tarifas: basadas en valor_habitacion de la reserva (los walk-ins no traen
      // tarifa, se excluyen del cálculo).
      const conTarifa = actualizacionreserva.filter(
        (stat) => Number(stat.valor_habitacion) > 0
      );
      const habsConTarifa = conTarifa.reduce(
        (acc, stat) => acc + habitaciones(stat),
        0
      );
      const sumaTarifas = conTarifa.reduce(
        (acc, stat) => acc + Number(stat.valor_habitacion) * habitaciones(stat),
        0
      );
      setTotalTarifas(sumaTarifas);
      setTarifaPromedio(
        habsConTarifa > 0 ? Math.round(sumaTarifas / habsConTarifa) : 0
      );

      // --- Ingresos oculto por ahora (RevPAR / Ingresos del día) ---
    }

    //Calculo de total personas en el hotel
    const totalPersonasHotel = actualizacionreserva
      .filter(
        (stat) =>
          parseInt(stat.cantid_reh) > 0 &&
          parseInt(stat.estado_habitacion) === 31
      )
      .reduce(
        (acc, stat) =>
          acc + (parseInt(stat.adultos, 10) || 0) + (parseInt(stat.ninos, 10) || 0),
        0
      );
    setPersonasEnHotel(totalPersonasHotel);
  }, [actualizacionreserva]);

  // Cancelaciones: total de HABITACIONES canceladas (consistente con el gráfico).
  // Efecto propio: depende solo de las cancelaciones, así no hay carrera con la
  // otra petición (antes se calculaba en el efecto de [actualizacionreserva] y si
  // esta respuesta llegaba después, el contador se quedaba en 0).
  useEffect(() => {
    const habitacionesCanceladas = actualizacionreservacancelaciones.reduce(
      (acc, stat) =>
        acc + (parseInt(stat.cantid_reh, 10) > 0 ? parseInt(stat.cantid_reh, 10) : 1),
      0
    );
    setCancelacionReservas(habitacionesCanceladas);
  }, [actualizacionreservacancelaciones]);

  return (
    <div className="App">
      <TopBar />

      <div className="toggle-vista">
        <button
          className={vista === "hoy" ? "activo" : ""}
          onClick={() => setVista("hoy")}
        >
          Hoy
        </button>
        <button
          className={vista === "mes" ? "activo" : ""}
          onClick={() => setVista("mes")}
        >
          Mes
        </button>
        <button
          className={vista === "resumen" ? "activo" : ""}
          onClick={() => setVista("resumen")}
        >
          Resumen
        </button>
        <button
          className={vista === "pickup" ? "activo" : ""}
          onClick={() => setVista("pickup")}
        >
          Pickup
        </button>
        <button
          className={vista === "canales" ? "activo" : ""}
          onClick={() => setVista("canales")}
        >
          Canales
        </button>
      </div>

      {vista === "hoy" && (
        <Carrusel
          reinicioClave="hoy"
          slides={[
            {
              titulo: "Ocupación",
              contenido: (
                <div className="grupo-cards ocupacion">
                  <StatCard
                    value={`${occupancyRate}%`}
                    sub={`${occupancyWithCheckIn} / ${TOTAL_HABITACIONES} hab`}
                    label="🛏️ Ocupación actual"
                  />
                  <StatCard
                    value={`${projectedOccupancy}%`}
                    sub={`${projectedOcupacionCheckIn} / ${TOTAL_HABITACIONES} hab`}
                    label="📅 Ocupación proyectada"
                  />
                  <StatCard
                    value={personasEnHotel}
                    sub="en casa"
                    label="👥 Huéspedes"
                  />
                  <StatCard
                    value={cancelacionReservas}
                    sub="habitaciones"
                    label="❌ Canceladas"
                  />
                </div>
              ),
            },
            {
              titulo: "Tarifas e ingresos",
              contenido: (
                <div className="grupo-cards tres">
                  <StatCard
                    value={formatCOP(tarifaPromedio)}
                    sub="ADR · por habitación vendida"
                    label="💵 Tarifa media diaria"
                  />
                  <StatCard
                    value={formatCOP(
                      Math.round(totalTarifas / TOTAL_HABITACIONES)
                    )}
                    sub="RevPAR · venta ÷ 29 hab"
                    label="📈 Tarifa promedio"
                  />
                  <StatCard
                    value={formatCOP(totalTarifas)}
                    sub="alojamiento del día"
                    label="📊 Total tarifas"
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
                    label="📊 Ocupación media"
                  />
                  <StatCard
                    value={metricasMes ? metricasMes.pico : "—"}
                    sub={`/ ${TOTAL_HABITACIONES} hab`}
                    label="⬆️ Día pico"
                  />
                  <StatCard
                    value={metricasMes ? metricasMes.llenos : "—"}
                    sub="días"
                    label="🏨 Días llenos"
                  />
                  <StatCard
                    value={metricasMes ? metricasMes.canceladas : "—"}
                    sub="habitaciones"
                    label="❌ Canceladas"
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
                    sub="ADR · por habitación-noche"
                    label="💵 Tarifa media diaria"
                  />
                  <StatCard
                    value={metricasMes ? formatCOP(metricasMes.revpar) : "—"}
                    sub="RevPAR · venta ÷ 29 hab"
                    label="📈 Tarifa promedio"
                  />
                  <StatCard
                    value={
                      metricasMes ? formatCOP(metricasMes.totalTarifas) : "—"
                    }
                    sub="alojamiento del mes"
                    label="📊 Total tarifas"
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
                    label="🗓️ Estancia media"
                  />
                  <StatCard
                    value={
                      metricasMes ? `${metricasMes.antelacion} días` : "—"
                    }
                    sub="al hacer la reserva"
                    label="⏱️ Antelación media"
                  />
                  <StatCard
                    value={
                      metricasMes ? `${metricasMes.tasaCancelacion}%` : "—"
                    }
                    sub="de las reservas del mes"
                    label="🔴 Tasa de cancelación"
                  />
                </div>
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
                        label="📊 Ocupación media"
                      />
                      <StatCard
                        value={p ? p.checkin : "—"}
                        delta={pp && deltaPct(p.checkin, pp.checkin, true)}
                        sub="habitaciones"
                        label="🟢 Con check-in"
                      />
                      <StatCard
                        value={p ? p.reservadas : "—"}
                        delta={pp && deltaPct(p.reservadas, pp.reservadas, true)}
                        sub="sin llegar"
                        label="🔵 Reservadas"
                      />
                      <StatCard
                        value={p ? p.canceladas : "—"}
                        delta={pp && deltaPct(p.canceladas, pp.canceladas, false)}
                        sub="habitaciones"
                        label="🔴 Canceladas"
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
                        sub="ADR · por habitación-noche"
                        label="💵 Tarifa media diaria"
                      />
                      <StatCard
                        value={p ? formatCOP(p.revpar) : "—"}
                        delta={pp && deltaPct(p.revpar, pp.revpar, true)}
                        sub="RevPAR · venta ÷ 29 hab"
                        label="📈 Tarifa promedio"
                      />
                      <StatCard
                        value={p ? formatCOP(p.totalTarifas) : "—"}
                        delta={
                          pp && deltaPct(p.totalTarifas, pp.totalTarifas, true)
                        }
                        sub="alojamiento del periodo"
                        label="📊 Total tarifas"
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
                        label="🗓️ Estancia media"
                      />
                      <StatCard
                        value={p ? `${p.antelacion} días` : "—"}
                        delta={
                          pp && deltaPuntos(p.antelacion, pp.antelacion, true)
                        }
                        sub="al hacer la reserva"
                        label="⏱️ Antelación media"
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
                        label="🔴 Tasa de cancelación"
                      />
                    </div>
                  ),
                },
              ]}
            />
          );
        })()}

      {vista === "pickup" && <Pickup />}
      {vista === "canales" && <Canales />}
      {vista === "resumen" && <ResumenPeriodo onData={setPeriodoData} />}
      {(vista === "hoy" || vista === "mes") && (
        <OcupacionMes onData={setMesData} />
      )}
    </div>
  );
}

export default App;

import "./App.css";
import React, { useState, useEffect } from "react";
import axios from "axios";

import TopBar from "./components/top/TopBar";
import StatCard from "./components/statcard/StatCard";
import OcupacionMes from "./components/linechart/OcupacionMes";
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

  const [vista, setVista] = useState("hoy"); // "hoy" | "mes"
  const [mesData, setMesData] = useState(null); // { titulo, dias, hoy } del mes en la gráfica

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
    metricasMes = {
      media: Math.round((suma * 100) / (ocup.length * TOTAL_HABITACIONES)),
      pico: Math.max(...ocup),
      llenos: ocup.filter((o) => o >= TOTAL_HABITACIONES).length,
      canceladas: mesData.dias.reduce((a, d) => a + d.cancelaciones, 0),
      totalTarifas: totalTarifasMes,
      tarifaPromedio:
        habsTarifaMes > 0 ? Math.round(totalTarifasMes / habsTarifaMes) : 0,
    };
  }

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
      </div>

      {vista === "hoy" && (
        <>
          <section className="grupo">
            <div className="grupo-titulo">Ocupación</div>
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
              <StatCard value={personasEnHotel} sub="en casa" label="👥 Huéspedes" />
              <StatCard
                value={cancelacionReservas}
                sub="habitaciones"
                label="❌ Canceladas"
              />
            </div>
          </section>

          <section className="grupo">
            <div className="grupo-titulo">Tarifas</div>
            <div className="grupo-cards ingresos">
              <StatCard
                value={formatCOP(tarifaPromedio)}
                sub="por habitación"
                label="💵 Tarifa promedio"
              />
              <StatCard
                value={formatCOP(totalTarifas)}
                sub="alojamiento"
                label="📊 Total tarifas del día"
              />
            </div>
          </section>

          {/* Ingresos (RevPAR) oculto por ahora */}
        </>
      )}

      {vista === "mes" && (
        <>
          <section className="grupo">
            <div className="grupo-titulo">
              Ocupación{mesData ? ` · ${mesData.titulo}` : ""}
            </div>
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
          </section>

          <section className="grupo">
            <div className="grupo-titulo">Tarifas</div>
            <div className="grupo-cards ingresos">
              <StatCard
                value={metricasMes ? formatCOP(metricasMes.tarifaPromedio) : "—"}
                sub="por habitación-noche"
                label="💵 Tarifa promedio"
              />
              <StatCard
                value={metricasMes ? formatCOP(metricasMes.totalTarifas) : "—"}
                sub="alojamiento del mes"
                label="📊 Total tarifas"
              />
            </div>
          </section>
        </>
      )}

      <OcupacionMes onData={setMesData} />
    </div>
  );
}

export default App;

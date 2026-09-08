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
  const [revPAR, setRevPAR] = useState(0);
  const [ingreso, setIngreso] = useState(0);
  const [personasEnHotel, setPersonasEnHotel] = useState(0);
  const [cancelacionReservas, setCancelacionReservas] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          `http://${process.env.REACT_APP_URL_PRODUCCION}/api/reservas`
        );
        console.log("Reservas: ", response.data);
        setActualizacionreserva(response.data);
        setLoading(false);
      } catch (err) {
        setError("Error al cargar los datos");
        setLoading(false);
      }
    };

    const fetchDataCancelaciones = async () => {
      try {
        const response = await axios.get(
          `http://${process.env.REACT_APP_URL_PRODUCCION}/api/reservascanceladas`
        );
        //console.log(response.data);
        setActualizacionreservacancelaciones(response.data);
        setLoading(false);
      } catch (err) {
        setError("Error al cargar los datos");
        setLoading(false);
      }
    };

    fetchDataCancelaciones();
    fetchData();
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

      //revPAR is the sum of valor_habitacion for all elements with estado_habitacion = 31 and cantid_reh > 0
      const revPAR = actualizacionreserva
        .filter(
          (stat) =>
            //parseInt(stat.estado_habitacion) === 31 &&
            parseInt(stat.cantid_reh) > 0
        )
        .reduce(
          (acc, stat) =>
            acc +
            stat.valor_habitacion * (stat.cantid_reh ? stat.cantid_reh : 1),
          0
        );
      setRevPAR(revPAR / TOTAL_HABITACIONES);

      //Ingresos
      const ingresoPorReservaConchecking = actualizacionreserva
        .filter(
          (stat) =>
            //parseInt(stat.estado_habitacion) === 31 &&
            parseInt(stat.cantid_reh) > 0
        )
        .reduce(
          (acc, stat) =>
            acc +
            stat.valor_habitacion * (stat.cantid_reh ? stat.cantid_reh : 1),
          0
        );
      setIngreso(ingresoPorReservaConchecking);
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

      <section className="grupo">
        <div className="grupo-titulo">Ocupación · hoy</div>
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
      </section>

      <section className="grupo">
        <div className="grupo-titulo">Ingresos · hoy</div>
        <div className="grupo-cards ingresos">
          <StatCard
            value={formatCOP(revPAR)}
            sub="por habitación"
            label="💸 RevPAR"
          />
          <StatCard
            value={formatCOP(ingreso)}
            sub="del día"
            label="💵 Ingresos"
          />
        </div>
      </section>

      <OcupacionMes />
    </div>
  );
}

export default App;

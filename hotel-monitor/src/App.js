import "./App.css";
import React, { useState, useEffect } from "react";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import axios from "axios";

import TopBar from "./components/top/TopBar";
import StatCard from "./components/statcard/StatCard";
import OccupancyForecast from "./components/statcard/OccupancyForecast";
import OcupacionChart from "./components/linechart/OcupacionChart";
import OcupacionPasadoChart from "./components/linechart/OcupacionPasadoChart";

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

  const [fechas, setFechas] = React.useState("10");

  const handleChange = (event) => {
    setFechas(event.target.value);
  };

  const [fechasPasado, setFechasPasado] = React.useState("10");
  const handleChangeFechaPasado = (event) => {
    setFechasPasado(event.target.value);
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          `http://${process.env.REACT_APP_URL_PRODUCCION}/api/reservas`
        );
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
      //occupancyRate is elements with adultos > 0 and estado_habitacion = 31
      const occupancyRate = actualizacionreserva
        .filter(
          (stat) =>
            parseInt(stat.canuti_reh) > 0 &&
            parseInt(stat.estado_habitacion) === 31
        )
        .reduce((acc, stat) => acc + parseInt(stat.canuti_reh, 10), 0);
      //projectedOccupancy is length of stats * 100 / 30 with two decimal points
      //30 is the number of rooms
      const ocupacionConCheckIn = actualizacionreserva
        .filter((stat) => parseInt(stat.canuti_reh) === 0)
        .reduce((acc) => acc + 1, 0);
      setOccupancyRate(parseFloat(((occupancyRate * 100) / 29).toFixed(2)));
      setOccupancyWithCheckIn(occupancyRate);

      setProjectedOcupacionCheckIn(ocupacionConCheckIn + occupancyRate);
      setProjectedOccupancy(
        parseFloat(
          (((ocupacionConCheckIn + occupancyRate) * 100) / 29).toFixed(2)
        )
      );

      //revPAR is the sum of valor_habitacion for all elements with estado_habitacion = 31 and canuti_reh > 0
      const revPAR = actualizacionreserva
        .filter(
          (stat) =>
            parseInt(stat.estado_habitacion) === 31 &&
            parseInt(stat.canuti_reh) > 0
        )
        .reduce((acc, stat) => acc + stat.valor_habitacion, 0);
      setRevPAR(revPAR / 29);

      //Ingresos
      const ingresoPorReservaConchecking = actualizacionreserva
        .filter(
          (stat) =>
            parseInt(stat.estado_habitacion) === 31 &&
            parseInt(stat.canuti_reh) > 0
        )
        .reduce(
          (acc, stat) => acc + stat.valor_habitacion * stat.canuti_reh,
          0
        );
      setIngreso(ingresoPorReservaConchecking);
    }

    //Calculo de total personas en el hotel
    const totalPersonasHotel = actualizacionreserva
      .filter(
        (stat) =>
          parseInt(stat.canuti_reh) > 0 &&
          parseInt(stat.estado_habitacion) === 31
      )
      .reduce((acc, stat) => acc + (stat.adultos + stat.ninos), 0);
    setPersonasEnHotel(totalPersonasHotel);

    //Calculo de total de cancelacion en el hotel
    const totalCancelacionesReservas = actualizacionreservacancelaciones.filter(
      (stat) => stat.fecha_cancelacion !== "1900-01-01T00:00:00.000Z"
    ); // Cuenta el número de cancelaciones

    setCancelacionReservas(totalCancelacionesReservas.length);
  }, [actualizacionreserva]);

  return (
    <div className="App">
      <TopBar />

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap", // Permite que las tarjetas se ajusten en varias filas si es necesario
          gap: "5px", // Espaciado entre las tarjetas
          //justifyContent: "space-between", // Distribuye las tarjetas uniformemente
          width: "100%", // Asegura que ocupe todo el ancho del contenedor
        }}
      >
        <div style={{ width: "48%" }}>
          <StatCard
            value={occupancyRate}
            valueCheckIn={occupancyWithCheckIn}
            label="🛏️ Ocupación actual"
            unit=""
            maxvalue={100}
            flag={"%"}
          />

          <StatCard
            value={projectedOccupancy}
            valueCheckIn={projectedOcupacionCheckIn}
            label="📅 Ocupación proyectada"
            unit=""
            maxvalue={100}
            flag={"%"}
          />
          {/*
          <StatCard
            value={personasEnHotel}
            label="👥 Total de Huéspedes"
            unit="UNI"
            maxvalue={100}
            flag={"n"}
          />
          */}
        </div>

        <div style={{ width: "48%" }}>
          <StatCard
            value={revPAR}
            label="💸 RevPAR"
            unit="COP"
            maxvalue={500000}
            flag={"ocrev"}
          />

          <StatCard
            value={ingreso}
            label="💵 Ingresos actuales"
            unit="COP"
            maxvalue={10000000}
            flag={"ocrev"}
          />
          {/*
          <StatCard
            value={cancelacionReservas}
            label="❌ Numero de cancelación"
            unit="UNI"
            maxvalue={100}
            flag={"ocrev"}
          />
          */}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginTop: "20px",
        }}
      >
        <h1 className="title">Ocupación próximos </h1>
        <Box
          sx={{
            width: 65,
            backgroundColor: "#ffffff",
            borderRadius: "5px",
            marginLeft: "10px",
          }}
        >
          <FormControl fullWidth>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={fechas}
              onChange={handleChange}
              size="small"
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={30}>30</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <h1 className="title">días</h1>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginTop: "-20px",
        }}
      >
        <OcupacionChart valorIntervalo={fechas} />
      </div>

      {/*Ocupacion pasada */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginTop: "50px"
        }}
      >
        <h1 className="title">Histórico de Ocupación</h1>
        <Box
          sx={{
            width: 65,
            backgroundColor: "#ffffff",
            borderRadius: "5px",
            marginLeft: "10px",
          }}
        >
          <FormControl fullWidth>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={fechasPasado}
              onChange={handleChangeFechaPasado}
              size="small"
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={30}>30</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <h1 className="title">días atrás</h1>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginTop: "-20px"
        }}
      >
        <OcupacionPasadoChart valorIntervalo={fechasPasado} />
      </div>
    </div>
  );
}

export default App;

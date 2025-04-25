import React, { useState, useEffect } from "react";
import axios from "axios";
import "./TopBar.css";

function TopBar() {
  const [actualizacionreserva, setActualizacionreserva] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          `http://${process.env.REACT_APP_URL_PRODUCCION}/api/reservasactualizacioncontrol`
        );
        setActualizacionreserva(response.data);
        setLoading(false);
      } catch (err) {
        setError("Error al cargar los datos");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const today = new Date();
  const options = {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  const formattedDate = today.toLocaleDateString("es-CO", options);

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>{error}</div>;
  if (!actualizacionreserva.length) return <div>No hay datos disponibles</div>;

  const mostRecent = actualizacionreserva.reduce((latest, current) => {
    const latestDate = new Date(latest.fecha);
    const currentDate = new Date(current.fecha);
    return currentDate > latestDate ? current : latest;
  }, actualizacionreserva[0]);

  const formatearFecha = (fecha) => {
    if (!fecha) return "Unknown Date";
    const date = new Date(fecha);
    return date.toLocaleString("es-CO", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="topbar-container">
      <div className="topbar-content">
        <div style={{ width: "70%", display: "flex", alignItems: "center", justifyContent: "left" }}>
          <h1 className="title">Monitor de Ocupación <br /> {formattedDate}</h1>
        </div>
        <div style={{ width: "30%" }}>
          <span className="last-update">
            Última actualización: {formatearFecha(mostRecent?.fecha)}
          </span>
          <span
            className="status-dot"
            style={{
              backgroundColor:
                mostRecent?.estado === "éxito" ? "#38a169" : "#e53e3e",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default TopBar;

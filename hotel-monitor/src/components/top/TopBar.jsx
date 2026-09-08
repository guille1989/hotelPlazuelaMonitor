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

  const formatearFecha = (fecha) => {
    if (!fecha) return "—";
    const date = new Date(fecha);
    return date.toLocaleString("es-CO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const marca = (
    <div className="topbar-brand">
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
        <path
          d="M6 22 L14 6 L22 22"
          stroke="#8cf4ee"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M14 6 L18 14"
          stroke="#59b2b0"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
      <span className="marca">
        Inno<span>App</span>
      </span>
      <span className="sector">HOTELERÍA</span>
    </div>
  );

  if (loading)
    return (
      <div className="topbar">
        {marca}
        <div className="topbar-cargando">Cargando…</div>
      </div>
    );
  if (error)
    return (
      <div className="topbar">
        {marca}
        <div className="topbar-cargando">{error}</div>
      </div>
    );

  const mostRecent = actualizacionreserva.length
    ? actualizacionreserva.reduce((latest, current) => {
        const latestDate = new Date(latest.fecha);
        const currentDate = new Date(current.fecha);
        return currentDate > latestDate ? current : latest;
      }, actualizacionreserva[0])
    : null;

  const ok = mostRecent?.estado === "éxito";

  return (
    <div className="topbar">
      {marca}
      <div className="topbar-row">
        <div>
          <div className="topbar-eyebrow">Monitor de Ocupación</div>
          <h1 className="topbar-fecha">{formattedDate}</h1>
        </div>
        <div className="topbar-update">
          <div className="lbl">Última actualización</div>
          <div className="val">{formatearFecha(mostRecent?.fecha)}</div>
          <div className={`topbar-estado ${ok ? "ok" : "err"}`}>
            <span className="dot" />
            <span className="txt">{ok ? "EN VIVO" : "REVISAR"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TopBar;

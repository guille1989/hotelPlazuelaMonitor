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

  const DIAS = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  const MESES_LARGO = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const today = new Date();
  const dia = DIAS[today.getDay()];
  const fechaLinea1 = `${dia[0].toUpperCase()}${dia.slice(1)}, ${today.getDate()} de`;
  const fechaLinea2 = `${MESES_LARGO[today.getMonth()]} ${today.getFullYear()}`;

  // Solo la hora ("06:34 p. m."), como en el diseño.
  const formatearFecha = (fecha) => {
    if (!fecha) return "—";
    return new Date(fecha).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const marca = (
    <div className="topbar-brand">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
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
          <h1 className="topbar-fecha">
            <span>{fechaLinea1}</span> <span>{fechaLinea2}</span>
          </h1>
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

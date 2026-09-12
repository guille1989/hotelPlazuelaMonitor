import React, { useState, useEffect } from "react";
import axios from "axios";
import logoInnoApp from "../../assets/innoapp-logo.png";
import "./TopBar.css";

const VISTAS = [
  ["hoy", "Hoy"],
  ["mes", "Mes"],
  ["resumen", "Resumen"],
  ["pickup", "Pickup"],
];

function TopBar({ vista, onVista }) {
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
      <img className="topbar-logo" src={logoInnoApp} alt="InnoApp" />
      <span className="sector">HOTELERÍA</span>
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

      {loading || error ? (
        <div className="topbar-cargando">{error || "Cargando…"}</div>
      ) : (
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
      )}

      <div className="toggle-vista">
        {VISTAS.map(([id, etiqueta]) => (
          <button
            key={id}
            className={vista === id ? "activo" : ""}
            onClick={() => onVista(id)}
          >
            {etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}

export default TopBar;

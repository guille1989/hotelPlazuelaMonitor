import React from "react";
import "./StatCard.css";

// Tarjeta de una métrica: valor grande, subtítulo opcional y etiqueta.
function StatCard({ value, sub, label }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default StatCard;

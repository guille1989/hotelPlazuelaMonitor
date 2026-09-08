import React from "react";
import "./StatCard.css";

// Tarjeta de una métrica: valor grande, delta opcional, subtítulo y etiqueta.
// delta: { texto, tipo } con tipo "buena" | "mala" | "neutra".
function StatCard({ value, sub, label, delta }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      {delta ? (
        <div className={`stat-delta ${delta.tipo || "neutra"}`}>{delta.texto}</div>
      ) : null}
      {sub ? <div className="stat-sub">{sub}</div> : null}
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default StatCard;

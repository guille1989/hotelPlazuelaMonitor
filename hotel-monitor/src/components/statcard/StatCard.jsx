import React from "react";
import "./StatCard.css";

// Color de acento por "tono" — se usa en el punto, la caja del icono,
// la barra de progreso y (en las tarjetas anchas) el valor.
const TONES = {
  accent: "var(--color-accent)",
  teal: "var(--color-teal)",
  blue: "var(--color-blue)",
  red: "var(--color-red)",
  positive: "var(--color-positive)",
  amber: "var(--color-amber)",
  purple: "var(--color-purple)",
  orange: "var(--color-orange)",
};

// Tarjeta de una métrica: valor grande, delta opcional, subtítulo, caja de
// icono y etiqueta con punto de color.
// delta: { texto, tipo } con tipo "buena" | "mala" | "neutra".
// tone: clave de TONES. progress: 0-100 (barra opcional). wide: ocupa toda la fila.
function StatCard({
  value,
  sub,
  label,
  delta,
  icon,
  tone = "accent",
  progress,
  wide,
}) {
  const color = TONES[tone] || TONES.accent;
  const tint = `color-mix(in srgb, ${color} 14%, transparent)`;

  return (
    <div
      className={`stat-card${wide ? " stat-card-wide" : ""}`}
      style={wide ? { borderLeftColor: color } : undefined}
    >
      <div className="stat-card-top">
        <div className="stat-card-main">
          <div
            className="stat-value"
            style={wide ? { color } : undefined}
          >
            {value}
          </div>
          {delta ? (
            <div className={`stat-delta ${delta.tipo || "neutra"}`}>
              {delta.texto}
            </div>
          ) : null}
          {sub ? <div className="stat-sub">{sub}</div> : null}
        </div>
        {icon ? (
          <span className="stat-icon" style={{ background: tint }}>
            {icon}
          </span>
        ) : null}
      </div>

      {progress != null ? (
        <div className="stat-progress">
          <div
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              background: color,
            }}
          />
        </div>
      ) : null}

      <div className="stat-label">
        <span className="stat-dot" style={{ background: color }} />
        {label}
      </div>
    </div>
  );
}

export default StatCard;

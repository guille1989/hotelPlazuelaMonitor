import React, { useState, useEffect } from "react";
import "./Carrusel.css";

// slides: [{ titulo, contenido }]. Muestra uno a la vez (flechas, puntos, swipe).
// `reinicioClave` — al cambiar, vuelve al primer slide (p.ej. al cambiar de vista).
export default function Carrusel({ slides, reinicioClave }) {
  const [i, setI] = useState(0);
  const [x0, setX0] = useState(null);
  const n = slides.length;

  useEffect(() => {
    setI(0);
  }, [reinicioClave]);

  const ir = (k) => setI(Math.max(0, Math.min(n - 1, k)));

  return (
    <div className="carrusel">
      <div className="carrusel-head">
        <button
          className="flecha"
          onClick={() => ir(i - 1)}
          disabled={i === 0}
          aria-label="Anterior"
        >
          ‹
        </button>
        <div className="carrusel-titulo">{slides[i].titulo}</div>
        <button
          className="flecha"
          onClick={() => ir(i + 1)}
          disabled={i === n - 1}
          aria-label="Siguiente"
        >
          ›
        </button>
      </div>

      <div
        className="carrusel-cuerpo"
        onTouchStart={(e) => setX0(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (x0 == null) return;
          const dx = e.changedTouches[0].clientX - x0;
          if (dx < -45) ir(i + 1);
          else if (dx > 45) ir(i - 1);
          setX0(null);
        }}
      >
        {slides[i].contenido}
      </div>

      <div className="carrusel-dots">
        {slides.map((s, k) => (
          <button
            key={k}
            className={k === i ? "activo" : ""}
            onClick={() => ir(k)}
            aria-label={s.titulo}
          />
        ))}
      </div>
    </div>
  );
}

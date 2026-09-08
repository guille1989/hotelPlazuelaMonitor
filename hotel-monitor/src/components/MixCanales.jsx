import React from "react";
import { canalNombre, canalColor } from "../config";
import "./MixCanales.css";

// canal / canalPrev: { "B": 340, "EM": 310, ... } (habitaciones por canal)
export default function MixCanales({ canal, canalPrev }) {
  const total = Object.values(canal).reduce((a, b) => a + b, 0);
  if (!total) return null;

  const filas = Object.entries(canal)
    .map(([cod, n]) => ({ cod, n, pct: Math.round((n * 100) / total) }))
    .sort((a, b) => b.n - a.n);
  const max = Math.max(...filas.map((f) => f.n)) || 1;

  const totalPrev = canalPrev
    ? Object.values(canalPrev).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="mix">
      {filas.map((f) => {
        const prev = canalPrev ? canalPrev[f.cod] || 0 : null;
        const diff = prev != null ? f.n - prev : null;
        const pctPrev =
          prev != null && totalPrev
            ? Math.round((prev * 100) / totalPrev)
            : null;
        const color = canalColor(f.cod);
        return (
          <div className="mix-row" key={f.cod}>
            <div className="mix-row-head">
              <span className="mix-canal">{canalNombre(f.cod)}</span>
              <span className="mix-valor">
                {diff != null && diff !== 0 && (
                  <span className={`mix-diff ${diff > 0 ? "pos" : "neg"}`}>
                    {diff > 0 ? "+" : ""}
                    {diff}
                  </span>
                )}
                <b>{f.n} hab</b> · {f.pct}%
              </span>
            </div>
            <div className="mix-track">
              <div
                className="mix-fill"
                style={{ width: `${(f.n / max) * 100}%`, background: color }}
              />
            </div>
            {prev != null && (
              <>
                <div className="mix-track mix-track-prev">
                  <div
                    className="mix-fill"
                    style={{
                      width: `${(prev / max) * 100}%`,
                      background: color,
                      opacity: 0.35,
                    }}
                  />
                </div>
                <div className="mix-prev-lbl">
                  Año ant.: {prev} hab · {pctPrev}%
                </div>
              </>
            )}
          </div>
        );
      })}

      <div className="mix-total">
        <span>Total</span>
        <b>{total} hab</b>
      </div>
    </div>
  );
}

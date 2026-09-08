import React from "react";
import { canalNombre, canalColor } from "../config";

// canal / canalPrev: { "B": 340, "EM": 310, ... } (habitaciones por canal)
export default function MixCanales({ canal, canalPrev }) {
  const total = Object.values(canal).reduce((a, b) => a + b, 0);
  if (!total) return null;

  const filas = Object.entries(canal)
    .map(([cod, n]) => ({ cod, n, pct: Math.round((n * 100) / total) }))
    .sort((a, b) => b.n - a.n);

  const totalPrev = canalPrev
    ? Object.values(canalPrev).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        background: "rgba(25, 34, 58, 0.42)",
        borderRadius: 12,
        padding: "14px 16px",
        border: "1px solid rgba(140, 244, 238, 0.06)",
      }}
    >
      {filas.map((f) => {
        let delta = null;
        if (canalPrev && totalPrev) {
          const pctPrev = Math.round(
            ((canalPrev[f.cod] || 0) * 100) / totalPrev
          );
          const d = f.pct - pctPrev;
          if (d !== 0)
            delta = `${d > 0 ? "▲" : "▼"} ${Math.abs(d)} pp vs año ant.`;
        }
        return (
          <div key={f.cod} style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: "var(--color-muted)",
                marginBottom: 3,
              }}
            >
              <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
                {canalNombre(f.cod)}
              </span>
              <span>
                {f.n} hab · {f.pct}%
                {delta && (
                  <span style={{ color: "var(--color-muted)", marginLeft: 6 }}>{delta}</span>
                )}
              </span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: "rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{
                  width: `${f.pct}%`,
                  height: "100%",
                  borderRadius: 4,
                  background: canalColor(f.cod),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

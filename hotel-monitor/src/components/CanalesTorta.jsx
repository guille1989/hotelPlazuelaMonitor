import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { canalNombre, canalColor } from "../config";
import "./CanalesTorta.css";

// canal: { "B": 340, "EM": 310, ... } (habitaciones por canal, ya sumadas)
export default function CanalesTorta({ canal }) {
  const total = Object.values(canal || {}).reduce((a, b) => a + b, 0);

  if (!total) {
    return (
      <div className="om-state" style={{ padding: "16px 0" }}>
        Sin datos de canal en el periodo.
      </div>
    );
  }

  const datos = Object.entries(canal)
    .map(([cod, n]) => ({
      cod,
      nombre: canalNombre(cod),
      n,
      pct: Math.round((n * 100) / total),
    }))
    .sort((a, b) => b.n - a.n);

  return (
    <div className="torta">
      <div className="torta-row">
        <div className="torta-chart">
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie
                data={datos}
                dataKey="n"
                nameKey="nombre"
                innerRadius={32}
                outerRadius={58}
                paddingAngle={2}
                isAnimationActive={false}
              >
                {datos.map((d) => (
                  <Cell key={d.cod} fill={canalColor(d.cod)} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, _name, props) => [
                  `${value} hab · ${props.payload.pct}%`,
                  props.payload.nombre,
                ]}
                contentStyle={{
                  background: "#1f293d",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                itemStyle={{ color: "#e8eef5" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="torta-leyenda">
          {datos.map((d) => (
            <div className="torta-item" key={d.cod}>
              <span className="torta-dot" style={{ background: canalColor(d.cod) }} />
              <span className="torta-nombre">{d.nombre}</span>
              <span className="torta-valor">
                {d.n} · {d.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="torta-total">
        <span>Total</span>
        <b>{total} hab</b>
      </div>
    </div>
  );
}

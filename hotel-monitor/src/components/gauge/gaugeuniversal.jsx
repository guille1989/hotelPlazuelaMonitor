import React, { useEffect } from "react";
import GaugeComponent from "react-gauge-component";

const GaugeUniversal = ({ valor, maxvalue, flag }) => {
  const scaleFactor = maxvalue / 100; // Cada unidad del gauge = $8,000
  const moneyValue = valor; // Valor actual en dinero ($600K)
  const gaugeValue = moneyValue / scaleFactor; // Convertir a escala del gauge (75)
  
  return (
    <div >
      <GaugeComponent
        key={100}
        type="semicircle"
        pointer={{ type: "needle", elastic: true, color: "#1f293d" }}
        arc={{
          width: 0.3,
          subArcs: [
            { limit: 50, color: "#EA4228" },
            { limit: 80, color: "#F5CD19" },
            { limit: 100, color: "#5BE12C" },
          ],
        }}
        value={gaugeValue}
        labels={{
            valueLabel: {
              formatTextValue: (valor) => {
                const money = valor * scaleFactor;
                if (flag === "ocrev") {
                    if( money >= 1000000) {
                        return `$${(money / 1000000).toFixed(1)}M`;
                    }
                    return `$${(money / 1000).toFixed(1)}K`;
                } else {
                    return `${valor}%`
                }
                
              },
              style: {
                fontSize: "35px", // Tamaño del texto (ajustable)
                textAnchor: "middle", // Centrado horizontalmente
                fill: "#ffffff", // Color del texto
              },
            },
        }}
      />
      <style>
        {`
        .tick-value { display: none; }
        .tick-line { display: none; }
        `}
      </style>
    </div>
  );
};

export default GaugeUniversal;

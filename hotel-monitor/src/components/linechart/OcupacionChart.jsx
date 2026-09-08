import React, { useState, useEffect, PureComponent } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  CartesianGrid,
  ReferenceLine,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// X roja en los días que tienen reservas canceladas.
const CancelXDot = ({ cx, cy, value }) => {
  if (value == null || cx == null || cy == null) return null;
  const s = 6;
  return (
    <g stroke="#EF4444" strokeWidth={2.5} strokeLinecap="round">
      <line x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s} />
      <line x1={cx - s} y1={cy + s} x2={cx + s} y2={cy - s} />
    </g>
  );
};

export default function OcupacionChart({ valorIntervalo }) {
  const [data, setData] = useState({
    conteoPorDia: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          `http://${process.env.REACT_APP_URL_PRODUCCION}/api/reservasfuturas`
        ); //Guardamos los datos teniendo en cuenta el intervalo
        
        const filteredData = {
          conteoPorDia: response.data.conteoPorDia
            .slice(0, valorIntervalo)
            .map((d) => ({
              ...d,
              // posición de la X: sobre la línea de ocupación (mínimo 1 para que se vea)
              cancelMark: d.cancelaciones > 0 ? Math.max(d.ocupacion, 1) : null,
            })),
        };

        setData(filteredData);
        setLoading(false);
      } catch (err) {
        setError("Error al cargar los datos");
        setLoading(false);
      }
    };

    fetchData();
  }, [valorIntervalo]);

  if (loading) return <div style={{ color: "white", marginTop: "20px" }}>Cargando...</div>;
  if (error) return <div>{error}</div>;

  class CustomizedLabel extends PureComponent {
    render() {
      const { x, y, stroke, value } = this.props;
      // Si el valor es 0, no renderiza nada
      if (value === 0) {
        return null;
      }

      return (
        <text
          x={x}
          y={y}
          dy={-4}
          fill="#22C55E"
          fontSize={20}
          textAnchor="middle"
        >
          {value}
        </text>
      );
    }
  }

  class CustomizedLabelAux extends PureComponent {
    render() {
      const { x, y, stroke, value } = this.props;
      // Si el valor es 0, no renderiza nada
      if (value === 0) {
        return null;
      }

      return (
        <text
          x={x}
          y={y}
          dy={20}
          fill="#22C55E"
          fontSize={20}
          textAnchor="middle"
        >
          {value}
        </text>
      );
    }
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const fila = payload[0].payload || {};
      return (
        <div
          style={{
            backgroundColor: "#353d54",
            color: "#fff",
            padding: "10px",
            borderRadius: "5px",
            border: "1px solid #ccc",
          }}
        >
          <p style={{ margin: 0 }}>{`Día: ${label}`}</p>
          <p style={{ margin: 0 }}>{`Reservas totales: ${fila.ocupacion ?? 0}`}</p>
          {fila.cancelaciones > 0 && (
            <p style={{ margin: 0, color: "#EF4444" }}>
              {`Canceladas: ${fila.cancelaciones}`}
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  class CustomizedAxisTick extends PureComponent {
    render() {
      const { x, y, stroke, payload } = this.props;

      return (
        <g transform={`translate(${x},${y})`}>
          <text
            x={1}
            y={0}
            dy={5}
            textAnchor="end"
            fill="#666"
            transform="rotate(-25)"
          >
            {payload.value.split("-")[1] + "-" + payload.value.split("-")[2]}
          </text>
        </g>
      );
    }
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart
        data={data.conteoPorDia}
        margin={{ top: 40, right: 10, left: -30, bottom: 0 }}
      >
        <XAxis dataKey="dia" tick={<CustomizedAxisTick />} />
        <YAxis domain={[0, 29]} />
        <ReferenceLine
          y={29}
          strokeDasharray="3 3"
          label="Ocupación-100%"
          stroke="#9CA3AF "
        />
        <ReferenceLine
          y={15}
          strokeDasharray="3 3"
          label="Ocupación-50%"
          stroke="#9CA3AF"
        />
        <Tooltip content={<CustomTooltip />} /> {/* Tooltip personalizado */}
        
        {/* 
        <Line
          type="monotone"
          dataKey="ocupacionConCheckIn"
          stroke="#22C55E"
          strokeWidth={2}
          dot={{ r: 3 }}
          label={<CustomizedLabelAux />}
        />
        */}
        <Line
          type="monotone"
          dataKey="ocupacion"
          stroke="#22C55E"
          strokeDasharray="10 5"
          label={<CustomizedLabel />}
        />

        {/* Marcador: X roja en días con reservas canceladas */}
        <Line
          type="monotone"
          dataKey="cancelMark"
          stroke="none"
          legendType="none"
          isAnimationActive={false}
          dot={<CancelXDot />}
          activeDot={false}
          connectNulls={false}
        />

      </LineChart>
    </ResponsiveContainer>
  );
}

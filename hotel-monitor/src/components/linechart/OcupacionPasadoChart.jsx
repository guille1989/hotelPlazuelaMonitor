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

export default function OcupacionPasadoChart({ valorIntervalo }) {
  const [data, setData] = useState({
    conteoPorDia: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          `http://${process.env.REACT_APP_URL_PRODUCCION}/api/reservaspasadas`
        ); //Guardamos los datos teniendo en cuenta el intervalo
        //console.log(response.data)
        const filteredData = {
            conteoPorDia: response.data.slice(0, valorIntervalo),
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
          fill="#3B82F6"
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
      return (
        <div
          style={{
            backgroundColor: "#353d54", // Fondo del tooltip
            color: "#fff", // Color del texto
            padding: "10px",
            borderRadius: "5px",
            border: "1px solid #ccc",
          }}
        >
          <p>{`Día: ${label}`}</p>
          {payload.map((item, index) => (
            <p
              key={index}
              style={{
                color: item.stroke, // Usa el color de la línea para el texto
                margin: 0,
              }}
            >
              {`${
                item.name === "ocupacion"
                  ? "Reservas totales"
                  : item.name === "ocupacionConCheckIn"
                  ? "Reservas con check-in"
                  : item.name
              }: ${item.value}`}
            </p>
          ))}
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
        <YAxis domain={[0, 29]}/>
        <ReferenceLine
          y={29}
          strokeDasharray="3 3"
          label="Ocupación"
          
          stroke="#9CA3AF "
        />
        <ReferenceLine
          y={15}
          strokeDasharray="3 3"
          label="50%"
          stroke="#9CA3AF"
        />
        <Tooltip content={<CustomTooltip />} /> {/* Tooltip personalizado */}
        <Line
          type="monotone"
          dataKey="ocupacion"
          stroke="#3B82F6"
          strokeDasharray="10 5"
          label={<CustomizedLabel />}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

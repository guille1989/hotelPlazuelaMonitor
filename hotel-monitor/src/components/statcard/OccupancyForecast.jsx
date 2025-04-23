import React, { useState, useEffect } from 'react';
import axios from 'axios';

function OccupancyForecast() {
  const [data, setData] = useState({ conteoPorDia: [], conteoPorDiaConCheckIn: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('http://localhost:5002/api/reservasfuturas');
        setData(response.data);
        setLoading(false);
      } catch (err) {
        setError('Error al cargar los datos');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h2>Pronóstico de Ocupación (Próximos 30 días)</h2>
      <h3>Conteo por Día</h3>
      <ul>
        {data.conteoPorDia.map((item) => (
          <li key={item.dia}>
            {item.dia}: {item.ocupacion} (Con Check-In: {item.ocupacionConCheckIn})
          </li>
        ))}
      </ul>
      <h3>Conteo por Día con Check-In</h3>
      <ul>
        {data.conteoPorDiaConCheckIn.map((item) => (
          <li key={item.dia}>
            {item.dia}: {item.ocupacion}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default OccupancyForecast;
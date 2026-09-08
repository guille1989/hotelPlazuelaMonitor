const express = require("express");
const router = express.Router();
const { diasDelMes, mesActualBogota, hoyBogota } = require("../functions/fechas");
const {
  estaCancelada,
  salidaEfectiva,
  habitaciones,
  filtroTraslape,
  noches,
} = require("../functions/ocupacion");
const { getDb } = require("../db");

// GET /api/ocupacionmes?mes=YYYY-MM  -> ocupación día a día del mes.
// Sin `mes` usa el mes actual (Bogotá).
router.get("/", async (req, res) => {
  try {
    const mes = /^\d{4}-\d{2}$/.test(req.query.mes || "")
      ? req.query.mes
      : mesActualBogota();
    const [anio, m] = mes.split("-").map(Number);

    const dias = diasDelMes(anio, m);
    const inicio = dias[0];
    const fin = dias[dias.length - 1];

    const collection = (await getDb()).collection("reservas");

    // Reservas cuya estancia se traslapa con el mes (comparación de strings).
    const reservas = await collection
      .find(filtroTraslape(inicio, fin))
      .toArray();

    const conteoPorDia = dias.map((dia) => ({
      dia,
      ocupacion: 0,
      cancelaciones: 0,
      tarifas: 0, // Σ (valor_habitacion × habitaciones) de las ocupadas ese día
      habsTarifa: 0, // habitaciones con tarifa (para el promedio ponderado)
    }));
    const porDia = new Map(conteoPorDia.map((d) => [d.dia, d]));

    // Acumulador por MES DE LLEGADA (para tasa de cancelación y estancia media).
    const arribo = { checkin: 0, reservadas: 0, canceladas: 0, roomNoches: 0 };

    for (const reserva of reservas) {
      const llegada = reserva.fecha_llegada_habitacion || reserva.fecha_llegada;
      const salida = salidaEfectiva(reserva);
      if (!llegada || !salida) continue;

      const cancelada = estaCancelada(reserva);
      const habs = habitaciones(reserva);
      const valor = Number(reserva.valor_habitacion) || 0;

      if (llegada.slice(0, 7) === mes) {
        if (cancelada) {
          arribo.canceladas += habs;
        } else {
          if (String(reserva.estado_habitacion) === "31") arribo.checkin += habs;
          else arribo.reservadas += habs;
          arribo.roomNoches += noches(llegada, salida) * habs;
        }
      }

      for (const dia of dias) {
        if (dia >= llegada && dia < salida) {
          const d = porDia.get(dia);
          if (cancelada) {
            d.cancelaciones += habs;
          } else {
            d.ocupacion += habs;
            if (valor > 0) {
              d.tarifas += valor * habs;
              d.habsTarifa += habs;
            }
          }
        }
      }
    }

    res.json({ mes, hoy: hoyBogota(), arribo, dias: conteoPorDia });
  } catch (error) {
    console.error("Error fetching ocupacionmes:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

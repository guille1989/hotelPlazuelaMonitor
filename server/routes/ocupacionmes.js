const express = require("express");
const router = express.Router();
const { diasDelMes, mesActualBogota, hoyBogota } = require("../functions/fechas");
const { getDb } = require("../db");

function estaCancelada(doc) {
  return !!doc.fecha_cancelacion && !doc.fecha_cancelacion.startsWith("1900");
}

// Salida efectiva: si fecha_ult_mod es posterior a la salida, la estancia se extendió.
function salidaEfectiva(reserva) {
  const salida = reserva.fecha_salida_habitacion || reserva.fecha_salida;
  if (reserva.fecha_ult_mod && reserva.fecha_ult_mod > salida) {
    return reserva.fecha_ult_mod;
  }
  return salida;
}

function habitaciones(reserva) {
  const origen = (reserva.origen || "").trim().toLowerCase();
  if (origen === "sin reserva") return 1;
  return reserva.cantid_reh > 0 ? reserva.cantid_reh : 1;
}

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
      .find({
        $or: [
          {
            fecha_llegada_habitacion: { $lte: fin },
            fecha_salida_habitacion: { $gt: inicio },
          },
          {
            fecha_llegada_habitacion: null,
            fecha_llegada: { $lte: fin },
            fecha_salida: { $gt: inicio },
          },
        ],
      })
      .toArray();

    const conteoPorDia = dias.map((dia) => ({
      dia,
      ocupacion: 0,
      cancelaciones: 0,
      tarifas: 0, // Σ (valor_habitacion × habitaciones) de las ocupadas ese día
      habsTarifa: 0, // habitaciones con tarifa (para el promedio ponderado)
    }));
    const porDia = new Map(conteoPorDia.map((d) => [d.dia, d]));

    for (const reserva of reservas) {
      const llegada = reserva.fecha_llegada_habitacion || reserva.fecha_llegada;
      const salida = salidaEfectiva(reserva);
      if (!llegada || !salida) continue;

      const cancelada = estaCancelada(reserva);
      const habs = habitaciones(reserva);
      const valor = Number(reserva.valor_habitacion) || 0;

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

    res.json({ mes, hoy: hoyBogota(), dias: conteoPorDia });
  } catch (error) {
    console.error("Error fetching ocupacionmes:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

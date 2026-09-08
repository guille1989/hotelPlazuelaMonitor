const express = require("express");
const router = express.Router();
const { diasDelMes, mesActualBogota, hoyBogota } = require("../functions/fechas");
const {
  estaCancelada,
  salidaEfectiva,
  habitaciones,
  noches,
} = require("../functions/ocupacion");
const { ocupacionPorDia } = require("../functions/ocupacionDiaria");
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

    const db = await getDb();
    const { porDia, reservas } = await ocupacionPorDia(db, dias);

    const conteoPorDia = dias.map((dia) => {
      const o = porDia.get(dia);
      return {
        dia,
        ocupacion: o.ocupacion,
        cancelaciones: o.cancelaciones,
        tarifas: o.tarifas,
        habsTarifa: o.habsTarifa,
      };
    });

    // Agregados por MES DE LLEGADA (para estancia media y tasa de cancelación).
    // Salen de reservas — el folio no distingue check-in/reservada ni cancelaciones.
    const arribo = { checkin: 0, reservadas: 0, canceladas: 0, roomNoches: 0 };
    for (const r of reservas) {
      const llegada = r.fecha_llegada_habitacion || r.fecha_llegada;
      const salida = salidaEfectiva(r);
      if (!llegada || !salida || llegada.slice(0, 7) !== mes) continue;
      const habs = habitaciones(r);
      if (estaCancelada(r)) {
        arribo.canceladas += habs;
      } else {
        if (String(r.estado_habitacion) === "31") arribo.checkin += habs;
        else arribo.reservadas += habs;
        arribo.roomNoches += noches(llegada, salida) * habs;
      }
    }

    res.json({ mes, hoy: hoyBogota(), arribo, dias: conteoPorDia });
  } catch (error) {
    console.error("Error fetching ocupacionmes:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

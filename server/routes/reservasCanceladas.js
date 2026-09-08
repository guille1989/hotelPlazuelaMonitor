const express = require("express");
const router = express.Router();
const moment = require("moment-timezone");
const { getDb } = require("../db");

// Reservas CANCELADAS cuya estancia se solapa con el día de hoy (Bogotá).
// Antes esta query estaba rota: filtraba `fecha_cancelacion: { $ne: new Date("1900-...") }`
// (un Date) y `fecha_llegada: { $lte: <Date> }` contra campos que en Mongo son strings
// "YYYY-MM-DD", así que nunca hacía match y el contador de cancelaciones quedaba en 0.
// Contrato nuevo: fecha_cancelacion es null (no cancelada) o "YYYY-MM-DD" (cancelada).
router.get("/", async (req, res) => {
  try {
    const collection = (await getDb()).collection("reservas");

    const hoy = moment().tz("America/Bogota").format("YYYY-MM-DD");
    const manana = moment().tz("America/Bogota").add(1, "day").format("YYYY-MM-DD");

    const canceladas = await collection
      .find({
        fecha_cancelacion: { $ne: null },
        $or: [
          {
            fecha_llegada_habitacion: { $lte: manana },
            fecha_salida_habitacion: { $gt: hoy },
          },
          {
            fecha_llegada_habitacion: null,
            fecha_llegada: { $lte: manana },
            fecha_salida: { $gt: hoy },
          },
        ],
      })
      .toArray();

    res.json(canceladas);
  } catch (error) {
    console.error("Error fetching reservas canceladas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

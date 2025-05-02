const express = require("express");
const { MongoClient } = require("mongodb");
const router = express.Router();
const moment = require("moment-timezone");

const uri =
  "mongodb+srv://root:123@cluster0.jwxt0.mongodb.net/hotellpmonitor?retryWrites=true&w=majority";
const client = new MongoClient(uri);

router.get("/", async (req, res) => {
  try {
    await client.connect();
    const database = client.db("hotellpmonitor");
    const collection = database.collection("reservas");
    
    
    const hoy = moment().tz("America/Bogota").startOf("day");
    const inicioDelDiaLocal = hoy.toDate(); // 2025-05-01T00:00:00 GMT-0500
    const fechaSalidaLocal = moment(hoy).add(1, "day").toDate(); // 2025-05-02T00:00:00 GMT-0500

    // Ejecutar la query con fechas en UTC
    const reservasHoy = await collection
      .find({
        fecha_cancelacion: new Date("1900-01-01T00:00:00.000Z"),
        fecha_llegada: { $lte: fechaSalidaLocal }, // 2025-05-02T05:00:00.000Z
        fecha_salida: { $gt: inicioDelDiaLocal }, // 2025-05-01T05:00:00.000Z
      })
      .toArray();

    //Quitar de reservas los que tienen fecha de llegada mayor a hoy
    const reservasHoyFiltradas = reservasHoy.filter((reserva) => {
      const fechaLlegada = new Date(reserva.fecha_llegada);
      return fechaLlegada <= inicioDelDiaLocal;
    });
    res.json(reservasHoyFiltradas);
  } catch (error) {
    console.error("Error fetching reservas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    await client.close();
  }
});

module.exports = router;

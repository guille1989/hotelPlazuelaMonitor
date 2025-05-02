const express = require("express");
const { MongoClient } = require("mongodb");
const router = express.Router();

const uri =
  "mongodb+srv://root:123@cluster0.jwxt0.mongodb.net/hotellpmonitor?retryWrites=true&w=majority";
const client = new MongoClient(uri);

router.get("/", async (req, res) => {
  try {
    await client.connect();
    const database = client.db("hotellpmonitor");
    const collection = database.collection("reservas");
    // Crear la fecha base
    const hoy = new Date();

    // Calcular el inicio del día actual en la zona horaria LOCAL (Colombia, GMT-0500)
    const inicioDelDiaLocal = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate(),
      0,
      0,
      0,
      0
    );

    // Calcular la fecha de salida (día siguiente al de llegada) en la zona horaria LOCAL
    const fechaSalidaLocal = new Date(inicioDelDiaLocal);
    fechaSalidaLocal.setDate(inicioDelDiaLocal.getDate() + 1);

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

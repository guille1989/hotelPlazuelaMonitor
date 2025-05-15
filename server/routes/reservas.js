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
    //console.log("Inicio del día local:", inicioDelDiaLocal);
    //console.log("Fecha de salida local:", fechaSalidaLocal);

    // Ejecutar la query con fechas en UTC
    const reservasHoy = await collection
      .find({
        $or: [
          {
            fecha_llegada_habitacion: {
              $lte: fechaSalidaLocal.toISOString().split("T")[0],
            },
            fecha_salida_habitacion: {
              $gt: inicioDelDiaLocal.toISOString().split("T")[0],
            },
          },
          {
            fecha_llegada_habitacion: null,
            fecha_llegada: { $lte: fechaSalidaLocal.toISOString().split("T")[0] },
            fecha_salida: { $gt: inicioDelDiaLocal.toISOString().split("T")[0] },
          },
        ],
      })
      .toArray();

    const FECHA_1900 = "1900-01-01"; // Fecha de referencia para cancelación
    const reservasFiltradas = reservasHoy.filter((doc) => {
      if (!doc.fecha_cancelacion) return true;

      // Comparar directamente las cadenas
      return doc.fecha_cancelacion.startsWith(FECHA_1900);
    });

    //Quitar de reservas los que tienen fecha de llegada mayor a hoy
    const reservasHoyFiltradas = reservasFiltradas.filter((reserva) => {
      const fechaLlegadaAux =
        reserva.fecha_llegada_habitacion || reserva.fecha_llegada;
      const fechaLlegada = new Date(fechaLlegadaAux);
      return fechaLlegada <= inicioDelDiaLocal;
    });

    //console.log("Reservas de hoy:", reservasHoyFiltradas);
    res.json(reservasHoyFiltradas);
  } catch (error) {
    console.error("Error fetching reservas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    await client.close();
  }
});

module.exports = router;

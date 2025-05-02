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

    const moment = require("moment-timezone");

    // Calcular el inicio del día actual en la zona horaria LOCAL (America/Bogota, GMT-0500)
    const today = moment().tz("America/Bogota");

    // Calcular startDate: 30 días atrás, inicio del día
    const startDate = moment(today).subtract(30, "days").startOf("day");

    // Calcular endDate: día anterior, fin del día
    const endDate = moment(today).subtract(1, "day").endOf("day");

    // Imprimir para verificar
    console.log(
      "Inicio del rango (local):",
      startDate.format("YYYY-MM-DD HH:mm:ss.SSS ZZ")
    ); // 2025-04-01 00:00:00.000 -0500
    console.log(
      "Fin del rango (local):",
      endDate.format("YYYY-MM-DD HH:mm:ss.SSS ZZ")
    ); // 2025-04-30 23:59:59.999 -0500
    console.log("Inicio del rango (UTC):", startDate.toISOString()); // 2025-04-01T05:00:00.000Z
    console.log("Fin del rango (UTC):", endDate.toISOString()); // 2025-05-01T04:59:59.999Z

    // Reservas cuya estancia se traslape con algún día del rango
    const reservas = await collection
      .find({
        fecha_llegada: {
          $gte: startDate,
          $lte: endDate,
        },
        fecha_cancelacion: new Date("1900-01-01T00:00:00.000Z"),
      })
      .toArray();

    const conteoPorDia = [];

    for (let i = 1; i <= 31; i++) {
      const dia = new Date(today);
      dia.setDate(today.getDate() - i);
      dia.setHours(0, 0, 0, 0);
      const diaStr = dia.toISOString().split("T")[0]; // yyyy-mm-dd
      // Inicializar cada día con ocupación 0
      conteoPorDia.push({ dia: diaStr, ocupacion: 0 });
    }

    reservas.forEach((reserva) => {
      const llegada = new Date(reserva.fecha_llegada);
      const salida = new Date(reserva.fecha_salida);

      for (let i = 1; i <= 31; i++) {
        const dia = new Date(today);
        dia.setDate(today.getDate() - i);
        dia.setHours(0, 0, 0, 0);

        // Solo contar días entre llegada y salida (sin incluir salida)
        if (dia >= llegada && dia < salida) {
          const diaStr = dia.toISOString().split("T")[0];
          const diaObj = conteoPorDia.find((d) => d.dia === diaStr);

          if (diaObj) {
            if (reserva.cantid_reh > 0) {
              diaObj.ocupacion += reserva.cantid_reh;
            } else {
              diaObj.ocupacion++;
            }
          }
        }
      }
    });
    res.json(conteoPorDia);
  } catch (error) {
    console.error("Error fetching reservas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    await client.close();
  }
});

module.exports = router;

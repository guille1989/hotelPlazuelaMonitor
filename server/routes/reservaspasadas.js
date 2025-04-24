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

    const hoy = new Date();
    hoy.setDate(hoy.getDate() - 1); // Asegura que hoy sea el día siguiente
    hoy.setUTCHours(23, 59, 59, 999); // Final del día anterior en UTC
    const inicioRango = new Date(hoy);
    inicioRango.setDate(hoy.getDate() - 30); // Hace 30 días
    inicioRango.setUTCHours(0, 0, 0, 0); // Inicio del rango en UTC
        
    // Reservas cuya estancia se traslape con algún día del rango
    const reservas = await collection
      .find({
        fecha_cancelacion: new Date("1900-01-01T00:00:00.000Z"),
        fecha_liquidacion: {$ne: new Date("1900-01-01T00:00:00.000Z")},
        fecha_llegada: { $gte: inicioRango }, // Llegada dentro de los últimos 30 días
        fecha_salida: { $lte: hoy }, // Salida hasta hoy
      })
      .toArray();
    const conteoPorDia = [];
    const conteoPorDiaConCheckIn = [];

    for (let i = 0; i <= 30; i++) {
      const dia = new Date(hoy);
      dia.setDate(hoy.getDate() - i); // Retrocede `i` días desde hoy
      dia.setHours(0, 0, 0, 0);
      const diaStr = dia.toISOString().split("T")[0]; // Formato yyyy-mm-dd

      // Inicializar cada día con ocupación 0
      conteoPorDia.push({ dia: diaStr, ocupacion: 0, ocupacionConCheckIn: 0 });
      conteoPorDiaConCheckIn.push({
        dia: diaStr,
        ocupacion: 0,
      });
    }

    reservas.forEach((reserva) => {
      const llegada = new Date(reserva.fecha_llegada);
      const salida = new Date(reserva.fecha_salida);

      for (let i = 0; i <= 30; i++) {
        const dia = new Date(hoy);
        dia.setDate(hoy.getDate() - i); // Retrocede `i` días desde hoy
        dia.setHours(0, 0, 0, 0);

        // Solo contar días entre llegada y salida (sin incluir salida)
        if (dia >= llegada && dia < salida) {
          const diaStr = dia.toISOString().split("T")[0];
          const diaObj = conteoPorDia.find((d) => d.dia === diaStr);
          const diaObjConCheckIn = conteoPorDiaConCheckIn.find(
            (d) => d.dia === diaStr
          );

          if (diaObj) {
            if (reserva.canuti_reh > 0) {
              diaObj.ocupacion += reserva.canuti_reh;
              diaObj.ocupacionConCheckIn += reserva.canuti_reh;
              diaObjConCheckIn.ocupacion += reserva.canuti_reh;
            } else {
              diaObj.ocupacion++;
            }
          }
        }
      }
    });

    res.json({ conteoPorDia, conteoPorDiaConCheckIn });
  } catch (error) {
    console.error("Error fetching reservas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    await client.close();
  }
});

module.exports = router;

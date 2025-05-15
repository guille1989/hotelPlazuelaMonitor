const express = require("express");
const { MongoClient } = require("mongodb");
const router = express.Router();
const {
  getBogotaUtcRangoDesdeHoy,
} = require("../functions/rangodiasfuturo.js");

const uri =
  "mongodb+srv://root:123@cluster0.jwxt0.mongodb.net/hotellpmonitor?retryWrites=true&w=majority";
const client = new MongoClient(uri);

router.get("/", async (req, res) => {
  try {
    await client.connect();
    const database = client.db("hotellpmonitor");
    const collection = database.collection("reservas");

    //FechasUTC
    const { inicioUtc, finUtc } = getBogotaUtcRangoDesdeHoy(30);
    //console.log("Inicio UTC:", inicioUtc.toISOString());
    //console.log("Fin UTC:", finUtc.toISOString());

    // Reservas cuya estancia se traslape con algún día del rango
    const reservas = await collection
      .find({
        $or: [
          {
            fecha_llegada_habitacion: {
              $lte: finUtc.toISOString().split("T")[0],
            },
            fecha_salida_habitacion: {
              $gt: inicioUtc.toISOString().split("T")[0],
            },
          },
          {
            fecha_llegada_habitacion: null,
            fecha_llegada: { $lte: finUtc.toISOString().split("T")[0] },
            fecha_salida: { $gt: inicioUtc.toISOString().split("T")[0] },
          },
        ],
      })
      .toArray();

    // Procesar las reservas para ajustar `fecha_salida` si `fecha_ult_mod` existe y es mayor
    const reservasProcesadas = reservas.map((reserva) => {
      //Validamos que fecha tenemos si fecha_llegada_habitacion o fecha_llegada
      const fechaSalida =
        reserva.fecha_salida_habitacion || reserva.fecha_salida;

      if (
        reserva.fecha_ult_mod && // Verifica que `fecha_ult_mod` exista
        new Date(reserva.fecha_ult_mod) > new Date(fechaSalida) // Compara las fechas
      ) {
        // Reemplaza `fecha_salida` con `fecha_ult_mod`
        return {
          ...reserva,
          ...(reserva.fecha_salida_habitacion
            ? { fecha_salida_habitacion: reserva.fecha_ult_mod }
            : { fecha_salida: reserva.fecha_ult_mod }),
        };
      }
      return reserva; // Si no se cumple la condición, devuelve la reserva sin cambios
    });

    const FECHA_1900 = "1900-01-01"; // Fecha de referencia para cancelación

    const reservasFiltradas = reservasProcesadas.filter((doc) => {
      if (!doc.fecha_cancelacion) return true;

      // Comparar directamente las cadenas
      return doc.fecha_cancelacion.startsWith(FECHA_1900);
    });

    const conteoPorDia = [];

    for (let i = 0; i <= 30; i++) {
      const dia = new Date(inicioUtc);
      dia.setDate(inicioUtc.getDate() + i);
      dia.setHours(0, 0, 0, 0);
      const diaStr = dia.toISOString().split("T")[0]; // yyyy-mm-dd
      // Inicializar cada día con ocupación 0
      conteoPorDia.push({ dia: diaStr, ocupacion: 0, ocupacionConCheckIn: 0 });
    }
    //console.log("Conteo por día inicial:", conteoPorDia);

    reservasFiltradas.forEach((reserva) => {

      const fechaLlegada =
        reserva.fecha_llegada_habitacion || reserva.fecha_llegada;

      const fechaSalida =
        reserva.fecha_salida_habitacion || reserva.fecha_salida;

      const llegada = fechaLlegada;
      const salida = fechaSalida;

      for (let i = 0; i <= 30; i++) {
        const dia = new Date(inicioUtc);
        dia.setDate(inicioUtc.getDate() + i);
        dia.setHours(0, 0, 0, 0);

        // Solo contar días entre llegada y salida (sin incluir salida)
        if (
          new Date(dia) >= new Date(llegada) &&
          new Date(dia) < new Date(salida)
        ) {
          const diaStr = dia.toISOString().split("T")[0]; // yyyy-mm-dd
          const diaObj = conteoPorDia.find((d) => d.dia === diaStr);

          if (diaObj) {
            if (
              reserva.origen &&
              reserva.origen.trim().toLowerCase() === "con reserva"
            ) {
              if (reserva.cantid_reh > 0) {
                diaObj.ocupacion += reserva.cantid_reh;
              } else {
                diaObj.ocupacion++;
              }
            }

            if (
              reserva.origen &&
              reserva.origen.trim().toLowerCase() === "sin reserva"
            ) {
              diaObj.ocupacion++;
            }
          }
        }
      }
    });
    //console.log("Conteo por día:", conteoPorDia);
    res.json({ conteoPorDia });
  } catch (error) {
    console.error("Error fetching reservas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    await client.close();
  }
});

module.exports = router;

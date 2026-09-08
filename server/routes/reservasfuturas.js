const express = require("express");
const router = express.Router();
const { rangoDias } = require("../functions/fechas");
const { getDb } = require("../db");

const DIAS = 30; // ventana: hoy .. hoy+30

// Contrato nuevo: fecha_cancelacion es null (no cancelada) o "YYYY-MM-DD".
// El .startsWith("1900") queda por compatibilidad con documentos viejos que aún
// tengan el centinela.
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

// Habitaciones que aporta una reserva a un día.
function habitaciones(reserva) {
  const origen = (reserva.origen || "").trim().toLowerCase();
  if (origen === "sin reserva") return 1;
  return reserva.cantid_reh > 0 ? reserva.cantid_reh : 1;
}

router.get("/", async (req, res) => {
  try {
    const collection = (await getDb()).collection("reservas");

    const dias = rangoDias(0, DIAS);
    const inicio = dias[0];
    const fin = dias[dias.length - 1];

    // Reservas cuya estancia se traslapa con la ventana (comparación de strings YYYY-MM-DD).
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
    }));
    const porDia = new Map(conteoPorDia.map((d) => [d.dia, d]));

    for (const reserva of reservas) {
      const llegada = reserva.fecha_llegada_habitacion || reserva.fecha_llegada;
      const salida = salidaEfectiva(reserva);
      if (!llegada || !salida) continue;

      const cancelada = estaCancelada(reserva);
      const habs = habitaciones(reserva);

      for (const dia of dias) {
        if (dia >= llegada && dia < salida) {
          const d = porDia.get(dia);
          if (cancelada) d.cancelaciones += habs;
          else d.ocupacion += habs;
        }
      }
    }

    res.json({ conteoPorDia });
  } catch (error) {
    console.error("Error fetching reservasfuturas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

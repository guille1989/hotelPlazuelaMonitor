const express = require("express");
const router = express.Router();
const { hoyBogota, fechaBogota } = require("../functions/fechas");
const {
  estaCancelada,
  salidaEfectiva,
  habitaciones,
  noches,
} = require("../functions/ocupacion");
const { getDb } = require("../db");

// GET /api/pickup?dias=7
// Reservas captadas (y perdidas) en los últimos `dias`, por mes de llegada.
// pickup neto = nuevas − canceladas, ambas dentro de la ventana.
router.get("/", async (req, res) => {
  try {
    const dias = Math.min(90, Math.max(1, parseInt(req.query.dias, 10) || 7));
    const hoy = hoyBogota();
    const desde = fechaBogota(-dias);

    const db = await getDb();
    const reservas = await db
      .collection("reservas")
      .find({
        $or: [
          { fecha_reserva: { $gte: desde, $lte: hoy } },
          {
            fecha_cancelacion: { $gte: desde, $lte: hoy },
          },
        ],
      })
      .toArray();

    const porMes = new Map();
    const totales = { nuevas: 0, canceladas: 0, roomNoches: 0 };

    for (const r of reservas) {
      const llegada = r.fecha_llegada_habitacion || r.fecha_llegada;
      const salida = salidaEfectiva(r);
      if (!llegada || !salida) continue;

      const reservadoEnVentana =
        r.fecha_reserva && r.fecha_reserva >= desde && r.fecha_reserva <= hoy;
      const canceladoEnVentana =
        estaCancelada(r) &&
        r.fecha_cancelacion >= desde &&
        r.fecha_cancelacion <= hoy;

      const nueva = reservadoEnVentana && !estaCancelada(r);
      const cancel = canceladoEnVentana && !reservadoEnVentana;
      if (!nueva && !cancel) continue;

      const mes = llegada.slice(0, 7);
      if (!porMes.has(mes)) {
        porMes.set(mes, { mes, nuevas: 0, canceladas: 0, roomNoches: 0 });
      }
      const m = porMes.get(mes);
      const habs = habitaciones(r);
      const rn = noches(llegada, salida) * habs;

      if (nueva) {
        m.nuevas += habs;
        m.roomNoches += rn;
        totales.nuevas += habs;
        totales.roomNoches += rn;
      } else {
        m.canceladas += habs;
        m.roomNoches -= rn;
        totales.canceladas += habs;
        totales.roomNoches -= rn;
      }
    }

    const meses = [...porMes.values()].sort((a, b) =>
      a.mes.localeCompare(b.mes)
    );
    res.json({ dias, desde, hoy, totales, meses });
  } catch (error) {
    console.error("Error fetching pickup:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

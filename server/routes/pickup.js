const express = require("express");
const moment = require("moment-timezone");
const router = express.Router();
const { hoyBogota, fechaBogota } = require("../functions/fechas");
const {
  agruparPickup,
  combinarConHistorico,
  totalesVacios,
} = require("../functions/pickupCalculos");
const {
  evaluarRitmo,
  objetivosPickup,
} = require("../functions/objetivoPickup");
const { getDb } = require("../db");

const ANIOS_COMPARABLES = 1;

const desplazarFecha = (fecha, anios) =>
  moment(fecha, "YYYY-MM-DD").add(anios, "year").format("YYYY-MM-DD");

// GET /api/pickup?dias=7
// Reservas captadas (y perdidas) en los últimos `dias`, por mes de llegada.
// pickup neto = nuevas − canceladas, ambas dentro de la ventana.
router.get("/", async (req, res) => {
  try {
    const dias = Math.min(90, Math.max(1, parseInt(req.query.dias, 10) || 7));
    const objetivoPct = Math.min(
      100,
      Math.max(1, parseInt(req.query.objetivo, 10) || 75)
    );
    const hoy = hoyBogota();
    // La ventana incluye hoy: 7 días = hoy + los 6 días anteriores.
    const desde = fechaBogota(1 - dias);

    const ventanasHistoricas = Array.from(
      { length: ANIOS_COMPARABLES },
      (_, indice) => {
        const aniosAtras = indice + 1;
        return {
          aniosAtras,
          desde: desplazarFecha(desde, -aniosAtras),
          hasta: desplazarFecha(hoy, -aniosAtras),
        };
      }
    );
    const ventanas = [{ desde, hasta: hoy }, ...ventanasHistoricas];
    const filtroEventos = ventanas.flatMap((ventana) => [
      { fecha_reserva: { $gte: ventana.desde, $lte: ventana.hasta } },
      { fecha_cancelacion: { $gte: ventana.desde, $lte: ventana.hasta } },
    ]);

    const db = await getDb();
    const reservas = await db
      .collection("reservas")
      .find({ $or: filtroEventos })
      .toArray();

    const actual = agruparPickup(reservas, { desde, hasta: hoy });
    const muestrasHistoricas = ventanasHistoricas.map((ventana) => ({
      ...agruparPickup(reservas, {
        desde: ventana.desde,
        hasta: ventana.hasta,
        desplazarAnios: ventana.aniosAtras,
      }),
      periodo: ventana,
    }));
    const comparacion = combinarConHistorico(actual, muestrasHistoricas);
    const objetivos = await objetivosPickup(
      db,
      comparacion.meses,
      objetivoPct,
      hoy,
      ventanasHistoricas[0]?.hasta
    );
    // El semáforo de metas siempre trae un horizonte fijo de meses (objetivosPickup),
    // que puede incluir meses sin movimiento reciente de reservas; se completan con
    // ceros para que igual aparezcan en el desglose.
    const movimientoPorMes = new Map(comparacion.meses.map((mes) => [mes.mes, mes]));
    const clavesFinales = [
      ...new Set([...movimientoPorMes.keys(), ...objetivos.porMes.keys()]),
    ].sort((a, b) => a.localeCompare(b));
    const meses = clavesFinales.map((clave) => {
      const movimiento = movimientoPorMes.get(clave) || {
        mes: clave,
        ...totalesVacios(),
        historico: null,
      };
      const objetivo = objetivos.porMes.get(clave) || null;
      return {
        ...movimiento,
        objetivo,
        evaluacion: evaluarRitmo({
          roomNoches: movimiento.roomNoches,
          historico: movimiento.historico,
          objetivo,
        }),
      };
    });
    const periodosHistoricos = muestrasHistoricas
      .filter((muestra) => muestra.movimientos > 0)
      .map((muestra) => muestra.periodo);

    res.json({
      dias,
      desde,
      hoy,
      totales: actual.totales,
      meses,
      historico: comparacion.historico,
      objetivo: objetivos.resumen,
      referencia: {
        tipo: comparacion.muestrasDisponibles > 1 ? "mediana" : "anio_anterior",
        muestras: comparacion.muestrasDisponibles,
        periodos: periodosHistoricos,
      },
    });
  } catch (error) {
    console.error("Error fetching pickup:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const { diasDelMes, hoyBogota } = require("../functions/fechas");
const {
  estaCancelada,
  salidaEfectiva,
  habitaciones,
  noches,
} = require("../functions/ocupacion");
const { ocupacionPorDia } = require("../functions/ocupacionDiaria");
const { getDb } = require("../db");

const RE_MES = /^\d{4}-\d{2}$/;

// Lista de "YYYY-MM" desde `desde` hasta `hasta` inclusive (máx 24).
function mesesEntre(desde, hasta) {
  const lista = [];
  let [y, m] = desde.split("-").map(Number);
  const [ey, em] = hasta.split("-").map(Number);
  while ((y < ey || (y === ey && m <= em)) && lista.length < 24) {
    lista.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return lista;
}

// GET /api/ocupacionperiodo?desde=YYYY-MM&hasta=YYYY-MM
// -> agregados de ocupación por mes en el rango. Sin params: mes actual.
router.get("/", async (req, res) => {
  try {
    const hoy = hoyBogota();
    const desde = RE_MES.test(req.query.desde || "")
      ? req.query.desde
      : hoy.slice(0, 7);
    const hasta = RE_MES.test(req.query.hasta || "") ? req.query.hasta : desde;
    if (hasta < desde) {
      return res.status(400).json({ error: "rango inválido" });
    }

    const claves = mesesEntre(desde, hasta);
    const meses = claves.map((mes) => {
      const [y, m] = mes.split("-").map(Number);
      return {
        mes,
        dias: diasDelMes(y, m).length,
        habNoche: 0, // habitación-noche ocupadas (folio para pasado, reservas para futuro)
        canceladas: 0, // canceladas que se traslapan con el mes
        tarifas: 0,
        habsTarifa: 0,
        // Conteos por MES DE LLEGADA (barra apilada + estancia media + tasa cancelación):
        checkin: 0,
        reservadas: 0,
        canceladasLlegada: 0,
        roomNoches: 0,
        antelacionDias: 0,
        antelacionN: 0,
        canal: {}, // habitaciones por canal (modo_reserva), solo no canceladas
      };
    });
    const idx = new Map(meses.map((M, i) => [M.mes, i]));

    // Todos los días del rango.
    const dias = [];
    for (const clave of claves) {
      const [y, m] = clave.split("-").map(Number);
      dias.push(...diasDelMes(y, m));
    }

    const db = await getDb();
    const { porDia, reservas } = await ocupacionPorDia(db, dias);

    // Roll-up día -> mes de ocupación / ingreso / cancelaciones.
    for (const [dia, o] of porDia) {
      const M = meses[idx.get(dia.slice(0, 7))];
      if (!M) continue;
      M.habNoche += o.ocupacion;
      M.tarifas += o.tarifas;
      M.habsTarifa += o.habsTarifa;
      M.canceladas += o.cancelaciones;
    }

    // Agregados por MES DE LLEGADA, desde reservas.
    for (const r of reservas) {
      const llegada = r.fecha_llegada_habitacion || r.fecha_llegada;
      const salida = salidaEfectiva(r);
      if (!llegada || !salida) continue;
      const mi = idx.get(llegada.slice(0, 7));
      if (mi === undefined) continue;
      const M = meses[mi];
      const habs = habitaciones(r);
      if (estaCancelada(r)) {
        M.canceladasLlegada += habs;
      } else {
        if (String(r.estado_habitacion) === "31") M.checkin += habs;
        else M.reservadas += habs;
        M.roomNoches += noches(llegada, salida) * habs;
        if (r.fecha_reserva && r.fecha_reserva <= llegada) {
          M.antelacionDias += noches(r.fecha_reserva, llegada);
          M.antelacionN += 1;
        }
        const modo = r.modo_reserva || "?";
        M.canal[modo] = (M.canal[modo] || 0) + habs;
      }
    }

    res.json({ desde, hasta, hoy, meses });
  } catch (error) {
    console.error("Error fetching ocupacionperiodo:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

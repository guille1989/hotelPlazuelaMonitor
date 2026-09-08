const express = require("express");
const router = express.Router();
const { diasDelMes, hoyBogota } = require("../functions/fechas");
const {
  estaCancelada,
  salidaEfectiva,
  habitaciones,
  filtroTraslape,
} = require("../functions/ocupacion");
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

// Primer día del mes siguiente a `ym` ("2026-12" -> "2027-01-01").
function primerDiaSiguiente(ym) {
  let [y, m] = ym.split("-").map(Number);
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, "0")}-01`;
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
        habNoche: 0,
        canceladas: 0,
        tarifas: 0,
        habsTarifa: 0,
      };
    });
    const idx = new Map(meses.map((M, i) => [M.mes, i]));

    const inicioStr = `${desde}-01`;
    const finExclusivo = primerDiaSiguiente(claves[claves.length - 1]);
    const finStr = `${claves[claves.length - 1]}-31`;

    const collection = (await getDb()).collection("reservas");
    const reservas = await collection
      .find(filtroTraslape(inicioStr, finStr))
      .toArray();

    for (const reserva of reservas) {
      const llegada = reserva.fecha_llegada_habitacion || reserva.fecha_llegada;
      const salida = salidaEfectiva(reserva);
      if (!llegada || !salida) continue;

      const cancelada = estaCancelada(reserva);
      const habs = habitaciones(reserva);
      const valor = Number(reserva.valor_habitacion) || 0;

      const d0 = llegada < inicioStr ? inicioStr : llegada;
      const d1 = salida < finExclusivo ? salida : finExclusivo;
      let cur = new Date(`${d0}T00:00:00Z`);
      const end = new Date(`${d1}T00:00:00Z`);
      while (cur < end) {
        const mi = idx.get(cur.toISOString().slice(0, 7));
        if (mi !== undefined) {
          const M = meses[mi];
          if (cancelada) {
            M.canceladas += habs;
          } else {
            M.habNoche += habs;
            if (valor > 0) {
              M.tarifas += valor * habs;
              M.habsTarifa += habs;
            }
          }
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    res.json({ desde, hasta, hoy, meses });
  } catch (error) {
    console.error("Error fetching ocupacionperiodo:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const { mesActualBogota } = require("../functions/fechas");
const { getDb } = require("../db");
const { RE_MES } = require("../services/ocupacionMes");
const { obtenerCargosManuales } = require("../services/cargosManuales");

// GET /api/cargosmanuales?mes=YYYY-MM  -> cargos de alojamiento cargados a mano
// (y anulaciones) del mes, para revisar contra el trasunto. Sin `mes` usa el actual.
router.get("/", async (req, res) => {
  try {
    const mes = RE_MES.test(req.query.mes || "") ? req.query.mes : mesActualBogota();
    const db = await getDb();
    res.json(await obtenerCargosManuales(db, mes));
  } catch (error) {
    console.error("Error fetching cargosmanuales:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

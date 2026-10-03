const express = require("express");
const router = express.Router();
const { mesActualBogota } = require("../functions/fechas");
const { getDb } = require("../db");
const { RE_MES } = require("../services/ocupacionMes");
const { obtenerTrasuntoMes } = require("../services/trasuntoMes");

// GET /api/trasunto?mes=YYYY-MM  -> resumen de ventas por día (como la hoja RESUMEN
// MES del trasunto), armado con los folios de Zeus. Sin `mes` usa el mes actual.
router.get("/", async (req, res) => {
  try {
    const mes = RE_MES.test(req.query.mes || "") ? req.query.mes : mesActualBogota();
    const db = await getDb();
    res.json(await obtenerTrasuntoMes(db, mes));
  } catch (error) {
    console.error("Error fetching trasunto:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

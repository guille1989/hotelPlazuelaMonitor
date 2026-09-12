const express = require("express");
const router = express.Router();
const { mesActualBogota } = require("../functions/fechas");
const { getDb } = require("../db");
const { obtenerOcupacionMes, RE_MES } = require("../services/ocupacionMes");

// GET /api/ocupacionmes?mes=YYYY-MM  -> ocupación día a día del mes.
// Sin `mes` usa el mes actual (Bogotá).
router.get("/", async (req, res) => {
  try {
    const mes = RE_MES.test(req.query.mes || "") ? req.query.mes : mesActualBogota();
    const db = await getDb();
    res.json(await obtenerOcupacionMes(db, mes));
  } catch (error) {
    console.error("Error fetching ocupacionmes:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const { getDb } = require("../db");
const { generarRecomendaciones } = require("../services/recomendacionesTarifa");

// GET /api/recomendaciones?dias=60&objetivo=75 -> copiloto de tarifas: por cada día
// del horizonte, subir / mantener / bajar con %, confianza, motivo y las señales que
// lo justifican. Se calcula al momento con los datos del ETL.
router.get("/", async (req, res) => {
  try {
    const dias = Math.min(90, Math.max(1, parseInt(req.query.dias, 10) || 60));
    const objetivoPct = Math.min(100, Math.max(1, parseInt(req.query.objetivo, 10) || 75));
    const db = await getDb();
    const { dias: _senales, ...respuesta } = await generarRecomendaciones(db, { dias, objetivoPct });
    res.json(respuesta);
  } catch (error) {
    console.error("Error fetching recomendaciones:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const { getDb } = require("../db");
const { obtenerTarifasCompetencia } = require("../services/tarifasCompetencia");

// GET /api/tarifas?objetivo=75  -> última captura de tarifas de la competencia
// (Booking vía SerpApi) por fecha, con la mediana de los competidores directos y
// la ocupación proyectada propia. `objetivo` es el mismo objetivo de ocupación
// de Pickup y define los avisos "caro y vacío" / "barato y lleno".
router.get("/", async (req, res) => {
  try {
    const objetivoPct = Math.min(100, Math.max(1, parseInt(req.query.objetivo, 10) || 75));
    const db = await getDb();
    res.json(await obtenerTarifasCompetencia(db, { objetivoPct }));
  } catch (error) {
    console.error("Error fetching tarifas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

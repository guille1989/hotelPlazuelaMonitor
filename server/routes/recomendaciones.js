const express = require("express");
const router = express.Router();
const { getDb } = require("../db");
const { hoyBogota } = require("../functions/fechas");
const {
  desmarcarAplicada,
  generarRecomendaciones,
  marcarAplicada,
  validarAplicada,
} = require("../services/recomendacionesTarifa");

function responderError(res, error, contexto) {
  if (error.status === 400) return res.status(400).json({ error: error.message });
  console.error(`Error ${contexto}:`, error);
  return res.status(500).json({ error: "Internal Server Error" });
}

// GET /api/recomendaciones?dias=60&objetivo=75 -> copiloto de tarifas: por cada día
// del horizonte, subir / mantener / bajar con %, confianza, motivo, las señales que
// lo justifican y si ya se aplicó en los últimos 7 días. Se calcula al momento con
// los datos del ETL.
router.get("/", async (req, res) => {
  try {
    const dias = Math.min(90, Math.max(1, parseInt(req.query.dias, 10) || 60));
    const objetivoPct = Math.min(100, Math.max(1, parseInt(req.query.objetivo, 10) || 75));
    const db = await getDb();
    const { dias: _senales, ...respuesta } = await generarRecomendaciones(db, { dias, objetivoPct });
    res.json(respuesta);
  } catch (error) {
    responderError(res, error, "fetching recomendaciones");
  }
});

// POST /api/recomendaciones/aplicada {dia, accion, pct} -> se cambió el precio en
// Booking como recomendó el copiloto.
router.post("/aplicada", async (req, res) => {
  try {
    const hoy = hoyBogota();
    const datos = validarAplicada(req.body, hoy);
    const db = await getDb();
    res.json({ aplicada: await marcarAplicada(db, { hoy, ...datos }) });
  } catch (error) {
    responderError(res, error, "marcando recomendación aplicada");
  }
});

// DELETE /api/recomendaciones/aplicada/:dia -> deshace la marca.
router.delete("/aplicada/:dia", async (req, res) => {
  try {
    const db = await getDb();
    res.json(await desmarcarAplicada(db, { hoy: hoyBogota(), dia: req.params.dia }));
  } catch (error) {
    responderError(res, error, "desmarcando recomendación aplicada");
  }
});

module.exports = router;

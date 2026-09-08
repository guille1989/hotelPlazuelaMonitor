const express = require("express");
const router = express.Router();
const { getDb } = require("../db");

router.get("/", async (req, res) => {
  try {
    const collection = (await getDb()).collection("ultimaactualizacions");
    const reservas = await collection.find({}).toArray();

    res.json(reservas);
  } catch (error) {
    console.error("Error fetching actualizacionreservas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

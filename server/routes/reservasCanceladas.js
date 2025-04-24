const express = require('express');
const { MongoClient } = require('mongodb');
const router = express.Router();

const uri = 'mongodb+srv://root:123@cluster0.jwxt0.mongodb.net/hotellpmonitor?retryWrites=true&w=majority';
const client = new MongoClient(uri);

router.get('/', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('hotellpmonitor');
    const collection = database.collection('reservas');
    const hoy = new Date();

    // Calcular el inicio y fin del día en UTC
    const inicioDelDia = new Date(
      Date.UTC(
        hoy.getUTCFullYear(),
        hoy.getUTCMonth(),
        hoy.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );
    const finDelDia = new Date(
      Date.UTC(
        hoy.getUTCFullYear(),
        hoy.getUTCMonth(),
        hoy.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );

    const reservasHoy = await collection
      .find({
        fecha_cancelacion: { $ne: new Date('1900-01-01T00:00:00.000Z') },
        fecha_llegada: { $lte: finDelDia },
        fecha_salida: { $gt: inicioDelDia },
      })
      .toArray();

    res.json(reservasHoy);
  } catch (error) {
    console.error('Error fetching reservas:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    await client.close();
  }
});

module.exports = router;
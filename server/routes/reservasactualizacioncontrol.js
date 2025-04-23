const express = require('express');
const { MongoClient } = require('mongodb');
const router = express.Router();

const uri = 'mongodb+srv://root:123@cluster0.jwxt0.mongodb.net/hotellpmonitor?retryWrites=true&w=majority';
const client = new MongoClient(uri);

router.get('/', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('hotellpmonitor');
    const collection = database.collection('ultimaactualizacions');
    const reservas = await collection.find({}).toArray();

    res.json(reservas);
  } catch (error) {
    console.error('Error fetching actualizacionreservas:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    await client.close();
  }
});

module.exports = router;
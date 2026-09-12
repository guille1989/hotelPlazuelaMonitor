require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { getDb } = require("./db");

const app = express();
// Cloud Run inyecta PORT (normalmente 8080); en local usamos el 5002 de siempre.
const port = process.env.PORT || 5002;

// Rutas
const reservasRouter = require("./routes/reservas");
const reservasFuturasRouter = require("./routes/reservasfuturas");
const reservasActualizacionControlRouter = require("./routes/reservasactualizacioncontrol");
const reservasCanceladas = require("./routes/reservasCanceladas");
const reservasPasadas = require("./routes/reservaspasadas");
const ocupacionMesRouter = require("./routes/ocupacionmes");
const ocupacionPeriodoRouter = require("./routes/ocupacionperiodo");
const pickupRouter = require("./routes/pickup");
const whatsappRouter = require("./routes/whatsapp");

app.use(
  express.json({
    // Meta firma los bytes originales, antes de que express los convierta a objeto.
    verify: (req, _res, buffer) => {
      req.rawBody = Buffer.from(buffer);
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cors()); // TODO (aparcado): restringir al origen del frontend

app.use("/api/reservas", reservasRouter);
app.use("/api/reservasfuturas", reservasFuturasRouter);
app.use("/api/reservasactualizacioncontrol", reservasActualizacionControlRouter);
app.use("/api/reservascanceladas", reservasCanceladas);
app.use("/api/reservaspasadas", reservasPasadas);
app.use("/api/ocupacionmes", ocupacionMesRouter);
app.use("/api/ocupacionperiodo", ocupacionPeriodoRouter);
app.use("/api/pickup", pickupRouter);
app.use("/webhooks/whatsapp", whatsappRouter);

// Calienta la conexión a Mongo al arrancar (no bloquea el listen; las rutas la reutilizan).
getDb()
  .then(() => console.log("Conectado a MongoDB (hotellpmonitor)"))
  .catch((err) => console.error("No se pudo conectar a MongoDB:", err.message));

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});

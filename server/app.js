const express = require("express");
const cors = require("cors");
const { getDb } = require("./db");

const app = express();
const port = 5002;

// Rutas
const reservasRouter = require("./routes/reservas");
const reservasFuturasRouter = require("./routes/reservasfuturas");
const reservasActualizacionControlRouter = require("./routes/reservasactualizacioncontrol");
const reservasCanceladas = require("./routes/reservasCanceladas");
const reservasPasadas = require("./routes/reservaspasadas");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors()); // TODO (aparcado): restringir al origen del frontend

app.use("/api/reservas", reservasRouter);
app.use("/api/reservasfuturas", reservasFuturasRouter);
app.use("/api/reservasactualizacioncontrol", reservasActualizacionControlRouter);
app.use("/api/reservascanceladas", reservasCanceladas);
app.use("/api/reservaspasadas", reservasPasadas);

// Calienta la conexión a Mongo al arrancar (no bloquea el listen; las rutas la reutilizan).
getDb()
  .then(() => console.log("Conectado a MongoDB (hotellpmonitor)"))
  .catch((err) => console.error("No se pudo conectar a MongoDB:", err.message));

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});

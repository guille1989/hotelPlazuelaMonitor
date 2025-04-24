const express = require("express");
const mongose = require("mongoose");
const http = require("http");
const cors = require("cors"); // Importa CORS
const { Server } = require("socket.io");
const bodyParser = require("body-parser");

const app = express();
const server = http.createServer(app);
const port = 5002;

//Import Rutas:
const reservasRouter = require('./routes/reservas');
const reservasFuturasRouter = require('./routes/reservasfuturas');
const reservasActualizacionControlRouter = require('./routes/reservasactualizacioncontrol');
const reservasCanceladas = require('./routes/reservasCanceladas');
const reservasPasadas = require('./routes/reservaspasadas');

//Conectamos con Data Base
mongose
  .connect(
    "mongodb+srv://root:123@cluster0.jwxt0.mongodb.net/inventarios_prod?retryWrites=true&w=majority",
    { useNewUrlParser: true, useUnifiedTopology: true }
  )
  .then(() => console.log("Conectado con DB"))
  .catch(() => console.log("No se puedo conectar con DB"));

mongose.set("strictQuery", true);

// Manejo de eventos de conexión
mongose.connection.on("disconnected", () => {
  console.error("Conexión con MongoDB cerrada.");
});

mongose.connection.on("error", (err) => {
  console.error("Error en la conexión con MongoDB:", err);
});
//*************************
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(bodyParser.json());
app.use(cors()); // Habilita CORS para todas las rutas


// Rutas
app.use('/api/reservas', reservasRouter);
app.use('/api/reservasfuturas', reservasFuturasRouter);
app.use('/api/reservasactualizacioncontrol', reservasActualizacionControlRouter);
app.use('/api/reservascanceladas', reservasCanceladas);
app.use('/api/reservaspasadas', reservasPasadas);

// Iniciar el servidor
server.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
// Manejo de errores
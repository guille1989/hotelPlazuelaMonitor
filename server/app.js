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

//Conectamos con Data Base
mongose
  .connect(
    "mongodb+srv://root:123@cluster0.jwxt0.mongodb.net/inventarios_prod?retryWrites=true&w=majority",
    {}
  )
  .then(() => console.log("Conectado con DB"))
  .catch(() => console.log("No se puedo conectar con DB"));

mongose.set("strictQuery", true);
//*************************
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(bodyParser.json());
app.use(cors()); // Habilita CORS para todas las rutas


// Rutas
app.use('/api/reservas', reservasRouter);
app.use('/api/reservasfuturas', reservasFuturasRouter);
app.use('/api/reservasactualizacioncontrol', reservasActualizacionControlRouter);

// Iniciar el servidor
server.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
// Manejo de errores
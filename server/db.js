const mongoose = require("mongoose");

// Desarrollo local: si el DNS del equipo no resuelve registros SRV, exportar
//   DNS_SERVERS=8.8.8.8,1.1.1.1
// En producción no se define y no cambia nada.
if (process.env.DNS_SERVERS) {
  require("dns").setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));
}

const URI =
  process.env.MONGO_URI ||
  "mongodb+srv://root:123@cluster0.jwxt0.mongodb.net/hotellpmonitor?retryWrites=true&w=majority";

let conexion = null;

// Devuelve el Db nativo de MongoDB reutilizando UNA sola conexión para todo el proceso.
// Antes cada ruta hacía client.connect()/client.close() por request, lo que bajo
// concurrencia hacía que un request cerrara la conexión de otro.
async function getDb() {
  if (mongoose.connection.readyState === 1) return mongoose.connection.db;
  if (!conexion) {
    conexion = mongoose.connect(URI, { serverSelectionTimeoutMS: 15000 });
  }
  await conexion;
  return mongoose.connection.db;
}

module.exports = { getDb };

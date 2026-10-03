const mongoose = require("mongoose");

// Desarrollo local: si el DNS del equipo no resuelve registros SRV, exportar
//   DNS_SERVERS=8.8.8.8,1.1.1.1
// En producción no se define y no cambia nada.
if (process.env.DNS_SERVERS) {
  require("dns").setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));
}

let conexion = null;

function mongoUri(env = process.env) {
  const uri = String(env.MONGO_URI || "").trim();
  if (!uri) {
    const error = new Error(
      "MONGO_URI no está configurada. Defínela como variable de entorno o en server/.env"
    );
    error.codigo = "MONGO_URI_FALTANTE";
    throw error;
  }
  return uri;
}

// Devuelve el Db nativo de MongoDB reutilizando UNA sola conexión para todo el proceso.
// Antes cada ruta hacía client.connect()/client.close() por request, lo que bajo
// concurrencia hacía que un request cerrara la conexión de otro.
async function getDb() {
  if (mongoose.connection.readyState === 1) return mongoose.connection.db;
  if (!conexion) {
    conexion = mongoose.connect(mongoUri(), { serverSelectionTimeoutMS: 15000 });
  }
  await conexion;
  return mongoose.connection.db;
}

module.exports = { getDb, mongoUri };

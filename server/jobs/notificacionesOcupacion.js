require("dotenv").config({ quiet: true });

const { getDb } = require("../db");
const {
  ejecutarNotificacionesOcupacion,
} = require("../services/notificacionesOcupacion");

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = await getDb();
  const resultado = await ejecutarNotificacionesOcupacion({ db, dryRun });
  console.log(JSON.stringify(resultado, null, 2));

  if (resultado.resultados.some((item) => item.estado === "error")) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Error ejecutando notificaciones de ocupación:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    // El job es de una sola ejecución; cerramos para que cron no deje procesos vivos.
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });

require("dotenv").config({ quiet: true });

// Carga eventos de demanda a `copiloto_eventos` desde un JSON {origen, eventos: [...]}.
//   npm run copiloto:eventos -- data/copiloto-eventos-oct-nov-2026.json [--dry-run]
// Volver a cargar el mismo archivo actualiza los eventos, no los duplica.

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { getDb } = require("../db");
const { guardarEventos, normalizarEvento } = require("../services/eventosCopiloto");

async function main() {
  const archivo = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!archivo) throw new Error("Falta la ruta del JSON de eventos");
  const dryRun = process.argv.includes("--dry-run");

  const ruta = path.resolve(archivo);
  if (!fs.existsSync(ruta)) {
    const carpeta = path.dirname(ruta);
    const disponibles = fs.existsSync(carpeta)
      ? fs.readdirSync(carpeta).filter((f) => f.endsWith(".json"))
      : [];
    throw new Error(
      `No existe ${archivo}.` +
        (disponibles.length ? ` JSON disponibles en esa carpeta: ${disponibles.join(", ")}` : "")
    );
  }
  const contenido = JSON.parse(fs.readFileSync(ruta, "utf8"));
  const eventos = (contenido.eventos || []).map((e) => normalizarEvento(e, contenido.origen || null));
  const ids = new Set();
  for (const e of eventos) {
    if (ids.has(e._id)) throw new Error(`Evento repetido en el archivo: ${e._id}`);
    ids.add(e._id);
  }

  for (const e of eventos) {
    console.log(
      `${e.desde} → ${e.hasta}  ${e.impacto.padEnd(10)} ${e.tipo === "ventana" ? "[ventana] " : ""}${e.nombre}`
    );
  }
  if (dryRun) {
    console.log(`\n${eventos.length} eventos válidos. En seco: no se guardó nada.`);
    return;
  }

  const db = await getDb();
  const { insertados, actualizados } = await guardarEventos(db, eventos);
  console.log(`\n${eventos.length} eventos: ${insertados} nuevos, ${actualizados} actualizados.`);
}

main()
  .catch((error) => {
    console.error("Error cargando eventos:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });

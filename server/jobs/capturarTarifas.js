require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");
const { getDb } = require("../db");
const { crearConsultas } = require("../rate-shopping/consultas");
const { CATALOGO_HOTELES, GRUPOS } = require("../rate-shopping/catalogoHoteles");
const { crearProveedorMock } = require("../rate-shopping/providers/mock");
const {
  IDS_PILOTO_PLAYWRIGHT,
  crearProveedorPlaywright,
} = require("../rate-shopping/providers/playwright");
const { crearProveedorSerpApi } = require("../rate-shopping/providers/serpapi");
const {
  COLECCIONES,
  ejecutarCapturaTarifas,
  fechaCapturaBogota,
} = require("../services/rateShopping");

function valorArgumento(nombre) {
  const prefijo = `--${nombre}=`;
  const argumento = process.argv.find((item) => item.startsWith(prefijo));
  return argumento ? argumento.slice(prefijo.length) : null;
}

function crearProveedor(nombre) {
  if (nombre === "mock") return crearProveedorMock();
  if (nombre === "playwright") return crearProveedorPlaywright();
  if (nombre === "serpapi") return crearProveedorSerpApi();
  throw new Error(`Proveedor de tarifas no implementado: ${nombre}`);
}

function leerHorizontes(valor) {
  if (!valor) return undefined;
  const horizontes = valor.split(",").map((item) => Number(item.trim()));
  if (
    horizontes.length === 0 ||
    horizontes.some((item) => !Number.isInteger(item) || item < 0)
  ) {
    throw new Error("--horizontes debe contener enteros separados por coma");
  }
  return horizontes;
}

// Con SerpApi cada hotel gasta una búsqueda por fecha: por defecto solo el
// hotel propio y los competidores directos (7 × 7 fechas = 49 por corrida).
function catalogoDelProveedor(nombreProveedor) {
  if (nombreProveedor === "playwright") {
    return CATALOGO_HOTELES.filter((hotel) => IDS_PILOTO_PLAYWRIGHT.includes(hotel.id));
  }
  if (nombreProveedor === "serpapi") {
    const grupos = (
      valorArgumento("grupos") ||
      process.env.RATE_SHOPPING_GRUPOS ||
      `${GRUPOS.PROPIO},${GRUPOS.DIRECTO}`
    )
      .split(",")
      .map((grupo) => grupo.trim());
    return CATALOGO_HOTELES.filter((hotel) => grupos.includes(hotel.grupo));
  }
  return CATALOGO_HOTELES;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const nombreProveedor =
    valorArgumento("provider") || process.env.RATE_SHOPPING_PROVIDER || "mock";
  const fechaBase = valorArgumento("fecha-base") || undefined;
  const horizontes = leerHorizontes(valorArgumento("horizontes"));
  const proveedor = crearProveedor(nombreProveedor);
  const catalogo = catalogoDelProveedor(nombreProveedor);
  const db = dryRun ? null : await getDb();

  // Repetir la captura del día gasta otra corrida completa de la cuota (49 búsquedas
  // de SerpApi); solo se hace a propósito, con --forzar.
  if (!dryRun && !process.argv.includes("--forzar")) {
    const runId = `${proveedor.id}:${fechaCapturaBogota(new Date())}`;
    const previa = await db
      .collection(COLECCIONES.ejecuciones)
      .findOne({ _id: runId }, { projection: { _id: 1 } });
    if (previa) {
      console.log(`La captura ${runId} ya existe; no se repite (usa --forzar para repetirla).`);
      return;
    }
  }

  const resultado = await ejecutarCapturaTarifas({
    db,
    proveedor,
    catalogo,
    consultas: crearConsultas({ fechaBase, horizontes }),
    dryRun,
    allowSimulatedWrite: process.env.RATE_SHOPPING_ALLOW_MOCK_WRITE === "1",
  });

  console.log(
    JSON.stringify(
      {
        ejecucion: resultado.ejecucion,
        // En seco se listan todas para revisarlas contra Google/Booking a mano.
        tarifas: dryRun
          ? resultado.tarifas.map((tarifa) => ({
              hotelId: tarifa.hotelId,
              checkIn: tarifa.checkIn,
              roomType: tarifa.roomType,
              totalAmount: tarifa.totalAmount,
              refundable: tarifa.refundable,
              mealPlan: tarifa.mealPlan,
              comparable: tarifa.comparable,
              nonComparableReasons: tarifa.nonComparableReasons,
            }))
          : resultado.tarifas.slice(0, 3),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Error ejecutando captura de tarifas:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });

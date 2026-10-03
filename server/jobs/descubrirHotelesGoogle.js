// Lista los hoteles que Google Hotels devuelve para Popayán y sugiere a qué
// hotel del catálogo corresponde cada uno, para completar `googleHotelsToken`.
// Cada página consultada gasta una búsqueda de SerpApi.
require("dotenv").config({ quiet: true });

const moment = require("moment-timezone");
const { TZ } = require("../functions/fechas");
const { CATALOGO_HOTELES } = require("../rate-shopping/catalogoHoteles");
const {
  CONSULTA_POR_DEFECTO,
  buscarPropiedades,
  crearClienteSerpApi,
  parametrosBusqueda,
  sugerirHotelCatalogo,
} = require("../rate-shopping/providers/serpapi");

function valorArgumento(nombre) {
  const prefijo = `--${nombre}=`;
  const argumento = process.argv.find((item) => item.startsWith(prefijo));
  return argumento ? argumento.slice(prefijo.length) : null;
}

async function main() {
  const fecha = valorArgumento("fecha")
    ? moment.tz(valorArgumento("fecha"), "YYYY-MM-DD", true, TZ)
    : moment().tz(TZ).startOf("day").add(7, "day");
  if (!fecha.isValid()) throw new Error("--fecha debe tener formato YYYY-MM-DD");
  const paginas = Number(valorArgumento("paginas") || 3);
  if (!Number.isInteger(paginas) || paginas < 1 || paginas > 10) {
    throw new Error("--paginas debe ser un entero entre 1 y 10");
  }
  const texto = valorArgumento("q") || process.env.RATE_SHOPPING_SERPAPI_QUERY || CONSULTA_POR_DEFECTO;
  const consulta = {
    checkIn: fecha.format("YYYY-MM-DD"),
    checkOut: fecha.clone().add(1, "day").format("YYYY-MM-DD"),
    adultos: 2,
    habitaciones: 1,
  };

  const { propiedades, paginas: usadas, urlGoogle } = await buscarPropiedades({
    buscar: crearClienteSerpApi(),
    parametros: parametrosBusqueda(consulta, texto),
    maxPaginas: paginas,
  });

  console.log(`"${texto}" · ${consulta.checkIn} · ${usadas} búsqueda(s) · ${propiedades.length} propiedades`);
  if (urlGoogle) console.log(urlGoogle);
  console.log("");

  const sugeridos = new Map();
  for (const propiedad of propiedades) {
    const sugerencia = sugerirHotelCatalogo(propiedad.name, CATALOGO_HOTELES);
    const precio = propiedad.rate_per_night?.extracted_lowest;
    console.log(
      [
        sugerencia ? `→ ${sugerencia.hotelId}` : "  ",
        propiedad.name,
        propiedad.hotel_class || propiedad.extracted_hotel_class || "",
        precio ? `$${Math.round(precio).toLocaleString("es-CO")}` : "sin precio",
        propiedad.free_cancellation ? "cancelación gratis" : "",
      ]
        .filter(Boolean)
        .join(" · ")
    );
    console.log(`     ${propiedad.property_token}`);
    // Por cada hotel del catálogo se queda la propiedad más parecida, no la
    // primera: "Hotel Cristal Plaza" no debe ganarle a "Hotel Popayán Plaza".
    const previa = sugeridos.get(sugerencia?.hotelId);
    if (sugerencia && (!previa || sugerencia.puntaje > previa.puntaje)) {
      sugeridos.set(sugerencia.hotelId, {
        puntaje: sugerencia.puntaje,
        token: propiedad.property_token,
      });
    }
  }

  console.log("\nCatálogo sin coincidencia:");
  for (const hotel of CATALOGO_HOTELES.filter((h) => !sugeridos.has(h.id))) {
    console.log(`  ${hotel.id} (${hotel.nombre})`);
  }
  console.log("\nTokens sugeridos (revisar antes de copiarlos al catálogo):");
  console.log(
    JSON.stringify(
      Object.fromEntries([...sugeridos].map(([hotelId, { token }]) => [hotelId, token])),
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Error descubriendo hoteles en Google Hotels:", error.message);
  process.exitCode = 1;
});

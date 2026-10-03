// Tarifas de competencia desde Google Hotels a través de SerpApi.
// Por cada hotel y fecha se pide el detalle de la propiedad (`property_token`)
// y se toma la tarifa de Booking.com: incluye IVA y trae la política de
// cancelación, así todos los hoteles se comparan con el mismo criterio. El
// precio "más bajo" de Google mezcla fuentes con y sin IVA (Expedia vs Booking).
const SERPAPI_URL = "https://serpapi.com/search.json";
const CONSULTA_POR_DEFECTO = "Hoteles en Popayán, Cauca";
const MAX_BUSQUEDAS_POR_DEFECTO = 60;
const TIMEOUT_MS_POR_DEFECTO = 45000;
const RE_SIN_RESULTADOS = /hasn't returned any results/i;
const RE_BOOKING = /^booking\.com$/i;
const RE_DESAYUNO = /desayuno (incluido|gratis)|incluye desayuno|breakfast included|free breakfast/i;

const PALABRAS_IGNORADAS = new Set([
  "hotel",
  "hostal",
  "boutique",
  "restaurante",
  "popayan",
  "cauca",
  "colombia",
  "y",
  "la",
  "el",
  "los",
  "las",
  "de",
  "del",
]);

function enteroConfigurado(valor, predeterminado, minimo, maximo) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= minimo && numero <= maximo
    ? numero
    : predeterminado;
}

function crearClienteSerpApi(opciones = {}) {
  const apiKey = String(opciones.apiKey ?? process.env.SERPAPI_API_KEY ?? "").trim();
  const fetchImpl = opciones.fetchImpl || globalThis.fetch;
  const timeoutMs = enteroConfigurado(
    opciones.timeoutMs ?? process.env.RATE_SHOPPING_TIMEOUT_MS,
    TIMEOUT_MS_POR_DEFECTO,
    5000,
    120000
  );

  return async function buscar(parametros) {
    if (!apiKey) throw new Error("Falta configurar SERPAPI_API_KEY");
    if (typeof fetchImpl !== "function") throw new Error("Este entorno no dispone de fetch");

    const url = new URL(SERPAPI_URL);
    for (const [clave, valor] of Object.entries({
      engine: "google_hotels",
      gl: "co",
      hl: "es",
      currency: "COP",
      ...parametros,
    })) {
      if (valor !== undefined && valor !== null) url.searchParams.set(clave, String(valor));
    }
    url.searchParams.set("api_key", apiKey);

    // Los mensajes de error nunca incluyen la URL: lleva la API key.
    const respuesta = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    let cuerpo = null;
    try {
      cuerpo = await respuesta.json();
    } catch {
      cuerpo = null;
    }
    if (cuerpo?.error && RE_SIN_RESULTADOS.test(cuerpo.error)) {
      return { ...cuerpo, properties: [] };
    }
    if (!respuesta.ok || cuerpo?.error) {
      throw new Error(
        `SerpApi respondió HTTP ${respuesta.status}: ${cuerpo?.error || "sin detalle"}`
      );
    }
    if (!cuerpo) throw new Error("SerpApi devolvió una respuesta que no es JSON");
    const moneda = cuerpo.search_parameters?.currency;
    if (moneda && moneda !== "COP") {
      throw new Error(`SerpApi devolvió precios en ${moneda}, no en COP`);
    }
    return cuerpo;
  };
}

function parametrosBusqueda(consulta, texto) {
  if (consulta.habitaciones !== 1) {
    throw new Error("Google Hotels solo permite consultar una habitación");
  }
  return {
    q: texto,
    check_in_date: consulta.checkIn,
    check_out_date: consulta.checkOut,
    adults: consulta.adultos,
    children: 0,
  };
}

// Búsqueda de la ciudad, solo para el script de descubrimiento de tokens.
async function buscarPropiedades({ buscar, parametros, maxPaginas }) {
  const propiedades = [];
  const vistos = new Set();
  let urlGoogle = null;
  let paginas = 0;
  let siguiente = null;

  do {
    const respuesta = await buscar(
      siguiente ? { ...parametros, next_page_token: siguiente } : parametros
    );
    paginas += 1;
    urlGoogle = urlGoogle || respuesta.search_metadata?.google_hotels_url || null;
    for (const propiedad of respuesta.properties || []) {
      // Las páginas de Google se solapan: un hotel puede repetirse.
      if (!propiedad?.property_token || vistos.has(propiedad.property_token)) continue;
      vistos.add(propiedad.property_token);
      propiedades.push(propiedad);
    }
    siguiente = respuesta.serpapi_pagination?.next_page_token || null;
  } while (siguiente && paginas < maxPaginas);

  return { propiedades, paginas, urlGoogle };
}

function monto(tarifa) {
  const valor = Number(tarifa?.extracted_lowest);
  return Number.isFinite(valor) && valor > 0 ? Math.round(valor) : null;
}

function montoEstancia(oferta, noches) {
  const total = monto(oferta.total_rate);
  if (total !== null) return total;
  const porNoche = monto(oferta.rate_per_night);
  return porNoche === null ? null : porNoche * noches;
}

// Tarifas de Booking candidatas para la ocupación consultada. Cada habitación
// de `featured_prices` trae sus `rates` con cancelación e inclusiones; si
// Google no da ese detalle se usa la fila resumida de `prices`.
function tarifasBooking(detalle, adultos, noches) {
  const destacada = (detalle.featured_prices || []).find((p) => RE_BOOKING.test(p.source));
  const candidatas = [];

  for (const habitacion of destacada?.rooms || []) {
    const tarifas = habitacion.rates?.length ? habitacion.rates : [habitacion];
    for (const tarifa of tarifas) {
      const huespedes = Number(tarifa.num_guests ?? habitacion.num_guests ?? adultos);
      candidatas.push({
        roomType: habitacion.name || null,
        huespedes,
        total: montoEstancia(tarifa, noches),
        cancelacionGratis: tarifa.free_cancellation === true,
        inclusiones: tarifa.inclusions || [],
      });
    }
  }

  if (candidatas.length === 0) {
    const resumen = (detalle.prices || []).find((p) => RE_BOOKING.test(p.source));
    if (resumen) {
      candidatas.push({
        roomType: null,
        huespedes: Number(resumen.num_guests ?? adultos),
        total: montoEstancia(resumen, noches),
        cancelacionGratis: resumen.free_cancellation === true,
        inclusiones: [],
      });
    }
  }

  // Una triple para 3 huéspedes no es el precio de 2 adultos.
  return candidatas.filter((c) => c.total !== null && c.huespedes === adultos);
}

// La regla de comparabilidad exige cancelación flexible: se prefiere la tarifa
// más barata con cancelación gratis y, si no hay, la más barata a secas.
function cotizacionBooking({ hotel, detalle, consulta, capturedAt }) {
  const candidatas = tarifasBooking(detalle, consulta.adultos, consulta.noches).sort(
    (a, b) => a.total - b.total
  );
  if (candidatas.length === 0) return null;
  const elegida = candidatas.find((c) => c.cancelacionGratis) || candidatas[0];
  const filaPrecio = (detalle.prices || []).find((p) => RE_BOOKING.test(p.source));

  return {
    hotelId: hotel.id,
    source: "serpapi",
    channel: "booking_com",
    sourceUrl: filaPrecio?.link || detalle.search_metadata?.google_hotels_url || null,
    sourcePropertyId: hotel.googleHotelsToken,
    capturedAt,
    checkIn: consulta.checkIn,
    checkOut: consulta.checkOut,
    adults: consulta.adultos,
    rooms: consulta.habitaciones,
    roomType: elegida.roomType,
    refundable: elegida.cancelacionGratis ? true : null,
    mealPlan: elegida.inclusiones.some((texto) => RE_DESAYUNO.test(texto))
      ? "incluido"
      : "desconocido",
    currency: "COP",
    baseAmount: null,
    taxesAmount: null,
    totalAmount: elegida.total,
    // Es el precio final que Booking muestra a quien busca desde EE. UU. (punto
    // de venta de SerpApi): "incluye impuestos y cargos" y ext_price_tax=0 en su
    // enlace. Booking cambia el precio según el país del visitante, así que no es
    // necesariamente lo que paga un huésped colombiano; ver docs/rate-shopping.md.
    taxesIncluded: true,
    publicRate: true,
    memberRate: false,
    available: true,
    simulated: false,
  };
}

function errorConsulta(hotelId, consulta, detalle) {
  return {
    hotelId,
    checkIn: consulta.checkIn,
    checkOut: consulta.checkOut,
    code: detalle.code,
    message: detalle.message,
    sourceUrl: detalle.sourceUrl || null,
  };
}

function palabrasNombre(nombre) {
  return new Set(
    String(nombre || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((palabra) => palabra && !PALABRAS_IGNORADAS.has(palabra))
  );
}

// Solo para el script de descubrimiento: sugiere qué hotel del catálogo es una
// propiedad de Google. El proveedor nunca empareja por nombre, solo por token.
function sugerirHotelCatalogo(nombreGoogle, catalogo) {
  const palabrasGoogle = palabrasNombre(nombreGoogle);
  let mejor = null;

  for (const hotel of catalogo) {
    const palabrasHotel = palabrasNombre(hotel.nombre);
    const comunes = [...palabrasHotel].filter((p) => palabrasGoogle.has(p)).length;
    const union = new Set([...palabrasHotel, ...palabrasGoogle]).size;
    const puntaje = union ? comunes / union : 0;
    if (puntaje >= 0.5 && (!mejor || puntaje > mejor.puntaje)) {
      mejor = { hotelId: hotel.id, puntaje };
    }
  }
  return mejor;
}

function crearProveedorSerpApi(opciones = {}) {
  const buscar = opciones.buscar || crearClienteSerpApi(opciones);
  const texto =
    opciones.consulta || process.env.RATE_SHOPPING_SERPAPI_QUERY || CONSULTA_POR_DEFECTO;
  // Tope por corrida para no agotar la cuota mensual por un error de configuración.
  const maxBusquedas = enteroConfigurado(
    opciones.maxBusquedas ?? process.env.RATE_SHOPPING_SERPAPI_MAX_BUSQUEDAS,
    MAX_BUSQUEDAS_POR_DEFECTO,
    1,
    5000
  );

  return {
    id: "serpapi",
    simulated: false,

    async capturar({ hoteles, consultas, capturedAt }) {
      const cotizaciones = [];
      const errores = [];
      const conToken = hoteles.filter((hotel) => hotel.googleHotelsToken);
      const necesarias = conToken.length * consultas.length;
      let busquedas = 0;

      if (necesarias > maxBusquedas) {
        throw new Error(
          `La captura necesita ${necesarias} búsquedas de SerpApi y el tope por corrida es ` +
            `${maxBusquedas} (RATE_SHOPPING_SERPAPI_MAX_BUSQUEDAS)`
        );
      }

      for (const hotel of hoteles) {
        if (hotel.googleHotelsToken) continue;
        for (const consulta of consultas) {
          errores.push(
            errorConsulta(hotel.id, consulta, {
              code: "sin_token_google",
              message: "El hotel aún no tiene googleHotelsToken en el catálogo.",
            })
          );
        }
      }

      for (const consulta of consultas) {
        for (const hotel of conToken) {
          let detalle;
          try {
            detalle = await buscar({
              ...parametrosBusqueda(consulta, texto),
              property_token: hotel.googleHotelsToken,
            });
            busquedas += 1;
          } catch (error) {
            errores.push(
              errorConsulta(hotel.id, consulta, {
                code: "busqueda_serpapi_fallida",
                message: error.message,
              })
            );
            continue;
          }

          const cotizacion = cotizacionBooking({ hotel, detalle, consulta, capturedAt });
          if (cotizacion) {
            cotizaciones.push(cotizacion);
            continue;
          }
          // Sin precio no prueba que el hotel esté agotado: es falta de cobertura.
          const fuentes = (detalle.prices || []).map((p) => p.source).filter(Boolean);
          errores.push(
            errorConsulta(hotel.id, consulta, {
              code: fuentes.length ? "sin_precio_booking" : "sin_precio_publicado",
              message: fuentes.length
                ? `Booking.com no publica precio para 2 adultos; sí hay: ${fuentes.join(", ")}.`
                : "Google Hotels no publica precios de ninguna fuente para estas fechas.",
              sourceUrl: detalle.search_metadata?.google_hotels_url || null,
            })
          );
        }
      }

      return { cotizaciones, errores, usage: { busquedas } };
    },
  };
}

module.exports = {
  CONSULTA_POR_DEFECTO,
  buscarPropiedades,
  cotizacionBooking,
  crearClienteSerpApi,
  crearProveedorSerpApi,
  parametrosBusqueda,
  sugerirHotelCatalogo,
};

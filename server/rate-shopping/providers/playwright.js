const { chromium } = require("playwright");

const HOTEL_LA_PLAZUELA = "hotel-la-plazuela";
const IDS_PILOTO_PLAYWRIGHT = Object.freeze([
  HOTEL_LA_PLAZUELA,
  "hotel-camino-real-popayan",
  "hotel-la-herreria-colonial",
]);

const FUENTE_LA_PLAZUELA =
  "https://hotellaplazuela.com.co/buscar-disponibilidad/";

const FUENTES_SIN_ADAPTADOR = Object.freeze({
  "hotel-camino-real-popayan": {
    code: "fuente_sin_precio_por_fecha",
    message:
      "El sitio oficial no publica una tarifa verificable para las fechas consultadas.",
    sourceUrl: "https://hotelcaminoreal.com.co/accommodation/tarifas/",
  },
  "hotel-la-herreria-colonial": {
    code: "fuente_oficial_no_accesible",
    message:
      "El sitio oficial no ofrece actualmente una fuente pública accesible de tarifas.",
    sourceUrl: "https://laherreriapopayan.com/",
  },
});

function parsearMontoCop(texto) {
  const limpio = String(texto || "")
    .replace(/[^\d.,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const monto = Number(limpio);
  if (!Number.isFinite(monto) || monto < 0) {
    throw new Error(`No se pudo interpretar el monto COP: ${texto}`);
  }
  return Math.round(monto);
}

function fechaDmy(fechaYmd) {
  const [anio, mes, dia] = String(fechaYmd).split("-");
  return `${dia}/${mes}/${anio}`;
}

function elegirOfertaMinima(ofertas) {
  const validas = ofertas
    .map((oferta) => ({
      ...oferta,
      totalAmount: parsearMontoCop(oferta.priceText),
    }))
    .filter((oferta) => oferta.roomType && oferta.totalAmount > 0)
    .sort((a, b) => a.totalAmount - b.totalAmount);

  if (validas.length === 0) {
    throw new Error("La página respondió con disponibilidad, pero sin precios válidos");
  }
  return validas[0];
}

function esRespuestaSinDisponibilidad(resultado) {
  if (resultado?.success !== false) return false;
  const mensaje = String(resultado.msg || "").toLocaleLowerCase("es");
  return (
    mensaje.includes("no pudimos encontrar alojamiento") ||
    mensaje.includes("no hay alojamiento disponible")
  );
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

function cotizacionBase({ consulta, capturedAt, available }) {
  return {
    hotelId: HOTEL_LA_PLAZUELA,
    source: "playwright",
    channel: "web_directa_hotel",
    sourceUrl: FUENTE_LA_PLAZUELA,
    capturedAt,
    checkIn: consulta.checkIn,
    checkOut: consulta.checkOut,
    adults: consulta.adultos,
    rooms: consulta.habitaciones,
    refundable: null,
    mealPlan: "desconocido",
    currency: "COP",
    taxesIncluded: null,
    publicRate: true,
    memberRate: false,
    available,
    simulated: false,
  };
}

async function capturarLaPlazuela({ page, consulta, capturedAt, timeoutMs }) {
  await page.goto(FUENTE_LA_PLAZUELA, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  await page.waitForFunction(
    () => typeof window.hb_booking_form_data === "object",
    null,
    { timeout: timeoutMs }
  );

  await page.evaluate(
    ({ checkIn, checkOut, adults, rooms }) => {
      const valores = {
        "#hb-form-1-check-in-date": checkIn.display,
        "#hb-form-1-check-out-date": checkOut.display,
        ".hb-check-in-hidden": checkIn.value,
        ".hb-check-out-hidden": checkOut.value,
        "#hb-form-1-accom-number": String(rooms),
        "#hb-form-1-adults": String(adults),
        "#hb-form-1-children": "0",
      };

      for (const [selector, value] of Object.entries(valores)) {
        const elemento = document.querySelector(selector);
        if (!elemento) throw new Error(`No se encontró el control ${selector}`);
        elemento.value = value;
        elemento.dispatchEvent(new Event("input", { bubbles: true }));
        elemento.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    {
      checkIn: {
        value: consulta.checkIn,
        display: fechaDmy(consulta.checkIn),
      },
      checkOut: {
        value: consulta.checkOut,
        display: fechaDmy(consulta.checkOut),
      },
      adults: consulta.adultos,
      rooms: consulta.habitaciones,
    }
  );

  const respuestaPromise = page.waitForResponse(
    (respuesta) =>
      respuesta.url().includes("/wp-admin/admin-ajax.php") &&
      respuesta.request().method() === "POST" &&
      String(respuesta.request().postData() || "").includes(
        "action=hb_get_available_accom"
      ),
    { timeout: timeoutMs }
  );

  await page.locator("#hb-form-1-hb-search-form-submit").click();
  const respuesta = await respuestaPromise;
  if (!respuesta.ok()) {
    throw new Error(`El motor de reservas respondió HTTP ${respuesta.status()}`);
  }

  const resultado = await respuesta.json();
  if (esRespuestaSinDisponibilidad(resultado)) {
    return {
      ...cotizacionBase({ consulta, capturedAt, available: false }),
      roomType: null,
      baseAmount: null,
      taxesAmount: null,
      totalAmount: null,
    };
  }
  if (resultado?.success === false) {
    throw new Error(
      `El motor de reservas rechazó la consulta: ${resultado.msg || "sin detalle"}`
    );
  }
  if (resultado?.success !== true || !resultado.mark_up) {
    throw new Error("Respuesta inesperada del motor de reservas");
  }

  await page.waitForSelector(".hb-accom .hb-accom-price", {
    state: "attached",
    timeout: timeoutMs,
  });
  const ofertas = await page.locator(".hb-accom").evaluateAll((tarjetas) =>
    tarjetas.map((tarjeta) => ({
      propertyRoomId: tarjeta.getAttribute("data-accom-id"),
      roomType:
        tarjeta.querySelector(".hb-accom-title")?.textContent?.trim() || null,
      priceText:
        tarjeta.querySelector(".hb-accom-price")?.textContent?.trim() || null,
    }))
  );
  const oferta = elegirOfertaMinima(ofertas);

  return {
    ...cotizacionBase({ consulta, capturedAt, available: true }),
    roomType: oferta.roomType,
    sourcePropertyId: oferta.propertyRoomId,
    baseAmount: null,
    taxesAmount: null,
    totalAmount: oferta.totalAmount,
  };
}

function enteroNoNegativo(valor, predeterminado) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? Math.round(numero) : predeterminado;
}

function crearProveedorPlaywright(opciones = {}) {
  const timeoutMs = enteroNoNegativo(
    opciones.timeoutMs ?? process.env.RATE_SHOPPING_TIMEOUT_MS,
    45000
  );
  const delayMs = enteroNoNegativo(
    opciones.delayMs ?? process.env.RATE_SHOPPING_REQUEST_DELAY_MS,
    1000
  );
  const channel = String(
    opciones.channel ?? process.env.RATE_SHOPPING_BROWSER_CHANNEL ?? ""
  ).trim();
  const headless =
    opciones.headless ?? process.env.RATE_SHOPPING_HEADLESS !== "0";
  const lanzarBrowser =
    opciones.lanzarBrowser ||
    (() => chromium.launch({ headless, ...(channel ? { channel } : {}) }));
  const esperar =
    opciones.esperar || ((milisegundos) => new Promise((r) => setTimeout(r, milisegundos)));

  return {
    id: "playwright",
    simulated: false,

    async capturar({ hoteles, consultas, capturedAt }) {
      const cotizaciones = [];
      const errores = [];
      const hotelPropio = hoteles.find((hotel) => hotel.id === HOTEL_LA_PLAZUELA);

      for (const hotel of hoteles) {
        const detalle = FUENTES_SIN_ADAPTADOR[hotel.id];
        if (!detalle && hotel.id !== HOTEL_LA_PLAZUELA) {
          for (const consulta of consultas) {
            errores.push(
              errorConsulta(hotel.id, consulta, {
                code: "hotel_sin_adaptador",
                message: "El proveedor Playwright aún no tiene adaptador para este hotel.",
              })
            );
          }
        } else if (detalle) {
          for (const consulta of consultas) {
            errores.push(errorConsulta(hotel.id, consulta, detalle));
          }
        }
      }

      if (!hotelPropio) return { cotizaciones, errores };

      let browser;
      try {
        browser = await lanzarBrowser();
        const page = await browser.newPage({ locale: "es-CO" });

        for (let indice = 0; indice < consultas.length; indice += 1) {
          const consulta = consultas[indice];
          try {
            cotizaciones.push(
              await capturarLaPlazuela({
                page,
                consulta,
                capturedAt,
                timeoutMs,
              })
            );
          } catch (error) {
            errores.push(
              errorConsulta(HOTEL_LA_PLAZUELA, consulta, {
                code: "captura_playwright_fallida",
                message: error.message,
                sourceUrl: FUENTE_LA_PLAZUELA,
              })
            );
          }
          if (delayMs > 0 && indice < consultas.length - 1) await esperar(delayMs);
        }
      } catch (error) {
        for (const consulta of consultas) {
          if (
            !cotizaciones.some(
              (item) => item.hotelId === HOTEL_LA_PLAZUELA && item.checkIn === consulta.checkIn
            ) &&
            !errores.some(
              (item) => item.hotelId === HOTEL_LA_PLAZUELA && item.checkIn === consulta.checkIn
            )
          ) {
            errores.push(
              errorConsulta(HOTEL_LA_PLAZUELA, consulta, {
                code: "navegador_no_disponible",
                message: error.message,
                sourceUrl: FUENTE_LA_PLAZUELA,
              })
            );
          }
        }
      } finally {
        if (browser) await browser.close();
      }

      return { cotizaciones, errores };
    },
  };
}

module.exports = {
  FUENTE_LA_PLAZUELA,
  IDS_PILOTO_PLAYWRIGHT,
  capturarLaPlazuela,
  crearProveedorPlaywright,
  elegirOfertaMinima,
  esRespuestaSinDisponibilidad,
  fechaDmy,
  parsearMontoCop,
};

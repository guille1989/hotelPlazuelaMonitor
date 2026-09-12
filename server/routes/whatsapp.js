const express = require("express");
const {
  enviarMensajeTexto,
  numerosAutorizados,
  verificarFirmaWebhook,
} = require("../functions/whatsapp");
const { responderPreguntaSocio } = require("../agents/whatsappSocios");

function extraerMensajes(cuerpo) {
  return (cuerpo?.entry || []).flatMap((entrada) =>
    (entrada.changes || []).flatMap((cambio) => cambio.value?.messages || [])
  );
}

async function procesarMensajeEntrante(mensaje, dependencias = {}) {
  const permitidos = dependencias.numerosAutorizados || numerosAutorizados;
  const responder = dependencias.responderPregunta || responderPreguntaSocio;
  const enviar = dependencias.enviarMensaje || enviarMensajeTexto;
  const logger = dependencias.logger || console;
  const desde = mensaje?.from;

  if (!desde || !permitidos().includes(desde)) {
    if (desde) logger.warn(`WhatsApp: mensaje de número no autorizado (${desde})`);
    return { procesado: false, motivo: "no_autorizado" };
  }

  let respuesta;
  if (mensaje.type !== "text" || !mensaje.text?.body?.trim()) {
    respuesta =
      "Por ahora solo puedo atender mensajes de texto. Escríbeme qué quieres consultar sobre la ocupación del hotel.";
  } else {
    try {
      respuesta = await responder(mensaje.text.body);
    } catch (error) {
      logger.error("Error consultando a Claude:", error.message);
      respuesta =
        "No pude consultar los datos del hotel en este momento. Inténtalo de nuevo en unos minutos.";
    }
  }

  await enviar(desde, respuesta);
  return { procesado: true };
}

function crearWhatsappRouter(dependencias = {}) {
  const router = express.Router();
  const logger = dependencias.logger || console;

  // Handshake de verificación que Meta hace al configurar el webhook.
  router.get("/", (req, res) => {
    const modo = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const desafio = req.query["hub.challenge"];
    const tokenEsperado =
      dependencias.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN;

    if (modo === "subscribe" && tokenEsperado && token === tokenEsperado) {
      return res.status(200).send(desafio);
    }
    return res.sendStatus(403);
  });

  // Notificaciones entrantes. También llegan estados de entrega sin `messages`.
  router.post("/", async (req, res) => {
    const appSecret = dependencias.appSecret || process.env.WHATSAPP_APP_SECRET;
    const firma = req.get("x-hub-signature-256");
    const verificarFirma = dependencias.verificarFirma || verificarFirmaWebhook;

    if (!appSecret) {
      logger.error("WhatsApp: falta configurar WHATSAPP_APP_SECRET");
      return res.sendStatus(503);
    }
    if (!verificarFirma(req.rawBody, firma, appSecret)) {
      logger.warn("WhatsApp: webhook rechazado por firma inválida");
      return res.sendStatus(401);
    }

    const mensajes = extraerMensajes(req.body);
    if (mensajes.length === 0) return res.sendStatus(200);

    // Esperamos a enviar antes del 200 para que Cloud Run mantenga CPU asignada.
    // Antes de escalar el tráfico, este trabajo debe pasar a una cola duradera.
    const resultados = await Promise.allSettled(
      mensajes.map((mensaje) =>
        procesarMensajeEntrante(mensaje, { ...dependencias, logger })
      )
    );
    for (const resultado of resultados) {
      if (resultado.status === "rejected") {
        logger.error("Error respondiendo por WhatsApp:", resultado.reason?.message);
      }
    }
    return res.sendStatus(200);
  });

  return router;
}

const router = crearWhatsappRouter();

module.exports = router;
module.exports.crearWhatsappRouter = crearWhatsappRouter;
module.exports.extraerMensajes = extraerMensajes;
module.exports.procesarMensajeEntrante = procesarMensajeEntrante;

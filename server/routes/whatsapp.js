const express = require("express");
const router = express.Router();
const { enviarMensajeTexto, numerosAutorizados } = require("../functions/whatsapp");

// GET: handshake de verificación que Meta pide una sola vez al configurar el webhook.
router.get("/", (req, res) => {
  const modo = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const desafio = req.query["hub.challenge"];

  if (
    modo === "subscribe" &&
    process.env.WHATSAPP_VERIFY_TOKEN &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return res.status(200).send(desafio);
  }
  res.sendStatus(403);
});

// POST: notificaciones entrantes (mensajes nuevos, y también confirmaciones de
// entrega/lectura que no traen `messages`).
router.post("/", async (req, res) => {
  // Meta espera un 200 rápido; se responde antes de procesar el mensaje.
  res.sendStatus(200);

  const cambio = req.body?.entry?.[0]?.changes?.[0]?.value;
  const mensaje = cambio?.messages?.[0];
  if (!mensaje) return;

  const desde = mensaje.from;
  const permitidos = numerosAutorizados();
  if (!permitidos.includes(desde)) {
    console.warn(`WhatsApp: mensaje de número no autorizado (${desde})`);
    return;
  }

  const texto = mensaje.text?.body || "";
  try {
    // TODO: reemplazar el eco por el agente (Claude + herramientas de datos del hotel).
    await enviarMensajeTexto(desde, `Recibí tu mensaje: "${texto}"`);
  } catch (error) {
    console.error("Error respondiendo por WhatsApp:", error.message);
  }
});

module.exports = router;

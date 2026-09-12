const crypto = require("node:crypto");

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v26.0";

function urlMensajes() {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
}

// Envía un mensaje de texto simple por la Cloud API de WhatsApp.
async function enviarMensajeTexto(destino, texto) {
  const respuesta = await fetch(urlMensajes(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: destino,
      type: "text",
      text: { body: texto },
    }),
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`WhatsApp API ${respuesta.status}: ${detalle}`);
  }
  return respuesta.json();
}

// Números (formato internacional sin "+", ej. "573001234567") con permiso de
// hablar con el agente. Vacío = nadie autorizado (falla cerrado, no abierto).
function numerosAutorizados() {
  return (process.env.WHATSAPP_NUMEROS_AUTORIZADOS || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

function verificarFirmaWebhook(cuerpoCrudo, firma, appSecret) {
  if (!Buffer.isBuffer(cuerpoCrudo) || !firma || !appSecret) return false;

  const esperada = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(cuerpoCrudo)
    .digest("hex")}`;
  const recibida = Buffer.from(String(firma));
  const calculada = Buffer.from(esperada);
  return (
    recibida.length === calculada.length &&
    crypto.timingSafeEqual(recibida, calculada)
  );
}

module.exports = {
  GRAPH_VERSION,
  enviarMensajeTexto,
  numerosAutorizados,
  verificarFirmaWebhook,
};

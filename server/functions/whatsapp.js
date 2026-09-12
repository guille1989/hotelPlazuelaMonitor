const GRAPH_VERSION = "v20.0";

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

module.exports = { enviarMensajeTexto, numerosAutorizados };

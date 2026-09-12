const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODELO_POR_DEFECTO = "claude-sonnet-5";

class ClaudeApiError extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.name = "ClaudeApiError";
    this.status = status;
  }
}

async function crearMensajeClaude(parametros, opciones = {}) {
  const apiKey = opciones.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ClaudeApiError("Falta configurar ANTHROPIC_API_KEY");
  }

  const fetchImpl = opciones.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new ClaudeApiError("Este entorno no dispone de fetch");
  }

  const timeoutMs = opciones.timeoutMs || 18000;
  const signal = opciones.signal || AbortSignal.timeout(timeoutMs);
  const respuesta = await fetchImpl(opciones.url || ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model:
        opciones.model || process.env.ANTHROPIC_MODEL || MODELO_POR_DEFECTO,
      max_tokens: 600,
      ...parametros,
    }),
    signal,
  });

  if (!respuesta.ok) {
    const detalle = (await respuesta.text()).slice(0, 1000);
    throw new ClaudeApiError(
      `Claude API ${respuesta.status}: ${detalle}`,
      respuesta.status
    );
  }

  const mensaje = await respuesta.json();
  if (!Array.isArray(mensaje.content)) {
    throw new ClaudeApiError("Claude devolvió una respuesta sin contenido");
  }
  return mensaje;
}

module.exports = {
  ANTHROPIC_URL,
  ANTHROPIC_VERSION,
  MODELO_POR_DEFECTO,
  ClaudeApiError,
  crearMensajeClaude,
};

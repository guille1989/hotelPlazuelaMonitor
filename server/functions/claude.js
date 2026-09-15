const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODELO_POR_DEFECTO = "claude-sonnet-5";
const MAX_TOKENS_POR_DEFECTO = 3000;
const TIMEOUT_MS_POR_DEFECTO = 45000;

class ClaudeApiError extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.name = "ClaudeApiError";
    this.status = status;
  }
}

function enteroConfigurado(valor, predeterminado, minimo, maximo) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= minimo && numero <= maximo
    ? numero
    : predeterminado;
}

function resolverMaxTokens(opciones = {}) {
  return enteroConfigurado(
    opciones.maxTokens ?? process.env.ANTHROPIC_MAX_TOKENS,
    MAX_TOKENS_POR_DEFECTO,
    256,
    4096
  );
}

function resolverTimeoutMs(opciones = {}) {
  return enteroConfigurado(
    opciones.timeoutMs ?? process.env.ANTHROPIC_TIMEOUT_MS,
    TIMEOUT_MS_POR_DEFECTO,
    5000,
    120000
  );
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

  const timeoutMs = resolverTimeoutMs(opciones);
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
      // Los tokens de razonamiento también cuentan. Con 600, algunas preguntas
      // comerciales agotaban todo el presupuesto antes de producir texto.
      max_tokens: resolverMaxTokens(opciones),
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
  MAX_TOKENS_POR_DEFECTO,
  TIMEOUT_MS_POR_DEFECTO,
  ClaudeApiError,
  resolverMaxTokens,
  resolverTimeoutMs,
  crearMensajeClaude,
};

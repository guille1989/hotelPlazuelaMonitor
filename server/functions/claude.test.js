const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ANTHROPIC_URL,
  ANTHROPIC_VERSION,
  crearMensajeClaude,
} = require("./claude");

test("crearMensajeClaude llama Messages API sin filtrar la clave al cuerpo", async () => {
  let llamada;
  const fetchImpl = async (url, opciones) => {
    llamada = { url, opciones };
    return {
      ok: true,
      async json() {
        return {
          stop_reason: "end_turn",
          content: [{ type: "text", text: "Respuesta" }],
        };
      },
    };
  };

  const respuesta = await crearMensajeClaude(
    { messages: [{ role: "user", content: "Hola" }] },
    {
      apiKey: "clave-de-prueba",
      model: "modelo-de-prueba",
      fetchImpl,
      signal: new AbortController().signal,
    }
  );

  assert.equal(llamada.url, ANTHROPIC_URL);
  assert.equal(llamada.opciones.headers["x-api-key"], "clave-de-prueba");
  assert.equal(
    llamada.opciones.headers["anthropic-version"],
    ANTHROPIC_VERSION
  );
  const cuerpo = JSON.parse(llamada.opciones.body);
  assert.equal(cuerpo.model, "modelo-de-prueba");
  assert.equal(cuerpo.messages[0].content, "Hola");
  assert.equal(llamada.opciones.body.includes("clave-de-prueba"), false);
  assert.equal(respuesta.content[0].text, "Respuesta");
});

test("crearMensajeClaude informa los errores HTTP", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 401,
    async text() {
      return "unauthorized";
    },
  });

  await assert.rejects(
    crearMensajeClaude(
      { messages: [{ role: "user", content: "Hola" }] },
      {
        apiKey: "incorrecta",
        fetchImpl,
        signal: new AbortController().signal,
      }
    ),
    /Claude API 401/
  );
});

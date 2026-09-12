const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const {
  GRAPH_VERSION,
  verificarFirmaWebhook,
} = require("./whatsapp");
const {
  extraerMensajes,
  procesarMensajeEntrante,
} = require("../routes/whatsapp");

test("usa una versión vigente y configurable de Graph API", () => {
  assert.match(GRAPH_VERSION, /^v\d+\.\d+$/);
  assert.notEqual(GRAPH_VERSION, "v20.0");
});

test("verificarFirmaWebhook acepta solo el HMAC correcto", () => {
  const cuerpo = Buffer.from('{"object":"whatsapp_business_account"}');
  const secreto = "secreto-de-prueba";
  const firma = `sha256=${crypto
    .createHmac("sha256", secreto)
    .update(cuerpo)
    .digest("hex")}`;

  assert.equal(verificarFirmaWebhook(cuerpo, firma, secreto), true);
  assert.equal(verificarFirmaWebhook(cuerpo, `${firma}0`, secreto), false);
  assert.equal(verificarFirmaWebhook(cuerpo, "sha256=incorrecta", secreto), false);
});

test("extraerMensajes recorre todas las entradas y cambios", () => {
  const primero = { id: "wamid.1" };
  const segundo = { id: "wamid.2" };
  const mensajes = extraerMensajes({
    entry: [
      { changes: [{ value: { messages: [primero] } }] },
      { changes: [{ value: {} }, { value: { messages: [segundo] } }] },
    ],
  });
  assert.deepEqual(mensajes, [primero, segundo]);
});

test("procesarMensajeEntrante pasa el texto a Claude y envía su respuesta", async () => {
  const envios = [];
  const resultado = await procesarMensajeEntrante(
    {
      from: "573001234567",
      type: "text",
      text: { body: "¿Cómo va octubre?" },
    },
    {
      numerosAutorizados: () => ["573001234567"],
      responderPregunta: async (texto) => `Claude recibió: ${texto}`,
      enviarMensaje: async (destino, texto) => envios.push({ destino, texto }),
    }
  );

  assert.deepEqual(resultado, { procesado: true });
  assert.deepEqual(envios, [
    {
      destino: "573001234567",
      texto: "Claude recibió: ¿Cómo va octubre?",
    },
  ]);
});

test("procesarMensajeEntrante ignora números no autorizados", async () => {
  let llamado = false;
  const resultado = await procesarMensajeEntrante(
    { from: "573009999999", type: "text", text: { body: "Hola" } },
    {
      numerosAutorizados: () => ["573001234567"],
      responderPregunta: async () => {
        llamado = true;
      },
      enviarMensaje: async () => {
        llamado = true;
      },
      logger: { warn() {}, error() {} },
    }
  );

  assert.deepEqual(resultado, {
    procesado: false,
    motivo: "no_autorizado",
  });
  assert.equal(llamado, false);
});

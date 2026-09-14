const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const {
  GRAPH_VERSION,
  enviarMensajePlantilla,
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

test("enviarMensajePlantilla construye el payload esperado por Meta", async (t) => {
  const fetchOriginal = global.fetch;
  let solicitud;
  global.fetch = async (url, opciones) => {
    solicitud = { url, opciones };
    return {
      ok: true,
      async json() {
        return { messages: [{ id: "wamid.prueba" }] };
      },
    };
  };
  t.after(() => {
    global.fetch = fetchOriginal;
  });

  await enviarMensajePlantilla(
    "573001234567",
    "resumen_ocupacion_diaria_po",
    ["14/09/2026", "18/29"],
    "es_CO"
  );

  const cuerpo = JSON.parse(solicitud.opciones.body);
  assert.equal(cuerpo.type, "template");
  assert.equal(cuerpo.template.name, "resumen_ocupacion_diaria_po");
  assert.equal(cuerpo.template.language.code, "es_CO");
  assert.deepEqual(cuerpo.template.components[0].parameters, [
    { type: "text", text: "14/09/2026" },
    { type: "text", text: "18/29" },
  ]);
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

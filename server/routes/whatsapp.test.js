const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const { crearWhatsappRouter } = require("./whatsapp");

async function servidorDePrueba(dependencias) {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buffer) => {
        req.rawBody = Buffer.from(buffer);
      },
    })
  );
  app.use("/webhooks/whatsapp", crearWhatsappRouter(dependencias));

  const servidor = await new Promise((resolve) => {
    const instancia = app.listen(0, "127.0.0.1", () => resolve(instancia));
  });
  const direccion = servidor.address();
  return {
    url: `http://127.0.0.1:${direccion.port}/webhooks/whatsapp`,
    cerrar: () => new Promise((resolve) => servidor.close(resolve)),
  };
}

test("el webhook verifica el handshake y procesa un POST firmado", async (t) => {
  const appSecret = "app-secret-de-prueba";
  const envios = [];
  const servidor = await servidorDePrueba({
    appSecret,
    verifyToken: "verify-token-de-prueba",
    numerosAutorizados: () => ["573001234567"],
    responderPregunta: async () => "Respuesta consultada en Mongo",
    enviarMensaje: async (destino, texto) => envios.push({ destino, texto }),
    logger: { warn() {}, error() {} },
  });
  t.after(servidor.cerrar);

  const handshake = await fetch(
    `${servidor.url}?hub.mode=subscribe&hub.verify_token=verify-token-de-prueba&hub.challenge=12345`
  );
  assert.equal(handshake.status, 200);
  assert.equal(await handshake.text(), "12345");

  const cuerpo = JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: "wamid.1",
                  from: "573001234567",
                  type: "text",
                  text: { body: "¿Cómo va octubre?" },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const firma = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(cuerpo)
    .digest("hex")}`;
  const respuesta = await fetch(servidor.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": firma,
    },
    body: cuerpo,
  });

  assert.equal(respuesta.status, 200);
  assert.deepEqual(envios, [
    {
      destino: "573001234567",
      texto: "Respuesta consultada en Mongo",
    },
  ]);
});

test("el webhook rechaza un POST con firma inválida", async (t) => {
  const servidor = await servidorDePrueba({
    appSecret: "app-secret-de-prueba",
    logger: { warn() {}, error() {} },
  });
  t.after(servidor.cerrar);

  const respuesta = await fetch(servidor.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": "sha256=incorrecta",
    },
    body: JSON.stringify({ entry: [] }),
  });
  assert.equal(respuesta.status, 401);
});

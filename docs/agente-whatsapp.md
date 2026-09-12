# Agente de WhatsApp para socios

## Alcance actual

La primera versión responde preguntas de texto sobre ocupación mensual, ingresos de
alojamiento, tarifa media, RevPAR, cancelaciones, arribos y canales. Las consultas son
de solo lectura y Claude recibe únicamente métricas agregadas, nunca documentos de
reservas ni nombres de huéspedes.

Ejemplo:

> ¿Cómo va la ocupación de octubre?

## Flujo

1. Meta entrega el mensaje a `POST /webhooks/whatsapp`.
2. El backend comprueba `X-Hub-Signature-256` y la lista de números autorizados.
3. Claude interpreta la pregunta y solicita `consultar_ocupacion` con un mes `YYYY-MM`.
4. La herramienta obtiene una conexión compartida mediante `getDb()` y consulta MongoDB.
5. El backend entrega a Claude un resumen agregado y Claude redacta la respuesta.
6. El backend envía el texto mediante WhatsApp Cloud API.

Claude no conoce `MONGO_URI`, no ejecuta consultas Mongo arbitrarias y no puede escribir
en la base de datos.

## Configuración

Copiar `server/.env.example` a `server/.env` y completar:

- `MONGO_URI`: URI de MongoDB Atlas.
- `WHATSAPP_ACCESS_TOKEN`: token de acceso de WhatsApp Cloud API.
- `WHATSAPP_PHONE_NUMBER_ID`: identificador del número emisor.
- `WHATSAPP_APP_SECRET`: secreto de la aplicación usado para validar cada POST.
- `WHATSAPP_VERIFY_TOKEN`: token elegido para el handshake del webhook.
- `WHATSAPP_NUMEROS_AUTORIZADOS`: teléfonos E.164 sin `+`, separados por coma.
- `ANTHROPIC_API_KEY`: clave creada en Claude Console.
- `ANTHROPIC_MODEL`: opcional; por defecto `claude-sonnet-5`.

En producción estos valores deben configurarse mediante Secret Manager, no incluirse
en la imagen ni en Git.

## Ejecución local

```powershell
cd server
npm test
npm start
```

No hay llamadas reales a Claude, Meta o Mongo durante los tests.

## Antes de producción

- Mover el procesamiento del mensaje a una cola duradera para responder rápido a Meta.
- Registrar `message.id` para impedir respuestas duplicadas.
- Retirar y rotar la credencial Mongo que aún existe como fallback en `server/db.js`.
- Añadir memoria de conversación si se quieren admitir preguntas como «¿y noviembre?».

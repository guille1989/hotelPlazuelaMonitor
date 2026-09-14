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
- `WHATSAPP_NUMEROS_NOTIFICACIONES`: socios que aceptaron recibir mensajes
  automáticos; si se omite, se usa la lista de números autorizados.
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

## Resumen y alertas automáticas

El job `jobs/notificacionesOcupacion.js` reutiliza `ocupacionPorDia`, la misma fuente
de datos del dashboard y de los endpoints de ocupación. No usa Claude. Para el día
actual calcula:

- ocupación proyectada: reservas no canceladas;
- habitaciones en casa: estancias con check-in o walk-in;
- llegadas de hoy: habitaciones cuya llegada está programada para hoy, separadas
  entre check-in realizado y pendiente;
- ADR: ingreso de alojamiento / habitaciones con tarifa;
- RevPAR: ingreso de alojamiento / 29 habitaciones disponibles;
- meta: por defecto 75 %, redondeada hacia arriba a 22 habitaciones.

Los valores predeterminados son:

```dotenv
WHATSAPP_OBJETIVO_OCUPACION=75
WHATSAPP_HORA_RESUMEN=07:00
WHATSAPP_HORAS_ALERTA=11:00,15:00,18:00
WHATSAPP_HORA_ALERTA_LLEGADAS=18:00
WHATSAPP_PLANTILLAS_IDIOMA=es_CO
WHATSAPP_PLANTILLA_RESUMEN=resumen_ocupacion_diaria_po
WHATSAPP_PLANTILLA_RESUMEN_IDIOMA=es_CO
WHATSAPP_PLANTILLA_ALERTA=alerta_ocupacion_baja
WHATSAPP_PLANTILLA_ALERTA_IDIOMA=es_CO
WHATSAPP_PLANTILLA_OBJETIVO=objetivo_ocupacion_alcanzado_po
WHATSAPP_PLANTILLA_OBJETIVO_IDIOMA=es_CO
WHATSAPP_PLANTILLA_LLEGADAS=alerta_llegadas_pendientes_po
WHATSAPP_PLANTILLA_LLEGADAS_IDIOMA=es_CO
```

Todos los horarios usan `America/Bogota`. Cada envío se registra en la colección
`notificaciones_whatsapp` con una clave por fecha, tipo y destinatario. Esto evita
repeticiones después de un reinicio. Si el proceso estuvo detenido, solo envía el
corte de alerta más reciente y no acumula todos los anteriores.

### Plantillas que se deben aprobar en Meta

Crear las cuatro plantillas con encabezado de texto y sin botones, usando exactamente
el idioma configurado. El orden de las variables debe conservarse. Si Meta indica
que la categoría no coincide, aceptar la categoría recomendada (normalmente
**Marketing** para estos reportes internos); la categoría no cambia el payload del
backend. Usar como pie fijo `Actualización automática de InnoApp`.

`resumen_ocupacion_diaria_po`:

Encabezado: `Hotel La Plazuela`

```text
📊 *Resumen diario · {{1}}*

*Ocupación*
• Proyectada: *{{2}}* ({{3}})
• En casa: *{{4}} habitaciones*

*Llegadas*
• Programadas: {{5}}
• Check-ins realizados: {{6}}
• Pendientes: *{{7}}*

*Indicadores*
• ADR: *{{8}}*
• RevPAR: *{{9}}*

🎯 Meta: *{{10}}*
Estado: *{{11}}*

Información para seguimiento operativo.
```

`alerta_ocupacion_baja`:

Encabezado: `Alerta de ocupación`

```text
⚠️ *Corte de ocupación · {{1}}*
Fecha: {{2}}

• Proyectada: *{{3}}* ({{4}})
• En casa: {{5}} habitaciones
• ADR: *{{6}}*
• RevPAR: *{{7}}*

🎯 Meta: {{8}}
Faltan *{{9}} habitaciones*.

Revisa las acciones comerciales del día.
```

`objetivo_ocupacion_alcanzado_po`:

Encabezado: `Meta alcanzada`

```text
🎉 *¡Objetivo alcanzado!*
Fecha: {{1}}

• Ocupación proyectada: *{{2}}* ({{3}})
• Habitaciones en casa: {{4}}
• ADR: *{{5}}*
• RevPAR: *{{6}}*
• Meta: {{7}}

Excelente trabajo, equipo.
```

`alerta_llegadas_pendientes_po`:

Encabezado: `Llegadas pendientes`

```text
🛎️ *Seguimiento de llegadas · {{1}}*
Fecha: {{2}}

• Programadas: {{3}}
• Check-ins realizados: {{4}}
• Pendientes: *{{5}}*
• Habitaciones en casa: {{6}}

Por favor, revisa las llegadas pendientes.
```

Los destinatarios deben haber aceptado recibir estas notificaciones. Para probar el
cálculo y ver el payload sin enviar ni registrar mensajes:

```bash
cd /home/bitnami/app_hotel/hotelPlazuelaMonitor/server
npm run notificaciones:dry-run
```

Cuando las plantillas estén aprobadas, ejecutar el job cada diez minutos desde cron.
Antes, confirmar las rutas con `command -v node` y `command -v flock`. En la imagen
actual de Lightsail las rutas esperadas son:

```cron
*/10 * * * * cd /home/bitnami/app_hotel/hotelPlazuelaMonitor/server && /usr/bin/flock -n /tmp/hotel-notificaciones.lock /opt/bitnami/node/bin/node jobs/notificacionesOcupacion.js >> /home/bitnami/.pm2/logs/notificaciones-ocupacion.log 2>&1
```

El cron solo despierta el job; el código decide si corresponde enviar el resumen,
una alerta o el aviso de objetivo.

## Antes de producción

- Mover el procesamiento del mensaje a una cola duradera para responder rápido a Meta.
- Registrar `message.id` para impedir respuestas duplicadas.
- Retirar y rotar la credencial Mongo que aún existe como fallback en `server/db.js`.
- Añadir memoria de conversación si se quieren admitir preguntas como «¿y noviembre?».

# Copiloto de tarifas

Para cada uno de los próximos 60 días recomienda **subir, mantener o bajar** la
tarifa pública (Booking / directa), cuánto y por qué. No cambia precios: alguien
los aplica a mano en la extranet de Booking. Los convenios corporativos no se tocan.

## Piezas

| Pieza | Qué hace |
|---|---|
| `functions/calendarioColombia.js` | Festivos (Ley Emiliani), Semana Santa y tipo de noche: laboral, fin de semana, domingo, puente, fin de puente (lunes festivo), festivo suelto |
| `services/senalesTarifa.js` | Señales por día: ocupación, grupos, cotizaciones, ritmo frente al año pasado, pronóstico, pickup, tarifa vendida, competencia, piso y techo, eventos |
| `services/motorTarifas.js` | Reglas: de las señales a la recomendación con %, confianza y motivo |
| `services/recomendacionesTarifa.js` | Señales + motor, y el registro en `copiloto_recomendaciones` |
| `services/eventosCopiloto.js` | Eventos de demanda cargados desde JSON |
| `GET /api/recomendaciones?dias=60&objetivo=75` | Lo mismo para el dashboard, calculado al momento, con `yaAplicada` si la fecha se marcó en los últimos 7 días |
| `POST /api/recomendaciones/aplicada` `{dia, accion, pct}` | Marca que se cambió el precio en Booking como se recomendó |
| `DELETE /api/recomendaciones/aplicada/:dia` | Deshace la marca |
| `hotel-monitor/src/components/Copiloto.jsx` | Vista "Recomendaciones" de la pestaña Tarifas |

## Vista en el dashboard

La pestaña **Tarifas** abre en **Recomendaciones** (la otra subvista, **Competencia**,
es la lista de precios de Booking que había antes, sin los avisos "caro y vacío /
barato y lleno", que el copiloto reemplaza). El objetivo de ocupación es el mismo de
Pickup y vale para las dos.

- "Para revisar": fechas para subir, bajar o con un grupo por confirmar (cotización de
  5+ habitaciones). "Todas": las 60, incluidas las de mantener y las ya aplicadas.
- Agrupadas por tramo: próximos 7 días, 8–14, 15–30 y más de 30.
- Al tocar una fecha: el motivo, lo que hay en libros, el pronóstico, el año pasado,
  el precio con IVA contra la competencia, piso y techo, y eventos.
- **"Ya cambié el precio en Booking"**: guarda la marca en la recomendación del día.
  Esa fecha no vuelve a pedir cambio en 7 días, porque hasta la captura del sábado el
  copiloto sigue viendo el precio anterior y repetiría la misma subida. Es el tope de
  un paso por semana y el dato que necesita la medición de la Fase 5.

## Comandos (desde `server/`)

```bash
npm run copiloto:recomendaciones                    # tabla de hoy
npm run copiloto:recomendaciones -- --corte=2026-09-01 --dias=30   # prueba hacia atrás
npm run copiloto:guardar                            # guarda la corrida de hoy
npm run copiloto:senales                            # señales en bruto
npm run copiloto:eventos -- data/archivo.json [--dry-run]          # carga eventos
```

La prueba hacia atrás reconstruye lo que había en libros en esa fecha y compara
cada recomendación con lo que pasó según el folio. No ve cotizaciones (Zeus solo
guarda el estado final) ni competencia anterior al 3-oct-2026.

## Decisiones (2026-10-04)

- Habitación de referencia: **Doble Estándar, 2 personas** (el hotel tiene un solo
  tipo, "ST", y cobra por número de personas).
- Recomendaciones en %: **5 % o 10 %**, máximo 10 % por semana para una fecha.
- **Precios con IVA.** `valor_habitacion` de Zeus ya es la tarifa final. Booking
  muestra el precio propio a los extranjeros sin el 19 % de IVA (están exentos): el
  17-oct se veía $101.740 desde EE. UU. y España, y desde Colombia $101.740 + $19.340
  de impuestos. El motor compara el precio propio × 1,19 contra el total de la
  competencia (Popayán Plaza, por ejemplo, ya incluye el IVA en su precio).
- **Piso y techo automáticos:** lo cobrado por la doble el mismo mes del año pasado,
  sin el 10 % más barato ni el 10 % más caro. Se pueden fijar a mano por mes en
  `copiloto_rangos` (`{_id: "YYYY-MM", piso, techo}`). Se miden contra el precio
  público de Booking; sin captura de esa fecha no se recorta.
- **Eventos de impacto alto o más frenan los descuentos**, y solo suben el precio
  si el ritmo de reservas lo confirma. Excepción (versión "2" de las reglas): si el
  precio está fuera de mercado (más de 30 % sobre la competencia o por encima del
  techo) se baja igual, porque ni rebajado queda barato. Caso que la motivó: lun
  2-nov-2026, +70 % sobre la competencia, encima del techo y 10 de 29 esperadas.

## Pronóstico

Habitaciones en libros hoy + el pickup individual que el año pasado entró desde la
misma antelación, promediado en los días equivalentes (mismo día de la semana ±2
semanas, o el mismo tipo de puente/festivo ±45 días) que no estaban llenos. Los
grupos del año pasado se descuentan: los de este año ya están en libros.

Ese pickup se escala por la raíz de la **tendencia**: reservas individuales nuevas
de los últimos 28 días para los próximos 30, este año contra el año pasado. Por
ahora la tendencia solo baja el pronóstico (no hay pruebas con tendencia al alza).

Probado en 7 cortes de marzo a septiembre de 2026 (210 días): el error medio bajó
de 6,6 a 4,6 habitaciones frente a copiar el mismo día del año pasado. Los días en
que habría dicho **subir** cerraron con 24,8 habitaciones de media y el 74 %
llegó al objetivo; **mantener**, 16,4; **bajar**, 13,6.

Límites conocidos: los grupos que reservan tarde no se pronostican (9–12 jun 2026);
si una reserva cambió de fechas, Zeus no guarda el historial.

## Reglas del motor (versión "2")

Matriz de presión de demanda × posición del precio (±10 % de la mediana de los
directos comparables):

| Demanda \ Precio | Barato | En línea | Caro | Sin dato |
|---|---|---|---|---|
| Alta (esperadas ≥ objetivo) | +10 % | +5 % | = | +5 % |
| Normal | +5 % | = | = | = |
| Baja (esperadas < 15) | = (revisar canales) | −5 % | −10 % | −5 % si faltan ≤ 14 días |

Además:

- **Cotizaciones** (estado 11) no cuentan como demanda segura. Con 5 o más
  habitaciones cotizadas no se baja, y si "lleno" depende de ellas pide confirmar
  o liberar el grupo.
- **Quedan 2 habitaciones o menos:** subir 10 %.
- **Tendencia débil** (factor < 0,9): el pronóstico solo no basta para subir; hace
  falta tener en libros al menos el objetivo menos 3.
- **Confianza** baja con cada duda: sin precio de competencia, captura de más de
  14 días, sin año pasado, cotización grande, fecha a más de 45 días.

## Colecciones

- `copiloto_eventos`: `{nombre, desde, hasta, impacto, tipo: evento|ventana, ...}`.
- `copiloto_rangos`: piso y techo fijados a mano por mes.
- `copiloto_recomendaciones`: una por corrida y fecha (`_id` =
  `<corrida>:<fecha>`), con la recomendación, la versión de reglas, la tendencia y
  el resumen de señales. Volver a correr el mismo día la reemplaza sin tocar los
  campos que se agreguen después. `aplicada: {en, corrida, accion, pct}` se agrega
  desde el dashboard; si el cron todavía no guardó la corrida del día, la marca crea
  el documento y el cron lo completa.

## Cron

Todos los días a las 06:30 de Bogotá; los sábados queda después de la captura de
competencia de las 06:00:

```cron
30 6 * * * cd /home/bitnami/app_hotel/hotelPlazuelaMonitor/server && /usr/bin/flock -n /tmp/hotel-copiloto.lock /opt/bitnami/node/bin/node jobs/recomendacionesTarifa.js --guardar >> /home/bitnami/.pm2/logs/copiloto-tarifas.log 2>&1
```

## Próximos pasos

- Fase 4: herramienta en el agente de WhatsApp y resumen de los sábados.
- Fase 5: completar cada recomendación con el resultado y ajustar las reglas.
- El backend no tiene autenticación (decisión aparcada): quien conozca la URL podría
  marcar o desmarcar fechas. Solo afecta los datos de medición.

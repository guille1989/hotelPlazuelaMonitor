# Contrato de datos — colección `reservas`

Fuente de verdad: el ETL que corre en **`C:\scriptdb\hotel\app.js`** en el servidor
(hay una copia de trabajo en `C:\proyectos\hotelTest\hotel`, que es el repo git del ETL).
Zeus SQL Server → MongoDB Atlas `hotellpmonitor`.
Consumidores: `server/routes/*.js` y `hotel-monitor/src/**`.

Este documento fija los tipos y formatos que produce el ETL para que las queries
del backend y los cálculos del frontend puedan asumir un formato estable.

---

## Campos y tipos

| Campo | Tipo Mongo | Formato / valores | Notas |
|---|---|---|---|
| `codigo_reserva` | String \| null | código de reserva Zeus, o `null` para walk-ins ("Sin reserva") | llave de identidad junto con `linea_habitacion` |
| `linea_habitacion` | String \| null | trim aplicado; `null` en walk-ins | |
| `codigo_registro` | String | uno o varios registros unidos por `"; "` (orden **determinístico**) | llave de identidad para walk-ins |
| `estado_habitacion` | String | p. ej. `"31"` | el frontend hace `parseInt(...) === 31`; se mantiene String |
| `cantid_reh` | Number \| null | | **debe ser Number**: `reservasfuturas.js` hace `ocupacion += cantid_reh` |
| `adultos` | Number \| null | | |
| `ninos` | Number \| null | | |
| `valor_habitacion` | Number \| null | COP | |
| `costo_01`, `costo_02` | Number \| null | COP, nivel **reserva** (repetido igual en cada línea) | ver "Fan-out de costos" |
| `tipo_habitacion`, `clase_habitacion`, `tipo_registro`, `estado_registro`, `estado_folio`, `nombre_cliente_folio`, `codigo_folio`, `numero_habitacion`, `numero_transaction`, `prefijo_reserva` | String \| null | | agregados al schema para que no se descarten en silencio |
| `nombre_cliente` | String | trim aplicado | |
| `origen` | String | `"Con reserva"` \| `"Sin reserva"` | el backend compara `.trim().toLowerCase()` |
| `fecha_llegada`, `fecha_salida`, `fecha_llegada_habitacion`, `fecha_salida_habitacion`, `fecha_liquidacion`, `fecha_ult_mod` | String \| null | `"YYYY-MM-DD"` | ver "Fechas" |
| `fecha_cancelacion` | String \| null | `"YYYY-MM-DD"` si está cancelada, **`null` si no** | ver "Cancelación" |

---

## Fechas

- Formato único: `"YYYY-MM-DD"` (string), nunca `Date`, nunca ISO con hora.
- Se derivan con **componentes UTC** (`getUTCFullYear/Month/Date`) a partir del `Date`
  que devuelve `mssql`/tedious con `useUTC: true`. Esto hace el resultado independiente
  de la zona horaria del sistema operativo del servidor (la causa de los corrimientos
  de ±1 día que se venían parchando).
- Las queries del backend comparan estos campos como **strings** (`$lte: "2025-05-02"`),
  lo cual es correcto porque `"YYYY-MM-DD"` ordena lexicográficamente igual que
  cronológicamente.

### Centinelas
Zeus usa fechas "vacías" como `1900-01-01` (y a veces `1899-12-30`, `1753-01-01`).
El ETL las convierte a `null`. Regla: cualquier fecha con año `< 1990` → `null`.

### Verificado con DRY_RUN sobre el rango completo (7958 filas, 2025-01-01 .. 2027-12-31)
- `fecha_llegada` / `fecha_salida`: **0 nulls** en 7958 filas.
- `fecha_cancelacion`: 6351 null (no canceladas) / 1607 con fecha real.
- `fecha_llegada_habitacion` / `fecha_salida_habitacion` / `fecha_liquidacion`: ~1004
  null (≈ los 1003 walk-ins).
- `costo_01` / `cantid_reh`: 100% numéricos.
- `linea_habitacion`: string con cero a la izquierda (`"01"`, `"02"`). El CSV exportado
  la mostraba como `1`/`2` (Excel le quita el cero); el valor real vía tedious es `"01"`.
- `estado_habitacion` llega como string (`"31"`); `estado_registro`/`estado_folio` llegan
  como número (`32`) → Mongoose los castea a String. `prefijo_reserva` es texto libre de
  observaciones (no un "prefijo"), a veces largo.

### Verificado con `testQuery.csv` (muestra de 30 días)
- `fecha_llegada` / `fecha_salida`: sin nulls, todas a medianoche, año 2026. OK.
- `fecha_cancelacion`: años 1900 (centinela → null), 2025 y 2026 (cancelaciones reales →
  se conservan). OK.
- `fecha_liquidacion` / `fecha_ult_mod`: traen hora real (p.ej. `2026-08-19 03:14:25`).
  `toFechaYMD` las reduce a fecha. Confirmado que hay que leerlas con `getUTC*`: un
  timestamp de las 3 AM en un server en zona Bogotá daría el día anterior con `getDate()`.
- `prefijo_reserva`: Zeus lo devuelve como `char()` con relleno — "con desayuno" + hasta
  1500 espacios. El ETL lo recorta (`limpiarTexto`). Igual para dobles espacios en
  `nombre_cliente` ("HOTZ  KATRIN").

---

## Cancelación

- `fecha_cancelacion = null` → reserva **no** cancelada.
- `fecha_cancelacion = "YYYY-MM-DD"` → cancelada en esa fecha.
- Se elimina el centinela `"1900-01-01"` como marca de "no cancelada".

### Impacto en consumidores
- `server/routes/reservas.js`, `reservasfuturas.js`, `reservaspasadas.js`:
  ya usan `if (!doc.fecha_cancelacion) return true;` → **compatibles con `null`**, sin cambios.
- `server/routes/reservasCanceladas.js` (Fase 3): hoy filtra
  `fecha_cancelacion: { $ne: new Date("1900-01-01T00:00:00.000Z") }` — compara un `Date`
  contra un campo string, **nunca coincide**. Debe pasar a `{ $ne: null }` + rango de
  fechas como string.
- `hotel-monitor/src/App.js` (Fase 4): hoy filtra
  `stat.fecha_cancelacion !== "1900-01-01T00:00:00.000Z"` — siempre verdadero, cuenta
  todo como cancelado. Debe pasar a `stat.fecha_cancelacion != null`.

---

## Llaves de identidad (upsert)

- **Con reserva** (`codigo_reserva` no vacío): `{ codigo_reserva, linea_habitacion }`
- **Sin reserva** (`codigo_reserva` null): `{ codigo_registro }`

El ETL hace `updateOne(filtro, { $set }, { upsert: true })` vía `bulkWrite`.

### Filas con llave repetida → se fusionan en JS (`deduplicar` / `fusionar`)
La subconsulta "sin reserva" **no agrega**: un walk-in con varios folios produce varias
filas con el mismo `codigo_registro`. En el rango completo (7958 filas) fueron 6 casos.
Sin fusionar: el upsert las pisa (last-write-wins) y `reservasfuturas`/`reservaspasadas`
las cuentan doble en ocupación (`diaObj.ocupacion++` por documento). El ETL las fusiona
antes del `bulkWrite`: suma `costo_01/02`, concatena las listas, toma `fecha_ult_mod`
más nueva. La subconsulta "con reserva" no repite llave (0 casos en 6955 filas).

### Índices (crear en Fase 2, después de deduplicar)
```js
Reserva.syncIndexes();
```
Declarados en el schema:
- `{ codigo_reserva: 1, linea_habitacion: 1 }` único, parcial `codigo_reserva` tipo string
- `{ codigo_registro: 1 }` único, parcial `codigo_reserva: null`

`syncIndexes()` **fallará si hay documentos duplicados** → primero correr el dedup
(Fase 2.1).

---

## Fan-out de costos (bug del SQL actual — confirmado con datos)

En la subconsulta "Con reserva", `REGISTRO` y `MAEFOLIO` se unen a nivel de reserva,
pero el `GROUP BY` incluye `h.LINEA_REH`. Si una reserva tiene N líneas de habitación,
cada folio se cuenta N veces → `SUM(f.MOVTODEB)` queda multiplicado por N en `costo_01`
y `costo_02`.

**Confirmado** en la muestra de 30 días (`testQuery.csv`, 392 filas): de 312 filas
"con reserva", 23 reservas tienen 2-3 líneas. Ejemplos:
- `038103`: 2 líneas, `costo_01 = 1043595.62` en **ambas** → sumar da 2.087.191,24 (real: 1.043.595,62).
- `037753`: 3 líneas, `costo_01 = 863888.89` en las tres.

Además `codigo_registro`, `codigo_folio`, `numero_habitacion` y `nombre_cliente_folio`
salen **idénticos en cada línea** (la lista completa a nivel reserva, no la de esa línea).
O sea: para reservas multi-línea, esos campos y los costos son de la **reserva**, no de
la línea. Hoy ningún consumidor los lee (`App.js` usa `valor_habitacion`, que sí es por
línea), así que el fan-out no rompe nada en pantalla — pero el dato guardado está mal.

Decisión: la reestructura con CTEs se hace en Fase 2/3, no en la corrida de recuperación
(la query de 60 líneas sin probar es más riesgo que beneficio dado que esos campos no se
usan). Con los CTEs, los costos quedan a nivel reserva repetidos igual en cada línea (no
multiplicados). Si se decide que `costo_01/02` no hacen falta, se quitan del SELECT.

### Correcciones
1. **Ya aplicado en `app.js`:** el ETL normaliza en JS (`normalizarLista`) las listas
   concatenadas `codigo_registro` / `codigo_folio` / `numero_habitacion` /
   `nombre_cliente_folio` a un orden estable. `STRING_AGG ... WITHIN GROUP (ORDER BY)`
   **no se usa**: da Msg 102 en Zeus. El servidor es SQL Server 2022, así que la causa
   es el *compatibility level* de la base `Zeus` (< 110 → sin `WITHIN GROUP`; < 110
   tampoco tendría `STRING_AGG` — confirmar con
   `SELECT compatibility_level FROM sys.databases WHERE name = 'Zeus'`). Sin normalizar,
   un cambio de orden en la cadena hace que cada corrida marque el documento como
   "modificado" (no crea duplicados: para "con reserva" la llave del upsert es
   `{codigo_reserva, linea_habitacion}`, no `codigo_registro`).

2. **Propuesta a validar:** pre-agregar folios y registros en CTEs a nivel de reserva
   y unirlos ya agregados, quitando el `GROUP BY` del SELECT externo (una fila por
   `RESHAB`). Los costos quedan a nivel reserva, repetidos igual en cada línea (no
   multiplicados).

```sql
WITH reg_agg AS (
  SELECT
    reg.NRESER_RES,
    STRING_AGG(CONVERT(varchar(50), reg.REGISTRO), '; ')
      WITHIN GROUP (ORDER BY reg.REGISTRO)            AS codigo_registro,
    MIN(reg.TIPO_REG)                                 AS tipo_registro,
    MAX(reg.ESTADO_REG)                               AS estado_registro
  FROM REGISTRO reg
  GROUP BY reg.NRESER_RES
),
folio_agg AS (
  SELECT
    reg.NRESER_RES,
    MAX(f.ESTADO)                                     AS estado_folio,
    STRING_AGG(LTRIM(RTRIM(f.NOMBRE)), '; ')
      WITHIN GROUP (ORDER BY LTRIM(RTRIM(f.NOMBRE)))  AS nombre_cliente_folio,
    STRING_AGG(CONVERT(varchar(50), f.NFOLIO), '; ')
      WITHIN GROUP (ORDER BY f.NFOLIO)                AS codigo_folio,
    SUM(f.MOVTODEB)                                   AS costo_01,
    SUM(f.MOVTOCRE)                                   AS costo_02,
    MAX(f.NUMTRANS)                                   AS numero_transaction,
    STRING_AGG(LTRIM(RTRIM(f.NROHAB_HAB)), '; ')
      WITHIN GROUP (ORDER BY LTRIM(RTRIM(f.NROHAB_HAB))) AS numero_habitacion,
    MAX(f.LASTDATE)                                   AS fecha_ult_mod
  FROM REGISTRO reg
  JOIN MAEFOLIO f ON f.REGISTRO = reg.REGISTRO
  GROUP BY reg.NRESER_RES
)
SELECT
  r.NRESER_RES                       AS codigo_reserva,
  LTRIM(RTRIM(h.LINEA_REH))          AS linea_habitacion,
  h.CANTID_REH                       AS cantid_reh,
  ra.codigo_registro,
  r.FLLEGA_RES                       AS fecha_llegada,
  r.FSALID_RES                       AS fecha_salida,
  h.FLLEGA_REH                       AS fecha_llegada_habitacion,
  h.FSALID_REH                       AS fecha_salida_habitacion,
  ra.tipo_registro,
  h.NINOS_REH                        AS ninos,
  h.ADULTO_REH                       AS adultos,
  LTRIM(RTRIM(r.NOMBRE_RES))         AS nombre_cliente,
  ra.estado_registro,
  fa.estado_folio,
  fa.nombre_cliente_folio,
  fa.codigo_folio,
  fa.costo_01,
  fa.costo_02,
  fa.numero_transaction,
  fa.numero_habitacion,
  h.ESTADO_REH                       AS estado_habitacion,
  h.VLRP_REH                         AS valor_habitacion,
  h.TIPHAB_TIP                       AS tipo_habitacion,
  h.CLAHAB_CLH                       AS clase_habitacion,
  h.FCANR_REH                        AS fecha_cancelacion,
  h.FechaLiquidacion                 AS fecha_liquidacion,
  r.PREFE_RES                        AS prefijo_reserva,
  fa.fecha_ult_mod,
  'Con reserva'                      AS origen
FROM RESERVA r
JOIN RESHAB h        ON r.NRESER_RES = h.NRESER_RES
LEFT JOIN reg_agg ra ON ra.NRESER_RES = r.NRESER_RES
LEFT JOIN folio_agg fa ON fa.NRESER_RES = r.NRESER_RES
WHERE r.FLLEGA_RES BETWEEN DATEFROMPARTS(YEAR(GETDATE()) - 1, 1, 1)
                       AND DATEFROMPARTS(YEAR(GETDATE()) + 1, 12, 31)
```
Antes de reemplazar la query activa: correr ambas versiones sobre Zeus y comparar
número de filas y `SUM(costo_01)` por reserva.

---

## Estado del roadmap

- **Fase 0** — backup, git del ETL, este contrato. *(en curso)*
- **Fase 1** — refactor de `app.js`: schema, `toFechaYMD` UTC, `bulkWrite`+upsert,
  conteo real de éxito/fallo, cierre limpio de conexiones, `STRING_AGG` ordenado.
- **Fase 2** — dedup, re-sync sobre copia, validación, índices, promoción a prod.
- **Fase 3** — backend: conexión Mongo compartida, `reservasCanceladas` roto,
  helpers de fecha unificados.
- **Fase 4** — frontend: race de cancelaciones, comparaciones número/string,
  `fecha_cancelacion`, código muerto.

Aparcado (no se toca por ahora): mover credenciales a `.env`, sacar `.env`/`build/`
de git, CORS/auth/HTTPS.

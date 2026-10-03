# Rate shopping — contrato y primera implementación

## Objetivo del MVP

Comparar la tarifa pública futura del Hotel La Plazuela con seis competidores
directos de Popayán. Las propiedades boutique superiores y corporativas se
guardan en grupos separados para que no alteren la mediana principal.

La implementación contiene el catálogo, el plan de consultas, el contrato
normalizado, la persistencia, un proveedor simulado, un piloto real con
Playwright sobre páginas públicas oficiales y el proveedor `serpapi` (Google
Hotels), que es la fuente elegida para la competencia.

## Condiciones de búsqueda

- Una habitación.
- Dos adultos.
- Una noche.
- Moneda COP.
- Tarifa pública, sin iniciar sesión y sin descuentos de miembro.
- Horizontes D+1, D+3, D+7, D+14, D+30, D+60 y D+90.
- Captura semanal (ver la sección de SerpApi) con zona horaria `America/Bogota`.

## Regla de comparabilidad

Una observación entra en la mediana únicamente cuando:

- existe disponibilidad;
- tiene precio total;
- está expresada en COP;
- confirma impuestos incluidos;
- es pública y no requiere membresía; y
- permite cancelación flexible.

El desayuno se registra, pero no se descuenta ni se estima. La ausencia de
disponibilidad se guarda con `totalAmount: null`; nunca como precio cero.

## Colecciones

### `rate_hotels`

Catálogo canónico. Cada documento indica si es el hotel propio y si pertenece
al grupo `directo`, `superior` o `corporativo`.

### `rate_runs`

Control de cada captura: proveedor, fecha, estado, cobertura, consumo
(`usage`) y errores.
El identificador es `<proveedor>:<YYYY-MM-DD>`, haciendo idempotente una
repetición del job durante el mismo día.

### `rate_quotes`

Observaciones normalizadas por hotel, estancia, ocupación y canal. El campo
`comparable` y `nonComparableReasons` explican si puede entrar en las métricas.

## Seguridad de los datos simulados

El proveedor `mock` sirve para desarrollar sin llamadas externas. Sus valores
no representan precios reales. El servicio bloquea su escritura salvo que se
habilite expresamente `RATE_SHOPPING_ALLOW_MOCK_WRITE=1`.

Ejecución segura, sin MongoDB:

```powershell
cd server
npm run tarifas:dry-run -- --fecha-base=2026-09-27
```

## Piloto Playwright

El piloto consulta una habitación, dos adultos y una noche sin iniciar sesión.
No intenta eludir CAPTCHA, bloqueos ni medidas anti-bot. Actualmente:

- Hotel La Plazuela: consulta su motor oficial HBook por fecha y conserva la
  habitación pública de menor precio.
- Camino Real: su página oficial de tarifas no publica valores por fecha; se
  registra un error de cobertura, nunca un falso “agotado”.
- La Herrería Colonial: su fuente oficial no está accesible de forma fiable; se
  registra un error de cobertura.

La página de La Plazuela no confirma en el resultado los impuestos ni la
política de cancelación. Por ello el precio se almacena, pero queda como no
comparable hasta obtener esas condiciones de una fuente verificable.

Instalación del navegador para servidores o contenedores:

```powershell
cd server
npx playwright install chromium
```

En una máquina con Chrome ya instalado puede configurarse
`RATE_SHOPPING_BROWSER_CHANNEL=chrome`. Prueba corta, sin escritura en MongoDB:

```powershell
cd server
$Env:RATE_SHOPPING_BROWSER_CHANNEL="chrome"
npm run tarifas:playwright:dry-run -- --fecha-base=2026-09-27 --horizontes=1
```

## Competencia desde Google Hotels (SerpApi)

Las webs oficiales de la competencia no publican precios por fecha, así que la
fuente es Google Hotels consultado a través de SerpApi (`engine=google_hotels`,
`gl=co`, `hl=es`, `currency=COP`). Decisión del 2026-10-03:

- **Fuente fija: Booking.com.** Por cada hotel y fecha se pide el detalle de la
  propiedad (`property_token`) y se toma la tarifa de Booking. El "precio más
  bajo" de la búsqueda de la ciudad no sirve: mezcla fuentes con y sin IVA
  (el 10-oct Expedia daba $84.965 para La Plazuela y Booking $101.724) y no
  trae la política de cancelación.
- **Alcance y frecuencia:** hotel propio + competidores directos (7 hoteles),
  7 horizontes, **una vez por semana**: 49 búsquedas por corrida, ~210 al mes,
  dentro del plan gratis de SerpApi (250). El job se niega a correr si una
  captura necesita más de `RATE_SHOPPING_SERPAPI_MAX_BUSQUEDAS` (60). El
  consumo queda en `rate_runs.usage.busquedas`. Otros grupos: `--grupos=`.

Cómo se elige la tarifa de cada hotel:

- Solo tarifas para 2 adultos (`num_guests`); una triple no es el precio de 2.
- La más barata con cancelación gratis; si no hay ninguna, la más barata, con
  `refundable: null` (no confirmada).
- `mealPlan: "incluido"` si las condiciones de la tarifa mencionan desayuno
  incluido; si no, `desconocido`.
- Sin precio de Booking pero con otras fuentes → error `sin_precio_booking`;
  sin ninguna fuente → `sin_precio_publicado`. Ninguno se guarda como agotado
  (Camino Real, por ejemplo, tiene precio unas fechas y otras no).

### Qué precio es

Booking cambia el precio según el país de quien mira. Para la Doble Estándar
de La Plazuela del 10-oct-2026:

| Quién mira | Precio |
|---|---|
| Booking desde EE. UU. (SerpApi) | $101.724, "incluye impuestos" |
| Booking desde España (navegador) | $84.040, "incluye impuestos y cargos" (tachado $221.160) |
| Web directa (HBook) | $121.260 |

El hotel carga sus tarifas en Booking con IVA. SerpApi siempre consulta desde
EE. UU., así que lo guardado es **el precio final que ve un viajero desde
EE. UU. en Booking** (`taxesIncluded: true`), no necesariamente el que paga un
huésped colombiano. Sirve para comparar a los hoteles entre sí (misma fuente,
mismo punto de venta) y para seguir su evolución, no como tarifa absoluta.

### Tokens del catálogo

Cada hotel se identifica por su `googleHotelsToken`, nunca por el nombre. Para
obtenerlos (una búsqueda por página; los 12 hoteles aparecen en 3 páginas):

```powershell
cd server
npm run tarifas:serpapi:descubrir -- --paginas=3
```

Las sugerencias se revisan a mano antes de copiarlas a `catalogoHoteles.js`.

Prueba sin escritura en MongoDB (gasta hoteles × fechas búsquedas):

```powershell
cd server
npm run tarifas:serpapi:dry-run -- --horizontes=1,7,30
```

Primera prueba real (2026-10-03, D+1/D+7/D+30): 14 de 21 precios, 12
comparables. Los Portales Inn no tiene Booking en Google (sí su web y
Priceline) y Camino Real solo tiene precio algunas fechas.

## Próximo hito

1. Programar la captura semanal y guardar en MongoDB.
2. Vista en el dashboard: precio propio frente a la mediana de los directos.
3. Tras unas semanas, revisar la cobertura de Los Portales Inn y Camino Real.

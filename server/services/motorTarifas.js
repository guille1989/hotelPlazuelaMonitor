const { TOTAL_HABITACIONES } = require("../functions/objetivoPickup");
const { NIVELES_IMPACTO } = require("./eventosCopiloto");

// Motor de reglas del copiloto de tarifas (Fase 2): de las señales de un día a una
// recomendación subir / mantener / bajar con su porcentaje, confianza y motivo.
// Reglas fijas para que cada recomendación se explique en una línea.

// Se guarda con cada recomendación para poder medir cada versión por separado.
// "2" (2026-10-04): el evento fuerte ya no frena la rebaja de un precio fuera de mercado.
const VERSION_REGLAS = "2";
// Ocupación esperada por debajo de esta fracción = demanda baja (15 de 29).
const PCT_DEMANDA_BAJA = 50;
// ±10 % de la mediana de la competencia = precio en línea.
const UMBRAL_PRECIO_PCT = 10;
const MIN_COMPARABLES = 2;
// Booking muestra el precio propio a los extranjeros sin el 19 % de IVA (están
// exentos) y la competencia en general no lo descuenta. Se compara con lo que ve un
// huésped colombiano: precio propio × 1,19. Verificado el 2026-10-04: para el 17-oct,
// desde Colombia sale $101.740 + $19.340 de impuestos; desde EE. UU. y España, $101.740.
const FACTOR_IVA_PROPIO = 1.19;
const PASO_PCT = 5;
const MAX_PCT = 10;
const COMPETENCIA_VIEJA_DIAS = 14;
// Sin precio de competencia solo se baja cerca de la fecha: el hotel reserva tarde.
const DIAS_BAJAR_SIN_PRECIO = 14;
const HORIZONTE_CONFIABLE_DIAS = 45;
// Cotizaciones de este tamaño o más pueden no confirmar: ocupación en riesgo.
const COTIZACION_EN_RIESGO = 5;
const QUEDAN_POCAS = 2;
// Eventos de este impacto o más frenan los descuentos y, si el ritmo lo confirma,
// suben la demanda (decisión del 2026-10-04).
const IMPACTO_FUERTE = "alto";
// ...salvo que el precio esté fuera de mercado: más de 30 % sobre la competencia o por
// encima del techo. Ahí ni rebajado queda barato, así que se baja igual (lun 2-nov-2026:
// +70 % sobre la competencia, encima del techo y con 10 de 29 esperadas).
const CARO_EXTREMO_PCT = 30;
// Con la tendencia de reservas a la baja, el pronóstico (que copia el pickup del año
// pasado) no basta para subir: hace falta tener ya en libros casi el objetivo. En la
// prueba de agosto 2026 evitó 5 subidas en días que terminaron por debajo del 50 %.
const TENDENCIA_DEBIL = 0.9;
const MARGEN_FIRME_SUBIR = 3;

// % por presión de demanda × posición del precio.
const MATRIZ = Object.freeze({
  alta: { barato: 10, en_linea: 5, caro: 0, sin_dato: 5 },
  normal: { barato: 5, en_linea: 0, caro: 0, sin_dato: 0 },
  baja: { barato: 0, en_linea: -5, caro: -10, sin_dato: -5 },
});

const nivelImpacto = (impacto) => NIVELES_IMPACTO.indexOf(impacto);
const miles = (valor) => `${Math.round(valor / 1000)}k`;
const conSigno = (n) => (n > 0 ? `+${n}` : String(n));

// Nombre del evento fuerte que toca el día, si lo hay.
function eventoFuerte(calendario) {
  if (calendario.tipo === "semana_santa") return "Semana Santa";
  const fuertes = calendario.eventos.filter(
    (e) => nivelImpacto(e.impacto) >= nivelImpacto(IMPACTO_FUERTE)
  );
  const evento = fuertes.find((e) => e.tipo === "evento");
  if (evento) return evento.nombre;
  return fuertes.length ? "ventana de demanda alta" : null;
}

function evaluarDemanda(senal) {
  const { proyectada, objetivo } = senal.ocupacion;
  const cotizadas = senal.ocupacion.cotizadas || 0;
  const firme = Math.max(0, proyectada - cotizadas);
  const pronostico = senal.ritmo.pronostico;
  // Las cotizaciones no cuentan como demanda segura.
  const esperada = pronostico === null ? firme : Math.max(firme, pronostico - cotizadas);
  const umbralBaja = Math.ceil((TOTAL_HABITACIONES * PCT_DEMANDA_BAJA) / 100);
  // El ritmo de hoy incluye las cotizaciones; se compara solo lo firme.
  const diferenciaFirme = senal.ritmo.diferencia - cotizadas;
  const ritmoFavorable = senal.ritmo.actual - cotizadas > 0 && diferenciaFirme >= 0;
  const evento = eventoFuerte(senal.calendario);

  let nivel;
  if (esperada >= objetivo) nivel = "alta";
  // Sin año pasado no hay pronóstico: lo poco que hay en libros solo dice "baja" cerca
  // de la fecha, porque el hotel reserva tarde.
  else if (pronostico === null) nivel = senal.diasHasta <= 7 && esperada < umbralBaja ? "baja" : "normal";
  else nivel = esperada < umbralBaja ? "baja" : "normal";

  const factorTendencia = senal.ritmo.tendencia?.factor ?? 1;
  const frenadaPorTendencia =
    nivel === "alta" &&
    factorTendencia < TENDENCIA_DEBIL &&
    firme < objetivo - MARGEN_FIRME_SUBIR;
  if (frenadaPorTendencia) nivel = "normal";

  const subidaPorEvento = nivel === "normal" && evento !== null && ritmoFavorable;
  if (subidaPorEvento) nivel = "alta";

  return {
    nivel,
    firme,
    esperada,
    cotizadas,
    diferenciaFirme,
    libres: TOTAL_HABITACIONES - proyectada,
    evento,
    subidaPorEvento,
    frenadaPorTendencia,
    factorTendencia,
  };
}

function evaluarPrecio(senal) {
  const c = senal.competencia;
  if (!c || c.mediana == null || c.precioPropio == null || (c.comparables || 0) < MIN_COMPARABLES) {
    return { posicion: "sin_dato", vieja: false };
  }
  const propio = Math.round(c.precioPropio * FACTOR_IVA_PROPIO);
  const diferenciaPct = Math.round((propio / c.mediana - 1) * 100);
  const posicion =
    diferenciaPct <= -UMBRAL_PRECIO_PCT
      ? "barato"
      : diferenciaPct >= UMBRAL_PRECIO_PCT
        ? "caro"
        : "en_linea";
  return {
    posicion,
    propio,
    mediana: c.mediana,
    diferenciaPct,
    vieja: c.antiguedadDias > COMPETENCIA_VIEJA_DIAS,
  };
}

function encimaDelTecho(precio, rango) {
  return Boolean(rango && rango.techo && precio.propio && precio.propio > rango.techo);
}

function fueraDeMercado(precio, rango) {
  return (
    precio.posicion === "caro" &&
    (precio.diferenciaPct > CARO_EXTREMO_PCT || encimaDelTecho(precio, rango))
  );
}

// Recorta el % para no salirse del piso / techo. Se mide contra el precio público
// (Booking con IVA), que es el que se cambia; la tarifa vendida no sirve porque mezcla
// grupos y convenios. Sin captura de esa fecha no se recorta: el rango va en la
// recomendación para revisarlo al aplicar.
function limitarAlRango(pct, senal, precio) {
  const referencia = precio.propio ?? null;
  const { piso = null, techo = null } = senal.rango || {};
  if (referencia === null || pct === 0) return { pct, limite: null };
  let ajustado = pct;
  while (ajustado > 0 && techo && referencia * (1 + ajustado / 100) > techo) ajustado -= PASO_PCT;
  while (ajustado < 0 && piso && referencia * (1 + ajustado / 100) < piso) ajustado += PASO_PCT;
  if (ajustado === pct) return { pct, limite: null };
  const limite = pct > 0 ? { tipo: "techo", valor: techo } : { tipo: "piso", valor: piso };
  return { pct: ajustado, limite };
}

function armarMotivo({ senal, demanda, precio, regla, limite }) {
  const partes = [];
  if (regla === "lleno") partes.push("Sin habitaciones libres");
  else if (regla === "lleno_con_cotizacion") {
    partes.push(`Sin habitaciones libres, pero ${demanda.cotizadas} son cotización: confirmar o liberar el grupo`);
  } else if (regla === "quedan_pocas") partes.push(`Quedan ${demanda.libres} habitaciones`);
  else {
    let ocupacion = `Esperadas ${demanda.esperada}/${TOTAL_HABITACIONES} (objetivo ${senal.ocupacion.objetivo})`;
    if (senal.ritmo.pronostico !== null) {
      const d = demanda.diferenciaFirme;
      ocupacion +=
        d === 0
          ? ", igual que el año pasado a esta altura"
          : `, ${Math.abs(d)} ${d > 0 ? "más" : "menos"} que el año pasado a esta altura`;
    }
    partes.push(ocupacion);
  }
  if (demanda.cotizadas >= COTIZACION_EN_RIESGO && regla !== "lleno_con_cotizacion") {
    partes.push(`${demanda.cotizadas} son cotización`);
  }
  partes.push(
    precio.posicion === "sin_dato"
      ? "Sin precio de competencia para esta fecha"
      : `Booking ${miles(precio.propio)} con IVA vs ${miles(precio.mediana)} de la competencia (${conSigno(precio.diferenciaPct)} %)`
  );
  if (demanda.frenadaPorTendencia) {
    partes.push(
      `Reservas a la baja (×${demanda.factorTendencia}): con ${demanda.firme} en libros el pronóstico solo no basta para subir`
    );
  }
  if (demanda.subidaPorEvento) partes.push(`${demanda.evento} y el ritmo lo confirma`);
  if (regla === "evento_frena") partes.push(`No bajar: ${demanda.evento}`);
  if (regla === "caro_pese_a_evento") {
    const motivos = [];
    if (precio.diferenciaPct > CARO_EXTREMO_PCT) {
      motivos.push(`${conSigno(precio.diferenciaPct)} % sobre la competencia`);
    }
    if (encimaDelTecho(precio, senal.rango)) {
      motivos.push(`por encima del techo de ${miles(senal.rango.techo)}`);
    }
    const evento = demanda.evento.charAt(0).toUpperCase() + demanda.evento.slice(1);
    partes.push(`${evento}, pero el precio está ${motivos.join(" y ")}: bajar igual`);
  }
  if (regla === "sin_precio_lejos") partes.push("Sin precio de competencia no se baja a más de 14 días");
  if (regla === "revisar_canales") partes.push("El precio no es el problema: revisar canales y visibilidad");
  if (regla === "confirmar_cotizacion") partes.push("No bajar antes de confirmar la cotización");
  if (limite) partes.push(`Tope en el ${limite.tipo} de ${miles(limite.valor)}`);
  return partes.join(". ");
}

function recomendar(senal) {
  const demanda = evaluarDemanda(senal);
  const precio = evaluarPrecio(senal);

  let pct;
  let regla;
  if (demanda.libres <= 0) {
    pct = 0;
    regla = demanda.cotizadas >= COTIZACION_EN_RIESGO ? "lleno_con_cotizacion" : "lleno";
  } else if (demanda.libres <= QUEDAN_POCAS && demanda.cotizadas < COTIZACION_EN_RIESGO) {
    pct = MAX_PCT;
    regla = "quedan_pocas";
  } else {
    pct = MATRIZ[demanda.nivel][precio.posicion];
    regla = "matriz";
    if (demanda.nivel === "baja" && precio.posicion === "barato") regla = "revisar_canales";
    if (pct < 0 && precio.posicion === "sin_dato" && senal.diasHasta > DIAS_BAJAR_SIN_PRECIO) {
      pct = 0;
      regla = "sin_precio_lejos";
    }
    if (pct < 0 && demanda.evento) {
      if (fueraDeMercado(precio, senal.rango)) {
        regla = "caro_pese_a_evento";
      } else {
        pct = 0;
        regla = "evento_frena";
      }
    }
    // Si el grupo confirma, el descuento sobraba: primero hay que confirmarlo.
    if (pct < 0 && demanda.cotizadas >= COTIZACION_EN_RIESGO) {
      pct = 0;
      regla = "confirmar_cotizacion";
    }
  }
  const limitado = limitarAlRango(pct, senal, precio);
  pct = limitado.pct;

  let dudas = 0;
  if (precio.posicion === "sin_dato") dudas += 1;
  if (precio.vieja) dudas += 1;
  if (senal.ritmo.pronostico === null) dudas += 1;
  if (demanda.cotizadas >= COTIZACION_EN_RIESGO) dudas += 1;
  if (senal.diasHasta > HORIZONTE_CONFIABLE_DIAS) dudas += 1;
  const confianza = regla === "lleno" || dudas === 0 ? "alta" : dudas === 1 ? "media" : "baja";

  return {
    dia: senal.dia,
    accion: pct > 0 ? "subir" : pct < 0 ? "bajar" : "mantener",
    pct,
    confianza,
    demanda: demanda.nivel,
    posicion: precio.posicion,
    regla,
    limite: limitado.limite,
    alertas: demanda.cotizadas >= COTIZACION_EN_RIESGO ? ["cotizacion"] : [],
    motivo: armarMotivo({ senal, demanda, precio, regla, limite: limitado.limite }),
    versionReglas: VERSION_REGLAS,
    datos: {
      esperada: demanda.esperada,
      firme: demanda.firme,
      libres: demanda.libres,
      precioPropioConIva: precio.propio ?? null,
      mediana: precio.mediana ?? null,
      diferenciaPct: precio.diferenciaPct ?? null,
    },
  };
}

module.exports = {
  FACTOR_IVA_PROPIO,
  MATRIZ,
  VERSION_REGLAS,
  evaluarDemanda,
  evaluarPrecio,
  recomendar,
};

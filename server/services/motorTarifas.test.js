const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluarPrecio, recomendar } = require("./motorTarifas");

// Señal mínima de un día; `cambios` reemplaza secciones completas.
function senal(cambios = {}) {
  return {
    dia: "2026-10-10",
    diasHasta: 6,
    calendario: { tipo: "puente", festivo: null, eventos: [], impactoEventos: null },
    ocupacion: { proyectada: 5, pct: 17, objetivo: 22, grupos: 0, cotizadas: 0 },
    ritmo: { actual: 5, anioAnterior: { fecha: "2025-10-11", alCorte: 7, final: 22 }, diferencia: -2, pronostico: 20 },
    tarifaVendida: { promedio: 135000, habitaciones: 5, doble: { promedio: 121000, habitaciones: 3 } },
    competencia: null,
    rango: { piso: 107000, techo: 226000 },
    ...cambios,
  };
}

const competencia = (precioPropio, mediana, extras = {}) => ({
  capturedDate: "2026-10-03",
  antiguedadDias: 1,
  precioPropio,
  mediana,
  comparables: 3,
  ...extras,
});

test("compara el precio propio con IVA contra la mediana", () => {
  // 101.725 desde EE. UU. = 121.053 con IVA, contra 155.000.
  const precio = evaluarPrecio(senal({ competencia: competencia(101725, 155000) }));
  assert.deepEqual(precio, {
    posicion: "barato",
    propio: 121053,
    mediana: 155000,
    diferenciaPct: -22,
    vieja: false,
    estimado: false,
  });
  assert.equal(evaluarPrecio(senal({ competencia: competencia(101725, 155000, { comparables: 1 }) })).posicion, "sin_dato");
  assert.equal(evaluarPrecio(senal()).posicion, "sin_dato");
});

test("un precio estimado con fechas vecinas decide igual, pero baja la confianza", () => {
  const r = recomendar(
    senal({
      ritmo: { actual: 9, anioAnterior: { fecha: "x", alCorte: 7, final: 22 }, diferencia: 2, pronostico: 24 },
      competencia: competencia(101725, 155000, { estimado: true, entre: ["2026-10-10", "2026-10-17"] }),
    })
  );
  assert.equal(r.pct, 10);
  assert.equal(r.posicion, "barato");
  assert.equal(r.confianza, "media");
  assert.equal(r.datos.precioEstimado, true);
  assert.match(r.motivo, /\(-22 %, estimado con fechas vecinas\)/);
});

test("demanda alta y precio barato: subir 10 %", () => {
  const r = recomendar(
    senal({
      ritmo: { actual: 9, anioAnterior: { fecha: "2025-10-11", alCorte: 7, final: 22 }, diferencia: 2, pronostico: 24 },
      competencia: competencia(101725, 155000),
    })
  );
  assert.equal(r.accion, "subir");
  assert.equal(r.pct, 10);
  assert.equal(r.demanda, "alta");
  assert.equal(r.confianza, "alta");
  assert.equal(
    r.motivo,
    "Esperadas 24/29 (objetivo 22), 2 más que el año pasado a esta altura. " +
      "Booking 121k con IVA vs 155k de la competencia (-22 %)"
  );
});

test("demanda baja y caro: bajar 10 %, salvo que haya un evento fuerte", () => {
  const base = {
    dia: "2026-11-02",
    calendario: { tipo: "fin_puente", festivo: "Todos los Santos", eventos: [], impactoEventos: null },
    ocupacion: { proyectada: 2, pct: 7, objetivo: 22, grupos: 0, cotizadas: 0 },
    ritmo: { actual: 2, anioAnterior: { fecha: "2025-11-03", alCorte: 6, final: 16 }, diferencia: -4, pronostico: 12 },
    tarifaVendida: { promedio: 248000, habitaciones: 2, doble: { promedio: 248000, habitaciones: 2 } },
    competencia: competencia(221142, 155000),
    rango: { piso: 107000, techo: 240000 },
  };
  const sinEvento = recomendar(senal(base));
  assert.equal(sinEvento.accion, "bajar");
  assert.equal(sinEvento.pct, -10);

  // Con evento fuerte y algo caro (con IVA 172.550, +11 %, bajo el techo): no se baja.
  const conEvento = {
    ...base,
    calendario: {
      ...base.calendario,
      eventos: [{ nombre: "Ventana de demanda", impacto: "alto", tipo: "ventana" }],
      impactoEventos: "alto",
    },
  };
  const algoCaro = recomendar(senal({ ...conEvento, competencia: competencia(145000, 155000) }));
  assert.equal(algoCaro.accion, "mantener");
  assert.equal(algoCaro.regla, "evento_frena");
  assert.match(algoCaro.motivo, /No bajar: ventana de demanda alta/);
});

test("con un evento fuerte igual se baja si el precio está fuera de mercado", () => {
  const base = {
    dia: "2026-11-02",
    calendario: {
      tipo: "fin_puente",
      festivo: "Todos los Santos",
      eventos: [{ nombre: "Ventana de demanda", impacto: "alto", tipo: "ventana" }],
      impactoEventos: "alto",
    },
    ocupacion: { proyectada: 2, pct: 7, objetivo: 22, grupos: 0, cotizadas: 0 },
    ritmo: { actual: 2, anioAnterior: { fecha: "2025-11-03", alCorte: 6, final: 16 }, diferencia: -4, pronostico: 12 },
    rango: { piso: 107000, techo: 240000 },
  };
  // Caso real del 2-nov: 263.159 con IVA, +70 % y encima del techo.
  const extremo = recomendar(senal({ ...base, competencia: competencia(221142, 155000) }));
  assert.equal(extremo.accion, "bajar");
  assert.equal(extremo.pct, -10);
  assert.equal(extremo.regla, "caro_pese_a_evento");
  assert.equal(extremo.versionReglas, "2");
  assert.match(
    extremo.motivo,
    /Ventana de demanda alta, pero el precio está \+70 % sobre la competencia y por encima del techo de 240k: bajar igual/
  );

  // +25 % sobre la competencia pero encima del techo (bajo): también se baja.
  const encimaTecho = recomendar(
    senal({ ...base, competencia: competencia(163000, 155000), rango: { piso: 107000, techo: 180000 } })
  );
  assert.equal(encimaTecho.regla, "caro_pese_a_evento");
  assert.match(encimaTecho.motivo, /pero el precio está por encima del techo de 180k: bajar igual/);
});

test("un evento fuerte sube la demanda solo si el ritmo lo confirma", () => {
  const evento = {
    tipo: "laboral",
    festivo: null,
    eventos: [{ nombre: "Popayán Ciudad Libro", impacto: "alto", tipo: "evento" }],
    impactoEventos: "alto",
  };
  const comp = competencia(130000, 155000); // con IVA 154.700: en línea
  const confirma = recomendar(
    senal({
      calendario: evento,
      ritmo: { actual: 8, anioAnterior: { fecha: "x", alCorte: 7, final: 18 }, diferencia: 1, pronostico: 19 },
      competencia: comp,
    })
  );
  assert.equal(confirma.demanda, "alta");
  assert.equal(confirma.pct, 5);
  assert.match(confirma.motivo, /Popayán Ciudad Libro y el ritmo lo confirma/);

  const noConfirma = recomendar(
    senal({
      calendario: evento,
      ritmo: { actual: 5, anioAnterior: { fecha: "x", alCorte: 7, final: 20 }, diferencia: -2, pronostico: 18 },
      competencia: comp,
    })
  );
  assert.equal(noConfirma.demanda, "normal");
  assert.equal(noConfirma.accion, "mantener");
});

test("con reservas a la baja el pronóstico solo no basta para subir", () => {
  const ritmo = (actual, tendencia) => ({
    actual,
    anioAnterior: { fecha: "x", alCorte: actual, final: 26 },
    diferencia: 0,
    pronostico: 26,
    tendencia: { factor: tendencia },
  });
  const ocupacion = (proyectada) => ({ proyectada, pct: 0, objetivo: 22, grupos: 0, cotizadas: 0 });

  const debil = recomendar(senal({ ocupacion: ocupacion(16), ritmo: ritmo(16, 0.73) }));
  assert.equal(debil.demanda, "normal");
  assert.equal(debil.accion, "mantener");
  assert.match(debil.motivo, /Reservas a la baja \(×0.73\): con 16 en libros el pronóstico solo no basta para subir/);

  // Con casi el objetivo ya en libros sí sube, aunque la tendencia sea débil.
  assert.equal(recomendar(senal({ ocupacion: ocupacion(20), ritmo: ritmo(20, 0.73) })).accion, "subir");
  // Con tendencia normal, el pronóstico basta.
  assert.equal(recomendar(senal({ ocupacion: ocupacion(16), ritmo: ritmo(16, 1) })).accion, "subir");
});

test("el techo recorta la subida, medido contra el precio público", () => {
  const alta = {
    ritmo: { actual: 9, anioAnterior: { fecha: "x", alCorte: 7, final: 22 }, diferencia: 2, pronostico: 24 },
    // La tarifa vendida (grupos, convenios) no cuenta para el techo.
    tarifaVendida: { promedio: 250000, habitaciones: 9, doble: { promedio: 261000, habitaciones: 4 } },
    rango: { piso: 107000, techo: 130000 },
  };
  const r = recomendar(senal({ ...alta, competencia: competencia(101725, 155000) }));
  // Booking con IVA 121.053: +10 % = 133.158 > 130.000; +5 % = 127.106 entra.
  assert.equal(r.pct, 5);
  assert.deepEqual(r.limite, { tipo: "techo", valor: 130000 });
  assert.match(r.motivo, /Tope en el techo de 130k/);

  // Sin precio público de esa fecha no se recorta.
  const sinPrecio = recomendar(senal(alta));
  assert.equal(sinPrecio.pct, 5);
  assert.equal(sinPrecio.limite, null);
});

test("lleno, quedan pocas y cotización grande", () => {
  const lleno = recomendar(senal({ ocupacion: { proyectada: 29, pct: 100, objetivo: 22, grupos: 24, cotizadas: 0 } }));
  assert.equal(lleno.accion, "mantener");
  assert.equal(lleno.regla, "lleno");

  const llenoCotizado = recomendar(
    senal({ ocupacion: { proyectada: 29, pct: 100, objetivo: 22, grupos: 27, cotizadas: 27 } })
  );
  assert.equal(llenoCotizado.accion, "mantener");
  assert.equal(llenoCotizado.regla, "lleno_con_cotizacion");
  assert.equal(llenoCotizado.confianza, "baja");
  assert.match(llenoCotizado.motivo, /^Sin habitaciones libres, pero 27 son cotización: confirmar o liberar el grupo/);

  const pocas = recomendar(senal({ ocupacion: { proyectada: 27, pct: 93, objetivo: 22, grupos: 0, cotizadas: 0 } }));
  assert.equal(pocas.pct, 10);
  assert.equal(pocas.regla, "quedan_pocas");

  // 28 en libros pero 27 son una cotización: se decide con la ocupación firme.
  const cotizada = recomendar(
    senal({
      ocupacion: { proyectada: 28, pct: 97, objetivo: 22, grupos: 27, cotizadas: 27 },
      ritmo: { actual: 28, anioAnterior: { fecha: "x", alCorte: 18, final: 24 }, diferencia: 10, pronostico: 29 },
    })
  );
  assert.notEqual(cotizada.regla, "quedan_pocas");
  assert.equal(cotizada.datos.firme, 1);
  assert.equal(cotizada.datos.esperada, 2);
  assert.equal(cotizada.demanda, "baja");
  assert.equal(cotizada.accion, "mantener");
  assert.equal(cotizada.regla, "confirmar_cotizacion");
  assert.deepEqual(cotizada.alertas, ["cotizacion"]);
  assert.match(cotizada.motivo, /27 son cotización/);
  assert.match(cotizada.motivo, /No bajar antes de confirmar la cotización/);
  // Sin la cotización, lo firme va 17 por debajo del año pasado (1 contra 18).
  assert.match(cotizada.motivo, /17 menos que el año pasado/);
});

test("sin precio de competencia solo baja cerca de la fecha", () => {
  const baja = {
    ocupacion: { proyectada: 2, pct: 7, objetivo: 22, grupos: 0, cotizadas: 0 },
    ritmo: { actual: 2, anioAnterior: { fecha: "x", alCorte: 3, final: 10 }, diferencia: -1, pronostico: 9 },
  };
  const lejos = recomendar(senal({ ...baja, diasHasta: 30 }));
  assert.equal(lejos.accion, "mantener");
  assert.equal(lejos.regla, "sin_precio_lejos");

  const cerca = recomendar(senal({ ...baja, diasHasta: 10 }));
  assert.equal(cerca.pct, -5);
  assert.equal(cerca.confianza, "media");
});

test("barato y vacío: no bajar, revisar canales", () => {
  const r = recomendar(
    senal({
      ocupacion: { proyectada: 2, pct: 7, objetivo: 22, grupos: 0, cotizadas: 0 },
      ritmo: { actual: 2, anioAnterior: { fecha: "x", alCorte: 3, final: 10 }, diferencia: -1, pronostico: 9 },
      competencia: competencia(80000, 155000),
    })
  );
  assert.equal(r.accion, "mantener");
  assert.equal(r.regla, "revisar_canales");
});

test("sin año pasado ni competencia la confianza es baja", () => {
  const r = recomendar(
    senal({
      diasHasta: 30,
      ritmo: { actual: 3, anioAnterior: { fecha: "x", alCorte: 0, final: null }, diferencia: 3, pronostico: null },
    })
  );
  assert.equal(r.demanda, "normal");
  assert.equal(r.confianza, "baja");
});

// Eventos de demanda del copiloto de tarifas: ferias, festivales, recesos y ventanas
// de demanda que no salen del calendario de festivos. Se cargan desde un JSON con
// `npm run copiloto:eventos` (y más adelante desde el dashboard).

const COLECCION_EVENTOS = "copiloto_eventos";
// Impacto sobre el alojamiento, de menor a mayor (escala del estudio de impacto).
const NIVELES_IMPACTO = Object.freeze([
  "bajo",
  "bajo-medio",
  "medio",
  "medio-alto",
  "alto",
  "muy alto",
]);
// evento = algo puntual; ventana = periodo de demanda alta que junta varios eventos.
const TIPOS_EVENTO = Object.freeze(["evento", "ventana"]);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const nivel = (impacto) => NIVELES_IMPACTO.indexOf(impacto);

function slug(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Valida y normaliza un evento del JSON de carga. El id es fecha de inicio + nombre,
// así volver a cargar el mismo archivo actualiza en vez de duplicar.
function normalizarEvento(evento, origen = null) {
  const nombre = String(evento.nombre || "").trim();
  if (!nombre) throw new Error("Hay un evento sin nombre");
  const { desde, hasta } = evento;
  if (!FECHA.test(desde || "") || !FECHA.test(hasta || "") || desde > hasta) {
    throw new Error(`${nombre}: fechas inválidas (${desde} → ${hasta})`);
  }
  const impacto = String(evento.impacto || "").trim().toLowerCase().replace(/_/g, " ");
  if (nivel(impacto) === -1) {
    throw new Error(
      `${nombre}: impacto "${evento.impacto}" no es uno de: ${NIVELES_IMPACTO.join(", ")}`
    );
  }
  const tipo = evento.tipo || "evento";
  if (!TIPOS_EVENTO.includes(tipo)) {
    throw new Error(`${nombre}: tipo "${tipo}" no es uno de: ${TIPOS_EVENTO.join(", ")}`);
  }
  return {
    _id: `${desde}:${slug(nombre)}`,
    nombre,
    desde,
    hasta,
    impacto,
    tipo,
    categoria: evento.categoria || null,
    estado: evento.estado || null,
    observaciones: evento.observaciones || null,
    fuente: evento.fuente || null,
    origen,
  };
}

async function guardarEventos(db, eventos, ahora = new Date()) {
  if (eventos.length === 0) return { insertados: 0, actualizados: 0 };
  const resultado = await db.collection(COLECCION_EVENTOS).bulkWrite(
    eventos.map(({ _id, ...datos }) => ({
      updateOne: {
        filter: { _id },
        update: { $set: { ...datos, actualizadoEn: ahora }, $setOnInsert: { creadoEn: ahora } },
        upsert: true,
      },
    }))
  );
  return { insertados: resultado.upsertedCount, actualizados: resultado.modifiedCount };
}

// Eventos que tocan `dia`, del de mayor impacto al de menor.
function eventosDelDia(eventos, dia) {
  return eventos
    .filter((e) => e.desde <= dia && dia <= e.hasta)
    .map(({ nombre, impacto, tipo }) => ({ nombre, impacto, tipo: tipo || "evento" }))
    .sort((a, b) => nivel(b.impacto) - nivel(a.impacto));
}

function impactoMaximo(eventos) {
  return eventos.reduce(
    (max, e) => (max === null || nivel(e.impacto) > nivel(max) ? e.impacto : max),
    null
  );
}

module.exports = {
  COLECCION_EVENTOS,
  NIVELES_IMPACTO,
  eventosDelDia,
  guardarEventos,
  impactoMaximo,
  normalizarEvento,
};

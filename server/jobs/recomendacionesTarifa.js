require("dotenv").config({ quiet: true });

// Recomendaciones del copiloto de tarifas por día.
//   npm run copiloto:recomendaciones -- [--dias=60] [--json]
// Guardarlas en copiloto_recomendaciones (lo corre el cron todos los días):
//   npm run copiloto:guardar
// Prueba hacia atrás: corre "como si fuera" una fecha pasada y compara con lo que pasó.
//   npm run copiloto:recomendaciones -- --corte=2026-09-01 --dias=30

const mongoose = require("mongoose");
const { getDb } = require("../db");
const {
  generarRecomendaciones,
  guardarRecomendaciones,
} = require("../services/recomendacionesTarifa");

function valorArgumento(nombre) {
  const prefijo = `--${nombre}=`;
  const argumento = process.argv.find((item) => item.startsWith(prefijo));
  return argumento ? argumento.slice(prefijo.length) : null;
}

const conSigno = (n) => (n > 0 ? `+${n}` : String(n));
const ACCIONES = { subir: "↑", bajar: "↓", mantener: "=" };

function accionCorta(r) {
  return r.pct === 0 ? "=" : `${ACCIONES[r.accion]}${Math.abs(r.pct)}%`;
}

function fila(s, r, historico) {
  const cot = s.ocupacion.cotizadas ? ` c${s.ocupacion.cotizadas}` : "";
  const precio = r.datos.diferenciaPct === null ? "—" : `${conSigno(r.datos.diferenciaPct)}%`;
  const columnas = [
    `${s.diaSemana} ${s.dia.slice(5)}`.padEnd(10),
    s.calendario.tipo.replaceAll("_", " ").padEnd(13),
    `${s.ocupacion.proyectada}${cot}`.padEnd(7),
    String(r.datos.esperada).padStart(4),
  ];
  if (historico) {
    columnas.push(String(s.resultado?.ocupacion ?? "—").padStart(4));
  }
  columnas.push(
    precio.padStart(6),
    accionCorta(r).padEnd(5),
    r.confianza.padEnd(6),
    r.motivo
  );
  return columnas.join(" ");
}

function promedio(valores) {
  return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
}

function resumenHistorico(pares, objetivo) {
  const conResultado = pares.filter(({ s }) => s.resultado);
  const errores = conResultado
    .filter(({ s }) => s.ritmo.pronostico !== null)
    .map(({ s }) => s.ritmo.pronostico - s.resultado.ocupacion);
  const lineas = [
    `Días con resultado: ${conResultado.length}`,
    `Pronóstico vs real: error medio ${promedio(errores.map(Math.abs))?.toFixed(1) ?? "—"} habitaciones,` +
      ` sesgo ${promedio(errores)?.toFixed(1) ?? "—"} (positivo = el pronóstico se pasó)`,
  ];
  for (const accion of ["subir", "mantener", "bajar"]) {
    const grupo = conResultado.filter(({ r }) => r.accion === accion);
    if (!grupo.length) continue;
    const reales = grupo.map(({ s }) => s.resultado.ocupacion);
    const llegaron = reales.filter((o) => o >= objetivo).length;
    lineas.push(
      `${accion.padEnd(8)} ${String(grupo.length).padStart(2)} días · ocupación real media ` +
        `${promedio(reales).toFixed(1)} · llegaron al objetivo ${llegaron}/${grupo.length}`
    );
  }
  return lineas.join("\n");
}

async function main() {
  const dias = Number(valorArgumento("dias") || 60);
  const corte = valorArgumento("corte");
  const db = await getDb();
  const senales = await generarRecomendaciones(db, { dias, corte });
  const pares = senales.dias.map((s, i) => ({ s, r: senales.recomendaciones[i] }));

  if (process.argv.includes("--guardar")) {
    const { insertadas, actualizadas } = await guardarRecomendaciones(db, senales);
    const cuenta = (accion) => senales.recomendaciones.filter((r) => r.accion === accion).length;
    console.log(
      `${new Date().toISOString()} copiloto ${senales.hoy}: ${senales.recomendaciones.length} fechas ` +
        `(subir ${cuenta("subir")}, mantener ${cuenta("mantener")}, bajar ${cuenta("bajar")}); ` +
        `${insertadas} nuevas, ${actualizadas} actualizadas`
    );
    return;
  }

  if (process.argv.includes("--json")) {
    const { dias: _senales, ...resto } = senales;
    console.log(JSON.stringify(resto, null, 2));
    return;
  }

  const { historico } = senales;
  console.log(
    `Copiloto de tarifas · ${historico ? `PRUEBA HACIA ATRÁS al ${senales.hoy}` : `hoy ${senales.hoy}`}` +
      ` · capturas: ${senales.capturas.join(", ") || "ninguna"}` +
      (senales.tendencia
        ? ` · tendencia ×${senales.tendencia.factor} (${senales.tendencia.reservasEsteAnio} reservas` +
          ` nuevas en 28 días vs ${senales.tendencia.reservasAnioPasado} el año pasado)`
        : "")
  );
  const encabezado = ["Fecha".padEnd(10), "Tipo".padEnd(13), "Ocup".padEnd(7), "Esp".padStart(4)];
  if (historico) encabezado.push("Real".padStart(4));
  encabezado.push("Precio".padStart(6), "Acc".padEnd(5), "Conf".padEnd(6), "Motivo");
  console.log(encabezado.join(" "));
  for (const { s, r } of pares) console.log(fila(s, r, historico));

  const cuenta = (accion) => pares.filter(({ r }) => r.accion === accion).length;
  console.log(
    `\nSubir ${cuenta("subir")} · mantener ${cuenta("mantener")} · bajar ${cuenta("bajar")}` +
      ` · confianza alta ${pares.filter(({ r }) => r.confianza === "alta").length}`
  );
  if (historico) console.log(resumenHistorico(pares, senales.dias[0]?.ocupacion.objetivo ?? 22));
  console.log(
    "\nOcup: habitaciones en libros (c = en cotización). Esp: habitaciones esperadas al cierre" +
      " sin contar cotizaciones. Precio: Booking propio con IVA vs mediana de la competencia."
  );
}

main()
  .catch((error) => {
    console.error("Error calculando recomendaciones:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });

require("dotenv").config({ quiet: true });

// Imprime las señales del copiloto de tarifas por día, para revisarlas a mano.
//   npm run copiloto:senales -- [--dias=60] [--json]

const mongoose = require("mongoose");
const { getDb } = require("../db");
const { NIVELES_IMPACTO } = require("../services/eventosCopiloto");
const { obtenerSenalesTarifa } = require("../services/senalesTarifa");

function valorArgumento(nombre) {
  const prefijo = `--${nombre}=`;
  const argumento = process.argv.find((item) => item.startsWith(prefijo));
  return argumento ? argumento.slice(prefijo.length) : null;
}

const miles = (valor) => (valor == null ? "—" : `${Math.round(valor / 1000)}k`);
const conSigno = (n) => (n > 0 ? `+${n}` : String(n));
const TIPOS = {
  laboral: "laboral",
  fin_de_semana: "finde",
  domingo: "domingo",
  festivo: "festivo",
  puente: "PUENTE",
  fin_puente: "fin puente",
  semana_santa: "S. SANTA",
};

function fila(s) {
  const { ritmo, pickup, tarifaVendida, historia, competencia, rango, calendario } = s;
  const comp = competencia
    ? `${miles(competencia.precioPropio)} vs ${miles(competencia.mediana)}` +
      (competencia.diferenciaPct == null ? "" : ` (${conSigno(competencia.diferenciaPct)}%)`) +
      ` n=${competencia.comparables} ${competencia.antiguedadDias}d`
    : "";
  // Eventos de impacto medio o más; las ventanas del estudio solo suben el máximo.
  const eventos = calendario.eventos
    .filter((e) => e.tipo === "evento" && NIVELES_IMPACTO.indexOf(e.impacto) >= NIVELES_IMPACTO.indexOf("medio"))
    .map((e) => e.nombre);
  const impacto = calendario.impactoEventos ? `[${calendario.impactoEventos}]` : "";
  const notas = [calendario.festivo, impacto, eventos.join(", ")].filter(Boolean).join(" ");
  return [
    `${s.diaSemana} ${s.dia.slice(5)}`.padEnd(10),
    (TIPOS[calendario.tipo] || calendario.tipo).padEnd(10),
    `${s.ocupacion.proyectada}/${s.ocupacion.objetivo}`.padStart(5),
    (s.ocupacion.grupos ? String(s.ocupacion.grupos) : "").padStart(3),
    (s.ocupacion.cotizadas ? String(s.ocupacion.cotizadas) : "").padStart(3),
    `${ritmo.actual} vs ${ritmo.anioAnterior.alCorte}→${ritmo.anioAnterior.final ?? "—"}`.padEnd(11),
    String(ritmo.pronostico ?? "—").padStart(4),
    `${conSigno(pickup.actual)}/${conSigno(pickup.anioAnterior)}`.padEnd(7),
    `${miles(tarifaVendida.promedio)}/${miles(tarifaVendida.doble.promedio)}`.padEnd(10),
    `${miles(historia.adr)} ${historia.ocupacionPct ?? "—"}%`.padEnd(10),
    `${miles(rango?.piso)}–${miles(rango?.techo)}`.padEnd(10),
    comp.padEnd(30),
    notas,
  ].join(" ");
}

async function main() {
  const dias = Number(valorArgumento("dias") || 60);
  const db = await getDb();
  const resultado = await obtenerSenalesTarifa(db, { dias });

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(resultado, null, 2));
    return;
  }

  console.log(
    `Señales del copiloto · hoy ${resultado.hoy} · objetivo ${resultado.objetivoPct}% · ` +
      `capturas: ${resultado.capturas.join(", ") || "ninguna"}`
  );
  console.log(
    [
      "Fecha".padEnd(10),
      "Tipo".padEnd(10),
      "Ocup".padStart(5),
      "Grp".padStart(3),
      "Cot".padStart(3),
      "Hoy vs AA".padEnd(11),
      "Pron".padStart(4),
      "Pick7".padEnd(7),
      "Vend/dob".padEnd(10),
      "Hist AA".padEnd(10),
      "Piso–techo".padEnd(10),
      "Booking propio vs mediana".padEnd(30),
      "Notas",
    ].join(" ")
  );
  for (const s of resultado.dias) console.log(fila(s));
  console.log(
    "\nGrp: habitaciones de reservas de 5+ habitaciones. Cot: habitaciones en cotización (estado 11)." +
      " Hoy vs AA: habitaciones en libros hoy vs el mismo día de la semana del año pasado a esta" +
      " altura → cómo cerró. Pron: hoy + lo que entró el año pasado desde aquí." +
      "\nPick7: neto de los últimos 7 días (hoy/AA). Vend/dob: tarifa promedio en libros, total y" +
      " doble. Hist AA: tarifa cobrada y ocupación en días equivalentes del año pasado." +
      "\nPrecios con IVA. El de Booking es el visto desde EE. UU."
  );
}

main()
  .catch((error) => {
    console.error("Error calculando señales:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });

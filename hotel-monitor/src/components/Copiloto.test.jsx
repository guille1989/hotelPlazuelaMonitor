import { fireEvent, render, screen, within } from "@testing-library/react";
import axios from "axios";
import Copiloto from "./Copiloto";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

// Recomendación con la forma de GET /api/recomendaciones; `cambios` pisa campos.
function rec(dia, diasHasta, cambios = {}) {
  const { senal = {}, datos = {}, ...resto } = cambios;
  return {
    dia,
    accion: "subir",
    pct: 5,
    confianza: "media",
    demanda: "alta",
    posicion: "sin_dato",
    regla: "matriz",
    limite: null,
    alertas: [],
    motivo: "Esperadas 24/29 (objetivo 22), igual que el año pasado a esta altura. Sin precio de competencia para esta fecha",
    versionReglas: "1",
    yaAplicada: null,
    ...resto,
    datos: {
      esperada: 24,
      firme: 10,
      libres: 19,
      precioPropioConIva: null,
      mediana: null,
      diferenciaPct: null,
      ...datos,
    },
    senal: {
      diasHasta,
      calendario: { tipo: "laboral", festivo: null, impactoEventos: null, eventos: [] },
      ocupacion: { proyectada: 10, pct: 34, objetivo: 22, grupos: 0, cotizadas: 0 },
      ritmo: { actual: 10, alCorteAA: 10, finalAA: 24, diferencia: 0, pronostico: 24, pickupEsperado: 14, diasReferencia: 5 },
      tarifaVendida: { promedio: 180000, habitaciones: 10, doble: { promedio: 170000, habitaciones: 4 } },
      competencia: null,
      rango: { piso: 107000, techo: 226000, origen: "historico" },
      ...senal,
    },
  };
}

const respuesta = {
  data: {
    hoy: "2026-10-04",
    historico: false,
    objetivoPct: 75,
    capturas: ["2026-10-03"],
    tendencia: { factor: 1 },
    recomendaciones: [
      rec("2026-10-05", 1),
      rec("2026-10-12", 8, {
        accion: "mantener",
        pct: 0,
        senal: { calendario: { tipo: "fin_puente", festivo: "Día de la Raza", impactoEventos: "muy alto", eventos: ["Ventana de demanda"] } },
      }),
      rec("2026-10-17", 13, {
        pct: 10,
        confianza: "alta",
        posicion: "barato",
        motivo: "Esperadas 22/29 (objetivo 22), igual que el año pasado a esta altura. Booking 121k con IVA vs 154k de la competencia (-21 %)",
        datos: { esperada: 22, precioPropioConIva: 121053, mediana: 154000, diferenciaPct: -21 },
        senal: {
          ocupacion: { proyectada: 3, pct: 10, objetivo: 22, grupos: 0, cotizadas: 0 },
          competencia: { capturedDate: "2026-10-03", antiguedadDias: 1, precioPropio: 101725, mediana: 154000, comparables: 3 },
        },
      }),
      rec("2026-10-20", 16, {
        yaAplicada: { en: "2026-10-03T15:00:00.000Z", corrida: "2026-10-03", accion: "subir", pct: 5 },
      }),
      rec("2026-11-13", 40, {
        accion: "mantener",
        pct: 0,
        confianza: "baja",
        alertas: ["cotizacion"],
        senal: { ocupacion: { proyectada: 29, pct: 100, objetivo: 22, grupos: 27, cotizadas: 27 } },
      }),
    ],
  },
};

afterEach(() => {
  jest.clearAllMocks();
});

test("lista lo que hay que revisar por tramos, con la acción y la confianza", async () => {
  axios.get.mockResolvedValue(respuesta);
  render(<Copiloto objetivo={75} />);

  expect(await screen.findByRole("heading", { name: "3 fechas para revisar" })).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/recomendaciones?dias=60&objetivo=75"));
  expect(screen.getByText("Calculado dom 4 oct · competencia del sáb 3 oct")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Para revisar (3)" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("1 ya aplicada: están en \"Todas\".")).toBeInTheDocument();

  expect(screen.getByRole("heading", { name: "Próximos 7 días" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "En 8 a 14 días" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "En 15 a 30 días" })).not.toBeInTheDocument();

  const sabado = screen.getByRole("button", { name: /Sáb 17 oct/ });
  expect(within(sabado).getByText("↑ 10%")).toBeInTheDocument();
  expect(within(sabado).getByText("confianza alta")).toBeInTheDocument();
  expect(screen.getByText("3 reservadas · se esperan 22 de 29 · Booking −21%")).toBeInTheDocument();

  // Lleno, pero con una cotización de 27: la tarea es confirmar el grupo.
  const grupo = screen.getByRole("button", { name: /Vie 13 nov/ });
  expect(within(grupo).getByText("Confirmar grupo")).toBeInTheDocument();
  expect(screen.getByText(/27 en cotización/)).toBeInTheDocument();

  // Mantener y las ya aplicadas solo aparecen en "Todas".
  expect(screen.queryByRole("button", { name: /Lun 12 oct/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Todas (5)" }));
  const festivo = screen.getByRole("button", { name: /Lun 12 oct/ });
  expect(within(festivo).getByText("Mantener")).toBeInTheDocument();
  expect(within(festivo).getByText("Fin de puente")).toBeInTheDocument();
  expect(within(screen.getByRole("button", { name: /Mar 20 oct/ })).getByText("✓ Aplicada")).toBeInTheDocument();
});

test("el detalle explica la recomendación y permite marcarla como aplicada", async () => {
  axios.get.mockResolvedValue(respuesta);
  axios.post.mockResolvedValue({
    data: { aplicada: { en: "2026-10-04T16:00:00.000Z", corrida: "2026-10-04", accion: "subir", pct: 10 } },
  });
  render(<Copiloto objetivo={75} />);

  const sabado = await screen.findByRole("button", { name: /Sáb 17 oct/ });
  fireEvent.click(sabado);
  expect(sabado).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText(/Booking 121k con IVA vs 154k de la competencia/)).toBeInTheDocument();
  expect(screen.getByText(/\$\s?121\.053 vs \$\s?154\.000 · 3 hoteles, captura sáb 3 oct/)).toBeInTheDocument();
  expect(screen.getByText("10 a esta altura · cerró en 24")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Ya cambié el precio en Booking" }));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/recomendaciones/aplicada"), {
    dia: "2026-10-17",
    accion: "subir",
    pct: 10,
  });
  // Queda a la vista con su marca para poder deshacer.
  expect(await screen.findByText(/Aplicada el dom 4 oct: subir 10%/)).toBeInTheDocument();
  expect(within(sabado).getByText("✓ Aplicada")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "2 fechas para revisar" })).toBeInTheDocument();

  axios.delete.mockResolvedValue({ data: { desmarcadas: 1 } });
  fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
  expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining("/api/recomendaciones/aplicada/2026-10-17"));
  expect(await within(sabado).findByText("↑ 10%")).toBeInTheDocument();
});

test("marca el precio estimado con fechas vecinas", async () => {
  axios.get.mockResolvedValue({
    data: {
      ...respuesta.data,
      recomendaciones: [
        rec("2026-10-14", 10, {
          pct: 10,
          datos: { precioPropioConIva: 121053, mediana: 154576, diferenciaPct: -22, precioEstimado: true },
          senal: {
            competencia: {
              capturedDate: "2026-10-03",
              antiguedadDias: 1,
              precioPropio: 101725,
              mediana: 154576,
              comparables: 3,
              estimado: true,
              entre: ["2026-10-10", "2026-10-17"],
            },
          },
        }),
      ],
    },
  });
  render(<Copiloto objetivo={75} />);

  expect(await screen.findByText("10 reservadas · se esperan 24 de 29 · Booking ≈−22%")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Mié 14 oct/ }));
  expect(
    screen.getByText(/≈ \$\s?121\.053 vs ≈ \$\s?154\.576 · estimado con las noches del sáb 10 oct y el sáb 17 oct/)
  ).toBeInTheDocument();
});

test("avisa si no se pudo guardar la marca", async () => {
  axios.get.mockResolvedValue(respuesta);
  axios.post.mockRejectedValue(new Error("red"));
  render(<Copiloto objetivo={75} />);

  fireEvent.click(await screen.findByRole("button", { name: /Lun 5 oct/ }));
  fireEvent.click(screen.getByRole("button", { name: "Ya cambié el precio en Booking" }));
  expect(await screen.findByText("No se pudo guardar. Intenta de nuevo.")).toBeInTheDocument();
});

test("en el computador el detalle va en un panel al lado de la lista", async () => {
  const original = window.matchMedia;
  window.matchMedia = jest.fn(() => ({
    matches: true,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
  try {
    axios.get.mockResolvedValue(respuesta);
    render(<Copiloto objetivo={75} />);

    // Sin tocar nada, el panel muestra la primera fecha para revisar.
    const panel = await screen.findByRole("complementary", { name: "Detalle del Lun 5 oct" });
    expect(within(panel).getByRole("button", { name: "Ya cambié el precio en Booking" })).toBeInTheDocument();

    const sabado = screen.getByRole("button", { name: /Sáb 17 oct/ });
    expect(sabado).not.toHaveAttribute("aria-expanded");
    fireEvent.click(sabado);
    expect(sabado).toHaveAttribute("aria-current", "true");
    const nuevo = screen.getByRole("complementary", { name: "Detalle del Sáb 17 oct" });
    expect(within(nuevo).getByText(/Booking 121k con IVA vs 154k/)).toBeInTheDocument();
  } finally {
    window.matchMedia = original;
  }
});

test("sin cambios recomendados lo dice", async () => {
  axios.get.mockResolvedValue({
    data: { ...respuesta.data, recomendaciones: [rec("2026-10-12", 8, { accion: "mantener", pct: 0 })] },
  });
  render(<Copiloto objetivo={75} />);

  expect(await screen.findByRole("heading", { name: "Nada que cambiar por ahora" })).toBeInTheDocument();
  expect(screen.getByText(/No hay cambios recomendados/)).toBeInTheDocument();
});

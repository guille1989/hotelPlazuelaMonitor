import { fireEvent, render, screen, within } from "@testing-library/react";
import axios from "axios";
import Tarifas, { Competencia } from "./Tarifas";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const hotel = (hotelId, nombre, precio, extras = {}) => ({
  hotelId,
  nombre,
  grupo: "directo",
  propio: false,
  estado: precio === null ? "sin_precio" : "comparable",
  precio,
  habitacion: precio === null ? null : "Doble",
  cancelacionGratis: precio === null ? null : true,
  desayuno: null,
  motivos: [],
  error: precio === null ? "sin_precio_publicado" : null,
  ...extras,
});

// Captura real del 3-oct-2026 (recortada a dos fechas).
const respuesta = {
  data: {
    ejecucion: {
      id: "serpapi:2026-10-03",
      capturedDate: "2026-10-03",
      status: "parcial",
      summary: { esperadas: 14, comparables: 9 },
    },
    objetivoPct: 75,
    totalHabitaciones: 29,
    umbralAlertaPct: 15,
    diasAlerta: 30,
    fechas: [
      {
        dia: "2026-10-10",
        diasHasta: 7,
        ocupacion: { habitaciones: 5, pct: 17 },
        precioPropio: 101725,
        propioComparable: true,
        mediana: 155152,
        comparables: 3,
        minimo: 90000,
        maximo: 180000,
        diferenciaPct: -34,
        posicion: { lugar: 2, de: 4 },
        alerta: null,
        hoteles: [
          hotel("hotel-santa-marta-centro-historico", "Santa Marta", 90000),
          hotel("hotel-la-plazuela", "La Plazuela", 101725, { propio: true, grupo: "propio" }),
          hotel("hotel-la-herreria-colonial", "Herrería Colonial", 154000, {
            estado: "no_comparable",
            motivos: ["cancelacion_no_confirmada"],
          }),
          hotel("hotel-popayan-plaza", "Popayán Plaza", 155152),
          hotel("hotel-colonial-popayan", "Colonial", 180000),
          hotel("hotel-camino-real-popayan", "Camino Real", null),
          hotel("hotel-los-portales-inn", "Los Portales Inn", null, {
            error: "sin_precio_booking",
          }),
        ],
      },
      {
        dia: "2026-11-02",
        diasHasta: 30,
        ocupacion: { habitaciones: 2, pct: 7 },
        precioPropio: 221142,
        propioComparable: true,
        mediana: 154576,
        comparables: 4,
        minimo: 94500,
        maximo: 180000,
        diferenciaPct: 43,
        posicion: { lugar: 5, de: 5 },
        alerta: "caro_vacio",
        hoteles: [
          hotel("hotel-santa-marta-centro-historico", "Santa Marta", 94500),
          hotel("hotel-la-plazuela", "La Plazuela", 221142, { propio: true, grupo: "propio" }),
        ],
      },
    ],
  },
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  jest.clearAllMocks();
});

test("muestra cada fecha con su precio y la diferencia con la mediana", async () => {
  axios.get.mockResolvedValue(respuesta);
  render(<Competencia objetivo={75} />);

  expect(
    await screen.findByRole("heading", { name: "Tu tarifa frente a 6 directos" })
  ).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/tarifas?objetivo=75"));
  // Los avisos "caro y vacío / barato y lleno" los reemplaza el copiloto.
  expect(screen.queryByText("Caro y vacío")).not.toBeInTheDocument();

  const sabado = screen.getByRole("button", { name: /Sáb 10 oct/ });
  expect(within(sabado).getByText("D+7 · ocupación 17%")).toBeInTheDocument();
  expect(within(sabado).getByText("−34%")).toBeInTheDocument();
  expect(screen.getByText(/Mediana \$\s?155\.152 · 2\.º más barato de 4/)).toBeInTheDocument();
  expect(screen.getByText(/el más caro de 5/)).toBeInTheDocument();
});

test("al tocar una fecha muestra los hoteles, incluidos los que no tienen precio", async () => {
  axios.get.mockResolvedValue(respuesta);
  render(<Competencia objetivo={75} />);

  const sabado = await screen.findByRole("button", { name: /Sáb 10 oct/ });
  expect(sabado).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("Camino Real")).not.toBeInTheDocument();

  fireEvent.click(sabado);
  expect(sabado).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Camino Real")).toBeInTheDocument();
  expect(screen.getByText("sin Booking")).toBeInTheDocument();
  // El motivo se lee en la fila (en el celular no hay tooltip).
  expect(screen.getByText("sin cancelación gratis")).toBeInTheDocument();
});

// La pestaña pide recomendaciones o competencia según la subvista elegida.
const responderPorRuta = () =>
  axios.get.mockImplementation((url) =>
    Promise.resolve(
      url.includes("/api/recomendaciones")
        ? { data: { hoy: "2026-10-04", capturas: [], recomendaciones: [] } }
        : respuesta
    )
  );

test("abre en las recomendaciones y recuerda si se cambia a la competencia", async () => {
  responderPorRuta();
  render(<Tarifas />);

  expect(await screen.findByText("Copiloto de tarifas")).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/recomendaciones"));
  expect(screen.getByRole("tab", { name: "Recomendaciones" })).toHaveAttribute("aria-selected", "true");

  fireEvent.click(screen.getByRole("tab", { name: "Competencia" }));
  expect(
    await screen.findByRole("heading", { name: "Tu tarifa frente a 6 directos" })
  ).toBeInTheDocument();
  expect(window.localStorage.getItem("tarifasSubvista")).toBe("competencia");
});

test("comparte el objetivo de ocupación con Pickup en las dos subvistas", async () => {
  window.localStorage.setItem("pickupObjetivoOcupacion", "85");
  window.localStorage.setItem("tarifasSubvista", "competencia");
  responderPorRuta();
  render(<Tarifas />);

  await screen.findByRole("heading", { name: "Tu tarifa frente a 6 directos" });
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/tarifas?objetivo=85"));

  fireEvent.change(screen.getByRole("combobox"), { target: { value: "70" } });
  fireEvent.click(screen.getByRole("tab", { name: "Recomendaciones" }));
  await screen.findByText("Copiloto de tarifas");
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/recomendaciones?dias=60&objetivo=70"));
  expect(window.localStorage.getItem("pickupObjetivoOcupacion")).toBe("70");
});

test("sin capturas lo dice en vez de mostrar una lista vacía", async () => {
  axios.get.mockResolvedValue({ data: { ejecucion: null, objetivoPct: 75, fechas: [] } });
  render(<Competencia objetivo={75} />);

  expect(await screen.findByText("Todavía no hay capturas de tarifas.")).toBeInTheDocument();
});

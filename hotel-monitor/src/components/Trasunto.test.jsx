import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import Trasunto from "./Trasunto";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const respuesta = {
  data: {
    mes: "2026-09",
    hoy: "2026-09-03",
    totalHabitaciones: 29,
    fechaCorte: "2026-09-01",
    acumulado: {
      dias: 1,
      habitacionesNoche: 15,
      ocupacionPct: 51.7,
      ventaHabitaciones: 1867126,
      tarifaPromedio: 64384,
      iva: 177358,
      restaurante: 0,
      desayunos: 128000,
      lavanderia: 0,
      ventasTotales: 2172484,
    },
    dias: [
      {
        dia: "2026-09-01",
        estado: "cerrado",
        habitaciones: 15,
        ocupacionPct: 51.7,
        ventaHabitaciones: 1867126,
        tarifaPromedio: 64384,
        iva: 177358,
        restaurante: 0,
        desayunos: 128000,
        lavanderia: 0,
        ventasTotales: 2172484,
      },
      { dia: "2026-09-02", estado: "pendiente" },
      { dia: "2026-09-03", estado: "futuro" },
    ],
  },
};

afterEach(() => {
  jest.clearAllMocks();
});

test("muestra el total del mes, los días cerrados y los pendientes", async () => {
  axios.get.mockResolvedValue(respuesta);
  render(<Trasunto />);

  expect(await screen.findByText("1 día cerrado · hasta el 1 de septiembre")).toBeInTheDocument();
  expect(screen.getAllByText("2.172.484").length).toBe(2); // día 1 y columna Total
  // Días en columnas: el 1 (cerrado) y el 2 (pendiente); el 3 es futuro y no se lista.
  expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
    "Día",
    "1",
    "2",
    "Total",
  ]);
  expect(screen.getAllByTitle("Pendiente de la auditoría nocturna")).toHaveLength(8);
  expect(screen.getAllByRole("row")).toHaveLength(9); // encabezado + 8 rubros
});

test("el botón de mes anterior pide el mes anterior", async () => {
  axios.get.mockResolvedValue(respuesta);
  render(<Trasunto />);
  await screen.findByText(/día cerrado/);

  const primeraUrl = axios.get.mock.calls[0][0];
  fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));

  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  const [, mes] = primeraUrl.match(/mes=(\d{4}-\d{2})/);
  const [y, m] = mes.split("-").map(Number);
  const anterior = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  expect(axios.get.mock.calls[1][0]).toContain(`mes=${anterior}`);
  expect(screen.getByRole("button", { name: "Mes siguiente" })).not.toBeDisabled();
});

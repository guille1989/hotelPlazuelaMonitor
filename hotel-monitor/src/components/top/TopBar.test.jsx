import { fireEvent, render, screen } from "@testing-library/react";
import axios from "axios";
import TopBar from "./TopBar";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe("toggle de vistas de TopBar", () => {
  beforeEach(() => {
    axios.get.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("incluye Hoy como primera opción", async () => {
    render(<TopBar vista="hoy" onVista={jest.fn()} />);
    await screen.findByText("Monitor de Ocupación");

    const etiquetas = screen
      .getAllByRole("button")
      .map((button) => button.textContent);

    expect(etiquetas).toEqual(["Hoy", "Mes", "Resumen", "Pickup"]);
    expect(screen.getByRole("button", { name: "Hoy" })).toHaveClass("activo");
  });

  test("selecciona la vista Hoy al pulsar su botón", async () => {
    const onVista = jest.fn();
    render(<TopBar vista="mes" onVista={onVista} />);
    await screen.findByText("Monitor de Ocupación");

    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));

    expect(onVista).toHaveBeenCalledTimes(1);
    expect(onVista).toHaveBeenCalledWith("hoy");
  });
});

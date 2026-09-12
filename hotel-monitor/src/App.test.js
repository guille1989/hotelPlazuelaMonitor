import { act, fireEvent, render, screen } from "@testing-library/react";
import axios from "axios";
import App from "./App";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: [] })),
  },
}));

jest.mock("./components/top/TopBar", () => ({ vista, onVista }) => (
  <nav aria-label="Vistas">
    {["hoy", "mes", "resumen", "pickup"].map((id) => (
      <button key={id} onClick={() => onVista(id)}>
        {id}
      </button>
    ))}
    <span data-testid="vista-activa">{vista}</span>
  </nav>
));

jest.mock("./components/statcard/StatCard", () => ({ label, value }) => (
  <div>
    <span>{label}</span>
    <span>{value}</span>
  </div>
));

jest.mock("./components/linechart/OcupacionMes", () => () => (
  <div data-testid="ocupacion-mes" />
));
jest.mock("./components/linechart/ResumenPeriodo", () => () => null);
jest.mock("./components/Pickup", () => () => null);
jest.mock("./components/CanalesTorta", () => () => null);

describe("navegación de vistas", () => {
  beforeEach(() => {
    axios.get.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderApp = async () => {
    await act(async () => {
      render(<App />);
    });
  };

  test("Hoy es la vista inicial y muestra sus indicadores", async () => {
    await renderApp();

    expect(screen.getByTestId("vista-activa")).toHaveTextContent("hoy");
    expect(screen.getByText("Ocupación actual")).toBeInTheDocument();
    expect(screen.getByText("Ocupación proyectada")).toBeInTheDocument();
    expect(screen.getByText("Huéspedes")).toBeInTheDocument();
    expect(screen.getByText("Canceladas")).toBeInTheDocument();
  });

  test("permite volver a Hoy después de navegar a Mes", async () => {
    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "mes" }));
    expect(screen.getByTestId("vista-activa")).toHaveTextContent("mes");
    expect(screen.getByText("Ocupación media")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "hoy" }));
    expect(screen.getByTestId("vista-activa")).toHaveTextContent("hoy");
    expect(screen.getByText("Ocupación actual")).toBeInTheDocument();
  });

  test("calcula los indicadores de Hoy con reservas y cancelaciones", async () => {
    axios.get.mockImplementation((url) => {
      if (url.endsWith("/api/reservas")) {
        return Promise.resolve({
          data: [
            {
              cantid_reh: "2",
              estado_habitacion: "31",
              adultos: "2",
              ninos: "1",
              valor_habitacion: "100000",
            },
            {
              cantid_reh: "1",
              estado_habitacion: "21",
              adultos: "1",
              ninos: "0",
              valor_habitacion: "200000",
            },
            {
              cantid_reh: null,
              estado_habitacion: null,
              origen: "Sin reserva",
              adultos: "2",
              ninos: "0",
              valor_habitacion: "0",
            },
          ],
        });
      }

      return Promise.resolve({
        data: [{ cantid_reh: "2" }, { cantid_reh: null }],
      });
    });

    await renderApp();

    expect(screen.getByText("10.34%")).toBeInTheDocument();
    expect(screen.getByText("13.79%")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Tarifa media diaria")).toBeInTheDocument();
    expect(screen.getByText("Tarifa promedio")).toBeInTheDocument();
    expect(screen.getByText("Total tarifas")).toBeInTheDocument();
    expect(screen.getByText(/133\.333/)).toBeInTheDocument();
    expect(screen.getByText(/13\.793/)).toBeInTheDocument();
    expect(screen.getByText(/400\.000/)).toBeInTheDocument();
  });
});

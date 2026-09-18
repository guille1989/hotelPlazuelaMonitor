import { render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import OcupacionMes from "./OcupacionMes";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock("recharts", () => {
  const React = require("react");
  const Contenedor = ({ children }) => <div>{children}</div>;
  const Grafica = ({ children, data }) => (
    <div>
      <output data-testid="datos-grafica">{JSON.stringify(data)}</output>
      <svg>{children}</svg>
    </div>
  );
  const Serie = ({ dataKey }) => <g data-testid={`serie-${dataKey}`} />;
  const Vacio = () => null;

  return {
    ResponsiveContainer: Contenedor,
    ComposedChart: Grafica,
    Area: Serie,
    Line: Serie,
    CartesianGrid: Vacio,
    ReferenceLine: Vacio,
    XAxis: Vacio,
    YAxis: Vacio,
    Tooltip: Vacio,
  };
});

const respuestaMes = {
  data: {
    hoy: "2026-09-17",
    dias: Array.from({ length: 30 }, (_, indice) => ({
      dia: `2026-09-${String(indice + 1).padStart(2, "0")}`,
      ocupacion: 10,
      real: 10,
      proyectada: 12,
      cancelaciones: 0,
      tarifas: 600000,
      habsTarifa: 3,
    })),
  },
};

describe("gráfica de ocupación mensual", () => {
  beforeEach(() => {
    axios.get.mockResolvedValue(respuestaMes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("no incluye el selector de ADR y RevPAR", async () => {
    render(<OcupacionMes />);

    await screen.findByTestId("serie-real");

    expect(
      screen.queryByRole("radio", { name: "ADR / RevPAR" })
    ).not.toBeInTheDocument();
  });

  test("centra automáticamente el día de hoy al cargar la gráfica", async () => {
    const descriptorAncho = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth"
    );
    const descriptorScroll = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollWidth"
    );
    const scrollToOriginal = HTMLElement.prototype.scrollTo;
    const scrollTo = jest.fn();

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 320,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get: () => 1074,
    });
    HTMLElement.prototype.scrollTo = scrollTo;

    try {
      render(<OcupacionMes />);

      await screen.findByTestId("serie-real");
      await waitFor(() => expect(scrollTo).toHaveBeenCalled());

      expect(scrollTo).toHaveBeenLastCalledWith({
        left: 416,
        behavior: "auto",
      });
    } finally {
      if (descriptorAncho) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientWidth",
          descriptorAncho
        );
      } else {
        delete HTMLElement.prototype.clientWidth;
      }
      if (descriptorScroll) {
        Object.defineProperty(
          HTMLElement.prototype,
          "scrollWidth",
          descriptorScroll
        );
      } else {
        delete HTMLElement.prototype.scrollWidth;
      }
      HTMLElement.prototype.scrollTo = scrollToOriginal;
    }
  });
});

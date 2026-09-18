import { fireEvent, render, screen } from "@testing-library/react";
import axios from "axios";
import { MESES } from "../../config";
import ResumenPeriodo from "./ResumenPeriodo";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock("recharts", () => {
  const React = require("react");
  const Contenedor = ({ children }) => <div>{children}</div>;
  const Grafica = ({ children, data }) => (
    <div>
      <output data-testid="datos-resumen">{JSON.stringify(data)}</output>
      <svg>{children}</svg>
    </div>
  );
  const Serie = ({ dataKey, strokeDasharray }) => (
    <g
      data-testid={`serie-${dataKey}`}
      data-stroke-dasharray={strokeDasharray || ""}
    />
  );
  const Vacio = () => null;

  return {
    ResponsiveContainer: Contenedor,
    BarChart: Grafica,
    ComposedChart: Grafica,
    Bar: Serie,
    Line: Serie,
    CartesianGrid: Vacio,
    XAxis: Vacio,
    YAxis: Vacio,
    Tooltip: Vacio,
  };
});

const claveMes = (offset) => {
  const fecha = new Date();
  fecha.setDate(1);
  fecha.setMonth(fecha.getMonth() + offset);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
};

const mesSiguiente = (() => {
  const fecha = new Date();
  fecha.setDate(1);
  fecha.setMonth(fecha.getMonth() + 1);
  return `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
})();

const respuestaPeriodo = {
  data: {
    meses: [
      {
        mes: claveMes(-1),
        dias: 31,
        habNoche: 310,
        tarifas: 3100000,
        habsTarifa: 31,
        checkin: 20,
        reservadas: 8,
        canceladasLlegada: 2,
      },
      {
        mes: claveMes(0),
        dias: 30,
        habNoche: 300,
        tarifas: 4350000,
        habsTarifa: 29,
        checkin: 18,
        reservadas: 10,
        canceladasLlegada: 1,
      },
      {
        mes: claveMes(1),
        dias: 31,
        habNoche: 320,
        tarifas: 5394000,
        habsTarifa: 31,
        checkin: 12,
        reservadas: 16,
        canceladasLlegada: 1,
      },
    ],
  },
};

describe("gráfica de tarifas del resumen", () => {
  beforeEach(() => {
    axios.get.mockResolvedValue(respuestaPeriodo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("cambia de reservas a las líneas de ADR y RevPAR", async () => {
    render(<ResumenPeriodo />);

    expect(await screen.findByTestId("serie-checkin")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Reservas" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "ADR / RevPAR" }));

    expect(screen.getByTestId("serie-adrReal")).toHaveAttribute(
      "data-stroke-dasharray",
      ""
    );
    expect(screen.getByTestId("serie-revparReal")).toHaveAttribute(
      "data-stroke-dasharray",
      ""
    );
    expect(screen.getByTestId("serie-adrFuturo")).toHaveAttribute(
      "data-stroke-dasharray",
      "5 4"
    );
    expect(screen.getByTestId("serie-revparFuturo")).toHaveAttribute(
      "data-stroke-dasharray",
      "5 4"
    );
    expect(screen.getByRole("button", { name: /Comparar/ })).toBeDisabled();
    expect(screen.queryByTestId("serie-checkin")).not.toBeInTheDocument();

    const datos = JSON.parse(screen.getByTestId("datos-resumen").textContent);
    expect(datos[1]).toMatchObject({
      mes: claveMes(0),
      adr: 150000,
      revpar: 5000,
      adrReal: 150000,
      adrFuturo: 150000,
    });
    expect(datos[2]).toMatchObject({
      mes: claveMes(1),
      adrReal: null,
      adrFuturo: 174000,
      revparReal: null,
      revparFuturo: 6000,
    });
    expect(screen.getByText(mesSiguiente)).toBeInTheDocument();
    expect(screen.getByText(/174\.000/)).toBeInTheDocument();
  });
});

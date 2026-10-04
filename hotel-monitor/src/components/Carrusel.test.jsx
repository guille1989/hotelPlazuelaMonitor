import { fireEvent, render, screen } from "@testing-library/react";
import Carrusel from "./Carrusel";

const slides = [
  { titulo: "Ocupación", contenido: <p>tarjetas de ocupación</p> },
  { titulo: "Tarifas e ingresos", contenido: <p>tarjetas de tarifas</p> },
];

const simularPantalla = (escritorio) => {
  window.matchMedia = jest.fn(() => ({
    matches: escritorio,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
};

const original = window.matchMedia;
afterEach(() => {
  window.matchMedia = original;
});

test("en el celular muestra un panel a la vez con flechas", () => {
  simularPantalla(false);
  render(<Carrusel slides={slides} />);

  expect(screen.getByText("tarjetas de ocupación")).toBeInTheDocument();
  expect(screen.queryByText("tarjetas de tarifas")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(screen.getByText("tarjetas de tarifas")).toBeInTheDocument();
});

test("en el computador muestra todos los paneles a la vez, sin flechas", () => {
  simularPantalla(true);
  render(<Carrusel slides={slides} columnasEscritorio={2} />);

  expect(screen.getByText("tarjetas de ocupación")).toBeInTheDocument();
  expect(screen.getByText("tarjetas de tarifas")).toBeInTheDocument();
  expect(screen.getByText("Tarifas e ingresos")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Siguiente" })).not.toBeInTheDocument();
});

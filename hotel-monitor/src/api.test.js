import { apiUrl } from "./api";

describe("apiUrl", () => {
  const anterior = process.env.REACT_APP_API_URL;

  afterEach(() => {
    if (anterior === undefined) delete process.env.REACT_APP_API_URL;
    else process.env.REACT_APP_API_URL = anterior;
  });

  test("usa el mismo dominio cuando no hay origen externo", () => {
    delete process.env.REACT_APP_API_URL;
    expect(apiUrl("/api/reservas")).toBe("/api/reservas");
  });

  test("admite un origen explícito para desarrollo", () => {
    process.env.REACT_APP_API_URL = "http://localhost:5002/";
    expect(apiUrl("api/reservas")).toBe(
      "http://localhost:5002/api/reservas"
    );
  });
});

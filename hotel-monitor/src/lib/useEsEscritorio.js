import { useEffect, useState } from "react";

// Pantalla de computador. Debe coincidir con el @media de index.css que amplía
// --app-max: en el celular la app no cambia.
export const CONSULTA_ESCRITORIO = "(min-width: 1024px)";

const consultar = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(CONSULTA_ESCRITORIO).matches;

// true en pantalla de computador; se actualiza si cambia el ancho de la ventana.
export default function useEsEscritorio() {
  const [esEscritorio, setEsEscritorio] = useState(consultar);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const consulta = window.matchMedia(CONSULTA_ESCRITORIO);
    const alCambiar = () => setEsEscritorio(consulta.matches);
    alCambiar();
    // "resize" además de "change": algunos navegadores (y la emulación de tamaño de
    // las herramientas de desarrollo) no avisan el cambio de la consulta.
    consulta.addEventListener("change", alCambiar);
    window.addEventListener("resize", alCambiar);
    return () => {
      consulta.removeEventListener("change", alCambiar);
      window.removeEventListener("resize", alCambiar);
    };
  }, []);

  return esEscritorio;
}

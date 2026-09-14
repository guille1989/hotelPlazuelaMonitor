// En producción la API vive detrás del mismo Nginx que sirve el dashboard, por
// eso la URL normal es relativa (/api/...). Para un backend externo se puede
// definir REACT_APP_API_URL incluyendo el protocolo, por ejemplo
// http://localhost:5002.
export const apiUrl = (ruta) => {
  const origen = (process.env.REACT_APP_API_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const path = ruta.startsWith("/") ? ruta : `/${ruta}`;
  return `${origen}${path}`;
};

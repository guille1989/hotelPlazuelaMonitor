const GRUPOS = Object.freeze({
  PROPIO: "propio",
  DIRECTO: "directo",
  SUPERIOR: "superior",
  CORPORATIVO: "corporativo",
});

const datosComunes = Object.freeze({
  ciudad: "Popayán",
  departamento: "Cauca",
  pais: "CO",
  activo: true,
  // Identificador de la propiedad en Google Hotels (proveedor serpapi). Se
  // obtiene con `npm run tarifas:serpapi:descubrir`.
  googleHotelsToken: null,
});

const CATALOGO_HOTELES = Object.freeze(
  [
    {
      id: "hotel-la-plazuela",
      nombre: "Hotel La Plazuela",
      googleHotelsToken: "ChkIpp3kudPvvM_3ARoML2cvMWhjMHI3N3Z4EAE",
      grupo: GRUPOS.PROPIO,
      propio: true,
    },
    {
      id: "hotel-camino-real-popayan",
      nombre: "Hotel Camino Real Popayán",
      googleHotelsToken: "ChkIgN-e-d6hndbCARoML2cvMWhmMjJoamJuEAE",
      grupo: GRUPOS.DIRECTO,
    },
    {
      id: "hotel-la-herreria-colonial",
      nombre: "Hotel La Herrería Colonial",
      googleHotelsToken: "ChcIgKKdtOmprrdqGgsvZy8xdGtfcTlzehAB",
      grupo: GRUPOS.DIRECTO,
    },
    {
      id: "hotel-santa-marta-centro-historico",
      nombre: "Hotel Santa Marta Centro Histórico",
      // En Google Hotels figura como "Hotel Santa Marta’s Popayán centro".
      googleHotelsToken: "ChkI56q9qPfS1IVEGg0vZy8xMWtyY25rZGJsEAE",
      grupo: GRUPOS.DIRECTO,
    },
    {
      id: "hotel-popayan-plaza",
      nombre: "Hotel Popayán Plaza",
      googleHotelsToken: "ChcImI_U2dLy_OVMGgsvZy8xdGRkNjlmNRAB",
      grupo: GRUPOS.DIRECTO,
    },
    {
      id: "hotel-colonial-popayan",
      nombre: "Hotel y Restaurante Colonial Popayán",
      // En Google Hotels figura como "Hotel Colonial".
      googleHotelsToken: "ChkIx7uB8tad5c0iGg0vZy8xMWI2Z2dmN2szEAE",
      grupo: GRUPOS.DIRECTO,
    },
    {
      id: "hotel-los-portales-inn",
      nombre: "Hotel Los Portales Inn",
      googleHotelsToken: "ChoIv8H9ndPE6NHOARoNL2cvMTFoMG1zNXZ3cRAB",
      grupo: GRUPOS.DIRECTO,
    },
    {
      id: "casa-loma-hotel-boutique",
      nombre: "Casa Loma Hotel Boutique & Terraza Gastro",
      googleHotelsToken: "ChkIsofeiJjfjrI8Gg0vZy8xMWtqOTNrenpyEAE",
      grupo: GRUPOS.SUPERIOR,
    },
    {
      id: "hotel-boutique-confort-suites",
      nombre: "Hotel Boutique Confort Suites",
      googleHotelsToken: "ChgI5q3F1fTSlIyCARoLL2cvMXRsczN3bTMQAQ",
      grupo: GRUPOS.SUPERIOR,
    },
    {
      id: "hotel-dann-monasterio",
      nombre: "Hotel Dann Monasterio Popayán",
      // En Google Hotels figura como "Hotel Monasterio".
      googleHotelsToken: "ChgI6N7vr9Om1aqHARoLL2cvMXRodmhfMDcQAQ",
      grupo: GRUPOS.SUPERIOR,
    },
    {
      id: "hotel-business-center-popayan",
      nombre: "Hotel Business Center Popayán",
      googleHotelsToken: "ChoIqpy-kcby0drvARoNL2cvMTFqOHZoc2Z6dBAB",
      grupo: GRUPOS.CORPORATIVO,
    },
    {
      id: "hotel-san-martin-popayan",
      nombre: "Hotel San Martín Popayán",
      googleHotelsToken: "ChgI07THhKWA_94aGgwvZy8xaGMxMWdkazAQAQ",
      grupo: GRUPOS.CORPORATIVO,
    },
  ].map((hotel) => Object.freeze({ ...datosComunes, propio: false, ...hotel }))
);

function validarCatalogo(catalogo = CATALOGO_HOTELES) {
  const ids = new Set();
  let propios = 0;

  for (const hotel of catalogo) {
    if (!hotel.id || !hotel.nombre || !hotel.grupo) {
      throw new Error("Cada hotel requiere id, nombre y grupo");
    }
    if (!Object.values(GRUPOS).includes(hotel.grupo)) {
      throw new Error(`Grupo inválido para ${hotel.id}: ${hotel.grupo}`);
    }
    if (ids.has(hotel.id)) throw new Error(`Hotel duplicado: ${hotel.id}`);
    ids.add(hotel.id);
    if (hotel.propio) propios += 1;
  }

  if (propios !== 1) {
    throw new Error(`El catálogo debe contener exactamente un hotel propio; hay ${propios}`);
  }
  return true;
}

validarCatalogo();

module.exports = { CATALOGO_HOTELES, GRUPOS, validarCatalogo };

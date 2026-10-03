const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CATALOGO_HOTELES,
  GRUPOS,
  validarCatalogo,
} = require("./catalogoHoteles");

test("el catálogo contiene La Plazuela y once competidores", () => {
  assert.equal(CATALOGO_HOTELES.length, 12);
  assert.equal(CATALOGO_HOTELES.filter((hotel) => hotel.propio).length, 1);
  assert.equal(
    CATALOGO_HOTELES.filter((hotel) => hotel.grupo === GRUPOS.DIRECTO).length,
    6
  );
  assert.equal(
    CATALOGO_HOTELES.filter((hotel) => hotel.grupo === GRUPOS.SUPERIOR).length,
    3
  );
  assert.equal(
    CATALOGO_HOTELES.filter((hotel) => hotel.grupo === GRUPOS.CORPORATIVO)
      .length,
    2
  );
});

test("validarCatalogo rechaza identificadores duplicados", () => {
  const propio = CATALOGO_HOTELES.find((hotel) => hotel.propio);
  assert.throws(
    () => validarCatalogo([propio, { ...propio }]),
    /Hotel duplicado/
  );
});

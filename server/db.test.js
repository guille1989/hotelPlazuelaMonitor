const test = require("node:test");
const assert = require("node:assert/strict");
const { mongoUri } = require("./db");

test("mongoUri exige una URI configurada", () => {
  assert.throws(
    () => mongoUri({}),
    (error) =>
      error.codigo === "MONGO_URI_FALTANTE" && /MONGO_URI/.test(error.message)
  );
});

test("mongoUri devuelve la URI sin espacios exteriores", () => {
  assert.equal(
    mongoUri({ MONGO_URI: "  mongodb://localhost:27017/hotel  " }),
    "mongodb://localhost:27017/hotel"
  );
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { obtenerOcupacionMes } = require("./ocupacionMes");

function dbDePrueba({ cargos = [], reservas = [] } = {}) {
  return {
    collection(nombre) {
      return {
        find() {
          return {
            async toArray() {
              return nombre === "noches_vendidas" ? cargos : reservas;
            },
          };
        },
      };
    },
  };
}

test("obtenerOcupacionMes conserva el contrato de la ruta y sus agregados", async () => {
  const datos = await obtenerOcupacionMes(
    dbDePrueba({
      reservas: [
        {
          fecha_llegada: "2027-02-10",
          fecha_salida: "2027-02-12",
          fecha_llegada_habitacion: "2027-02-10",
          fecha_salida_habitacion: "2027-02-12",
          fecha_reserva: "2027-01-10",
          fecha_cancelacion: null,
          cantid_reh: 2,
          estado_habitacion: "30",
          valor_habitacion: 200000,
          modo_reserva: "BK",
          origen: "Con reserva",
        },
      ],
    }),
    "2027-02"
  );

  assert.equal(datos.mes, "2027-02");
  assert.equal(datos.dias.length, 28);
  assert.equal(datos.dias.find((dia) => dia.dia === "2027-02-10").ocupacion, 2);
  assert.equal(datos.arribo.reservadas, 2);
  assert.equal(datos.arribo.roomNoches, 4);
  assert.equal(datos.arribo.antelacionN, 1);
  assert.deepEqual(datos.arribo.canal, { BK: 2 });
});

test("obtenerOcupacionMes rechaza meses imposibles", async () => {
  await assert.rejects(
    obtenerOcupacionMes(dbDePrueba(), "2026-13"),
    /formato YYYY-MM/
  );
});

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  diasDelPeriodo,
  obtenerOcupacionPeriodo,
} = require("./ocupacionPeriodo");

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

test("diasDelPeriodo incluye ambos extremos y permite cruzar de mes", () => {
  assert.deepEqual(diasDelPeriodo("2027-01-30", "2027-02-02"), [
    "2027-01-30",
    "2027-01-31",
    "2027-02-01",
    "2027-02-02",
  ]);
});

test("obtenerOcupacionPeriodo devuelve el detalle exacto de una semana", async () => {
  const datos = await obtenerOcupacionPeriodo(
    dbDePrueba({
      reservas: [
        {
          fecha_llegada: "2027-02-01",
          fecha_salida: "2027-02-04",
          fecha_reserva: "2027-01-20",
          cantid_reh: 2,
          estado_habitacion: "30",
          valor_habitacion: 200000,
          modo_reserva: "BK",
          origen: "Con reserva",
        },
      ],
    }),
    "2027-02-01",
    "2027-02-07"
  );

  assert.equal(datos.dias.length, 7);
  assert.equal(datos.dias[0].ocupacion, 2);
  assert.equal(datos.dias[2].ocupacion, 2);
  assert.equal(datos.dias[3].ocupacion, 0);
  assert.equal(datos.arribo.reservadas, 2);
  assert.deepEqual(datos.arribo.canal, { BK: 2 });
});

test("diasDelPeriodo rechaza rangos inválidos o demasiado largos", () => {
  assert.throws(() => diasDelPeriodo("2027-02-10", "2027-02-01"), /periodo/);
  assert.throws(() => diasDelPeriodo("2027-01-01", "2027-05-01"), /92/);
});

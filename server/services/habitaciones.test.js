const test = require("node:test");
const assert = require("node:assert/strict");
const {
  numerosHabitacion,
  obtenerHabitaciones,
} = require("./habitaciones");
const { hoyBogota, fechaBogota } = require("../functions/fechas");

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

test("numerosHabitacion separa, limpia y descarta valores vacíos", () => {
  assert.deepEqual(numerosHabitacion("217; 101; ; null"), ["217", "101"]);
  assert.deepEqual(numerosHabitacion(null), []);
});

test("devuelve habitaciones asignadas futuras sin datos de huéspedes", async () => {
  const datos = await obtenerHabitaciones(
    dbDePrueba({
      reservas: [
        {
          fecha_llegada: "2027-02-01",
          fecha_salida: "2027-02-03",
          cantid_reh: 2,
          estado_habitacion: "30",
          numero_habitacion: "217; 101",
          nombre_cliente: "No debe salir",
          fecha_cancelacion: null,
          origen: "Con reserva",
        },
      ],
    }),
    "2027-02-01",
    "2027-02-01"
  );

  assert.deepEqual(datos.dias[0].habitacionesAsignadas, ["101", "217"]);
  assert.deepEqual(datos.dias[0].habitacionesOcupadas, []);
  assert.equal(datos.dias[0].conteoAsignadas, 2);
  assert.equal(JSON.stringify(datos).includes("No debe salir"), false);
});

test("para hoy separa habitaciones ocupadas de asignadas pendientes", async () => {
  const hoy = hoyBogota();
  const manana = fechaBogota(1);
  const base = {
    fecha_llegada: hoy,
    fecha_salida: manana,
    cantid_reh: 1,
    fecha_cancelacion: null,
    origen: "Con reserva",
  };
  const datos = await obtenerHabitaciones(
    dbDePrueba({
      reservas: [
        {
          ...base,
          estado_habitacion: "31",
          numero_habitacion: "101",
        },
        {
          ...base,
          estado_habitacion: "30",
          numero_habitacion: "217",
        },
      ],
    }),
    hoy,
    hoy
  );

  assert.equal(datos.dias[0].conteoOcupadas, 1);
  assert.deepEqual(datos.dias[0].habitacionesOcupadas, ["101"]);
  assert.equal(datos.dias[0].conteoAsignadas, 2);
  assert.deepEqual(datos.dias[0].habitacionesAsignadas, ["101", "217"]);
});

test("limita el detalle operativo a catorce días", async () => {
  await assert.rejects(
    obtenerHabitaciones(dbDePrueba(), "2027-02-01", "2027-02-15"),
    /14 días/
  );
});

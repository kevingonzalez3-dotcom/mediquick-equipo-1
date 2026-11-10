
import test from "node:test";
import assert from "node:assert/strict";

import {
  crearReceta,
  obtenerRecetaPorQR,
  obtenerRecetasPorPaciente,
  agregarMedicamentoAReceta,
  cambiarEstadoReceta,
  despacharReceta,
  obtenerInventario,
  obtenerHistorialEstados,
  obtenerMovimientosInventario
} from "../src/services/receta.service";

test("Debe crear una receta con estado Emitida y código QR", () => {
  const receta = crearReceta({
    medico_id: "medico-test-001",
    paciente_id: "paciente-test-001",
    fecha_vigencia: "2027-12-31"
  });

  assert.equal(receta.estado, "Emitida");
  assert.ok(receta.codigo_qr);
  assert.equal(receta.detalles.length, 0);
});

test("Debe consultar una receta mediante su código QR", () => {
  const receta = crearReceta({
    medico_id: "medico-test-002",
    paciente_id: "paciente-test-002",
    fecha_vigencia: "2027-12-31"
  });

  const resultado = obtenerRecetaPorQR(receta.codigo_qr);

  assert.equal(resultado?.id, receta.id);
});

test("Debe consultar las recetas de un paciente", () => {
  const pacienteId = "paciente-test-003";

  const receta = crearReceta({
    medico_id: "medico-test-003",
    paciente_id: pacienteId,
    fecha_vigencia: "2027-12-31"
  });

  const resultados = obtenerRecetasPorPaciente(pacienteId);

  assert.ok(resultados.some((item) => item.id === receta.id));
});

test("Debe rechazar la creación de una receta sin médico", () => {
  assert.throws(
    () =>
      crearReceta({
        medico_id: " ",
        paciente_id: "paciente-test-004",
        fecha_vigencia: "2027-12-31"
      }),
    /médico y el paciente son obligatorios/
  );
});

test("Debe agregar un medicamento a una receta", () => {
  const receta = crearReceta({
    medico_id: "medico-test-005",
    paciente_id: "paciente-test-005",
    fecha_vigencia: "2027-12-31"
  });

  const resultado = agregarMedicamentoAReceta({
    receta_id: receta.id,
    medicamento_id: 1,
    cantidad: 5,
    dosis: "Una cápsula",
    indicaciones: "Cada ocho horas"
  });

  assert.equal(resultado.detalles.length, 1);
  assert.equal(resultado.detalles[0]?.cantidad, 5);
});

test("No debe permitir cantidades iguales o menores que cero", () => {
  const receta = crearReceta({
    medico_id: "medico-test-006",
    paciente_id: "paciente-test-006",
    fecha_vigencia: "2027-12-31"
  });

  assert.throws(
    () =>
      agregarMedicamentoAReceta({
        receta_id: receta.id,
        medicamento_id: 1,
        cantidad: 0,
        dosis: "Una cápsula",
        indicaciones: "Cada ocho horas"
      }),
    /cantidad debe ser un número entero mayor que cero/
  );
});

test("Debe permitir cambiar una receta de Emitida a En Proceso", () => {
  const receta = crearReceta({
    medico_id: "medico-test-007",
    paciente_id: "paciente-test-007",
    fecha_vigencia: "2027-12-31"
  });

  const resultado = cambiarEstadoReceta(receta.id, "En Proceso");

  assert.equal(resultado.estado, "En Proceso");
  assert.equal(obtenerHistorialEstados(receta.id).length, 1);
});

test("No debe permitir despachar directamente desde cambiarEstadoReceta", () => {
  const receta = crearReceta({
    medico_id: "medico-test-008",
    paciente_id: "paciente-test-008",
    fecha_vigencia: "2027-12-31"
  });

  cambiarEstadoReceta(receta.id, "En Proceso");

  assert.throws(
    () => cambiarEstadoReceta(receta.id, "Despachada"),
    /utilizar despacharReceta/
  );
});

test("Debe descontar el inventario al despachar una receta", () => {
  const receta = crearReceta({
    medico_id: "medico-test-009",
    paciente_id: "paciente-test-009",
    fecha_vigencia: "2027-12-31"
  });

  agregarMedicamentoAReceta({
    receta_id: receta.id,
    medicamento_id: 1,
    cantidad: 5,
    dosis: "Una cápsula",
    indicaciones: "Cada ocho horas"
  });

  cambiarEstadoReceta(receta.id, "En Proceso");

  const stockAntes = obtenerInventario().find(
    (medicamento) => medicamento.id === 1
  )?.stock;

  const resultado = despacharReceta(receta.id, "farmaceutico-test-001");

  const stockDespues = obtenerInventario().find(
    (medicamento) => medicamento.id === 1
  )?.stock;

  assert.equal(resultado.estado, "Despachada");
  assert.equal(resultado.farmaceutico_id, "farmaceutico-test-001");
  assert.equal(stockDespues, (stockAntes ?? 0) - 5);
  assert.equal(obtenerMovimientosInventario(receta.id).length, 1);
});

test("No debe descontar inventario si el stock es insuficiente", () => {
  const receta = crearReceta({
    medico_id: "medico-test-010",
    paciente_id: "paciente-test-010",
    fecha_vigencia: "2027-12-31"
  });

  const medicamento = obtenerInventario().find(
    (item) => item.id === 3
  );

  assert.ok(medicamento);

  const stockAntes = medicamento.stock;

  agregarMedicamentoAReceta({
    receta_id: receta.id,
    medicamento_id: 3,
    cantidad: stockAntes + 1,
    dosis: "Una tableta",
    indicaciones: "Según indicación médica"
  });

  cambiarEstadoReceta(receta.id, "En Proceso");

  assert.throws(
    () => despacharReceta(receta.id, "farmaceutico-test-002"),
    /Stock insuficiente/
  );

  const stockDespues = obtenerInventario().find(
    (item) => item.id === 3
  )?.stock;

  assert.equal(stockDespues, stockAntes);
  assert.equal(receta.estado, "En Proceso");
  assert.equal(obtenerMovimientosInventario(receta.id).length, 0);
});

test("No debe permitir modificar una receta despachada", () => {
  const receta = crearReceta({
    medico_id: "medico-test-011",
    paciente_id: "paciente-test-011",
    fecha_vigencia: "2027-12-31"
  });

  agregarMedicamentoAReceta({
    receta_id: receta.id,
    medicamento_id: 2,
    cantidad: 2,
    dosis: "Una tableta",
    indicaciones: "Cada ocho horas"
  });

  cambiarEstadoReceta(receta.id, "En Proceso");
  despacharReceta(receta.id, "farmaceutico-test-003");

  assert.throws(
    () =>
      agregarMedicamentoAReceta({
        receta_id: receta.id,
        medicamento_id: 1,
        cantidad: 1,
        dosis: "Una cápsula",
        indicaciones: "Una vez al día"
      }),
    /receta finalizada/
  );
});


import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import { pool } from "../src/db";

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

// ==========================================
// 1. DATOS DE PRUEBA
// ==========================================

const MEDICO_ID = "11111111-1111-1111-1111-111111111111";
const PACIENTE_ID = "33333333-3333-3333-3333-333333333333";
const FARMACEUTICO_ID = "22222222-2222-2222-2222-222222222222";

const FECHA_VIGENCIA = "2027-12-31";

const recetasCreadas: number[] = [];

// ==========================================
// 2. FUNCIONES AUXILIARES
// ==========================================

const crearRecetaPrueba = async (): Promise<
  Awaited<ReturnType<typeof crearReceta>>
> => {
  const receta = await crearReceta({
    medico_id: MEDICO_ID,
    paciente_id: PACIENTE_ID,
    fecha_vigencia: FECHA_VIGENCIA
  });

  recetasCreadas.push(receta.id);

  return receta;
};

// ==========================================
// 3. LIMPIEZA DESPUÉS DE CADA PRUEBA
// ==========================================

afterEach(async () => {
  for (const recetaId of recetasCreadas) {
    try {
      const movimientos = await pool.query<{
        medicamento_id: number;
        cantidad: number;
      }>(
        `SELECT medicamento_id, SUM(cantidad)::INTEGER AS cantidad
         FROM movimiento_inventario
         WHERE receta_id = $1
           AND tipo = 'SALIDA'
         GROUP BY medicamento_id`,
        [recetaId]
      );

      // Restaurar el inventario descontado por la receta.
      for (const movimiento of movimientos.rows) {
        await pool.query(
          `UPDATE medicamento
           SET stock = stock + $1
           WHERE id = $2`,
          [movimiento.cantidad, movimiento.medicamento_id]
        );
      }

      // Eliminar movimientos antes de eliminar la receta.
      await pool.query(
        "DELETE FROM movimiento_inventario WHERE receta_id = $1",
        [recetaId]
      );

      // Los detalles y el historial se eliminan mediante CASCADE.
      await pool.query(
        "DELETE FROM receta_medica WHERE id = $1",
        [recetaId]
      );
    } catch (error) {
      console.error(
        `Error limpiando la receta de prueba ${recetaId}:`,
        error
      );

      throw error;
    }
  }

  recetasCreadas.length = 0;
});

// ==========================================
// 4. PRUEBAS DEL SERVICIO DE RECETAS
// ==========================================

test("Debe crear una receta con estado Emitida y código QR", async () => {
  const receta = await crearRecetaPrueba();

  assert.equal(receta.estado, "Emitida");
  assert.ok(receta.codigo_qr);
  assert.equal(receta.detalles.length, 0);
});

test("Debe consultar una receta mediante su código QR", async () => {
  const receta = await crearRecetaPrueba();

  const resultado = await obtenerRecetaPorQR(receta.codigo_qr);

  assert.equal(resultado?.id, receta.id);
});

test("Debe consultar las recetas de un paciente", async () => {
  const receta = await crearRecetaPrueba();

  const resultados = await obtenerRecetasPorPaciente(PACIENTE_ID);

  assert.ok(resultados.some((item) => item.id === receta.id));
});

test("Debe rechazar la creación de una receta sin médico", async () => {
  await assert.rejects(
    () =>
      crearReceta({
        medico_id: " ",
        paciente_id: PACIENTE_ID,
        fecha_vigencia: FECHA_VIGENCIA
      }),
    /médico y el paciente son obligatorios/
  );
});

test("Debe agregar un medicamento a una receta", async () => {
  const receta = await crearRecetaPrueba();

  const resultado = await agregarMedicamentoAReceta({
    receta_id: receta.id,
    medicamento_id: 1,
    cantidad: 5,
    dosis: "Una cápsula",
    indicaciones: "Cada ocho horas"
  });

  assert.equal(resultado.detalles.length, 1);
  assert.equal(resultado.detalles[0]?.cantidad, 5);
});

test("No debe permitir cantidades iguales o menores que cero", async () => {
  const receta = await crearRecetaPrueba();

  await assert.rejects(
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

test("Debe permitir cambiar una receta de Emitida a En Proceso", async () => {
  const receta = await crearRecetaPrueba();

  const resultado = await cambiarEstadoReceta(
    receta.id,
    "En Proceso"
  );

  const historial = await obtenerHistorialEstados(receta.id);

  assert.equal(resultado.estado, "En Proceso");
  assert.equal(historial.length, 1);
});

test("No debe permitir despachar directamente desde cambiarEstadoReceta", async () => {
  const receta = await crearRecetaPrueba();

  await cambiarEstadoReceta(receta.id, "En Proceso");

  await assert.rejects(
    () => cambiarEstadoReceta(receta.id, "Despachada"),
    /utilizar despacharReceta/
  );
});

test("Debe descontar el inventario al despachar una receta", async () => {
  const receta = await crearRecetaPrueba();

  // Utilizamos el medicamento 2 para separar esta prueba
  // de la prueba de integración HTTP.
  const medicamentoId = 2;

  await agregarMedicamentoAReceta({
    receta_id: receta.id,
    medicamento_id: medicamentoId,
    cantidad: 5,
    dosis: "Una cápsula",
    indicaciones: "Cada ocho horas"
  });

  await cambiarEstadoReceta(receta.id, "En Proceso");

  const inventarioAntes = await obtenerInventario();

  const stockAntes = inventarioAntes.find(
    (medicamento) => medicamento.id === medicamentoId
  )?.stock;

  assert.ok(stockAntes !== undefined);

  const resultado = await despacharReceta(
    receta.id,
    FARMACEUTICO_ID
  );

  const inventarioDespues = await obtenerInventario();

  const stockDespues = inventarioDespues.find(
    (medicamento) => medicamento.id === medicamentoId
  )?.stock;

  const movimientos = await obtenerMovimientosInventario(receta.id);

  assert.equal(resultado.estado, "Despachada");
  assert.equal(resultado.farmaceutico_id, FARMACEUTICO_ID);
  assert.equal(stockDespues, stockAntes - 5);
  assert.equal(movimientos.length, 1);
});

test("No debe descontar inventario si el stock es insuficiente", async () => {
  const receta = await crearRecetaPrueba();

  const medicamentoId = 3;

  const inventario = await obtenerInventario();

  const medicamento = inventario.find(
    (item) => item.id === medicamentoId
  );

  assert.ok(medicamento);

  const stockAntes = medicamento.stock;

  await agregarMedicamentoAReceta({
    receta_id: receta.id,
    medicamento_id: medicamentoId,
    cantidad: stockAntes + 1,
    dosis: "Una tableta",
    indicaciones: "Según indicación médica"
  });

  await cambiarEstadoReceta(receta.id, "En Proceso");

  await assert.rejects(
    () => despacharReceta(receta.id, FARMACEUTICO_ID),
    /Stock insuficiente/
  );

  const inventarioDespues = await obtenerInventario();

  const stockDespues = inventarioDespues.find(
    (item) => item.id === medicamentoId
  )?.stock;

  const recetaActualizada = await obtenerRecetaPorQR(
    receta.codigo_qr
  );

  const movimientos = await obtenerMovimientosInventario(receta.id);

  assert.equal(stockDespues, stockAntes);
  assert.equal(recetaActualizada?.estado, "En Proceso");
  assert.equal(movimientos.length, 0);
});

test("No debe permitir modificar una receta despachada", async () => {
  const receta = await crearRecetaPrueba();

  await agregarMedicamentoAReceta({
    receta_id: receta.id,
    medicamento_id: 2,
    cantidad: 2,
    dosis: "Una tableta",
    indicaciones: "Cada ocho horas"
  });

  await cambiarEstadoReceta(receta.id, "En Proceso");

  await despacharReceta(receta.id, FARMACEUTICO_ID);

  await assert.rejects(
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
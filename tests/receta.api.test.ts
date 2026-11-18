
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app";
import { pool } from "../src/db";

test("Integración HTTP del módulo de recetas", async (t) => {
  const estadoPrueba: { recetaId?: number } = {};

  const medicamentoId = 1;
  const cantidadDespachada = 2;

  // Limpiar los datos después de terminar la prueba.
  t.after(async () => {
    const recetaId = estadoPrueba.recetaId;

    if (recetaId === undefined) {
      return;
    }

    const cliente = await pool.connect();

    try {
      await cliente.query("BEGIN");

      const movimientos = await cliente.query<{
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

      // Restaurar el inventario descontado.
      for (const movimiento of movimientos.rows) {
        await cliente.query(
          `UPDATE medicamento
           SET stock = stock + $1
           WHERE id = $2`,
          [movimiento.cantidad, movimiento.medicamento_id]
        );
      }

      // Eliminar los movimientos de la prueba.
      await cliente.query(
        "DELETE FROM movimiento_inventario WHERE receta_id = $1",
        [recetaId]
      );

      // Eliminar la receta y sus registros relacionados.
      await cliente.query(
        "DELETE FROM receta_medica WHERE id = $1",
        [recetaId]
      );

      await cliente.query("COMMIT");
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    } finally {
      cliente.release();
    }
  });

  // 1. Comprobar que la API está funcionando.
  const health = await request(app).get("/health");

  assert.equal(health.status, 200);
  assert.equal(health.body.status, "OK");

  // 2. Consultar el inventario.
  const inventario = await request(app).get("/api/recetas/inventario");

  assert.equal(inventario.status, 200);
  assert.ok(Array.isArray(inventario.body.datos));
  assert.ok(inventario.body.datos.length > 0);

  // 3. Crear una receta.
  const creacion = await request(app)
    .post("/api/recetas")
    .send({
      medico_id: "11111111-1111-1111-1111-111111111111",
      paciente_id: "33333333-3333-3333-3333-333333333333",
      fecha_vigencia: "2027-12-31",
      observaciones: "Receta creada mediante prueba de integración"
    });

  assert.equal(creacion.status, 201);
  assert.ok(creacion.body.datos.id);
  assert.ok(creacion.body.datos.codigo_qr);

  estadoPrueba.recetaId = creacion.body.datos.id;

  const codigoQR = creacion.body.datos.codigo_qr;
  const recetaId = estadoPrueba.recetaId;

  // 4. Consultar la receta mediante su código QR.
  const consultaQR = await request(app)
    .get(`/api/recetas/qr/${codigoQR}`);

  assert.equal(consultaQR.status, 200);
  assert.equal(consultaQR.body.datos.id, recetaId);

  // 5. Consultar las recetas del paciente.
  const recetasPaciente = await request(app)
    .get("/api/recetas/paciente/33333333-3333-3333-3333-333333333333");

  assert.equal(recetasPaciente.status, 200);
  assert.ok(Array.isArray(recetasPaciente.body.datos));

  // 6. Agregar un medicamento.
  const medicamento = await request(app)
    .post("/api/recetas/medicamentos")
    .send({
      receta_id: recetaId,
      medicamento_id: medicamentoId,
      cantidad: cantidadDespachada,
      dosis: "500 mg cada 8 horas",
      indicaciones: "Tomar después de los alimentos"
    });

  assert.equal(medicamento.status, 200);

  // 7. Cambiar el estado de la receta.
  const cambioEstado = await request(app)
    .patch(`/api/recetas/${recetaId}/estado`)
    .send({ estado: "En Proceso" });

  assert.equal(cambioEstado.status, 200);

  // 8. Despachar la receta.
  const despacho = await request(app)
    .post(`/api/recetas/${recetaId}/despachar`)
    .send({
      farmaceuticoId: "22222222-2222-2222-2222-222222222222"
    });

  assert.equal(despacho.status, 200);

  // 9. Consultar el historial de estados.
  const historial = await request(app)
    .get(`/api/recetas/${recetaId}/historial`);

  assert.equal(historial.status, 200);
  assert.ok(Array.isArray(historial.body.datos));
  assert.ok(historial.body.datos.length >= 2);

  // 10. Consultar los movimientos de inventario.
  const movimientos = await request(app)
    .get(`/api/recetas/${recetaId}/movimientos`);

  assert.equal(movimientos.status, 200);
  assert.ok(Array.isArray(movimientos.body.datos));
  assert.ok(movimientos.body.datos.length > 0);
  assert.equal(movimientos.body.datos[0].tipo, "SALIDA");
  assert.equal(
    movimientos.body.datos[0].cantidad,
    cantidadDespachada
  );
});
import { pool } from "../db";

import type {
  EstadoReceta,
  RecetaMedica,
  DetalleReceta,
  Medicamento
} from "../types/receta.types";

// ==========================================
// 1. TIPOS INTERNOS DE BASE DE DATOS
// ==========================================

interface RecetaRow {
  id: number;
  codigo_qr: string;
  medico_id: string;
  paciente_id: string;
  farmaceutico_id: string | null;
  estado: EstadoReceta;
  fecha_emision: Date | string;
  fecha_vigencia: Date | string;
  fecha_despacho: Date | string | null;
  observaciones: string | null;
  actualizado_en: Date | string;
}

interface DetalleRow {
  id: number;
  receta_id: number;
  medicamento_id: number;
  cantidad: number;
  dosis: string;
  indicaciones: string;
}

interface HistorialEstadoReceta {
  id: number;
  receta_id: number;
  estado_anterior: EstadoReceta | null;
  estado_nuevo: EstadoReceta;
  cambiado_en: Date | string;
}

interface MovimientoInventario {
  id: number;
  medicamento_id: number;
  receta_id: number | null;
  tipo: "ENTRADA" | "SALIDA";
  cantidad: number;
  stock_resultante: number;
  fecha: Date | string;
}

interface CrearRecetaDTO {
  medico_id: string;
  paciente_id: string;
  fecha_vigencia: string;
  observaciones?: string;
}

interface AgregarMedicamentoDTO {
  receta_id: number;
  medicamento_id: number;
  cantidad: number;
  dosis: string;
  indicaciones: string;
}

// ==========================================
// 2. FUNCIONES AUXILIARES
// ==========================================

const convertirFecha = (fecha: Date | string): string => {
  if (fecha instanceof Date) {
    return fecha.toISOString();
  }

  return fecha;
};

const convertirFechaNullable = (
  fecha: Date | string | null
): string | null => {
  return fecha === null ? null : convertirFecha(fecha);
};

const mapearDetalle = (fila: DetalleRow): DetalleReceta => ({
  id: Number(fila.id),
  receta_id: Number(fila.receta_id),
  medicamento_id: Number(fila.medicamento_id),
  cantidad: Number(fila.cantidad),
  dosis: fila.dosis,
  indicaciones: fila.indicaciones
});

const mapearReceta = (
  fila: RecetaRow,
  detalles: DetalleReceta[]
): RecetaMedica => ({
  id: Number(fila.id),
  codigo_qr: fila.codigo_qr,
  medico_id: fila.medico_id,
  paciente_id: fila.paciente_id,
  farmaceutico_id: fila.farmaceutico_id,
  estado: fila.estado,
  fecha_emision: convertirFecha(fila.fecha_emision),
  fecha_vigencia: String(fila.fecha_vigencia).slice(0, 10),
  fecha_despacho: convertirFechaNullable(fila.fecha_despacho),
  observaciones: fila.observaciones,
  actualizado_en: convertirFecha(fila.actualizado_en),
  detalles
});

const obtenerDetallesDeReceta = async (
  recetaId: number
): Promise<DetalleReceta[]> => {
  const resultado = await pool.query<DetalleRow>(
    `SELECT id, receta_id, medicamento_id, cantidad, dosis, indicaciones
     FROM detalle_receta
     WHERE receta_id = $1
     ORDER BY id`,
    [recetaId]
  );

  return resultado.rows.map(mapearDetalle);
};

const obtenerRecetaPorId = async (
  recetaId: number
): Promise<RecetaMedica | undefined> => {
  const resultado = await pool.query<RecetaRow>(
    `SELECT id, codigo_qr, medico_id, paciente_id, farmaceutico_id,
            estado, fecha_emision, fecha_vigencia, fecha_despacho,
            observaciones, actualizado_en
     FROM receta_medica
     WHERE id = $1`,
    [recetaId]
  );

  const fila = resultado.rows[0];

  if (!fila) {
    return undefined;
  }

  const detalles = await obtenerDetallesDeReceta(recetaId);

  return mapearReceta(fila, detalles);
};

const estadosFinales: EstadoReceta[] = [
  "Despachada",
  "Cancelada",
  "Vencida"
];

// ==========================================
// 3. CREAR UNA NUEVA RECETA
// ==========================================

export const crearReceta = async (
  datos: CrearRecetaDTO
): Promise<RecetaMedica> => {
  if (!datos.medico_id.trim() || !datos.paciente_id.trim()) {
    throw new Error("El médico y el paciente son obligatorios");
  }

  if (!datos.fecha_vigencia) {
    throw new Error("La fecha de vigencia es obligatoria");
  }

  const fecha = new Date(`${datos.fecha_vigencia}T00:00:00`);

  if (
    Number.isNaN(fecha.getTime()) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha_vigencia) ||
    fecha.toISOString().slice(0, 10) !== datos.fecha_vigencia
  ) {
    throw new Error("La fecha de vigencia no es válida");
  }

  const resultado = await pool.query<RecetaRow>(
    `INSERT INTO receta_medica
       (medico_id, paciente_id, fecha_vigencia, observaciones)
     VALUES ($1, $2, $3, $4)
     RETURNING id, codigo_qr, medico_id, paciente_id, farmaceutico_id,
               estado, fecha_emision, fecha_vigencia, fecha_despacho,
               observaciones, actualizado_en`,
    [
      datos.medico_id,
      datos.paciente_id,
      datos.fecha_vigencia,
      datos.observaciones?.trim() || null
    ]
  );

  const nuevaReceta = resultado.rows[0];

  if (!nuevaReceta) {
    throw new Error("No fue posible crear la receta médica");
  }

  return mapearReceta(nuevaReceta, []);
};

// ==========================================
// 4. CONSULTAR RECETA MEDIANTE CÓDIGO QR
// ==========================================

export const obtenerRecetaPorQR = async (
  codigoQR: string
): Promise<RecetaMedica | undefined> => {
  if (!codigoQR.trim()) {
    throw new Error("El código QR es obligatorio");
  }

  const resultado = await pool.query<RecetaRow>(
    `SELECT id, codigo_qr, medico_id, paciente_id, farmaceutico_id,
            estado, fecha_emision, fecha_vigencia, fecha_despacho,
            observaciones, actualizado_en
     FROM receta_medica
     WHERE codigo_qr = $1`,
    [codigoQR]
  );

  const fila = resultado.rows[0];

  if (!fila) {
    return undefined;
  }

  const detalles = await obtenerDetallesDeReceta(Number(fila.id));

  return mapearReceta(fila, detalles);
};

// ==========================================
// 5. CONSULTAR RECETAS POR PACIENTE
// ==========================================

export const obtenerRecetasPorPaciente = async (
  pacienteId: string
): Promise<RecetaMedica[]> => {
  if (!pacienteId.trim()) {
    throw new Error("El identificador del paciente es obligatorio");
  }

  const resultado = await pool.query<RecetaRow>(
    `SELECT id, codigo_qr, medico_id, paciente_id, farmaceutico_id,
            estado, fecha_emision, fecha_vigencia, fecha_despacho,
            observaciones, actualizado_en
     FROM receta_medica
     WHERE paciente_id = $1
     ORDER BY fecha_emision DESC`,
    [pacienteId]
  );

  return Promise.all(
    resultado.rows.map(async (fila) => {
      const detalles = await obtenerDetallesDeReceta(Number(fila.id));
      return mapearReceta(fila, detalles);
    })
  );
};

// ==========================================
// 6. AGREGAR MEDICAMENTO A UNA RECETA
// ==========================================

export const agregarMedicamentoAReceta = async (
  datos: AgregarMedicamentoDTO
): Promise<RecetaMedica> => {
  if (!Number.isInteger(datos.cantidad) || datos.cantidad <= 0) {
    throw new Error("La cantidad debe ser un número entero mayor que cero");
  }

  if (!datos.dosis.trim() || !datos.indicaciones.trim()) {
    throw new Error("La dosis y las indicaciones son obligatorias");
  }

  if (datos.dosis.trim().length > 100) {
    throw new Error("La dosis no puede superar los 100 caracteres");
  }

  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");

    const recetaResultado = await cliente.query<RecetaRow>(
      `SELECT id, codigo_qr, medico_id, paciente_id, farmaceutico_id,
              estado, fecha_emision, fecha_vigencia, fecha_despacho,
              observaciones, actualizado_en
       FROM receta_medica
       WHERE id = $1
       FOR UPDATE`,
      [datos.receta_id]
    );

    const receta = recetaResultado.rows[0];

    if (!receta) {
      throw new Error("La receta médica no existe");
    }

    if (estadosFinales.includes(receta.estado)) {
      throw new Error("No se puede modificar una receta finalizada");
    }

    const medicamentoResultado = await cliente.query(
      "SELECT id FROM medicamento WHERE id = $1",
      [datos.medicamento_id]
    );

    if (medicamentoResultado.rowCount === 0) {
      throw new Error("El medicamento no existe");
    }

    await cliente.query(
      `INSERT INTO detalle_receta
         (receta_id, medicamento_id, cantidad, dosis, indicaciones)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        datos.receta_id,
        datos.medicamento_id,
        datos.cantidad,
        datos.dosis.trim(),
        datos.indicaciones.trim()
      ]
    );

    await cliente.query(
      "UPDATE receta_medica SET actualizado_en = NOW() WHERE id = $1",
      [datos.receta_id]
    );

    await cliente.query("COMMIT");
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }

  const recetaActualizada = await obtenerRecetaPorId(datos.receta_id);

  if (!recetaActualizada) {
    throw new Error("No fue posible recuperar la receta actualizada");
  }

  return recetaActualizada;
};

// ==========================================
// 7. CAMBIAR ESTADO DE UNA RECETA
// ==========================================

export const cambiarEstadoReceta = async (
  recetaId: number,
  nuevoEstado: EstadoReceta
): Promise<RecetaMedica> => {
  if (nuevoEstado === "Despachada") {
    throw new Error(
      "Para despachar una receta debes utilizar despacharReceta"
    );
  }

  const resultado = await pool.query(
    `UPDATE receta_medica
     SET estado = $1
     WHERE id = $2
     RETURNING id`,
    [nuevoEstado, recetaId]
  );

  if (resultado.rowCount === 0) {
    throw new Error("La receta médica no existe");
  }

  const recetaActualizada = await obtenerRecetaPorId(recetaId);

  if (!recetaActualizada) {
    throw new Error("No fue posible recuperar la receta actualizada");
  }

  return recetaActualizada;
};

// ==========================================
// 8. DESPACHAR UNA RECETA
// ==========================================

export const despacharReceta = async (
  recetaId: number,
  farmaceuticoId: string
): Promise<RecetaMedica> => {
  if (!farmaceuticoId.trim()) {
    throw new Error("El identificador del farmacéutico es obligatorio");
  }

  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");

    const resultado = await cliente.query<RecetaRow>(
      `SELECT id, codigo_qr, medico_id, paciente_id, farmaceutico_id,
              estado, fecha_emision, fecha_vigencia, fecha_despacho,
              observaciones, actualizado_en
       FROM receta_medica
       WHERE id = $1
       FOR UPDATE`,
      [recetaId]
    );

    const receta = resultado.rows[0];

    if (!receta) {
      throw new Error("La receta médica no existe");
    }

    if (receta.estado !== "En Proceso") {
      throw new Error(
        "Solo se pueden despachar recetas que estén En Proceso"
      );
    }

    const detalles = await cliente.query(
      `SELECT id
       FROM detalle_receta
       WHERE receta_id = $1`,
      [recetaId]
    );

    if (detalles.rowCount === 0) {
      throw new Error("No se puede despachar una receta sin medicamentos");
    }

    const vigencia = String(receta.fecha_vigencia).slice(0, 10);
    const hoy = new Date().toISOString().slice(0, 10);

    if (vigencia < hoy) {
      throw new Error("No se puede despachar una receta vencida");
    }

    // El trigger de PostgreSQL V4 gestiona automáticamente:
    // - La validación del inventario.
    // - El descuento del stock.
    // - El registro de movimientos.
    // - El historial de estados.
    // - La fecha de despacho.

    await cliente.query(
      `UPDATE receta_medica
       SET estado = 'Despachada',
           farmaceutico_id = $1
       WHERE id = $2`,
      [farmaceuticoId, recetaId]
    );

    await cliente.query("COMMIT");
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }

  const recetaDespachada = await obtenerRecetaPorId(recetaId);

  if (!recetaDespachada) {
    throw new Error("No fue posible recuperar la receta despachada");
  }

  return recetaDespachada;
};

// ==========================================
// 9. CONSULTAR INVENTARIO
// ==========================================

export const obtenerInventario = async (): Promise<Medicamento[]> => {
  const resultado = await pool.query<Medicamento>(
    `SELECT id, codigo, nombre, presentacion, stock, stock_minimo
     FROM medicamento
     ORDER BY id`
  );

  return resultado.rows.map((medicamento) => ({
    ...medicamento,
    id: Number(medicamento.id),
    stock: Number(medicamento.stock),
    stock_minimo: Number(medicamento.stock_minimo)
  }));
};

// ==========================================
// 10. CONSULTAR HISTORIAL DE ESTADOS
// ==========================================

export const obtenerHistorialEstados = async (
  recetaId: number
): Promise<HistorialEstadoReceta[]> => {
  const resultado = await pool.query<HistorialEstadoReceta>(
    `SELECT id, receta_id, estado_anterior, estado_nuevo, cambiado_en
     FROM historial_estado_receta
     WHERE receta_id = $1
     ORDER BY cambiado_en, id`,
    [recetaId]
  );

  return resultado.rows.map((registro) => ({
    ...registro,
    id: Number(registro.id),
    receta_id: Number(registro.receta_id),
    cambiado_en: convertirFecha(registro.cambiado_en)
  }));
};

// ==========================================
// 11. CONSULTAR MOVIMIENTOS DE INVENTARIO
// ==========================================

export const obtenerMovimientosInventario = async (
  recetaId: number
): Promise<MovimientoInventario[]> => {
  const resultado = await pool.query<MovimientoInventario>(
    `SELECT id, medicamento_id, receta_id, tipo, cantidad,
            stock_resultante, fecha
     FROM movimiento_inventario
     WHERE receta_id = $1
     ORDER BY fecha, id`,
    [recetaId]
  );

  return resultado.rows.map((movimiento) => ({
    ...movimiento,
    id: Number(movimiento.id),
    medicamento_id: Number(movimiento.medicamento_id),
    receta_id: movimiento.receta_id === null
      ? null
      : Number(movimiento.receta_id),
    cantidad: Number(movimiento.cantidad),
    stock_resultante: Number(movimiento.stock_resultante),
    fecha: convertirFecha(movimiento.fecha)
  }));
};
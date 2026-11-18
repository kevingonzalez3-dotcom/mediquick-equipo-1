import { type Request, type Response } from "express";

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
} from "../services/receta.service";

// ==========================================
// 1. CREAR UNA RECETA MÉDICA
// ==========================================

export const crearRecetaController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const receta = await crearReceta(req.body);

    res.status(201).json({
      mensaje: "Receta médica creada correctamente",
      datos: receta
    });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error
        ? error.message
        : "Error al crear la receta"
    });
  }
};

// ==========================================
// 2. CONSULTAR RECETA MEDIANTE CÓDIGO QR
// ==========================================

export const obtenerRecetaPorQRController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const codigoQR = String(req.params.codigoQR ?? "");

    const receta = await obtenerRecetaPorQR(codigoQR);

    if (!receta) {
      res.status(404).json({
        mensaje: "Receta no encontrada"
      });
      return;
    }

    res.status(200).json({
      datos: receta
    });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error
        ? error.message
        : "Error al consultar la receta"
    });
  }
};

// ==========================================
// 3. CONSULTAR RECETAS DE UN PACIENTE
// ==========================================

export const obtenerRecetasPorPacienteController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const pacienteId = String(req.params.pacienteId ?? "");

    const recetas = await obtenerRecetasPorPaciente(pacienteId);

    res.status(200).json({
      datos: recetas
    });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error
        ? error.message
        : "Error al consultar las recetas"
    });
  }
};

// ==========================================
// 4. AGREGAR MEDICAMENTO A UNA RECETA
// ==========================================

export const agregarMedicamentoController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const receta = await agregarMedicamentoAReceta(req.body);

    res.status(200).json({
      mensaje: "Medicamento agregado correctamente",
      datos: receta
    });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error
        ? error.message
        : "Error al agregar medicamento"
    });
  }
};

// ==========================================
// 5. CAMBIAR ESTADO DE UNA RECETA
// ==========================================

export const cambiarEstadoRecetaController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const recetaId = Number(req.params.recetaId);
    const { estado } = req.body;

    if (!Number.isInteger(recetaId) || recetaId <= 0) {
      res.status(400).json({
        mensaje: "El identificador de la receta no es válido"
      });
      return;
    }

    const receta = await cambiarEstadoReceta(recetaId, estado);

    res.status(200).json({
      mensaje: "Estado de la receta actualizado correctamente",
      datos: receta
    });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error
        ? error.message
        : "Error al cambiar el estado"
    });
  }
};

// ==========================================
// 6. DESPACHAR UNA RECETA
// ==========================================

export const despacharRecetaController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const recetaId = Number(req.params.recetaId);
    const { farmaceuticoId } = req.body;

    if (!Number.isInteger(recetaId) || recetaId <= 0) {
      res.status(400).json({
        mensaje: "El identificador de la receta no es válido"
      });
      return;
    }

    const receta = await despacharReceta(
      recetaId,
      farmaceuticoId
    );

    res.status(200).json({
      mensaje: "Receta despachada correctamente",
      datos: receta
    });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error
        ? error.message
        : "Error al despachar la receta"
    });
  }
};

// ==========================================
// 7. CONSULTAR INVENTARIO
// ==========================================

export const obtenerInventarioController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const inventario = await obtenerInventario();

    res.status(200).json({
      datos: inventario
    });
  } catch (error) {
    res.status(500).json({
      mensaje: error instanceof Error
        ? error.message
        : "Error al consultar el inventario"
    });
  }
};

// ==========================================
// 8. CONSULTAR HISTORIAL DE ESTADOS
// ==========================================

export const obtenerHistorialEstadosController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const recetaId = Number(req.params.recetaId);

    if (!Number.isInteger(recetaId) || recetaId <= 0) {
      res.status(400).json({
        mensaje: "El identificador de la receta no es válido"
      });
      return;
    }

    const historial = await obtenerHistorialEstados(recetaId);

    res.status(200).json({
      datos: historial
    });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error
        ? error.message
        : "Error al consultar el historial"
    });
  }
};

// ==========================================
// 9. CONSULTAR MOVIMIENTOS DE INVENTARIO
// ==========================================

export const obtenerMovimientosInventarioController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const recetaId = Number(req.params.recetaId);

    if (!Number.isInteger(recetaId) || recetaId <= 0) {
      res.status(400).json({
        mensaje: "El identificador de la receta no es válido"
      });
      return;
    }

    const movimientos = await obtenerMovimientosInventario(recetaId);

    res.status(200).json({
      datos: movimientos
    });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error
        ? error.message
        : "Error al consultar los movimientos"
    });
  }
};
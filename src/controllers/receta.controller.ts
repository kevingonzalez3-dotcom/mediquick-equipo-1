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

// Crear una receta médica
export const crearRecetaController = (req: Request, res: Response): void => {
  try {
    const receta = crearReceta(req.body);

    res.status(201).json({
      mensaje: "Receta médica creada correctamente",
      datos: receta
    });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error ? error.message : "Error al crear la receta"
    });
  }
};

// Consultar una receta mediante su código QR
export const obtenerRecetaPorQRController = (req: Request, res: Response): void => {
  try {
    const codigoQR = String(req.params.codigoQR ?? "");
    const receta = obtenerRecetaPorQR(codigoQR);

    if (!receta) {
      res.status(404).json({ mensaje: "Receta no encontrada" });
      return;
    }

    res.status(200).json({ datos: receta });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error ? error.message : "Error al consultar la receta"
    });
  }
};

// Consultar recetas de un paciente
export const obtenerRecetasPorPacienteController = (req: Request, res: Response): void => {
  try {
    const pacienteId = String(req.params.pacienteId ?? "");
    const recetas = obtenerRecetasPorPaciente(pacienteId);

    res.status(200).json({ datos: recetas });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error ? error.message : "Error al consultar las recetas"
    });
  }
};

// Agregar un medicamento a una receta
export const agregarMedicamentoController = (req: Request, res: Response): void => {
  try {
    const receta = agregarMedicamentoAReceta(req.body);

    res.status(200).json({
      mensaje: "Medicamento agregado correctamente",
      datos: receta
    });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error ? error.message : "Error al agregar medicamento"
    });
  }
};

// Cambiar el estado de una receta
export const cambiarEstadoRecetaController = (req: Request, res: Response): void => {
  try {
    const recetaId = Number(req.params.recetaId);
    const { estado } = req.body;

    const receta = cambiarEstadoReceta(recetaId, estado);

    res.status(200).json({
      mensaje: "Estado de la receta actualizado correctamente",
      datos: receta
    });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error ? error.message : "Error al cambiar el estado"
    });
  }
};

// Despachar una receta
export const despacharRecetaController = (req: Request, res: Response): void => {
  try {
    const recetaId = Number(req.params.recetaId);
    const { farmaceuticoId } = req.body;

    const receta = despacharReceta(recetaId, farmaceuticoId);

    res.status(200).json({
      mensaje: "Receta despachada correctamente",
      datos: receta
    });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error ? error.message : "Error al despachar la receta"
    });
  }
};

// Consultar inventario
export const obtenerInventarioController = (_req: Request, res: Response): void => {
  res.status(200).json({
    datos: obtenerInventario()
  });
};

// Consultar historial de estados de una receta
export const obtenerHistorialEstadosController = (req: Request, res: Response): void => {
  try {
    const recetaId = Number(req.params.recetaId);

    const historial = obtenerHistorialEstados(recetaId);

    res.status(200).json({
      datos: historial
    });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error ? error.message : "Error al consultar el historial"
    });
  }
};

// Consultar movimientos de inventario de una receta
export const obtenerMovimientosInventarioController = (req: Request, res: Response): void => {
  try {
    const recetaId = Number(req.params.recetaId);

    const movimientos = obtenerMovimientosInventario(recetaId);

    res.status(200).json({
      datos: movimientos
    });
  } catch (error) {
    res.status(400).json({
      mensaje: error instanceof Error ? error.message : "Error al consultar los movimientos"
    });
  }
};
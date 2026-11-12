import { Router } from "express";

import {
  crearRecetaController,
  obtenerRecetaPorQRController,
  obtenerRecetasPorPacienteController,
  agregarMedicamentoController,
  cambiarEstadoRecetaController,
  despacharRecetaController,
  obtenerInventarioController,
  obtenerHistorialEstadosController,
  obtenerMovimientosInventarioController
} from "../controllers/receta.controller";

const router = Router();

// Crear una receta médica
router.post("/", crearRecetaController);

// Consultar receta mediante código QR
router.get("/qr/:codigoQR", obtenerRecetaPorQRController);

// Consultar recetas de un paciente
router.get("/paciente/:pacienteId", obtenerRecetasPorPacienteController);

// Agregar medicamento a una receta
router.post("/medicamentos", agregarMedicamentoController);

// Cambiar estado de una receta
router.patch("/:recetaId/estado", cambiarEstadoRecetaController);

// Despachar una receta
router.post("/:recetaId/despachar", despacharRecetaController);

// Consultar inventario
router.get("/inventario", obtenerInventarioController);

// Consultar historial de estados
router.get("/:recetaId/historial", obtenerHistorialEstadosController);

// Consultar movimientos de inventario
router.get("/:recetaId/movimientos", obtenerMovimientosInventarioController);

export default router;
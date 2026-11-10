
import { randomUUID } from "node:crypto";

import type {
  EstadoReceta,
  RecetaMedica,
  DetalleReceta,
  Medicamento
} from "../types/receta.types";

// ==========================================
// 1. ALMACENAMIENTO TEMPORAL EN MEMORIA
// ==========================================

const recetas = new Map<number, RecetaMedica>();
const medicamentos = new Map<number, Medicamento>();

let siguienteIdReceta = 1;
let siguienteIdDetalle = 1;
let siguienteIdMovimiento = 1;

// ==========================================
// 2. HISTORIAL Y MOVIMIENTOS DE INVENTARIO
// ==========================================

interface HistorialEstadoReceta {
  receta_id: number;
  estado_anterior: EstadoReceta;
  estado_nuevo: EstadoReceta;
  fecha_cambio: string;
}

interface MovimientoInventario {
  id: number;
  medicamento_id: number;
  receta_id: number;
  tipo: "SALIDA";
  cantidad: number;
  fecha_movimiento: string;
}

const historialEstados: HistorialEstadoReceta[] = [];
const movimientosInventario: MovimientoInventario[] = [];

// ==========================================
// 3. ESTADOS Y TRANSICIONES DE RECETAS
// ==========================================

const estadosFinales: EstadoReceta[] = [
  "Despachada",
  "Cancelada",
  "Vencida"
];

const transicionesPermitidas: Record<EstadoReceta, EstadoReceta[]> = {
  Emitida: ["En Proceso", "Cancelada", "Vencida"],
  "En Proceso": ["Despachada", "Cancelada"],
  Despachada: [],
  Cancelada: [],
  Vencida: []
};

// ==========================================
// 4. FUNCIONES AUXILIARES
// ==========================================

const fechaActual = (): string => new Date().toISOString();

const fechaHoy = (): string => {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
};

const registrarCambioEstado = (
  receta: RecetaMedica,
  nuevoEstado: EstadoReceta,
  fecha: string
): void => {
  historialEstados.push({
    receta_id: receta.id,
    estado_anterior: receta.estado,
    estado_nuevo: nuevoEstado,
    fecha_cambio: fecha
  });

  receta.estado = nuevoEstado;
  receta.actualizado_en = fecha;
};

// ==========================================
// 5. INVENTARIO INICIAL DE MEDICAMENTOS
// ==========================================

const inicializarMedicamentos = (): void => {
  const medicamentosIniciales: Medicamento[] = [
    {
      id: 1,
      codigo: "MED-001",
      nombre: "Amoxicilina 500 mg",
      presentacion: "Cápsulas",
      stock: 120,
      stock_minimo: 10
    },
    {
      id: 2,
      codigo: "MED-002",
      nombre: "Ibuprofeno 400 mg",
      presentacion: "Tabletas",
      stock: 200,
      stock_minimo: 10
    },
    {
      id: 3,
      codigo: "MED-003",
      nombre: "Loratadina 10 mg",
      presentacion: "Tabletas",
      stock: 80,
      stock_minimo: 10
    },
    {
      id: 4,
      codigo: "MED-004",
      nombre: "Omeprazol 20 mg",
      presentacion: "Cápsulas",
      stock: 60,
      stock_minimo: 10
    },
    {
      id: 5,
      codigo: "MED-005",
      nombre: "Metformina 850 mg",
      presentacion: "Tabletas",
      stock: 45,
      stock_minimo: 10
    }
  ];

  medicamentosIniciales.forEach((medicamento) => {
    medicamentos.set(medicamento.id, medicamento);
  });
};

inicializarMedicamentos();

// ==========================================
// 6. INTERFACES DE DATOS
// ==========================================

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
// 7. CREAR UNA NUEVA RECETA
// ==========================================

export const crearReceta = (
  datos: CrearRecetaDTO
): RecetaMedica => {
  if (!datos.medico_id.trim() || !datos.paciente_id.trim()) {
    throw new Error("El médico y el paciente son obligatorios");
  }

  const fechaVigencia = new Date(datos.fecha_vigencia);

  if (
    !datos.fecha_vigencia ||
    Number.isNaN(fechaVigencia.getTime()) ||
    datos.fecha_vigencia.slice(0, 10) < fechaHoy()
  ) {
    throw new Error("La fecha de vigencia no es válida");
  }

  const fecha = fechaActual();

  const nuevaReceta: RecetaMedica = {
    id: siguienteIdReceta++,
    codigo_qr: randomUUID(),
    medico_id: datos.medico_id,
    paciente_id: datos.paciente_id,
    farmaceutico_id: null,
    estado: "Emitida",
    fecha_emision: fecha,
    fecha_vigencia: datos.fecha_vigencia,
    fecha_despacho: null,
    observaciones: datos.observaciones ?? null,
    actualizado_en: fecha,
    detalles: []
  };

  recetas.set(nuevaReceta.id, nuevaReceta);

  return nuevaReceta;
};

// ==========================================
// 8. CONSULTAR RECETA MEDIANTE CÓDIGO QR
// ==========================================

export const obtenerRecetaPorQR = (
  codigoQR: string
): RecetaMedica | undefined => {
  if (!codigoQR.trim()) {
    throw new Error("El código QR es obligatorio");
  }

  return Array.from(recetas.values()).find(
    (receta) => receta.codigo_qr === codigoQR
  );
};

// ==========================================
// 9. CONSULTAR RECETAS POR PACIENTE
// ==========================================

export const obtenerRecetasPorPaciente = (
  pacienteId: string
): RecetaMedica[] => {
  if (!pacienteId.trim()) {
    throw new Error("El identificador del paciente es obligatorio");
  }

  return Array.from(recetas.values()).filter(
    (receta) => receta.paciente_id === pacienteId
  );
};

// ==========================================
// 10. AGREGAR MEDICAMENTO A UNA RECETA
// ==========================================

export const agregarMedicamentoAReceta = (
  datos: AgregarMedicamentoDTO
): RecetaMedica => {
  const receta = recetas.get(datos.receta_id);

  if (!receta) {
    throw new Error("La receta médica no existe");
  }

  if (estadosFinales.includes(receta.estado)) {
    throw new Error("No se puede modificar una receta finalizada");
  }

  const medicamento = medicamentos.get(datos.medicamento_id);

  if (!medicamento) {
    throw new Error("El medicamento no existe");
  }

  if (!Number.isInteger(datos.cantidad) || datos.cantidad <= 0) {
    throw new Error("La cantidad debe ser un número entero mayor que cero");
  }

  if (!datos.dosis.trim() || !datos.indicaciones.trim()) {
    throw new Error("La dosis y las indicaciones son obligatorias");
  }

  const nuevoDetalle: DetalleReceta = {
    id: siguienteIdDetalle++,
    receta_id: receta.id,
    medicamento_id: medicamento.id,
    cantidad: datos.cantidad,
    dosis: datos.dosis.trim(),
    indicaciones: datos.indicaciones.trim()
  };

  receta.detalles.push(nuevoDetalle);
  receta.actualizado_en = fechaActual();

  return receta;
};

// ==========================================
// 11. CAMBIAR ESTADO DE UNA RECETA
// ==========================================

export const cambiarEstadoReceta = (
  recetaId: number,
  nuevoEstado: EstadoReceta
): RecetaMedica => {
  const receta = recetas.get(recetaId);

  if (!receta) {
    throw new Error("La receta médica no existe");
  }

  if (nuevoEstado === "Despachada") {
    throw new Error(
      "Para despachar una receta debes utilizar despacharReceta"
    );
  }

  const estadosPermitidos = transicionesPermitidas[receta.estado];

  if (!estadosPermitidos.includes(nuevoEstado)) {
    throw new Error(
      `No se permite cambiar de ${receta.estado} a ${nuevoEstado}`
    );
  }

  registrarCambioEstado(receta, nuevoEstado, fechaActual());

  return receta;
};

// ==========================================
// 12. DESPACHAR UNA RECETA
// ==========================================

export const despacharReceta = (
  recetaId: number,
  farmaceuticoId: string
): RecetaMedica => {
  const receta = recetas.get(recetaId);

  if (!receta) {
    throw new Error("La receta médica no existe");
  }

  if (receta.estado !== "En Proceso") {
    throw new Error(
      "Solo se pueden despachar recetas que estén En Proceso"
    );
  }

  if (!farmaceuticoId.trim()) {
    throw new Error("El identificador del farmacéutico es obligatorio");
  }

  if (receta.detalles.length === 0) {
    throw new Error("No se puede despachar una receta sin medicamentos");
  }

  if (receta.fecha_vigencia.slice(0, 10) < fechaHoy()) {
    throw new Error("No se puede despachar una receta vencida");
  }

  // Agrupar cantidades por medicamento.
  // Esto evita errores si un medicamento aparece varias veces
  // en los detalles de la misma receta.

  const cantidadesNecesarias = new Map<number, number>();

  for (const detalle of receta.detalles) {
    const cantidadActual =
      cantidadesNecesarias.get(detalle.medicamento_id) ?? 0;

    cantidadesNecesarias.set(
      detalle.medicamento_id,
      cantidadActual + detalle.cantidad
    );
  }

  // PRIMERA FASE: comprobar todo el inventario.
  // Todavía no se modifica ninguna existencia.

  for (const [medicamentoId, cantidadNecesaria] of cantidadesNecesarias) {
    const medicamento = medicamentos.get(medicamentoId);

    if (!medicamento) {
      throw new Error(`El medicamento ${medicamentoId} no existe`);
    }

    if (medicamento.stock < cantidadNecesaria) {
      throw new Error(
        `Stock insuficiente de ${medicamento.nombre}. ` +
        `Disponible: ${medicamento.stock}. ` +
        `Solicitado: ${cantidadNecesaria}`
      );
    }
  }

  // SEGUNDA FASE: aplicar los descuentos.
  // Solo se llega aquí si todos los medicamentos tienen stock.

  const fecha = fechaActual();

  for (const [medicamentoId, cantidadNecesaria] of cantidadesNecesarias) {
    const medicamento = medicamentos.get(medicamentoId);

    if (!medicamento) {
      throw new Error(`El medicamento ${medicamentoId} no existe`);
    }

    medicamento.stock -= cantidadNecesaria;

    movimientosInventario.push({
      id: siguienteIdMovimiento++,
      medicamento_id: medicamentoId,
      receta_id: receta.id,
      tipo: "SALIDA",
      cantidad: cantidadNecesaria,
      fecha_movimiento: fecha
    });
  }

  // Registrar farmacéutico y fecha de despacho.

  receta.farmaceutico_id = farmaceuticoId;
  receta.fecha_despacho = fecha;

  registrarCambioEstado(receta, "Despachada", fecha);

  return receta;
};

// ==========================================
// 13. CONSULTAR INVENTARIO
// ==========================================

export const obtenerInventario = (): Medicamento[] => {
  return Array.from(medicamentos.values());
};

// ==========================================
// 14. CONSULTAR HISTORIAL DE ESTADOS
// ==========================================

export const obtenerHistorialEstados = (
  recetaId: number
): HistorialEstadoReceta[] => {
  return historialEstados.filter(
    (registro) => registro.receta_id === recetaId
  );
};

// ==========================================
// 15. CONSULTAR MOVIMIENTOS DE INVENTARIO
// ==========================================

export const obtenerMovimientosInventario = (
  recetaId: number
): MovimientoInventario[] => {
  return movimientosInventario.filter(
    (movimiento) => movimiento.receta_id === recetaId
  );
};
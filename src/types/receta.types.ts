
export type EstadoReceta =
  | "Emitida"
  | "En Proceso"
  | "Despachada"
  | "Cancelada"
  | "Vencida";

export interface DetalleReceta {
  id: number;
  receta_id: number;
  medicamento_id: number;
  cantidad: number;
  dosis: string;
  indicaciones: string;
}

export interface RecetaMedica {
  id: number;
  codigo_qr: string;
  medico_id: string;
  paciente_id: string;
  farmaceutico_id: string | null;
  estado: EstadoReceta;
  fecha_emision: string;
  fecha_vigencia: string;
  fecha_despacho: string | null;
  observaciones: string | null;
  actualizado_en: string;
  detalles: DetalleReceta[];
}

export interface Medicamento {
  id: number;
  codigo: string;
  nombre: string;
  presentacion: string;
  stock: number;
  stock_minimo: number;
}

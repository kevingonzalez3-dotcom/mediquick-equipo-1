-- =====================================================================
-- MediQuick Digital - Migración V3: Evolución del esquema SIN pérdida
-- de información.
-- Descripción: amplía la estructura existente para soportar el control
-- de stock y la trazabilidad de estados, sin borrar tablas, columnas
-- ni filas. Técnicas usadas:
--   * ADD COLUMN con valor DEFAULT -> las filas existentes reciben un
--     valor válido automáticamente.
--   * Reemplazo de un CHECK por otro MÁS amplio -> los datos actuales
--     siguen cumpliendo la nueva regla.
--   * CREATE TABLE nuevas + backfill (relleno) desde datos existentes.
-- =====================================================================

-- 1) Medicamento: stock mínimo para alertas de reabastecimiento
ALTER TABLE medicamento
    ADD COLUMN stock_minimo INT NOT NULL DEFAULT 10;

ALTER TABLE medicamento
    ADD CONSTRAINT ck_medicamento_stock_minimo CHECK (stock_minimo >= 0);

-- 2) RecetaMedica: fecha de última actualización
ALTER TABLE receta_medica
    ADD COLUMN actualizado_en TIMESTAMP NOT NULL DEFAULT NOW();

-- 3) Se agrega el estado "Vencida" (definido en el diagrama de estados
--    del Parcial 1). Se reemplaza el CHECK por uno que incluye todos los
--    estados anteriores, así ninguna receta existente queda inválida.
ALTER TABLE receta_medica DROP CONSTRAINT ck_receta_estado;
ALTER TABLE receta_medica
    ADD CONSTRAINT ck_receta_estado
    CHECK (estado IN ('Emitida', 'En Proceso', 'Despachada', 'Cancelada', 'Vencida'));

-- 4) Historial de cambios de estado de cada receta (auditoría)
CREATE TABLE historial_estado_receta (
    id               SERIAL      PRIMARY KEY,
    receta_id        INT         NOT NULL REFERENCES receta_medica(id) ON DELETE CASCADE,
    estado_anterior  VARCHAR(20),
    estado_nuevo     VARCHAR(20) NOT NULL,
    cambiado_en      TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_historial_receta ON historial_estado_receta(receta_id);

-- Backfill: las recetas que ya existían reciben su registro inicial,
-- para que el historial quede completo desde el primer día.
INSERT INTO historial_estado_receta (receta_id, estado_anterior, estado_nuevo, cambiado_en)
SELECT id, NULL, estado, fecha_emision
FROM receta_medica;

-- 5) Movimientos de inventario: cada salida o entrada de stock queda
--    registrada y enlazada con la receta que la originó.
CREATE TABLE movimiento_inventario (
    id              SERIAL      PRIMARY KEY,
    medicamento_id  INT         NOT NULL REFERENCES medicamento(id),
    receta_id       INT         REFERENCES receta_medica(id),
    tipo            VARCHAR(10) NOT NULL,
    cantidad        INT         NOT NULL,
    stock_resultante INT        NOT NULL,
    fecha           TIMESTAMP   NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_movimiento_tipo     CHECK (tipo IN ('ENTRADA', 'SALIDA')),
    CONSTRAINT ck_movimiento_cantidad CHECK (cantidad > 0)
);

CREATE INDEX ix_movimiento_medicamento ON movimiento_inventario(medicamento_id);

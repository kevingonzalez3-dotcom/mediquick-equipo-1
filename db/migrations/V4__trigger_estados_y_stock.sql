-- =====================================================================
-- MediQuick Digital - Migración V4: Reglas de estado y stock en la BD
-- Descripción: crea un trigger que se ejecuta cada vez que cambia el
-- estado de una receta. Implementa en la base de datos el mismo flujo
-- del patrón State del Parcial 1:
--
--   Emitida    -> En Proceso | Cancelada | Vencida
--   En Proceso -> Despachada | Cancelada
--   Despachada, Cancelada, Vencida -> estados finales (no cambian)
--
-- Al pasar a "Despachada":
--   * verifica que haya stock suficiente de cada medicamento,
--   * descuenta el stock,
--   * registra la SALIDA en movimiento_inventario,
--   * guarda la fecha de despacho.
-- Si algo no cumple, la transacción completa se revierte.
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_cambio_estado_receta()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_detalle RECORD;
    v_stock_actual INT;
BEGIN
    -- Si el estado no cambió, no hay nada que validar
    IF NEW.estado = OLD.estado THEN
        RETURN NEW;
    END IF;

    -- 1) Validar que la transición sea permitida
    IF NOT (
           (OLD.estado = 'Emitida'    AND NEW.estado IN ('En Proceso', 'Cancelada', 'Vencida'))
        OR (OLD.estado = 'En Proceso' AND NEW.estado IN ('Despachada', 'Cancelada'))
    ) THEN
        RAISE EXCEPTION 'Transición de estado inválida: % -> % (receta %)',
            OLD.estado, NEW.estado, OLD.codigo_qr;
    END IF;

    -- 2) Al despachar: validar vigencia, descontar stock y registrar salida
    IF NEW.estado = 'Despachada' THEN
        IF OLD.fecha_vigencia < CURRENT_DATE THEN
            RAISE EXCEPTION 'La receta % está vencida y no puede despacharse', OLD.codigo_qr;
        END IF;

        FOR v_detalle IN
            SELECT medicamento_id, cantidad
            FROM detalle_receta
            WHERE receta_id = NEW.id
        LOOP
            -- FOR UPDATE bloquea la fila para evitar que dos despachos
            -- simultáneos usen el mismo stock
            SELECT stock INTO v_stock_actual
            FROM medicamento
            WHERE id = v_detalle.medicamento_id
            FOR UPDATE;

            IF v_stock_actual < v_detalle.cantidad THEN
                RAISE EXCEPTION 'Stock insuficiente del medicamento %: disponible %, requerido %',
                    v_detalle.medicamento_id, v_stock_actual, v_detalle.cantidad;
            END IF;

            UPDATE medicamento
            SET stock = stock - v_detalle.cantidad
            WHERE id = v_detalle.medicamento_id;

            INSERT INTO movimiento_inventario (medicamento_id, receta_id, tipo, cantidad, stock_resultante)
            VALUES (v_detalle.medicamento_id, NEW.id, 'SALIDA', v_detalle.cantidad,
                    v_stock_actual - v_detalle.cantidad);
        END LOOP;

        NEW.fecha_despacho := NOW();
    END IF;

    -- 3) Auditoría del cambio y fecha de actualización
    INSERT INTO historial_estado_receta (receta_id, estado_anterior, estado_nuevo)
    VALUES (NEW.id, OLD.estado, NEW.estado);

    NEW.actualizado_en := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cambio_estado_receta
    BEFORE UPDATE OF estado ON receta_medica
    FOR EACH ROW
    EXECUTE FUNCTION fn_cambio_estado_receta();

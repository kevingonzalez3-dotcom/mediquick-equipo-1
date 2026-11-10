-- =====================================================================
-- MediQuick Digital - Verificación automática de la migración
-- Se ejecuta en el pipeline DESPUÉS de "flyway migrate".
-- Si cualquier comprobación falla, psql termina con error y el job
-- de GitHub Actions queda en rojo.
-- Todo corre dentro de una transacción que se revierte al final, así
-- la verificación no deja cambios en la base.
-- =====================================================================
\set ON_ERROR_STOP on

BEGIN;

-- 1) Los datos cargados en V2 siguen presentes después de V3 y V4
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM medicamento) <> 5 THEN
        RAISE EXCEPTION 'FALLO: se perdieron medicamentos durante la migración';
    END IF;
    IF (SELECT COUNT(*) FROM receta_medica) <> 1 THEN
        RAISE EXCEPTION 'FALLO: se perdieron recetas durante la migración';
    END IF;
    IF (SELECT stock_minimo FROM medicamento WHERE codigo = 'MED-001') <> 10 THEN
        RAISE EXCEPTION 'FALLO: la columna nueva stock_minimo no recibió su valor por defecto';
    END IF;
    IF (SELECT COUNT(*) FROM historial_estado_receta) <> 1 THEN
        RAISE EXCEPTION 'FALLO: el backfill del historial no se ejecutó';
    END IF;
    RAISE NOTICE 'OK 1/4: datos existentes conservados y columnas nuevas pobladas';
END $$;

-- 2) Flujo válido: Emitida -> En Proceso -> Despachada descuenta stock
UPDATE receta_medica SET estado = 'En Proceso', farmaceutico_id = '22222222-2222-2222-2222-222222222222'
WHERE codigo_qr = 'aaaaaaaa-0000-4000-8000-000000000001';

UPDATE receta_medica SET estado = 'Despachada'
WHERE codigo_qr = 'aaaaaaaa-0000-4000-8000-000000000001';

DO $$
BEGIN
    IF (SELECT stock FROM medicamento WHERE codigo = 'MED-001') <> 119 THEN
        RAISE EXCEPTION 'FALLO: el stock de MED-001 no se descontó';
    END IF;
    IF (SELECT COUNT(*) FROM movimiento_inventario WHERE tipo = 'SALIDA') <> 2 THEN
        RAISE EXCEPTION 'FALLO: no se registraron las salidas de inventario';
    END IF;
    IF (SELECT fecha_despacho FROM receta_medica WHERE codigo_qr = 'aaaaaaaa-0000-4000-8000-000000000001') IS NULL THEN
        RAISE EXCEPTION 'FALLO: no se guardó la fecha de despacho';
    END IF;
    RAISE NOTICE 'OK 2/4: despacho descuenta stock y registra movimientos';
END $$;

-- 3) Flujo inválido: una receta Despachada no puede volver a despacharse
--    ni cancelarse. El trigger debe rechazarlo.
DO $$
BEGIN
    BEGIN
        UPDATE receta_medica SET estado = 'Cancelada'
        WHERE codigo_qr = 'aaaaaaaa-0000-4000-8000-000000000001';
        RAISE EXCEPTION 'FALLO: se permitió cancelar una receta ya despachada';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FALLO:%' THEN RAISE; END IF;
        RAISE NOTICE 'OK 3/4: transición inválida rechazada -> %', SQLERRM;
    END;
END $$;

-- 4) El CHECK no permite estados que no existen
DO $$
BEGIN
    BEGIN
        INSERT INTO receta_medica (medico_id, paciente_id, fecha_vigencia, estado)
        VALUES ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
                CURRENT_DATE + 5, 'Perdida');
        RAISE EXCEPTION 'FALLO: se aceptó un estado inexistente';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK 4/4: estado inexistente rechazado por la restricción CHECK';
    END;
END $$;

ROLLBACK;

\echo '>>> Verificación de migración completada: 4/4 comprobaciones OK'

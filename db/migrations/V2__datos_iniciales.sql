-- =====================================================================
-- MediQuick Digital - Migración V2: Datos iniciales de prueba
-- Descripción: carga un catálogo básico de medicamentos y un usuario
-- de cada tipo con una receta de ejemplo. Estos datos sirven para
-- demostrar que la migración V3 modifica la estructura SIN perderlos.
-- Las contraseñas son hashes de ejemplo, no credenciales reales.
-- =====================================================================

INSERT INTO medicamento (codigo, nombre, presentacion, stock) VALUES
    ('MED-001', 'Amoxicilina 500 mg',     'Caja 21 cápsulas', 120),
    ('MED-002', 'Ibuprofeno 400 mg',      'Caja 20 tabletas', 200),
    ('MED-003', 'Loratadina 10 mg',       'Caja 10 tabletas',  80),
    ('MED-004', 'Omeprazol 20 mg',        'Caja 14 cápsulas',  60),
    ('MED-005', 'Metformina 850 mg',      'Caja 30 tabletas',  45);

-- Usuarios de demostración (UUID fijos para poder referenciarlos)
INSERT INTO usuario (id, nombre, correo, contrasena_hash, rol) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Dra. Ana Martínez', 'ana.martinez@mediquick.test', '$2b$12$hashDeEjemploNoReal000000000000000000000000000000000', 'MEDICO'),
    ('22222222-2222-2222-2222-222222222222', 'Lic. Carlos Rivas', 'carlos.rivas@mediquick.test', '$2b$12$hashDeEjemploNoReal000000000000000000000000000000000', 'FARMACEUTICO'),
    ('33333333-3333-3333-3333-333333333333', 'José López',        'jose.lopez@mediquick.test',   '$2b$12$hashDeEjemploNoReal000000000000000000000000000000000', 'PACIENTE');

INSERT INTO medico       (usuario_id, numero_jvpm, especialidad)     VALUES ('11111111-1111-1111-1111-111111111111', 'JVPM-12345', 'Medicina General');
INSERT INTO farmaceutico (usuario_id, numero_licencia, sucursal)     VALUES ('22222222-2222-2222-2222-222222222222', 'LQF-0987',   'Sucursal Santa Ana Centro');
INSERT INTO paciente     (usuario_id, dui, fecha_nacimiento, telefono) VALUES ('33333333-3333-3333-3333-333333333333', '01234567-8', '1995-04-12', '7777-0000');

-- Receta de ejemplo en estado "Emitida" con dos medicamentos
INSERT INTO receta_medica (codigo_qr, medico_id, paciente_id, fecha_vigencia, observaciones) VALUES
    ('aaaaaaaa-0000-4000-8000-000000000001',
     '11111111-1111-1111-1111-111111111111',
     '33333333-3333-3333-3333-333333333333',
     CURRENT_DATE + 30,
     'Infección respiratoria leve');

INSERT INTO detalle_receta (receta_id, medicamento_id, cantidad, dosis, indicaciones)
SELECT r.id, m.id, d.cantidad, d.dosis, d.indicaciones
FROM receta_medica r
JOIN (VALUES
        ('MED-001', 1, '1 cápsula cada 8 horas', 'Tomar por 7 días'),
        ('MED-002', 1, '1 tableta cada 8 horas', 'Solo si hay dolor o fiebre')
     ) AS d(codigo, cantidad, dosis, indicaciones) ON TRUE
JOIN medicamento m ON m.codigo = d.codigo
WHERE r.codigo_qr = 'aaaaaaaa-0000-4000-8000-000000000001';

-- =====================================================================
-- MediQuick Digital - Migración V1: Esquema inicial
-- Autor: Estudiante 3 - Data & DevSecOps Specialist
-- Motor: PostgreSQL 16 | Herramienta: Flyway
-- Descripción: crea las tablas base del dominio definidas en el
-- diagrama de clases del Parcial 1 (Usuario, Medico, Farmaceutico,
-- Paciente, Medicamento, RecetaMedica, DetalleReceta).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Usuario: clase abstracta del diagrama. Se guarda en una sola tabla
-- con un campo "rol"; cada tipo de usuario tiene su tabla de detalle.
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre           VARCHAR(120) NOT NULL,
    correo           VARCHAR(150) NOT NULL UNIQUE,
    contrasena_hash  VARCHAR(255) NOT NULL,
    rol              VARCHAR(20)  NOT NULL,
    creado_en        TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_usuario_rol CHECK (rol IN ('MEDICO', 'FARMACEUTICO', 'PACIENTE'))
);

CREATE TABLE medico (
    usuario_id    UUID         PRIMARY KEY REFERENCES usuario(id),
    numero_jvpm   VARCHAR(20)  NOT NULL UNIQUE,   -- Junta de Vigilancia de la Profesión Médica
    especialidad  VARCHAR(100) NOT NULL
);

CREATE TABLE farmaceutico (
    usuario_id       UUID         PRIMARY KEY REFERENCES usuario(id),
    numero_licencia  VARCHAR(20)  NOT NULL UNIQUE,
    sucursal         VARCHAR(100) NOT NULL
);

CREATE TABLE paciente (
    usuario_id        UUID        PRIMARY KEY REFERENCES usuario(id),
    dui               VARCHAR(10) NOT NULL UNIQUE,
    fecha_nacimiento  DATE        NOT NULL,
    telefono          VARCHAR(15)
);

-- ---------------------------------------------------------------------
-- Medicamento: catálogo con su stock disponible en farmacia.
-- El CHECK impide que el stock quede negativo.
-- ---------------------------------------------------------------------
CREATE TABLE medicamento (
    id            SERIAL        PRIMARY KEY,
    codigo        VARCHAR(20)   NOT NULL UNIQUE,
    nombre        VARCHAR(120)  NOT NULL,
    presentacion  VARCHAR(80)   NOT NULL,
    stock         INT           NOT NULL DEFAULT 0,
    CONSTRAINT ck_medicamento_stock CHECK (stock >= 0)
);

-- ---------------------------------------------------------------------
-- RecetaMedica: entidad central. "codigo_qr" es el UUID que se imprime
-- en el código QR que escanea el farmacéutico.
-- Estados permitidos según la guía del laboratorio:
-- Emitida, En Proceso, Despachada, Cancelada.
-- ---------------------------------------------------------------------
CREATE TABLE receta_medica (
    id               SERIAL       PRIMARY KEY,
    codigo_qr        UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    medico_id        UUID         NOT NULL REFERENCES medico(usuario_id),
    paciente_id      UUID         NOT NULL REFERENCES paciente(usuario_id),
    farmaceutico_id  UUID         REFERENCES farmaceutico(usuario_id),  -- se llena al despachar
    estado           VARCHAR(20)  NOT NULL DEFAULT 'Emitida',
    fecha_emision    TIMESTAMP    NOT NULL DEFAULT NOW(),
    fecha_vigencia   DATE         NOT NULL,
    fecha_despacho   TIMESTAMP,
    observaciones    TEXT,
    CONSTRAINT ck_receta_estado CHECK (estado IN ('Emitida', 'En Proceso', 'Despachada', 'Cancelada')),
    CONSTRAINT ck_receta_vigencia CHECK (fecha_vigencia >= fecha_emision::date)
);

-- ---------------------------------------------------------------------
-- DetalleReceta: composición 1..* con RecetaMedica (si se borra la
-- receta se borran sus detalles).
-- ---------------------------------------------------------------------
CREATE TABLE detalle_receta (
    id              SERIAL       PRIMARY KEY,
    receta_id       INT          NOT NULL REFERENCES receta_medica(id) ON DELETE CASCADE,
    medicamento_id  INT          NOT NULL REFERENCES medicamento(id),
    cantidad        INT          NOT NULL,
    dosis           VARCHAR(100) NOT NULL,
    indicaciones    TEXT,
    CONSTRAINT ck_detalle_cantidad CHECK (cantidad > 0)
);

-- Índices para las consultas más frecuentes de la API
CREATE INDEX ix_receta_paciente ON receta_medica(paciente_id);
CREATE INDEX ix_receta_estado   ON receta_medica(estado);
CREATE INDEX ix_detalle_receta  ON detalle_receta(receta_id);

-- =============================================================================
-- Vitoria-Gasteiz PWA: Capa de Base de Datos Geoespacial
-- PostgreSQL 16 + PostGIS 3.4
-- =============================================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Tabla LUGARES (Patrimonio, Naturaleza, Cultura, Gastronomía, Ocio, Comercio)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lugares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255) UNIQUE,
    fuente_origen VARCHAR(50) NOT NULL DEFAULT 'opendata_vg',
    nombre VARCHAR(255) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    subcategoria VARCHAR(100),
    descripcion TEXT,
    direccion VARCHAR(255),
    imagen_url TEXT,
    telefono VARCHAR(50),
    web TEXT,
    metadata JSONB,
    geom GEOMETRY(Point, 4326) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Categorías canónicas según AGENTS.md
    CONSTRAINT check_categoria CHECK (
        categoria IN ('patrimonio', 'cultura', 'naturaleza', 'gastronomia', 'ocio', 'comercio')
    ),

    -- Restricción estricta de Bounding Box municipal (EPSG:4326):
    -- ST_MakeEnvelope(xmin, ymin, xmax, ymax, srid)
    -- ST_MakeEnvelope(-2.7700, 42.7800, -2.5700, 42.9200, 4326)
    CONSTRAINT check_vitoria_bbox CHECK (
        ST_Within(geom, ST_MakeEnvelope(-2.7700, 42.7800, -2.5700, 42.9200, 4326))
    )
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_lugares_geom ON lugares USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_lugares_categoria ON lugares (categoria);
CREATE INDEX IF NOT EXISTS idx_lugares_nombre_trgm ON lugares USING GIN (nombre gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- 2. Tabla EVENTOS (Agenda cultural Kulturklik municipio 01059)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255) UNIQUE,
    fuente_origen VARCHAR(50) NOT NULL DEFAULT 'kulturklik',
    titulo VARCHAR(255) NOT NULL,
    categoria VARCHAR(50) NOT NULL DEFAULT 'cultura',
    descripcion TEXT,
    espacio VARCHAR(255),
    direccion VARCHAR(255),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    hora VARCHAR(50),
    precio VARCHAR(100),
    imagen_url TEXT,
    enlace_web TEXT,
    metadata JSONB,
    geom GEOMETRY(Point, 4326) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Categorías canónicas
    CONSTRAINT check_evento_categoria CHECK (
        categoria IN ('cultura', 'patrimonio', 'ocio', 'gastronomia', 'naturaleza', 'comercio')
    ),

    -- Restricción estricta de Bounding Box municipal
    CONSTRAINT check_vitoria_bbox_eventos CHECK (
        ST_Within(geom, ST_MakeEnvelope(-2.7700, 42.7800, -2.5700, 42.9200, 4326))
    )
);

-- Índices de rendimiento para eventos
CREATE INDEX IF NOT EXISTS idx_eventos_geom ON eventos USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_eventos_fechas ON eventos (fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_eventos_categoria ON eventos (categoria);
CREATE INDEX IF NOT EXISTS idx_eventos_titulo_trgm ON eventos USING GIN (titulo gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- 3. Trigger para validar Bounding Box de Vitoria-Gasteiz con mensaje explícito
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_validar_bbox_vitoria()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT ST_Within(NEW.geom, ST_MakeEnvelope(-2.7700, 42.7800, -2.5700, 42.9200, 4326)) THEN
        RAISE EXCEPTION 'Spatial Constraint Violation: Coordenadas [%] fuera del Bounding Box de Vitoria-Gasteiz ST_MakeEnvelope(-2.7700, 42.7800, -2.5700, 42.9200, 4326)',
            ST_AsText(NEW.geom);
    END IF;
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_lugares_bbox ON lugares;
CREATE TRIGGER check_lugares_bbox
    BEFORE INSERT OR UPDATE ON lugares
    FOR EACH ROW
    EXECUTE FUNCTION trg_validar_bbox_vitoria();

DROP TRIGGER IF EXISTS check_eventos_bbox ON eventos;
CREATE TRIGGER check_eventos_bbox
    BEFORE INSERT OR UPDATE ON eventos
    FOR EACH ROW
    EXECUTE FUNCTION trg_validar_bbox_vitoria();

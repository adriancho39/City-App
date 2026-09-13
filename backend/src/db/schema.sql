-- =============================================================================
-- Vitoria-Gasteiz Urban Leisure & Tourism PWA
-- Database Schema: PostgreSQL 16 + PostGIS 3.4
-- =============================================================================

-- Enable PostGIS spatial extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing table and functions if needed for re-runs
-- DROP TABLE IF EXISTS pois CASCADE;

-- Categories: 'Patrimonio', 'Naturaleza', 'Cultura', 'Gastronomía'
CREATE TABLE IF NOT EXISTS pois (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255) UNIQUE,
    source VARCHAR(50) NOT NULL, -- 'kulturklik' | 'opendata_municipal' | 'geovitoria'
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(100),
    description TEXT,
    address VARCHAR(255),
    image_url TEXT,
    phone VARCHAR(100),
    website TEXT,
    price VARCHAR(100),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    raw_data JSONB,
    geom GEOMETRY(Point, 4326) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Category check constraint
    CONSTRAINT check_poi_category CHECK (
        category IN ('Patrimonio', 'Naturaleza', 'Cultura', 'Gastronomía')
    ),

    -- Strict Bounding Box Constraint:
    -- ST_MakeEnvelope(xmin, ymin, xmax, ymax, srid)
    -- ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)
    CONSTRAINT check_vitoria_bbox CHECK (
        ST_Within(geom, ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326))
    )
);

-- Spatial GIST index on point geometry for fast spatial searches (ST_DWithin, ST_Distance)
CREATE INDEX IF NOT EXISTS idx_pois_geom ON pois USING GIST (geom);

-- B-Tree indexes for fast filtering by category and date ranges
CREATE INDEX IF NOT EXISTS idx_pois_category ON pois (category);
CREATE INDEX IF NOT EXISTS idx_pois_source ON pois (source);
CREATE INDEX IF NOT EXISTS idx_pois_dates ON pois (start_date, end_date);

-- Trigger to validate bounding box and reject out-of-boundary records with informative error
CREATE OR REPLACE FUNCTION trg_enforce_vitoria_bbox()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT ST_Within(NEW.geom, ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)) THEN
        RAISE EXCEPTION 'Spatial Constraint Violation: Point [%] is outside the Vitoria-Gasteiz bounding box ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)',
            ST_AsText(NEW.geom);
    END IF;
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_vitoria_bbox_trigger ON pois;
CREATE TRIGGER check_vitoria_bbox_trigger
    BEFORE INSERT OR UPDATE ON pois
    FOR EACH ROW
    EXECUTE FUNCTION trg_enforce_vitoria_bbox();

-- Proximity Query Function (ST_DWithin in meters with geography projection)
CREATE OR REPLACE FUNCTION get_pois_proximity(
    center_lon DOUBLE PRECISION,
    center_lat DOUBLE PRECISION,
    radius_meters DOUBLE PRECISION DEFAULT 3000.0,
    filter_category VARCHAR DEFAULT NULL,
    filter_search VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    external_id VARCHAR,
    source VARCHAR,
    name VARCHAR,
    category VARCHAR,
    subcategory VARCHAR,
    description TEXT,
    address VARCHAR,
    image_url TEXT,
    phone VARCHAR,
    website TEXT,
    price VARCHAR,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    lon DOUBLE PRECISION,
    lat DOUBLE PRECISION,
    distance_meters DOUBLE PRECISION
) AS $$
DECLARE
    center_geom GEOMETRY;
BEGIN
    center_geom := ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326);

    RETURN QUERY
    SELECT
        p.id,
        p.external_id,
        p.source,
        p.name,
        p.category,
        p.subcategory,
        p.description,
        p.address,
        p.image_url,
        p.phone,
        p.website,
        p.price,
        p.start_date,
        p.end_date,
        ST_X(p.geom) AS lon,
        ST_Y(p.geom) AS lat,
        ROUND(ST_Distance(p.geom::geography, center_geom::geography)::numeric, 1)::DOUBLE PRECISION AS distance_meters
    FROM pois p
    WHERE (radius_meters IS NULL OR ST_DWithin(p.geom::geography, center_geom::geography, radius_meters))
      AND (filter_category IS NULL OR filter_category = '' OR p.category = filter_category)
      AND (filter_search IS NULL OR filter_search = '' OR p.name ILIKE '%' || filter_search || '%' OR p.description ILIKE '%' || filter_search || '%')
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;

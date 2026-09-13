import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env if present
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://vitoria_user:vitoria_password@localhost:5432/vitoria_turismo',
  PG: {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'vitoria_user',
    password: process.env.PGPASSWORD || 'vitoria_password',
    database: process.env.PGDATABASE || 'vitoria_turismo',
    connectionTimeoutMillis: 3000,
  },
  // Vitoria-Gasteiz Bounding Box specification:
  // ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)
  BBOX: {
    minLon: -2.77,
    minLat: 42.78,
    maxLon: -2.57,
    maxLat: 42.92,
    srid: 4326,
  },
  // City center (Plaza de la Virgen Blanca)
  CENTER: {
    lon: -2.6716,
    lat: 42.8467,
  },
  CATEGORIES: ['Patrimonio', 'Naturaleza', 'Cultura', 'Gastronomía'] as const,
  RADII_METERS: [500, 1000, 3000] as const,
  KULTURKLIK_API_URL: 'https://api.euskadi.eus/culture/events/v1.0/events',
  KULTURKLIK_MUNICIPALITY_NORA: '46', // Vitoria-Gasteiz Nora code in Province 01 (INE 01059)
  KULTURKLIK_PROVINCE_NORA: '01',
  GEOVITORIA_CAPA_URL: 'https://www.vitoria-gasteiz.org/j16-02w/capaAction.do?accion=CARGAR_ELEMENTOS_CAPA&idioma=ES',
};

export type CategoryType = typeof CONFIG.CATEGORIES[number];

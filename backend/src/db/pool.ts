import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from '../config.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const pool = new Pool({
  connectionString: CONFIG.DATABASE_URL,
  connectionTimeoutMillis: 3000,
});

let postgresAvailable = false;

export async function checkPostgresConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT PostGIS_Version();');
      console.log(`[Database] PostgreSQL + PostGIS connected successfully! Version: ${res.rows[0].postgis_version}`);
      postgresAvailable = true;

      // Run schema migrations if pois table doesn't exist
      const tableCheck = await client.query(`
        SELECT to_regclass('public.pois') as table_exists;
      `);

      if (!tableCheck.rows[0].table_exists) {
        console.log('[Database] Initializing schema from schema.sql...');
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
        await client.query(schemaSql);
        console.log('[Database] Schema initialized successfully.');
      }

      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn(`[Database] PostgreSQL not detected (${err.message}). Activating Standalone Geo-Engine with ST_MakeEnvelope verification.`);
    postgresAvailable = false;
    return false;
  }
}

export function isPostgresConnected(): boolean {
  return postgresAvailable;
}

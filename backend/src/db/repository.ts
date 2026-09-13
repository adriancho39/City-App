import { pool, isPostgresConnected } from './pool.js';
import { memoryStore } from './memoryStore.js';
import { Poi, ScrapedPoiInput, PoiQueryFilters, CategoryStats } from '../models/poi.js';
import { isWithinVitoriaBBox } from '../geo/bbox.js';
import { CONFIG } from '../config.js';

export class PoiRepository {
  /**
   * Inserts or updates a POI, enforcing the spatial bounding box constraint
   */
  async savePoi(input: ScrapedPoiInput): Promise<{ success: boolean; rejected: boolean; reason?: string }> {
    // 1. First line of defense: Scraper-level validation against ST_MakeEnvelope
    if (!isWithinVitoriaBBox(input.lon, input.lat)) {
      return {
        success: false,
        rejected: true,
        reason: `Coordinates [${input.lon}, ${input.lat}] outside Vitoria-Gasteiz bbox ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)`,
      };
    }

    // Always update memory store for quick local lookups / caching
    memoryStore.upsert(input);

    // If PostGIS is connected, persist to PostgreSQL
    if (isPostgresConnected()) {
      const query = `
        INSERT INTO pois (
          external_id, source, name, category, subcategory,
          description, address, image_url, phone, website,
          price, start_date, end_date, raw_data, geom
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          ST_SetSRID(ST_MakePoint($15, $16), 4326)
        )
        ON CONFLICT (external_id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          subcategory = EXCLUDED.subcategory,
          description = EXCLUDED.description,
          address = EXCLUDED.address,
          image_url = EXCLUDED.image_url,
          phone = EXCLUDED.phone,
          website = EXCLUDED.website,
          price = EXCLUDED.price,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          raw_data = EXCLUDED.raw_data,
          geom = EXCLUDED.geom,
          updated_at = CURRENT_TIMESTAMP;
      `;

      const values = [
        input.external_id,
        input.source,
        input.name,
        input.category,
        input.subcategory || null,
        input.description || null,
        input.address || null,
        input.image_url || null,
        input.phone || null,
        input.website || null,
        input.price || null,
        input.start_date ? new Date(input.start_date) : null,
        input.end_date ? new Date(input.end_date) : null,
        input.raw_data ? JSON.stringify(input.raw_data) : null,
        input.lon,
        input.lat,
      ];

      try {
        await pool.query(query, values);
      } catch (err: any) {
        console.error(`[PoiRepository] PostGIS Insert Error: ${err.message}`);
        // If Postgres rejected via BBOX constraint
        if (err.message.includes('check_vitoria_bbox') || err.message.includes('Spatial Constraint Violation')) {
          return { success: false, rejected: true, reason: err.message };
        }
        throw err;
      }
    }

    return { success: true, rejected: false };
  }

  /**
   * Queries POIs by distance, proximity radius, category, and text search
   */
  async findPois(filters: PoiQueryFilters): Promise<{ pois: Poi[]; total: number }> {
    if (isPostgresConnected()) {
      try {
        const centerLon = filters.centerLon ?? CONFIG.CENTER.lon;
        const centerLat = filters.centerLat ?? CONFIG.CENTER.lat;
        const radius = filters.radiusMeters ?? null;
        const category = filters.category || null;
        const search = filters.search || null;

        const query = `
          SELECT * FROM get_pois_proximity($1, $2, $3, $4, $5)
          LIMIT $6 OFFSET $7;
        `;
        const limit = filters.limit || 500;
        const offset = filters.offset || 0;

        const res = await pool.query(query, [centerLon, centerLat, radius, category, search, limit, offset]);

        const pois: Poi[] = res.rows.map((r: any) => ({
          id: r.id,
          external_id: r.external_id,
          source: r.source,
          name: r.name,
          category: r.category,
          subcategory: r.subcategory,
          description: r.description,
          address: r.address,
          image_url: r.image_url,
          phone: r.phone,
          website: r.website,
          price: r.price,
          start_date: r.start_date ? r.start_date.toISOString() : undefined,
          end_date: r.end_date ? r.end_date.toISOString() : undefined,
          lon: parseFloat(r.lon),
          lat: parseFloat(r.lat),
          distance_meters: parseFloat(r.distance_meters),
        }));

        return { pois, total: pois.length };
      } catch (err: any) {
        console.warn(`[PoiRepository] PostGIS query failed (${err.message}). Falling back to memory store.`);
      }
    }

    // Fallback or standalone execution
    return memoryStore.find(filters);
  }

  async getPoiById(id: string): Promise<Poi | undefined> {
    if (isPostgresConnected()) {
      try {
        const res = await pool.query(
          `SELECT id, external_id, source, name, category, subcategory, description,
                  address, image_url, phone, website, price, start_date, end_date,
                  ST_X(geom) as lon, ST_Y(geom) as lat
           FROM pois WHERE id::text = $1 OR external_id = $1`,
          [id]
        );
        if (res.rows.length > 0) {
          const r = res.rows[0];
          return {
            id: r.id,
            external_id: r.external_id,
            source: r.source,
            name: r.name,
            category: r.category,
            subcategory: r.subcategory,
            description: r.description,
            address: r.address,
            image_url: r.image_url,
            phone: r.phone,
            website: r.website,
            price: r.price,
            start_date: r.start_date?.toISOString(),
            end_date: r.end_date?.toISOString(),
            lon: parseFloat(r.lon),
            lat: parseFloat(r.lat),
          };
        }
      } catch (err: any) {
        console.warn(`[PoiRepository] getPoiById query failed: ${err.message}`);
      }
    }

    return memoryStore.findById(id);
  }

  async getCategoryStats(): Promise<CategoryStats[]> {
    if (isPostgresConnected()) {
      try {
        const res = await pool.query(`
          SELECT category, COUNT(*)::int as count
          FROM pois
          GROUP BY category;
        `);

        const map: Record<string, number> = {};
        for (const row of res.rows) {
          map[row.category] = row.count;
        }

        return [
          {
            category: 'Patrimonio',
            count: map['Patrimonio'] || 0,
            icon: 'landmark',
            color: '#b45309',
            description: 'Monumentos históricos, catedrales, muralla medieval y palacios renacentistas.',
          },
          {
            category: 'Naturaleza',
            count: map['Naturaleza'] || 0,
            icon: 'trees',
            color: '#15803d',
            description: 'Anillo Verde de Vitoria-Gasteiz, humedales de Salburua y parques urbanos.',
          },
          {
            category: 'Cultura',
            count: map['Cultura'] || 0,
            icon: 'sparkles',
            color: '#7c3aed',
            description: 'Museos (Artium, Bibat), teatros y agenda de eventos en vivo Kulturklik.',
          },
          {
            category: 'Gastronomía',
            count: map['Gastronomía'] || 0,
            icon: 'utensils',
            color: '#dc2626',
            description: 'Rutas de pintxos en el Casco Medieval, sidrerías y restaurantes alaveses.',
          },
        ];
      } catch (err: any) {
        console.warn(`[PoiRepository] Stats query failed: ${err.message}`);
      }
    }

    return memoryStore.getStats();
  }

  async count(): Promise<number> {
    if (isPostgresConnected()) {
      try {
        const res = await pool.query('SELECT COUNT(*)::int as count FROM pois');
        return res.rows[0].count;
      } catch (err) {}
    }
    return memoryStore.count();
  }
}

export const poiRepository = new PoiRepository();

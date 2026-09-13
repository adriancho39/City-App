import { Poi, ScrapedPoiInput, PoiQueryFilters, CategoryStats } from '../models/poi.js';
import { isWithinVitoriaBBox, haversineDistanceMeters } from '../geo/bbox.js';
import { CONFIG, CategoryType } from '../config.js';

class MemoryStore {
  private pois: Map<string, Poi> = new Map();

  constructor() {
    console.log('[MemoryStore] Initialized spatial in-memory store.');
  }

  public upsert(input: ScrapedPoiInput): { inserted: boolean; rejected: boolean; reason?: string } {
    // Spatial Bounding Box constraint: ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)
    if (!isWithinVitoriaBBox(input.lon, input.lat)) {
      return {
        inserted: false,
        rejected: true,
        reason: `Coordinates [${input.lon}, ${input.lat}] outside Vitoria-Gasteiz bbox ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)`,
      };
    }

    const existing = Array.from(this.pois.values()).find((p) => p.external_id === input.external_id);
    const id = existing ? existing.id : `mem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const poi: Poi = {
      id,
      external_id: input.external_id,
      source: input.source,
      name: input.name,
      category: input.category,
      subcategory: input.subcategory,
      description: input.description,
      address: input.address,
      image_url: input.image_url,
      phone: input.phone,
      website: input.website,
      price: input.price,
      start_date: input.start_date,
      end_date: input.end_date,
      lon: input.lon,
      lat: input.lat,
      created_at: existing ? existing.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.pois.set(id, poi);
    return { inserted: true, rejected: false };
  }

  public find(filters: PoiQueryFilters): { pois: Poi[]; total: number } {
    const centerLon = filters.centerLon ?? CONFIG.CENTER.lon;
    const centerLat = filters.centerLat ?? CONFIG.CENTER.lat;
    const radius = filters.radiusMeters;
    const category = filters.category;
    const search = filters.search?.toLowerCase().trim();

    let results: Poi[] = [];

    for (const poi of this.pois.values()) {
      // Category filter
      if (category && poi.category !== category) {
        continue;
      }

      // Search filter
      if (search) {
        const matchName = poi.name.toLowerCase().includes(search);
        const matchDesc = poi.description?.toLowerCase().includes(search);
        const matchAddr = poi.address?.toLowerCase().includes(search);
        const matchSub = poi.subcategory?.toLowerCase().includes(search);
        if (!matchName && !matchDesc && !matchAddr && !matchSub) {
          continue;
        }
      }

      // Calculate distance from center point
      const dist = haversineDistanceMeters(centerLon, centerLat, poi.lon, poi.lat);

      // Proximity radius filter (500m, 1000m, 3000m, etc.)
      if (radius !== undefined && radius > 0 && dist > radius) {
        continue;
      }

      results.push({
        ...poi,
        distance_meters: dist,
      });
    }

    // Sort by distance ascending
    results.sort((a, b) => (a.distance_meters || 0) - (b.distance_meters || 0));

    const total = results.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 500;
    const paginated = results.slice(offset, offset + limit);

    return { pois: paginated, total };
  }

  public findById(id: string): Poi | undefined {
    return this.pois.get(id);
  }

  public getStats(): CategoryStats[] {
    const counts: Record<CategoryType, number> = {
      Patrimonio: 0,
      Naturaleza: 0,
      Cultura: 0,
      Gastronomía: 0,
    };

    for (const poi of this.pois.values()) {
      if (counts[poi.category] !== undefined) {
        counts[poi.category]++;
      }
    }

    return [
      {
        category: 'Patrimonio',
        count: counts['Patrimonio'],
        icon: 'landmark',
        color: '#b45309', // Amber
        description: 'Monumentos históricos, catedrales, muralla medieval y palacios renacentistas.',
      },
      {
        category: 'Naturaleza',
        count: counts['Naturaleza'],
        icon: 'trees',
        color: '#15803d', // Green
        description: 'Anillo Verde de Vitoria-Gasteiz, humedales de Salburua y parques urbanos.',
      },
      {
        category: 'Cultura',
        count: counts['Cultura'],
        icon: 'sparkles',
        color: '#7c3aed', // Purple
        description: 'Museos (Artium, Bibat), teatros y agenda de eventos en vivo Kulturklik.',
      },
      {
        category: 'Gastronomía',
        count: counts['Gastronomía'],
        icon: 'utensils',
        color: '#dc2626', // Red
        description: 'Rutas de pintxos en el Casco Medieval, sidrerías y restaurantes alaveses.',
      },
    ];
  }

  public count(): number {
    return this.pois.size;
  }

  public clear(): void {
    this.pois.clear();
  }
}

export const memoryStore = new MemoryStore();

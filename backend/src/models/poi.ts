import { CategoryType } from '../config.js';

export interface Poi {
  id: string;
  external_id: string;
  source: 'kulturklik' | 'opendata_municipal' | 'geovitoria';
  name: string;
  category: CategoryType;
  subcategory?: string;
  description?: string;
  address?: string;
  image_url?: string;
  phone?: string;
  website?: string;
  price?: string;
  start_date?: string;
  end_date?: string;
  lon: number;
  lat: number;
  distance_meters?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ScrapedPoiInput {
  external_id: string;
  source: 'kulturklik' | 'opendata_municipal' | 'geovitoria';
  name: string;
  category: CategoryType;
  subcategory?: string;
  description?: string;
  address?: string;
  image_url?: string;
  phone?: string;
  website?: string;
  price?: string;
  start_date?: string;
  end_date?: string;
  lon: number;
  lat: number;
  raw_data?: any;
}

export interface PoiQueryFilters {
  centerLon?: number;
  centerLat?: number;
  radiusMeters?: number; // 500, 1000, 3000
  category?: CategoryType | string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CategoryStats {
  category: CategoryType;
  count: number;
  icon: string;
  color: string;
  description: string;
}

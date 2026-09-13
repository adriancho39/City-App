import { CONFIG } from '../config.js';

export interface BoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  srid: number;
}

/**
 * Validates whether a given longitude and latitude fall inside the
 * Vitoria-Gasteiz Bounding Box defined by:
 * ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)
 */
export function isWithinVitoriaBBox(
  lon: number,
  lat: number,
  bbox: BoundingBox = CONFIG.BBOX
): boolean {
  if (typeof lon !== 'number' || typeof lat !== 'number') return false;
  if (isNaN(lon) || isNaN(lat)) return false;

  return (
    lon >= bbox.minLon &&
    lon <= bbox.maxLon &&
    lat >= bbox.minLat &&
    lat <= bbox.maxLat
  );
}

/**
 * Asserts bounding box compliance, throwing an informative error if outside.
 */
export function assertWithinVitoriaBBox(
  lon: number,
  lat: number,
  name?: string
): void {
  if (!isWithinVitoriaBBox(lon, lat)) {
    throw new Error(
      `Spatial Constraint Violation: Point [${lon}, ${lat}] ${
        name ? `for "${name}" ` : ''
      }is outside Vitoria-Gasteiz bounding box ST_MakeEnvelope(${CONFIG.BBOX.minLon}, ${CONFIG.BBOX.minLat}, ${CONFIG.BBOX.maxLon}, ${CONFIG.BBOX.maxLat}, ${CONFIG.BBOX.srid})`
    );
  }
}

/**
 * Calculates geodesic distance between two points on the WGS84 sphere using the Haversine formula
 * Returns distance in meters (equivalent to PostGIS ST_Distance(p1::geography, p2::geography))
 */
export function haversineDistanceMeters(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

import proj4 from 'proj4';

// Register EPSG:25830 (ETRS89 / UTM Zone 30N)
// Proj4 definition matching IGN Spain / Basque Government official specification
proj4.defs(
  'EPSG:25830',
  '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
);

export interface GeoPoint {
  lon: number;
  lat: number;
}

/**
 * Transforms UTM EPSG:25830 coordinates (X, Y in meters) to WGS84 EPSG:4326 (lon, lat in degrees)
 * Uses proj4 with a high-precision ellipsoidal Transverse Mercator fallback.
 *
 * @param x Easting in meters (e.g. ~526833 for Vitoria-Gasteiz)
 * @param y Northing in meters (e.g. ~4743843 for Vitoria-Gasteiz)
 * @returns { lon, lat } in EPSG:4326
 */
export function transformUtm25830ToWgs84(x: number, y: number): GeoPoint {
  if (isNaN(x) || isNaN(y)) {
    throw new Error(`Invalid UTM coordinates: x=${x}, y=${y}`);
  }

  try {
    const [lon, lat] = proj4('EPSG:25830', 'EPSG:4326', [x, y]);
    return {
      lon: Number(lon.toFixed(6)),
      lat: Number(lat.toFixed(6)),
    };
  } catch (err) {
    // Mathematical Inverse Transverse Mercator fallback
    return inverseUtm25830Fallback(x, y);
  }
}

/**
 * Pure mathematical fallback for UTM 30N (GRS80/WGS84) to Lat/Lon
 */
function inverseUtm25830Fallback(x: number, y: number): GeoPoint {
  const a = 6378137.0; // GRS80 / WGS84 semi-major axis
  const f = 1 / 298.257222101;
  const b = a * (1 - f);
  const e2 = (a * a - b * b) / (a * a);
  const ePrime2 = (a * a - b * b) / (b * b);
  const k0 = 0.9996;
  const lon0 = -3.0 * (Math.PI / 180.0); // Central meridian for UTM Zone 30 is -3°

  const xAdj = x - 500000.0;
  const yAdj = y;

  const M = yAdj / k0;
  const mu =
    M /
    (a *
      (1 -
        e2 / 4 -
        (3 * e2 * e2) / 64 -
        (5 * e2 * e2 * e2) / 256));

  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * Math.pow(e1, 4)) / 32) * Math.sin(4 * mu) +
    ((151 * Math.pow(e1, 3)) / 96) * Math.sin(6 * mu) +
    ((1097 * Math.pow(e1, 4)) / 512) * Math.sin(8 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);

  const N1 = a / Math.sqrt(1 - e2 * sinPhi1 * sinPhi1);
  const T1 = tanPhi1 * tanPhi1;
  const C1 = ePrime2 * cosPhi1 * cosPhi1;
  const R1 = (a * (1 - e2)) / Math.pow(1 - e2 * sinPhi1 * sinPhi1, 1.5);
  const D = xAdj / (N1 * k0);

  const latRad =
    phi1 -
    ((N1 * tanPhi1) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ePrime2) * Math.pow(D, 4)) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ePrime2 - 3 * C1 * C1) *
          Math.pow(D, 6)) /
          720);

  const lonRad =
    lon0 +
    (D -
      ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ePrime2 + 24 * T1 * T1) *
        Math.pow(D, 5)) /
        120) /
      cosPhi1;

  return {
    lon: Number(((lonRad * 180.0) / Math.PI).toFixed(6)),
    lat: Number(((latRad * 180.0) / Math.PI).toFixed(6)),
  };
}

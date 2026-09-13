import { transformUtm25830ToWgs84 } from '../src/geo/transform.js';
import { isWithinVitoriaBBox, haversineDistanceMeters } from '../src/geo/bbox.js';

export function runGeoTests(): boolean {
  console.log('\n--- Running Geo & Spatial Transformation Tests ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. UTM EPSG:25830 -> EPSG:4326 Coordinate Transformation
  const virgenBlancaUtm = { x: 526833.8, y: 4743843.6 };
  const transformed = transformUtm25830ToWgs84(virgenBlancaUtm.x, virgenBlancaUtm.y);
  console.log(`  [UTM Transform] Plaza de la Virgen Blanca: UTM [${virgenBlancaUtm.x}, ${virgenBlancaUtm.y}] -> WGS84 [${transformed.lon}, ${transformed.lat}]`);

  // Expected lon: ~ -2.6716, lat: ~ 42.8467 (delta < 0.0005 deg or ~40m)
  assert(
    Math.abs(transformed.lon - -2.6716) < 0.001,
    `Longitude transform matches Plaza de la Virgen Blanca: ${transformed.lon}`
  );
  assert(
    Math.abs(transformed.lat - 42.8467) < 0.001,
    `Latitude transform matches Plaza de la Virgen Blanca: ${transformed.lat}`
  );

  // Catedral de Santa María UTM
  const catedralUtm = { x: 526749.0, y: 4744180.0 };
  const catedralWgs = transformUtm25830ToWgs84(catedralUtm.x, catedralUtm.y);
  assert(
    Math.abs(catedralWgs.lon - -2.6726) < 0.001,
    `Catedral de Santa María lon transform: ${catedralWgs.lon}`
  );
  assert(
    Math.abs(catedralWgs.lat - 42.8497) < 0.001,
    `Catedral de Santa María lat transform: ${catedralWgs.lat}`
  );

  // 2. Bounding Box Constraint: ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)
  // Inside Vitoria-Gasteiz:
  assert(
    isWithinVitoriaBBox(-2.6716, 42.8467),
    'Virgen Blanca (-2.6716, 42.8467) is accepted inside BBOX'
  );
  assert(
    isWithinVitoriaBBox(-2.645, 42.855),
    'Salburua Wetlands (-2.645, 42.855) is accepted inside BBOX'
  );
  assert(
    isWithinVitoriaBBox(-2.73, 42.83),
    'Júndiz West (-2.73, 42.83) is accepted inside BBOX'
  );

  // Outside Vitoria-Gasteiz (MUST be discarded):
  assert(
    !isWithinVitoriaBBox(-2.93, 43.26),
    'Bilbao (-2.93, 43.26) is strictly rejected outside BBOX'
  );
  assert(
    !isWithinVitoriaBBox(-3.70, 40.41),
    'Madrid (-3.70, 40.41) is strictly rejected outside BBOX'
  );
  assert(
    !isWithinVitoriaBBox(-2.58, 42.55),
    'Laguardia (-2.58, 42.55) is strictly rejected outside BBOX'
  );
  assert(
    !isWithinVitoriaBBox(-1.98, 43.32),
    'San Sebastián (-1.98, 43.32) is strictly rejected outside BBOX'
  );

  // 3. Distance calculation verification (500m, 1km, 3km)
  const distCenterToCatedral = haversineDistanceMeters(-2.6716, 42.8467, -2.6726, 42.8497);
  console.log(`  [Distance] Virgen Blanca -> Catedral de Santa María: ${distCenterToCatedral}m`);
  assert(
    distCenterToCatedral > 300 && distCenterToCatedral < 450,
    `Distance from center to Old Cathedral is ~340m (actual: ${distCenterToCatedral}m)`
  );
  assert(
    distCenterToCatedral <= 500,
    'Catedral de Santa María falls inside 500m proximity radius'
  );

  const distCenterToSalburua = haversineDistanceMeters(-2.6716, 42.8467, -2.645, 42.855);
  console.log(`  [Distance] Virgen Blanca -> Salburua Ataria: ${distCenterToSalburua}m`);
  assert(
    distCenterToSalburua > 1500 && distCenterToSalburua < 2800,
    `Distance to Salburua is within ~2.3km (actual: ${distCenterToSalburua}m)`
  );
  assert(
    distCenterToSalburua <= 3000,
    'Salburua Ataria falls inside 3km proximity radius'
  );

  console.log(`Geo Tests Result: ${passed} Passed, ${failed} Failed`);
  return failed === 0;
}

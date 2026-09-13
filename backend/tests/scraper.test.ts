import { classifyPoi } from '../src/scraper/classifier.js';
import { memoryStore } from '../src/db/memoryStore.js';
import { isWithinVitoriaBBox } from '../src/geo/bbox.js';

export function runScraperTests(): boolean {
  console.log('\n--- Running Scraper & Classification Tests ---');
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

  // 1. Classification Tests across the 4 canonical categories
  // Patrimonio
  const c1 = classifyPoi('Catedral de Santa María', 'Templo gótico del siglo XIII en la colina medieval');
  assert(c1.category === 'Patrimonio', `Catedral de Santa María categorized as Patrimonio (got: ${c1.category})`);

  const c2 = classifyPoi('Muralla Medieval y Adarve', 'Muralla defensiva histórica');
  assert(c2.category === 'Patrimonio', `Muralla Medieval categorized as Patrimonio (got: ${c2.category})`);

  const c3 = classifyPoi('Palacio Escoriaza-Esquivel', 'Palacio renacentista vitoriano');
  assert(c3.category === 'Patrimonio', `Palacio Escoriaza-Esquivel categorized as Patrimonio (got: ${c3.category})`);

  // Naturaleza
  const n1 = classifyPoi('Humedales de Salburua', 'Lagunas del Anillo Verde de Vitoria-Gasteiz');
  assert(n1.category === 'Naturaleza', `Humedales de Salburua categorized as Naturaleza (got: ${n1.category})`);

  const n2 = classifyPoi('Parque de la Florida', 'Jardín botánico histórico del ensanche');
  assert(n2.category === 'Naturaleza', `Parque de la Florida categorized as Naturaleza (got: ${n2.category})`);

  const n3 = classifyPoi('Bosque de Armentia', 'Quejigal del Anillo Verde');
  assert(n3.category === 'Naturaleza', `Bosque de Armentia categorized as Naturaleza (got: ${n3.category})`);

  // Cultura
  const cu1 = classifyPoi('Artium Centro-Museo Vasco', 'Exposición de arte contemporáneo vasco');
  assert(cu1.category === 'Cultura', `Artium categorized as Cultura (got: ${cu1.category})`);

  const cu2 = classifyPoi('Teatro Principal Antzokia', 'Concierto sinfónico y obra de teatro');
  assert(cu2.category === 'Cultura', `Teatro Principal categorized as Cultura (got: ${cu2.category})`);

  const cu3 = classifyPoi('Museo Bibat', 'Museo de Arqueología y Naipes Fournier');
  assert(cu3.category === 'Cultura', `Museo Bibat categorized as Cultura (got: ${cu3.category})`);

  // Gastronomía
  const g1 = classifyPoi('Bar de Pintxos Kutxi', 'Taberna tradicional con barra de pintxos y vinos alaveses');
  assert(g1.category === 'Gastronomía', `Bar de Pintxos categorized as Gastronomía (got: ${g1.category})`);

  const g2 = classifyPoi('Restaurante Asador Sagartoki', 'Restauración gastronómica y sidrería');
  assert(g2.category === 'Gastronomía', `Asador Sagartoki categorized as Gastronomía (got: ${g2.category})`);

  const g3 = classifyPoi('Mercado de Abastos Gastro-Gune', 'Espacio gastronómico y productos de cercanía');
  assert(g3.category === 'Gastronomía', `Mercado de Abastos categorized as Gastronomía (got: ${g3.category})`);

  // 2. MemoryStore Spatial Enforcement of ST_MakeEnvelope
  memoryStore.clear();

  // Valid point inside Vitoria
  const insideRes = memoryStore.upsert({
    external_id: 'test-inside-01',
    source: 'opendata_municipal',
    name: 'Punto Vitoria Centro',
    category: 'Patrimonio',
    lon: -2.6716,
    lat: 42.8467,
  });
  assert(insideRes.inserted === true, 'Store accepts point inside Vitoria BBox');

  // Point outside Vitoria (e.g. Bilbao)
  const outsideRes = memoryStore.upsert({
    external_id: 'test-outside-bilbao',
    source: 'opendata_municipal',
    name: 'Guggenheim Bilbao',
    category: 'Cultura',
    lon: -2.934,
    lat: 43.268,
  });
  assert(outsideRes.inserted === false, 'Store discards point outside Vitoria BBox');
  assert(outsideRes.rejected === true, 'Store flags rejected = true for point outside BBox');

  // 3. Radius Query Verification in Store
  // Query with 500m radius around Plaza de la Virgen Blanca
  const query500 = memoryStore.find({
    centerLon: -2.6716,
    centerLat: 42.8467,
    radiusMeters: 500,
  });
  assert(query500.pois.length === 1, '500m query returns the center point (distance 0m)');

  console.log(`Scraper Tests Result: ${passed} Passed, ${failed} Failed`);
  return failed === 0;
}

import { scrapeKulturklik } from './kulturklik.js';
import { scrapeMunicipalOpenData } from './opendata.js';
import { poiRepository } from '../db/repository.js';
import { CategoryType } from '../config.js';

export interface IngestionResult {
  totalFetched: number;
  totalIngested: number;
  totalRejectedBbox: number;
  byCategory: Record<CategoryType, number>;
  bySource: Record<string, number>;
  durationMs: number;
}

/**
 * Executes full ingestion pipeline:
 * 1. Kulturklik API for municipality 01059
 * 2. Municipal Open Data portal & GeoVitoria (with UTM EPSG:25830 -> EPSG:4326 transform)
 * 3. Enforces Bounding Box: ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)
 * 4. Models and classifies into Patrimonio, Naturaleza, Cultura, Gastronomía
 * 5. Persists to PostGIS / repository
 */
export async function runIngestionPipeline(): Promise<IngestionResult> {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('🚀 Starting Vitoria-Gasteiz Tourism & Leisure Ingestion Pipeline');
  console.log('   Bounding Box: ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)');
  console.log('================================================================');

  let totalFetched = 0;
  let totalIngested = 0;
  let totalRejectedBbox = 0;

  const byCategory: Record<CategoryType, number> = {
    Patrimonio: 0,
    Naturaleza: 0,
    Cultura: 0,
    Gastronomía: 0,
  };

  const bySource: Record<string, number> = {
    kulturklik: 0,
    opendata_municipal: 0,
    geovitoria: 0,
  };

  // 1. Municipal Open Data & GeoVitoria with UTM EPSG:25830 transformation
  const municipalRes = await scrapeMunicipalOpenData();
  totalFetched += municipalRes.totalFetched;
  totalRejectedBbox += municipalRes.rejectedCount;

  for (const poi of municipalRes.scraped) {
    const saveRes = await poiRepository.savePoi(poi);
    if (saveRes.success) {
      totalIngested++;
      byCategory[poi.category] = (byCategory[poi.category] || 0) + 1;
      bySource[poi.source] = (bySource[poi.source] || 0) + 1;
    } else if (saveRes.rejected) {
      totalRejectedBbox++;
    }
  }

  // 2. Kulturklik API for municipality 01059
  const kulturklikRes = await scrapeKulturklik(80);
  totalFetched += kulturklikRes.totalFetched;
  totalRejectedBbox += kulturklikRes.rejectedCount;

  for (const poi of kulturklikRes.scraped) {
    const saveRes = await poiRepository.savePoi(poi);
    if (saveRes.success) {
      totalIngested++;
      byCategory[poi.category] = (byCategory[poi.category] || 0) + 1;
      bySource[poi.source] = (bySource[poi.source] || 0) + 1;
    } else if (saveRes.rejected) {
      totalRejectedBbox++;
    }
  }

  const durationMs = Date.now() - startTime;

  console.log('================================================================');
  console.log(`✅ Ingestion Complete in ${durationMs}ms`);
  console.log(`   Total Records Processed: ${totalFetched}`);
  console.log(`   Successfully Ingested:   ${totalIngested}`);
  console.log(`   Rejected by BBOX:        ${totalRejectedBbox}`);
  console.log('   Category Breakdown:');
  console.log(`     🏛️ Patrimonio:  ${byCategory.Patrimonio}`);
  console.log(`     🌳 Naturaleza:  ${byCategory.Naturaleza}`);
  console.log(`     🎭 Cultura:     ${byCategory.Cultura}`);
  console.log(`     🍷 Gastronomía: ${byCategory.Gastronomía}`);
  console.log('================================================================');

  return {
    totalFetched,
    totalIngested,
    totalRejectedBbox,
    byCategory,
    bySource,
    durationMs,
  };
}

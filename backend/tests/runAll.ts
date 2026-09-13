import { runGeoTests } from './geo.test.js';
import { runScraperTests } from './scraper.test.js';

console.log('====================================================');
console.log('🧪 RUNNING VITORIA-GASTEIZ PWA AUTOMATED TEST SUITE');
console.log('====================================================');

const geoOk = runGeoTests();
const scraperOk = runScraperTests();

console.log('\n====================================================');
if (geoOk && scraperOk) {
  console.log('🎉 ALL AUTOMATED TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
  process.exit(0);
} else {
  console.error('💥 TEST SUITE FAILED!');
  console.log('====================================================');
  process.exit(1);
}

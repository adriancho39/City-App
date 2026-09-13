import { runIngestionPipeline } from './index.js';
import { checkPostgresConnection } from '../db/pool.js';

async function main() {
  await checkPostgresConnection();
  await runIngestionPipeline();
  process.exit(0);
}

main().catch((err) => {
  console.error('Scraper CLI Error:', err);
  process.exit(1);
});

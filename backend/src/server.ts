import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import { poisRouter } from './routes/pois.js';
import { categoriesRouter } from './routes/categories.js';
import { scrapeRouter } from './routes/scrape.js';
import { checkPostgresConnection, isPostgresConnected } from './db/pool.js';
import { runIngestionPipeline } from './scraper/index.js';
import { poiRepository } from './db/repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/pois', poisRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/scrape', scrapeRouter);

// Health & System Info
app.get('/api/health', async (req, res) => {
  const count = await poiRepository.count();
  res.json({
    status: 'ok',
    service: 'Vitoria-Gasteiz Tourism & Leisure Backend',
    database: isPostgresConnected() ? 'PostgreSQL + PostGIS (Active)' : 'PostGIS Standalone Geo-Engine',
    spatialConstraint: 'ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)',
    cityCenter: CONFIG.CENTER,
    totalPois: count,
  });
});

// Serve Frontend dist if built
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next();
  });
});

// Start Server
export async function startServer() {
  console.log('--- Initializing Vitoria-Gasteiz PWA Backend ---');
  await checkPostgresConnection();

  // Run initial ingestion to guarantee fresh data on launch
  try {
    await runIngestionPipeline();
  } catch (err: any) {
    console.warn(`[Server] Initial ingestion notice: ${err.message}`);
  }

  const server = app.listen(CONFIG.PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${CONFIG.PORT}`);
    console.log(`📍 City Center: [${CONFIG.CENTER.lon}, ${CONFIG.CENTER.lat}] (Vitoria-Gasteiz)`);
    console.log(`📐 Spatial Bounding Box: ST_MakeEnvelope(${CONFIG.BBOX.minLon}, ${CONFIG.BBOX.minLat}, ${CONFIG.BBOX.maxLon}, ${CONFIG.BBOX.maxLat}, 4326)`);
  });

  return { app, server };
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Fatal Server Startup Error:', err);
  });
}

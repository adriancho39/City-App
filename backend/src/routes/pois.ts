import { Router, Request, Response } from 'express';
import { poiRepository } from '../db/repository.js';
import { CONFIG } from '../config.js';

export const poisRouter = Router();

/**
 * GET /api/pois
 * Query POIs filtered by category, proximity radius (500m, 1km, 3km), and search term
 */
poisRouter.get('/', async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : CONFIG.CENTER.lat;
    const lon = req.query.lon ? parseFloat(req.query.lon as string) : CONFIG.CENTER.lon;
    const radius = req.query.radius ? parseFloat(req.query.radius as string) : undefined;
    const category = req.query.category ? (req.query.category as string) : undefined;
    const search = req.query.search ? (req.query.search as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 500;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const result = await poiRepository.findPois({
      centerLon: lon,
      centerLat: lat,
      radiusMeters: radius,
      category,
      search,
      limit,
      offset,
    });

    res.json({
      success: true,
      meta: {
        center: { lon, lat },
        radiusMeters: radius || null,
        category: category || 'all',
        total: result.total,
        count: result.pois.length,
      },
      data: result.pois,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/pois/:id
 * Retrieve specific POI by UUID or external ID
 */
poisRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const poi = await poiRepository.getPoiById(req.params.id);
    if (!poi) {
      return res.status(404).json({ success: false, error: 'POI not found' });
    }
    res.json({ success: true, data: poi });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

import { Router, Request, Response } from 'express';
import { runIngestionPipeline } from '../scraper/index.js';

export const scrapeRouter = Router();

/**
 * POST /api/scrape/trigger
 * Triggers on-demand execution of the ingestion pipeline
 */
scrapeRouter.post('/trigger', async (req: Request, res: Response) => {
  try {
    const result = await runIngestionPipeline();
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

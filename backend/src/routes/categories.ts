import { Router, Request, Response } from 'express';
import { poiRepository } from '../db/repository.js';

export const categoriesRouter = Router();

/**
 * GET /api/categories
 * Returns statistics and visual definitions for the 4 canonical categories:
 * Patrimonio, Naturaleza, Cultura, Gastronomía
 */
categoriesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const stats = await poiRepository.getCategoryStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

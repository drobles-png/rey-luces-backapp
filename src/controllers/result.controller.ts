import { Request, Response, NextFunction } from "express";
import * as resultService from "../services/result.service";

/** GET /api/results?limit=12 */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await resultService.listPublished(req.query.limit));
  } catch (error) {
    next(error);
  }
}

/** GET /api/results/stats */
export async function stats(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await resultService.stats());
  } catch (error) {
    next(error);
  }
}

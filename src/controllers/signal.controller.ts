import { Request, Response, NextFunction } from "express";
import { CustomError } from "../errors/customError.error";
import * as signalService from "../services/signal.service";
import { AuthRequest } from "../types/AuthRequest";

/** GET /api/signals/public?limit=8 */
export async function listPublic(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await signalService.listPublic(req.query.limit));
  } catch (error) {
    next(error);
  }
}

/** GET /api/signals — miembros con membresía vigente o admin. */
export async function listForMember(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new CustomError("No autorizado", 401);
    res.status(200).json(await signalService.listForMember(req.user));
  } catch (error) {
    next(error);
  }
}

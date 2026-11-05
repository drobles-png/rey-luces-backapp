import { Response, NextFunction } from "express";
import { CustomError } from "../errors/customError.error";
import * as accessService from "../services/access.service";
import * as courseService from "../services/course.service";
import * as orderService from "../services/order.service";
import * as productService from "../services/product.service";
import { AuthRequest, JwtPayload } from "../types/AuthRequest";

function sessionOf(req: AuthRequest): JwtPayload {
  if (!req.user) throw new CustomError("No autorizado", 401);
  return req.user;
}

/** GET /api/me/products */
export async function products(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await accessService.listForUser(sessionOf(req).userId));
  } catch (error) {
    next(error);
  }
}

/** GET /api/me/products/:slug */
export async function productDetail(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res
      .status(200)
      .json(await productService.getMemberDetail(String(req.params.slug), sessionOf(req)));
  } catch (error) {
    next(error);
  }
}

/** GET /api/me/lessons/:id/play */
export async function playLesson(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await courseService.playLesson(String(req.params.id), sessionOf(req)));
  } catch (error) {
    next(error);
  }
}

/** GET /api/me/orders */
export async function orders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await orderService.listForUser(sessionOf(req).userId));
  } catch (error) {
    next(error);
  }
}

import { Request, Response, NextFunction } from "express";
import * as productService from "../services/product.service";

/** GET /api/products */
export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await productService.listPublished());
  } catch (error) {
    next(error);
  }
}

/** GET /api/products/:slug */
export async function detail(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await productService.getPublicDetail(String(req.params.slug)));
  } catch (error) {
    next(error);
  }
}

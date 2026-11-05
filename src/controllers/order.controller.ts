import { Response, NextFunction } from "express";
import { CustomError } from "../errors/customError.error";
import * as orderService from "../services/order.service";
import { AuthRequest } from "../types/AuthRequest";

/** POST /api/orders — body: { productId } */
export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new CustomError("No autorizado", 401);
    res.status(201).json(await orderService.createOrder(req.user.userId, req.body?.productId));
  } catch (error) {
    next(error);
  }
}

/** POST /api/orders/confirm — body: { id, clientTransactionId } (los que Payphone pone en la URL de respuesta) */
export async function confirm(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new CustomError("No autorizado", 401);
    const { id, clientTransactionId } = req.body ?? {};
    res.status(200).json(await orderService.confirmOrder(req.user.userId, id, clientTransactionId));
  } catch (error) {
    next(error);
  }
}

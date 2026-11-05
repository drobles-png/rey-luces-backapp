import { isValidObjectId } from "mongoose";
import { CustomError } from "../errors/customError.error";

/**
 * Un id mal formado en la URL es un "no existe", no un 500 de CastError.
 */
export function assertId(id: unknown, notFoundMessage: string): string {
  const value = String(id ?? "");
  if (!isValidObjectId(value)) throw new CustomError(notFoundMessage, 404);
  return value;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

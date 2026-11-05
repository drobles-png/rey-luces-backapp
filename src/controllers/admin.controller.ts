import { Response, NextFunction } from "express";
import { CustomError } from "../errors/customError.error";
import * as accessService from "../services/access.service";
import * as adminService from "../services/admin.service";
import * as cloudinaryService from "../services/cloudinary.service";
import * as courseService from "../services/course.service";
import * as orderService from "../services/order.service";
import * as productService from "../services/product.service";
import * as resultService from "../services/result.service";
import * as signalService from "../services/signal.service";
import { AuthRequest } from "../types/AuthRequest";

/**
 * Todos los handlers del panel tienen la misma forma (leer req → service →
 * json), así que se arman con este envoltorio en vez de repetir el try/catch.
 */
function handle(fn: (req: AuthRequest) => Promise<unknown>, status = 200) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.status(status).json(await fn(req));
    } catch (error) {
      next(error);
    }
  };
}

const id = (req: AuthRequest) => String(req.params.id);

export const stats = handle(() => adminService.stats());

// Productos
export const listProducts = handle(() => productService.listAll());
export const createProduct = handle((req) => productService.create(req.body), 201);
export const getProduct = handle((req) => productService.getAdminDetail(id(req)));
export const updateProduct = handle((req) => productService.update(id(req), req.body));
export const deleteProduct = handle((req) => productService.remove(id(req)));

// Módulos y lecciones
export const createModule = handle((req) => courseService.createModule(id(req), req.body), 201);
export const updateModule = handle((req) => courseService.updateModule(id(req), req.body));
export const deleteModule = handle((req) => courseService.deleteModule(id(req)));
export const createLesson = handle((req) => courseService.createLesson(id(req), req.body), 201);
export const updateLesson = handle((req) => courseService.updateLesson(id(req), req.body));
export const deleteLesson = handle((req) => courseService.deleteLesson(id(req)));
export const createLessonVideo = handle((req) => courseService.createLessonVideo(id(req)), 201);

/** POST /api/admin/uploads/image — multipart, campo `file`. */
export const uploadImage = handle(async (req) => {
  if (!cloudinaryService.isCloudinaryConfigured()) {
    throw new CustomError("La subida de imágenes aún no está configurada (falta Cloudinary)", 503);
  }
  const file = req.file;
  if (!file) throw new CustomError("Adjunta una imagen en el campo «file»", 400);
  if (!file.mimetype.startsWith("image/"))
    throw new CustomError("El archivo debe ser una imagen", 400);
  const { url } = await cloudinaryService.uploadBuffer(file.buffer, "rey-luces");
  return { url };
}, 201);

// Resultados
export const listResults = handle(() => resultService.listAll());
export const createResult = handle((req) => resultService.create(req.body), 201);
export const updateResult = handle((req) => resultService.update(id(req), req.body));
export const deleteResult = handle((req) => resultService.remove(id(req)));

// Señales
export const listSignals = handle(() => signalService.listAll());
export const createSignal = handle((req) => signalService.create(req.body), 201);
export const updateSignal = handle((req) => signalService.update(id(req), req.body));
export const deleteSignal = handle((req) => signalService.remove(id(req)));

// Órdenes y alumnos
export const listOrders = handle((req) => orderService.listAdmin(req.query));
export const listStudents = handle((req) => adminService.listStudents(req.query));

// Accesos
export const grantAccess = handle((req) => {
  const body = req.body ?? {};
  return accessService.grantManual({
    email: body.email,
    productIds: body.productIds,
    // `in` y no `??`: hay que distinguir "no vino" (400) de null explícito (no vence).
    expiresAt: "expiresAt" in body ? body.expiresAt : undefined,
    note: body.note,
    adminId: req.user!.userId,
  });
}, 201);
export const listAccess = handle((req) => accessService.list(req.query));
export const updateAccess = handle((req) => {
  const body = req.body ?? {};
  return accessService.updateExpiry(id(req), "expiresAt" in body ? body.expiresAt : undefined);
});
export const revokeAccess = handle((req) => accessService.revoke(id(req)));

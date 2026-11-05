import { CustomError } from "../errors/customError.error";
import { Lesson } from "../models/lesson.model";
import { CourseModule } from "../models/module.model";
import { Product } from "../models/product.model";
import { JwtPayload } from "../types/AuthRequest";
import { assertId } from "../utils/objectId";
import { hasActiveAccess } from "./access.service";
import * as bunnyService from "./bunny.service";
import { toLesson } from "./product.service";

// ─── Módulos ─────────────────────────────────────────────────────────────────

export async function createModule(productId: string, body: any) {
  assertId(productId, "Producto no encontrado");
  const title = String(body?.title ?? "").trim();
  if (!title) throw new CustomError("El título del módulo es obligatorio", 400);
  if (!(await Product.exists({ _id: productId })))
    throw new CustomError("Producto no encontrado", 404);

  const sortOrder = await CourseModule.countDocuments({ product: productId });
  const mod = await CourseModule.create({ product: productId, title, sortOrder });
  return { ...mod.toObject(), lessons: [] };
}

export async function updateModule(id: string, body: any) {
  assertId(id, "Módulo no encontrado");
  const data: Record<string, unknown> = {};
  if (body?.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) throw new CustomError("El título del módulo es obligatorio", 400);
    data.title = title;
  }
  if (body?.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;

  const mod = await CourseModule.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
  if (!mod) throw new CustomError("Módulo no encontrado", 404);
  const lessons = await Lesson.find({ module: id }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  return { ...mod, lessons: lessons.map((l) => toLesson(l, true)) };
}

export async function deleteModule(id: string) {
  assertId(id, "Módulo no encontrado");
  const mod = await CourseModule.findByIdAndDelete(id);
  if (!mod) throw new CustomError("Módulo no encontrado", 404);
  await Lesson.deleteMany({ module: id });
  return { ok: true };
}

// ─── Lecciones ───────────────────────────────────────────────────────────────

function pickLesson(body: any) {
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) throw new CustomError("El título de la lección es obligatorio", 400);
    data.title = title;
  }
  if (body.description !== undefined) data.description = String(body.description ?? "");
  if (body.isFreePreview !== undefined) data.isFreePreview = !!body.isFreePreview;
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;
  if (body.durationSec !== undefined) data.durationSec = Math.max(0, Number(body.durationSec) || 0);
  if (body.bunnyVideoId !== undefined) data.bunnyVideoId = String(body.bunnyVideoId ?? "").trim();
  if (body.attachments !== undefined) {
    if (!Array.isArray(body.attachments))
      throw new CustomError("Los adjuntos deben ser una lista", 400);
    data.attachments = body.attachments
      .map((a: any) => ({ name: String(a?.name ?? "").trim(), url: String(a?.url ?? "").trim() }))
      .filter((a: { url: string }) => a.url);
  }
  if (body.module !== undefined) data.module = assertId(body.module, "Módulo no encontrado");
  return data;
}

export async function createLesson(moduleId: string, body: any) {
  assertId(moduleId, "Módulo no encontrado");
  const mod = await CourseModule.findById(moduleId).lean();
  if (!mod) throw new CustomError("Módulo no encontrado", 404);

  const data = pickLesson(body ?? {});
  if (!data.title) throw new CustomError("El título de la lección es obligatorio", 400);
  delete data.module;
  if (data.sortOrder === undefined)
    data.sortOrder = await Lesson.countDocuments({ module: moduleId });

  const lesson = await Lesson.create({ ...data, module: mod._id, product: mod.product });
  return toLesson(lesson.toObject(), true);
}

export async function updateLesson(id: string, body: any) {
  assertId(id, "Lección no encontrada");
  const data = pickLesson(body ?? {});
  if (data.module) {
    // Mover de módulo solo dentro del mismo producto.
    const current = await Lesson.findById(id).lean();
    const target = await CourseModule.findById(data.module).lean();
    if (!current) throw new CustomError("Lección no encontrada", 404);
    if (!target || String(target.product) !== String(current.product)) {
      throw new CustomError("Módulo no encontrado", 404);
    }
  }
  const lesson = await Lesson.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
  if (!lesson) throw new CustomError("Lección no encontrada", 404);
  return toLesson(lesson, true);
}

export async function deleteLesson(id: string) {
  assertId(id, "Lección no encontrada");
  const lesson = await Lesson.findByIdAndDelete(id);
  if (!lesson) throw new CustomError("Lección no encontrada", 404);
  return { ok: true };
}

/** Crea el video en Bunny, lo amarra a la lección y devuelve la firma TUS. */
export async function createLessonVideo(id: string) {
  assertId(id, "Lección no encontrada");
  if (!bunnyService.isBunnyConfigured()) {
    throw new CustomError("Bunny Stream no está configurado en el servidor", 503);
  }
  const lesson = await Lesson.findById(id);
  if (!lesson) throw new CustomError("Lección no encontrada", 404);
  const product = await Product.findById(lesson.product).select("title").lean();

  const videoId = await bunnyService.createVideo(`${product?.title ?? "Curso"} · ${lesson.title}`);
  lesson.bunnyVideoId = videoId;
  await lesson.save();
  return bunnyService.uploadTicket(videoId);
}

// ─── Reproducción ────────────────────────────────────────────────────────────

/** GET /me/lessons/:id/play — la URL firmada solo sale si hay acceso vigente. */
export async function playLesson(id: string, user: JwtPayload) {
  assertId(id, "Lección no encontrada");
  const lesson = await Lesson.findById(id).lean();
  if (!lesson) throw new CustomError("Lección no encontrada", 404);

  const allowed =
    lesson.isFreePreview ||
    user.accountType === "admin" ||
    (await hasActiveAccess(user.userId, lesson.product));
  if (!allowed) throw new CustomError("Tu acceso a este curso no está vigente", 403);

  return { embedUrl: lesson.bunnyVideoId ? bunnyService.embedUrl(lesson.bunnyVideoId) : null };
}

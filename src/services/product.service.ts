import { CustomError } from "../errors/customError.error";
import { Access } from "../models/access.model";
import { Lesson } from "../models/lesson.model";
import { CourseModule } from "../models/module.model";
import { Order } from "../models/order.model";
import { IProduct, Product, PRODUCT_TYPES } from "../models/product.model";
import { JwtPayload } from "../types/AuthRequest";
import { assertId } from "../utils/objectId";
import { slugify } from "../utils/slugify";
import { hasActiveAccess } from "./access.service";

const SORT = { sortOrder: 1, createdAt: 1 } as const;

/**
 * Producto con sus módulos y lecciones. `withVideos` en false vacía el
 * bunnyVideoId de las lecciones cerradas: la ficha pública no entrega videos,
 * salvo las vistas previas gratis.
 */
async function buildDetail(product: any, withVideos: boolean) {
  const [modules, lessons] = await Promise.all([
    CourseModule.find({ product: product._id }).sort(SORT).lean(),
    Lesson.find({ product: product._id }).sort(SORT).lean(),
  ]);

  return {
    ...product,
    modules: modules.map((m) => ({
      _id: m._id,
      product: m.product,
      title: m.title,
      sortOrder: m.sortOrder,
      lessons: lessons
        .filter((l) => String(l.module) === String(m._id))
        .map((l) => toLesson(l, withVideos || l.isFreePreview)),
    })),
  };
}

export function toLesson(lesson: any, withVideo: boolean) {
  return {
    _id: lesson._id,
    product: lesson.product,
    module: lesson.module,
    title: lesson.title,
    description: lesson.description ?? "",
    sortOrder: lesson.sortOrder ?? 0,
    bunnyVideoId: withVideo ? (lesson.bunnyVideoId ?? "") : "",
    durationSec: lesson.durationSec ?? 0,
    attachments: withVideo ? (lesson.attachments ?? []) : [],
    isFreePreview: !!lesson.isFreePreview,
  };
}

// ─── Público ─────────────────────────────────────────────────────────────────

export async function listPublished() {
  return Product.find({ isPublished: true }).sort(SORT).lean();
}

export async function getPublicDetail(slug: string) {
  const product = await Product.findOne({ slug: slug.toLowerCase(), isPublished: true }).lean();
  if (!product) throw new CustomError("Producto no encontrado", 404);
  return buildDetail(product, false);
}

// ─── Alumno ──────────────────────────────────────────────────────────────────

export async function getMemberDetail(slug: string, user: JwtPayload) {
  const product = await Product.findOne({ slug: slug.toLowerCase() }).lean();
  if (!product) throw new CustomError("Producto no encontrado", 404);

  if (user.accountType !== "admin" && !(await hasActiveAccess(user.userId, product._id))) {
    throw new CustomError("Tu acceso a este curso no está vigente", 403);
  }
  return buildDetail(product, true);
}

// ─── Admin ───────────────────────────────────────────────────────────────────

function toIntOrNull(value: unknown, field: string, allowNull: boolean): number | null {
  if (value === null || value === "") {
    if (allowNull) return null;
    throw new CustomError(`${field} es obligatorio`, 400);
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0)
    throw new CustomError(`${field} debe ser un entero positivo`, 400);
  return n;
}

/** Solo los campos editables; lo demás del body se ignora. */
function pickInput(body: any): Partial<IProduct> {
  const data: Partial<IProduct> = {};
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) throw new CustomError("El título es obligatorio", 400);
    data.title = title;
  }
  if (body.slug !== undefined) {
    const slug = slugify(String(body.slug));
    if (!slug) throw new CustomError("El slug no es válido", 400);
    data.slug = slug;
  }
  if (body.type !== undefined) {
    if (!PRODUCT_TYPES.includes(body.type)) throw new CustomError("Tipo de producto inválido", 400);
    data.type = body.type;
  }
  for (const key of ["shortDescription", "description", "cover", "badge"] as const) {
    if (body[key] !== undefined) data[key] = String(body[key] ?? "");
  }
  if (body.priceCents !== undefined)
    data.priceCents = toIntOrNull(body.priceCents, "El precio", false)!;
  if (body.comparePriceCents !== undefined) {
    data.comparePriceCents = toIntOrNull(body.comparePriceCents, "El precio anterior", true);
  }
  if (body.accessDurationDays !== undefined) {
    const days = toIntOrNull(body.accessDurationDays, "La duración", true);
    data.accessDurationDays = days === 0 ? null : days;
  }
  if (body.features !== undefined) {
    if (!Array.isArray(body.features))
      throw new CustomError("Las características deben ser una lista", 400);
    data.features = body.features.map((f: unknown) => String(f).trim()).filter(Boolean);
  }
  if (body.isFeatured !== undefined) data.isFeatured = !!body.isFeatured;
  if (body.isPublished !== undefined) data.isPublished = !!body.isPublished;
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;
  return data;
}

export async function listAll() {
  return Product.find().sort(SORT).lean();
}

export async function getById(id: string) {
  assertId(id, "Producto no encontrado");
  const product = await Product.findById(id).lean();
  if (!product) throw new CustomError("Producto no encontrado", 404);
  return product;
}

export async function getAdminDetail(id: string) {
  return buildDetail(await getById(id), true);
}

export async function create(body: any) {
  const data = pickInput(body ?? {});
  if (!data.title) throw new CustomError("El título es obligatorio", 400);
  if (!data.type) throw new CustomError("Elige el tipo de producto", 400);
  if (data.priceCents === undefined) throw new CustomError("El precio es obligatorio", 400);
  data.slug = data.slug || slugify(data.title);
  if (data.sortOrder === undefined) data.sortOrder = await Product.countDocuments();

  const product = await Product.create(data);
  return product.toObject();
}

export async function update(id: string, body: any) {
  assertId(id, "Producto no encontrado");
  const product = await Product.findByIdAndUpdate(
    id,
    { $set: pickInput(body ?? {}) },
    {
      new: true,
      runValidators: true,
    },
  ).lean();
  if (!product) throw new CustomError("Producto no encontrado", 404);
  return product;
}

/** Con ventas o alumnos no se borra: se perdería el historial. Se despublica. */
export async function remove(id: string) {
  assertId(id, "Producto no encontrado");
  const [accesses, orders] = await Promise.all([
    Access.countDocuments({ product: id }),
    Order.countDocuments({ product: id }),
  ]);
  if (accesses > 0 || orders > 0) {
    throw new CustomError(
      "Este producto tiene alumnos o ventas; despublícalo en lugar de borrarlo",
      409,
    );
  }
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw new CustomError("Producto no encontrado", 404);
  await Promise.all([CourseModule.deleteMany({ product: id }), Lesson.deleteMany({ product: id })]);
  return { ok: true };
}

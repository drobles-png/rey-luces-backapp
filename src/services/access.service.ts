import crypto from "crypto";
import { Types } from "mongoose";
import { env } from "../config/env";
import { CustomError } from "../errors/customError.error";
import { Access, AccessSource } from "../models/access.model";
import { Product } from "../models/product.model";
import { User } from "../models/user.model";
import { assertId } from "../utils/objectId";
import { sendAccessGrantedEmail } from "./notification.service";

export type AccessStatus = "vigente" | "vencido" | "revocado";

type AccessLike = { revokedAt?: Date | null; expiresAt?: Date | null };

/**
 * La única definición de "vigente": sin revocar y sin vencer (null = no vence).
 * La usan el reproductor, "Mis productos", las señales, el panel admin y el cron.
 */
export function accessStatus(access: AccessLike, now: Date = new Date()): AccessStatus {
  if (access.revokedAt) return "revocado";
  if (access.expiresAt && new Date(access.expiresAt).getTime() <= now.getTime()) return "vencido";
  return "vigente";
}

export function isVigente(access: AccessLike, now: Date = new Date()): boolean {
  return accessStatus(access, now) === "vigente";
}

/**
 * La misma regla de isVigente traducida a filtro de Mongo, para contar o
 * buscar sin traer todos los documentos. Si cambia una, cambia la otra.
 */
export function vigenteQuery(now: Date = new Date()) {
  return { revokedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] };
}

/**
 * El vencimiento manual es obligatorio y explícito: o fecha futura o null.
 * Un default silencioso terminaría regalando o cortando accesos sin que nadie
 * lo decida.
 */
export function parseExpiresAt(raw: unknown): Date | null {
  if (raw === undefined) {
    throw new CustomError("Elige cuándo vence el acceso: una fecha o «No se revoca»", 400);
  }
  if (raw === null) return null;

  const text = String(raw).trim();
  // Una fecha sola ("2026-11-30") vale hasta el final de ese día en Ecuador.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T23:59:59-05:00`)
    : new Date(text);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    throw new CustomError("La fecha de vencimiento debe ser una fecha futura válida", 400);
  }
  return date;
}

export async function hasActiveAccess(userId: string, productId: string | Types.ObjectId) {
  const access = await Access.findOne({ user: userId, product: productId }).lean();
  return !!access && isVigente(access);
}

/** ¿Tiene al menos una membresía vigente? Es lo que abre las señales. */
export async function hasActiveMembership(userId: string): Promise<boolean> {
  const memberships = await Product.find({ type: "membership" }).select("_id").lean();
  if (memberships.length === 0) return false;
  const found = await Access.exists({
    user: userId,
    product: { $in: memberships.map((p) => p._id) },
    ...vigenteQuery(),
  });
  return !!found;
}

/** Otorga o renueva: el índice único hace que siempre sea el mismo documento. */
export async function grant(input: {
  userId: string | Types.ObjectId;
  productId: string | Types.ObjectId;
  source: AccessSource;
  expiresAt: Date | null;
  note?: string;
  grantedBy?: string | Types.ObjectId | null;
  order?: string | Types.ObjectId | null;
}) {
  return Access.findOneAndUpdate(
    { user: input.userId, product: input.productId },
    {
      $set: {
        source: input.source,
        expiresAt: input.expiresAt,
        note: input.note ?? "",
        grantedBy: input.grantedBy ?? null,
        order: input.order ?? null,
        revokedAt: null,
        // Nuevo vencimiento, nuevos avisos.
        reminder7SentAt: null,
        reminder0SentAt: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

// ─── Vistas ──────────────────────────────────────────────────────────────────

export function toAccessInfo(access: any) {
  return {
    _id: String(access._id),
    source: access.source,
    status: accessStatus(access),
    expiresAt: access.expiresAt ?? null,
    createdAt: access.createdAt,
  };
}

export function toAdminAccess(access: any) {
  const user = access.user || {};
  const product = access.product || {};
  return {
    _id: String(access._id),
    user: { _id: String(user._id ?? ""), email: user.email ?? "", name: user.name ?? "" },
    product: {
      _id: String(product._id ?? ""),
      title: product.title ?? "",
      slug: product.slug ?? "",
    },
    source: access.source,
    status: accessStatus(access),
    note: access.note ?? "",
    expiresAt: access.expiresAt ?? null,
    revokedAt: access.revokedAt ?? null,
    createdAt: access.createdAt,
  };
}

async function findAdminAccess(filter: Record<string, unknown>) {
  return Access.find(filter)
    .populate("user", "email name")
    .populate("product", "title slug")
    .sort({ createdAt: -1 })
    .lean();
}

/** GET /me/products — incluye vencidos y revocados: que un curso desaparezca sin explicación genera soporte. */
export async function listForUser(userId: string) {
  const accesses = await Access.find({ user: userId })
    .populate("product")
    .sort({ createdAt: -1 })
    .lean();

  return accesses
    .filter((a: any) => a.product)
    .sort((a: any, b: any) => (a.product.sortOrder ?? 0) - (b.product.sortOrder ?? 0))
    .map((a: any) => {
      const vigente = isVigente(a);
      return {
        access: toAccessInfo(a),
        product: a.product,
        communityUrl:
          a.product.type === "membership" && vigente && env.COMMUNITY_URL
            ? env.COMMUNITY_URL
            : null,
      };
    });
}

// ─── Admin ───────────────────────────────────────────────────────────────────

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function grantManual(input: {
  email: unknown;
  productIds: unknown;
  expiresAt: unknown;
  note: unknown;
  adminId: string;
}) {
  const email = String(input.email ?? "")
    .toLowerCase()
    .trim();
  if (!EMAIL.test(email)) throw new CustomError("Escribe un correo válido", 400);

  const ids = Array.isArray(input.productIds) ? input.productIds.map(String) : [];
  if (ids.length === 0) throw new CustomError("Elige al menos un producto", 400);
  ids.forEach((id) => assertId(id, "Producto no encontrado"));

  const expiresAt = parseExpiresAt(input.expiresAt);
  const note = String(input.note ?? "").trim();

  const products = await Product.find({ _id: { $in: ids } }).lean();
  if (products.length !== new Set(ids).size)
    throw new CustomError("Algún producto ya no existe", 404);

  let user = await User.findOne({ email });
  let temporaryPassword: string | undefined;
  if (!user) {
    temporaryPassword = crypto.randomBytes(6).toString("base64url");
    user = await User.create({ email, password: temporaryPassword, accountType: "customer" });
  }

  for (const product of products) {
    await grant({
      userId: user._id,
      productId: product._id,
      source: "manual",
      expiresAt,
      note,
      grantedBy: input.adminId,
    });
  }

  void sendAccessGrantedEmail({
    user: { email: user.email, name: user.name },
    productTitles: products.map((p) => p.title),
    expiresAt,
    temporaryPassword,
  });

  const accesses = await findAdminAccess({
    user: user._id,
    product: { $in: products.map((p) => p._id) },
  });
  return accesses.map(toAdminAccess);
}

export async function list(filters: { product?: unknown; user?: unknown; status?: unknown }) {
  const query: Record<string, unknown> = {};
  if (filters.product) query.product = assertId(filters.product, "Producto no encontrado");
  if (filters.user) query.user = assertId(filters.user, "Alumno no encontrado");

  const items = (await findAdminAccess(query)).map(toAdminAccess);
  const status = String(filters.status ?? "");
  if (["vigente", "vencido", "revocado"].includes(status)) {
    return items.filter((a) => a.status === status);
  }
  return items;
}

export async function updateExpiry(id: string, rawExpiresAt: unknown) {
  assertId(id, "Acceso no encontrado");
  const expiresAt = parseExpiresAt(rawExpiresAt);
  const access = await Access.findByIdAndUpdate(
    id,
    { $set: { expiresAt, reminder7SentAt: null, reminder0SentAt: null } },
    { new: true },
  );
  if (!access) throw new CustomError("Acceso no encontrado", 404);
  const [populated] = await findAdminAccess({ _id: access._id });
  return toAdminAccess(populated);
}

/** No se borra: el historial sirve para soporte. */
export async function revoke(id: string) {
  assertId(id, "Acceso no encontrado");
  const access = await Access.findById(id);
  if (!access) throw new CustomError("Acceso no encontrado", 404);
  if (!access.revokedAt) {
    access.revokedAt = new Date();
    await access.save();
  }
  const [populated] = await findAdminAccess({ _id: access._id });
  return toAdminAccess(populated);
}

export async function countActive(): Promise<number> {
  return Access.countDocuments(vigenteQuery());
}

/** userId → cantidad de accesos vigentes, para la tabla de alumnos. */
export async function activeCountsByUser(userIds: Types.ObjectId[]): Promise<Map<string, number>> {
  const rows = await Access.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { user: { $in: userIds }, ...vigenteQuery() } },
    { $group: { _id: "$user", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

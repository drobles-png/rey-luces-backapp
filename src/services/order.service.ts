import crypto from "crypto";
import { env } from "../config/env";
import { CustomError } from "../errors/customError.error";
import { Access } from "../models/access.model";
import { Order, ORDER_STATUSES } from "../models/order.model";
import { Product } from "../models/product.model";
import { User } from "../models/user.model";
import { assertId } from "../utils/objectId";
import { grant, isVigente } from "./access.service";
import { sendPurchaseEmail } from "./notification.service";
import * as payphoneService from "./payphone.service";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Payphone pide el teléfono del comprador en formato internacional (+593...). */
export function toInternationalPhone(raw: string): string {
  const digits = (raw || "").replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("593")) return `+${digits}`;
  if (digits.startsWith("0")) return `+593${digits.slice(1)}`;
  return `+593${digits}`;
}

function newClientTransactionId(): string {
  // Máximo 50 caracteres; único por intento.
  return `RL-${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}`.toUpperCase();
}

/** POST /orders — el monto sale del producto en el servidor, nunca del navegador. */
export async function createOrder(userId: string, productId: unknown) {
  if (!payphoneService.isPayphoneConfigured()) {
    throw new CustomError("Los pagos en línea aún no están configurados", 503);
  }
  const id = assertId(productId, "Producto no encontrado");

  const [product, user] = await Promise.all([
    Product.findOne({ _id: id, isPublished: true }).lean(),
    User.findById(userId).lean<any>(),
  ]);
  if (!product) throw new CustomError("Producto no encontrado", 404);
  if (!user) throw new CustomError("Usuario no encontrado", 404);
  if (product.priceCents <= 0) throw new CustomError("Este producto no se vende en línea", 400);

  const phoneNumber = toInternationalPhone(user.phone);
  if (!phoneNumber) {
    throw new CustomError("Agrega tu número de celular a tu cuenta para poder pagar", 400);
  }

  const clientTransactionId = newClientTransactionId();
  const order = await Order.create({
    user: user._id,
    product: product._id,
    productTitle: product.title,
    totalCents: product.priceCents,
    clientTransactionId,
  });

  return {
    orderId: String(order._id),
    token: env.PAYPHONE_TOKEN,
    storeId: env.PAYPHONE_STORE_ID,
    clientTransactionId,
    amount: product.priceCents,
    // Sin desglose de IVA: Payphone exige que la suma cuadre con amount.
    amountWithoutTax: product.priceCents,
    currency: "USD" as const,
    reference: `Rey Luces · ${product.title}`.slice(0, 100),
    email: user.email,
    phoneNumber,
  };
}

/**
 * Una renovación suma días desde el vencimiento vigente, no desde hoy: quien
 * renueva antes de tiempo no pierde los días que le quedaban.
 */
async function purchaseExpiry(
  userId: string,
  productId: string,
  days: number | null,
): Promise<Date | null> {
  if (!days) return null;
  const current = await Access.findOne({ user: userId, product: productId }).lean();
  if (current && isVigente(current) && current.expiresAt === null) return null;
  const base =
    current && isVigente(current) && current.expiresAt
      ? new Date(current.expiresAt).getTime()
      : Date.now();
  return new Date(base + days * DAY_MS);
}

/** POST /orders/confirm — idempotente: recargar la página de respuesta no duplica nada. */
export async function confirmOrder(
  userId: string,
  payphoneId: unknown,
  clientTransactionId: unknown,
) {
  const txId = String(clientTransactionId ?? "").trim();
  const id = Number(payphoneId);
  if (!txId || !Number.isInteger(id))
    throw new CustomError("Faltan los datos de la transacción", 400);

  const order = await Order.findOne({ clientTransactionId: txId, user: userId });
  if (!order) throw new CustomError("Orden no encontrada", 404);

  const product = await Product.findById(order.product).lean();
  if (!product) throw new CustomError("Producto no encontrado", 404);

  if (order.status !== "pending") {
    return { status: order.status, order: toOrder(order), product };
  }

  const data = await payphoneService.confirm(id, txId);

  let status: "paid" | "canceled" | "failed";
  if (data.statusCode === 3 && Number(data.amount) === order.totalCents) status = "paid";
  else if (data.statusCode === 2) status = "canceled";
  else status = "failed";

  if (data.statusCode === 3 && status === "failed") {
    console.error(
      `[orders] monto no coincide en ${txId}: payphone=${data.amount} orden=${order.totalCents}`,
    );
  }

  // Transición atómica desde pending: si dos confirmaciones llegan juntas,
  // solo una entrega el acceso y manda el correo.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: "pending" },
    { $set: { status, payphoneResponse: data, paidAt: status === "paid" ? new Date() : null } },
    { new: true },
  );
  if (!updated) {
    const fresh = await Order.findById(order._id);
    return { status: fresh!.status, order: toOrder(fresh), product };
  }

  if (status === "paid") {
    const expiresAt = await purchaseExpiry(userId, String(product._id), product.accessDurationDays);
    await grant({
      userId,
      productId: product._id,
      source: "purchase",
      expiresAt,
      order: updated._id,
      note: `Compra ${txId}`,
    });

    const user = await User.findById(userId).lean<any>();
    if (user) {
      void sendPurchaseEmail({
        user: { email: user.email, name: user.name },
        productTitle: product.title,
        productType: product.type,
        totalCents: updated.totalCents,
        expiresAt,
      });
    }
  }

  return { status: updated.status, order: toOrder(updated), product };
}

export function toOrder(order: any) {
  const o = typeof order?.toObject === "function" ? order.toObject() : order;
  return {
    _id: String(o._id),
    user:
      o.user && typeof o.user === "object" && o.user.email !== undefined
        ? { _id: String(o.user._id), email: o.user.email, name: o.user.name ?? "" }
        : String(o.user),
    product:
      o.product && typeof o.product === "object" && o.product.slug !== undefined
        ? o.product
        : String(o.product),
    productTitle: o.productTitle,
    totalCents: o.totalCents,
    clientTransactionId: o.clientTransactionId,
    status: o.status,
    paidAt: o.paidAt ?? null,
    createdAt: o.createdAt,
  };
}

export async function listForUser(userId: string) {
  const orders = await Order.find({ user: userId }).sort({ createdAt: -1 }).lean();
  return orders.map(toOrder);
}

export async function listAdmin(query: { page?: unknown; status?: unknown }) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = 20;
  const filter: Record<string, unknown> = {};
  const status = String(query.status ?? "");
  if ((ORDER_STATUSES as readonly string[]).includes(status)) filter.status = status;

  const [items, total] = await Promise.all([
    Order.find(filter)
      .populate("user", "email name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { items: items.map(toOrder), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

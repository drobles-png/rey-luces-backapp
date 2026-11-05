import mongoose, { Schema, Types } from "mongoose";

export const ORDER_STATUSES = ["pending", "paid", "canceled", "failed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface IOrder {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  product: Types.ObjectId;
  productTitle: string;
  totalCents: number;
  clientTransactionId: string;
  status: OrderStatus;
  // Respuesta completa de Payphone: sirve para soporte y conciliación.
  payphoneResponse: unknown;
  paidAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productTitle: { type: String, required: true },
    totalCents: { type: Number, required: true, min: 0 },
    clientTransactionId: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ORDER_STATUSES, default: "pending", index: true },
    // select: false — no viaja al navegador por descuido.
    payphoneResponse: { type: Schema.Types.Mixed, default: null, select: false },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

export const Order =
  (mongoose.models.Order as mongoose.Model<IOrder>) || mongoose.model<IOrder>("Order", orderSchema);

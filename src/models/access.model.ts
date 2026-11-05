import mongoose, { Schema, Types } from "mongoose";

export const ACCESS_SOURCES = ["purchase", "manual", "demo"] as const;
export type AccessSource = (typeof ACCESS_SOURCES)[number];

export interface IAccess {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  product: Types.ObjectId;
  source: AccessSource;
  order: Types.ObjectId | null;
  grantedBy: Types.ObjectId | null;
  note: string;
  /** null = no se revoca. */
  expiresAt: Date | null;
  revokedAt: Date | null;
  // Marcas del cron de avisos: evitan mandar el mismo correo dos veces.
  reminder7SentAt: Date | null;
  reminder0SentAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const accessSchema = new Schema<IAccess>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    source: { type: String, enum: ACCESS_SOURCES, required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    grantedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, default: "" },
    expiresAt: { type: Date, default: null, index: true },
    revokedAt: { type: Date, default: null },
    reminder7SentAt: { type: Date, default: null, select: false },
    reminder0SentAt: { type: Date, default: null, select: false },
  },
  { timestamps: true, versionKey: false },
);

// Un acceso por alumno y producto: volver a otorgar actualiza el mismo registro.
accessSchema.index({ user: 1, product: 1 }, { unique: true });

export const Access =
  (mongoose.models.Access as mongoose.Model<IAccess>) ||
  mongoose.model<IAccess>("Access", accessSchema);

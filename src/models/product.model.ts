import mongoose, { Schema, Types } from "mongoose";

export const PRODUCT_TYPES = ["membership", "course", "service"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export interface IProduct {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  type: ProductType;
  shortDescription: string;
  description: string;
  priceCents: number;
  comparePriceCents: number | null;
  cover: string;
  features: string[];
  /** null = acceso de por vida. */
  accessDurationDays: number | null;
  badge: string;
  isFeatured: boolean;
  isPublished: boolean;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const productSchema = new Schema<IProduct>(
  {
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: PRODUCT_TYPES, required: true },
    shortDescription: { type: String, default: "" },
    description: { type: String, default: "" },
    priceCents: { type: Number, required: true, min: 0 },
    comparePriceCents: { type: Number, default: null },
    cover: { type: String, default: "" },
    features: { type: [String], default: [] },
    accessDurationDays: { type: Number, default: null },
    badge: { type: String, default: "" },
    isFeatured: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

export const Product =
  (mongoose.models.Product as mongoose.Model<IProduct>) ||
  mongoose.model<IProduct>("Product", productSchema);

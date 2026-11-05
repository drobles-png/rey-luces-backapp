import mongoose, { Schema, Types } from "mongoose";

export const DIRECTIONS = ["buy", "sell"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export interface IResult {
  _id: Types.ObjectId;
  asset: string;
  direction: Direction;
  lots: number;
  entryPrice: number;
  exitPrice: number;
  profitCents: number;
  image: string;
  note: string;
  tradedAt: Date;
  isPublished: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const resultSchema = new Schema<IResult>(
  {
    asset: { type: String, required: true, trim: true },
    direction: { type: String, enum: DIRECTIONS, required: true },
    lots: { type: Number, required: true, min: 0 },
    entryPrice: { type: Number, required: true },
    exitPrice: { type: Number, required: true },
    profitCents: { type: Number, required: true },
    image: { type: String, default: "" },
    note: { type: String, default: "" },
    tradedAt: { type: Date, required: true, index: true },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

export const Result =
  (mongoose.models.Result as mongoose.Model<IResult>) ||
  mongoose.model<IResult>("Result", resultSchema);

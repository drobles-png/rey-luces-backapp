import mongoose, { Schema, Types } from "mongoose";
import { DIRECTIONS, Direction } from "./result.model";

export const SIGNAL_STATUSES = ["open", "won", "lost", "cancelled"] as const;
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];

export interface ISignal {
  _id: Types.ObjectId;
  asset: string;
  direction: Direction;
  riskCents: number;
  targetCents: number;
  management: string;
  window: string;
  note: string;
  status: SignalStatus;
  resultCents: number | null;
  sentAt: Date;
  closedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const signalSchema = new Schema<ISignal>(
  {
    asset: { type: String, required: true, trim: true },
    direction: { type: String, enum: DIRECTIONS, required: true },
    riskCents: { type: Number, default: 0 },
    targetCents: { type: Number, default: 0 },
    management: { type: String, default: "" },
    window: { type: String, default: "" },
    note: { type: String, default: "" },
    status: { type: String, enum: SIGNAL_STATUSES, default: "open", index: true },
    resultCents: { type: Number, default: null },
    sentAt: { type: Date, default: () => new Date(), index: true },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

export const Signal =
  (mongoose.models.Signal as mongoose.Model<ISignal>) ||
  mongoose.model<ISignal>("Signal", signalSchema);

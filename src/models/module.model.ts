import mongoose, { Schema, Types } from "mongoose";

export interface IModule {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  title: string;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const moduleSchema = new Schema<IModule>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    title: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

// "Module" choca con el global de Node; el modelo se llama CourseModule.
export const CourseModule =
  (mongoose.models.CourseModule as mongoose.Model<IModule>) ||
  mongoose.model<IModule>("CourseModule", moduleSchema);

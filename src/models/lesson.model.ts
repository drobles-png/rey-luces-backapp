import mongoose, { Schema, Types } from "mongoose";

export interface ILesson {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  module: Types.ObjectId;
  title: string;
  description: string;
  sortOrder: number;
  bunnyVideoId: string;
  durationSec: number;
  attachments: { name: string; url: string }[];
  isFreePreview: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const lessonSchema = new Schema<ILesson>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    module: { type: Schema.Types.ObjectId, ref: "CourseModule", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    bunnyVideoId: { type: String, default: "" },
    durationSec: { type: Number, default: 0 },
    attachments: {
      type: [
        { _id: false, name: { type: String, default: "" }, url: { type: String, default: "" } },
      ],
      default: [],
    },
    isFreePreview: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

export const Lesson =
  (mongoose.models.Lesson as mongoose.Model<ILesson>) ||
  mongoose.model<ILesson>("Lesson", lessonSchema);

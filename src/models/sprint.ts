import mongoose, { ObjectId } from "mongoose";

export enum SprintType {
  SPRINT = "SPRINT",
  CONTINUOUS = "CONTINUOUS",
}

export interface ISprint {
  projectId: ObjectId;
  name: string;
  description?: string;
  type: SprintType;
  start_date: Date;
  end_date: Date;
  is_completed?: boolean;
  deleted?: boolean;
}

const SprintSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  name: {
    type: String,
    required: true,
    length: 120,
  },
  description: {
    type: String,
    required: false,
    length: 5000,
  },
  type: {
    type: String,
    required: true,
    enum: Object.values(SprintType),
  },
  start_date: {
    type: Date,
    required: true,
  },
  end_date: {
    type: Date,
    required: true,
  },
  is_completed: {
    type: Boolean,
    required: false,
  },
  deleted: {
    type: Boolean,
    required: false,
  },
}, {
  timestamps: true,
});

SprintSchema.index({ projectId: 1 });

const Sprint = mongoose.model<ISprint>("sprint", SprintSchema);
export default Sprint;

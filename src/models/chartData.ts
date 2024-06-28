import mongoose, { ObjectId } from "mongoose";

export enum EventType {
  SPRINT_START = "SPRINT_START",
  SPRINT_END = "SPRINT_END",
  ADDED_TO_SPRINT = "ADDED_TO_SPRINT",
  REMOVED_FROM_SPRINT = "REMOVED_FROM_SPRINT",
  ESTIMATE_UPDATED = "ESTIMATE_UPDATED",
  COMPLEXITY_UPDATED = "COMPLEXITY_UPDATED",
  ITEM_COMPLETED = "ITEM_COMPLETED",
}

export interface IChartDataItem {
  itemId: ObjectId;
  complexity?: number;
  old_complexity?: number;
  estimate?: number;
  old_estimate?: number;
}

export interface IChartData {
  projectId: ObjectId;
  items: IChartDataItem[];
  sprintId?: ObjectId[];
  event_type: EventType;
}

const ChartDataSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  items: {
    type: [{
      itemId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      complexity: {
        type: Number,
        required: false,
      },
      old_complexity: {
        type: Number,
        required: false,
      },
      estimate: {
        type: Number,
        required: false,
      },
      old_estimate: {
        type: Number,
        required: false,
      },
    }],
    required: false,
  },
  sprintId: {
    type: [mongoose.Schema.Types.ObjectId],
    required: false,
  },
  event_type: {
    type: String,
    required: true,
    enum: Object.values(EventType),
  },
}, {
  timestamps: true,
});

ChartDataSchema.index({ projectId: 1 });

ChartDataSchema.index({
  projectId: 1,
  sprintId: 1,
});

const ChartData = mongoose.model<IChartData>("chart_data", ChartDataSchema);
export default ChartData;

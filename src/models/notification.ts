import mongoose, { ObjectId } from "mongoose";

export enum NotificationType {
  MENTION = "MENTION",
  COMMENT = "COMMENT",
  ASSIGNMENT = "ASSIGNMENT",
  SPRINT_START = "SPRINT_START",
  SPRINT_COMPLETE = "SPRINT_COMPLETE",
  ITEM = "ITEM",
}

export interface INotification {
  projectId: ObjectId;
  userId: ObjectId;
  triggerId?: ObjectId;
  entityId?: ObjectId;
  entity_name?: string;
  notification_type: NotificationType;
  is_read: boolean;
}

const NotificationSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  triggerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  entity_name: {
    type: String,
    required: false,
  },
  notification_type: {
    type: String,
    required: true,
    enum: Object.values(NotificationType),
  },
  is_read: {
    type: Boolean,
    required: true,
  },
}, {
  timestamps: true,
});

const Notification = mongoose.model<INotification>("notification", NotificationSchema);
export default Notification;

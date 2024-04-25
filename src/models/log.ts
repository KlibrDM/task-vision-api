import mongoose, { ObjectId } from "mongoose";

export enum LogEntities {
  ITEM = "ITEM",
  PROJECT = "PROJECT",
  SPRINT = "SPRINT",
  USER = "USER",
  ORGANIZATION = "ORGANIZATION",
  UPLOADEDDOCS = "UPLOADEDDOCS",
  COLLABDOCS = "COLLABDOCS",
}

export enum LogAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  PUSHED = "PUSHED",
  PULLED = "PULLED",
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
}

export enum LogTrigger {
  SYSTEM = "SYSTEM",
  USER = "USER",
}

export interface ILog {
  projectId?: ObjectId;
  affectedEntity: LogEntities;
  affectedEntityId: ObjectId;
  affectedEntityName?: string;
  action: LogAction;
  logTrigger: LogTrigger;
  logTriggerId?: ObjectId;
  changedField?: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
}

export interface ILogPayload {
  count: number;
  logs: ILog[];
}

const LogSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  affectedEntity: {
    type: String,
    required: true,
    enum: Object.values(LogEntities),
  },
  affectedEntityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  affectedEntityName: {
    type: String,
    required: false,
    length: 1024,
  },
  action: {
    type: String,
    required: true,
    enum: Object.values(LogAction),
  },
  logTrigger: {
    type: String,
    required: true,
    enum: Object.values(LogTrigger),
  },
  logTriggerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  changedField: {
    type: String,
    required: false,
    length: 1024,
  },
  oldValue: {
    type: String,
    required: false,
    length: 8192,
  },
  newValue: {
    type: String,
    required: false,
    length: 8192,
  },
  description: {
    type: String,
    required: false,
    length: 1024,
  },
}, {
  timestamps: true,
});

const Log = mongoose.model<ILog>("log", LogSchema);
export default Log;

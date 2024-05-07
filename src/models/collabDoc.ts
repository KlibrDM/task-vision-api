import mongoose, { ObjectId } from "mongoose";
import { ProjectRole } from "./project";

export interface ICollabDoc {
  ownerId: ObjectId;
  projectId: ObjectId;
  name: string;
  structure_path: string;
  content?: string;
  ai_summary?: string;
  is_folder: boolean;
  roles?: ProjectRole[];
  users?: ObjectId[];
  edit_roles?: ProjectRole[];
  edit_users?: ObjectId[];
  is_edited_by?: ObjectId;
}

const CollabDocSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  name: {
    type: String,
    required: true,
    length: 1024,
  },
  structure_path: {
    type: String,
    required: true,
    length: 1024,
  },
  content: {
    type: String,
    required: false,
    length: 10000000
  },
  ai_summary: {
    type: String,
    required: false,
    length: 100000
  },
  is_folder: {
    type: Boolean,
    required: true,
  },
  roles: {
    type: [String],
    required: false,
    enum: Object.values(ProjectRole),
  },
  users: {
    type: [mongoose.Schema.Types.ObjectId],
    required: false,
  },
  edit_roles: {
    type: [String],
    required: false,
    enum: Object.values(ProjectRole),
  },
  edit_users: {
    type: [mongoose.Schema.Types.ObjectId],
    required: false,
  },
  is_edited_by: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
}, {
  timestamps: true,
});

const CollabDoc = mongoose.model<ICollabDoc>("collab_doc", CollabDocSchema);
export default CollabDoc;

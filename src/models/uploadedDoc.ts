import mongoose, { ObjectId } from "mongoose";
import { ProjectRole } from "./project";

export interface IUploadedDoc {
  ownerId: ObjectId;
  projectId: ObjectId;
  name: string;
  structure_path: string;
  file_path: string;
  size: number;
  type: string;
  roles?: ProjectRole[];
  users?: ObjectId[];
  is_project_storage_folder?: boolean;
  is_project_storage_file?: boolean;
}

const UploadedDocSchema = new mongoose.Schema({
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
  file_path: {
    type: String,
    required: true,
    length: 1024,
  },
  size: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    required: true,
    length: 512,
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
  is_project_storage_folder: {
    type: Boolean,
    required: false,
  },
  is_project_storage_file: {
    type: Boolean,
    required: false,
  },
}, {
  timestamps: true,
});

const UploadedDoc = mongoose.model<IUploadedDoc>("uploaded_doc", UploadedDocSchema);
export default UploadedDoc;

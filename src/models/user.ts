import mongoose, { ObjectId } from "mongoose";
import { ProjectRole } from "./project";

export interface IUserSettings {
  enable_reactivity: boolean;
  mention_notifications: boolean;
  assignment_notifications: boolean;
  sprint_notifications: boolean;
  item_notifications: boolean;
}

export interface IUser {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  is_organization_controlled: boolean;
  organizationId?: ObjectId;
  active_projectId?: ObjectId;
  settings: IUserSettings;
  access_token?: string;
  refresh_token?: string;
}

export interface IUserPartner {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_organization_controlled: boolean;
  organizationId?: string;
  is_active: boolean;
  role: ProjectRole;
}

const UserSchema = new mongoose.Schema({
  first_name: {
    type: String,
    required: false,
    length: 60,
  },
  last_name: {
    type: String,
    required: false,
    length: 60,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    length: 120,
  },
  password: {
    type: String,
    required: true,
    length: 120,
  },
  is_organization_controlled: {
    type: Boolean,
    required: true,
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  active_projectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  settings: {
    type: {
      enable_reactivity: {
        type: Boolean,
        required: true,
        default: true,
      },
      mention_notifications: {
        type: Boolean,
        required: true,
        default: true,
      },
      assignment_notifications: {
        type: Boolean,
        required: true,
        default: true,
      },
      sprint_notifications: {
        type: Boolean,
        required: true,
        default: true,
      },
      item_notifications: {
        type: Boolean,
        required: true,
        default: true,
      },
    },
    required: true,
  },
  access_token: {
    type: String,
    required: false,
    length: 2048,
  },
  refresh_token: {
    type: String,
    required: false,
    length: 2048,
  },
}, {
  timestamps: true,
});

const User = mongoose.model<IUser>("user", UserSchema);
export default User;

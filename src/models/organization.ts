import mongoose, { ObjectId } from "mongoose";

export enum OrganizationRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

export interface IOrganizationUser {
  userId: ObjectId;
  role: OrganizationRole;
  is_active: boolean;
}

export interface IOrganization {
  name: string;
  users: IOrganizationUser[];
}

const OrganizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: false,
    length: 120,
  },
  users: {
    type: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      role: {
        type: String,
        enum: Object.values(OrganizationRole),
        required: true,
      },
      is_active: {
        type: Boolean,
        required: true,
      },
    }],
    required: false,
  },
}, {
  timestamps: true,
});

const Organization = mongoose.model<IOrganization>("organization", OrganizationSchema);
export default Organization;

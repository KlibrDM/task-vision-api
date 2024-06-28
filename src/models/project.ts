import mongoose, { ObjectId } from "mongoose";

export enum ProjectRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  BOARDMASTER = "BOARDMASTER",
  QA = "QA",
  MEMBER = "MEMBER",
}

export enum OwnerTypes {
  USER = "USER",
  ORGANIZATION = "ORGANIZATION",
}

export interface IProjectSettings {
  use_sprints: boolean;
  sprint_length: number;
  force_epic_link: boolean;
  auto_show_linked_requirements: boolean;
  enable_multi_sprint_items: boolean;
  enable_hour_tracking: boolean;
  enable_reactivity: boolean;
  auto_move_to_qa: boolean;
}

export interface IProjectUser {
  userId: ObjectId;
  role: ProjectRole;
  is_active: boolean;
}

export interface IProject {
  ownerId: ObjectId;
  users: IProjectUser[];
  currentSprintId?: ObjectId;
  name: string;
  code: string;
  description?: string;
  owner_type: OwnerTypes;
  board_columns: string[];
  qa_column?: string;
  blocked_column?: string;
  done_column?: string;
  settings: IProjectSettings;
  start_date: Date;
  end_date: Date;
}

const ProjectSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  users: {
    type: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      role: {
        type: String,
        required: true,
        enum: Object.values(ProjectRole),
      },
      is_active: {
        type: Boolean,
        required: true,
        default: true,
      },
    }],
    required: true,
  },
  currentSprintId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  name: {
    type: String,
    required: true,
    maxLength: 120,
  },
  code: {
    type: String,
    required: true,
    maxLength: 4,
  },
  description: {
    type: String,
    required: false,
    maxLength: 2000,
  },
  owner_type: {
    type: String,
    required: true,
    enum: Object.values(OwnerTypes),
  },
  board_columns: {
    type: [String],
    required: false,
    length: 30,
  },
  qa_column: {
    type: String,
    required: false,
    maxLength: 30,
  },
  blocked_column: {
    type: String,
    required: false,
    maxLength: 30,
  },
  done_column: {
    type: String,
    required: false,
    maxLength: 30,
  },
  settings: {
    type: {
      use_sprints: {
        type: Boolean,
        required: true,
      },
      sprint_length: {
        type: Number,
        required: true,
      },
      force_epic_link: {
        type: Boolean,
        required: true,
      },
      auto_show_linked_requirements: {
        type: Boolean,
        required: true,
      },
      enable_multi_sprint_items: {
        type: Boolean,
        required: true,
      },
      enable_hour_tracking: {
        type: Boolean,
        required: true,
      },
      enable_reactivity: {
        type: Boolean,
        required: true,
      },
      auto_move_to_qa: {
        type: Boolean,
        required: true,
      },
    },
    required: true,
  },
  start_date: {
    type: Date,
    required: true,
  },
  end_date: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
});

ProjectSchema.index({
  _id: 1,
  'users.userId': 1
});

const Project = mongoose.model<IProject>("project", ProjectSchema);
export default Project;

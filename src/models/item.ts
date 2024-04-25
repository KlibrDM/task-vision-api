import mongoose, { ObjectId } from "mongoose";

export enum ItemType {
  EPIC = "EPIC",
  MILESTONE = "MILESTONE",
  STORY = "STORY",
  FEATURE = "FEATURE",
  SUB_FEATURE = "SUB_FEATURE",
  IMPROVEMENT = "IMPROVEMENT",
  TASK = "TASK",
  SUB_TASK = "SUB_TASK",
  BUG = "BUG",
  TEST = "TEST",
  CUSTOMER_REQUIREMENT = "CUSTOMER_REQUIREMENT",
  FUNCTIONAL_REQUIREMENT = "FUNCTIONAL_REQUIREMENT",
  NON_FUNCTIONAL_REQUIREMENT = "NON_FUNCTIONAL_REQUIREMENT"
}

export enum ItemRelationType {
  RELATES_TO = "RELATES_TO", // applies both ways
  BLOCKS = "BLOCKS",
  IS_BLOCKED_BY = "IS_BLOCKED_BY",
  CLONES = "CLONES",
  IS_CLONED_BY = "IS_CLONED_BY",
  DEPENDS_ON = "DEPENDS_ON",
  IS_DEPENDENCY_FOR = "IS_DEPENDENCY_FOR",
  DUPLICATES = "DUPLICATES",
  IS_DUPLICATED_BY = "IS_DUPLICATED_BY",
  EXECUTES = "EXECUTES",
  IS_EXECUTED_BY = "IS_EXECUTED_BY",
  CAUSES = "CAUSES",
  IS_CAUSED_BY = "IS_CAUSED_BY",
  SOLVES = "SOLVES",
  IS_SOLVED_BY = "IS_SOLVED_BY",
  TESTS = "TESTS",
  IS_TESTED_BY = "IS_TESTED_BY",
  VALIDATES = "VALIDATES",
  IS_VALIDATED_BY = "IS_VALIDATED_BY",
  IMPLEMENTS = "IMPLEMENTS",
  IS_IMPLEMENTED_BY = "IS_IMPLEMENTED_BY",
  DELIVERS = "DELIVERS",
  IS_DELIVERED_BY = "IS_DELIVERED_BY",
  AFFECTS = "AFFECTS",
  IS_AFFECTED_BY = "IS_AFFECTED_BY",
  IS_PARENT_OF = "IS_PARENT_OF",
  IS_CHILD_OF = "IS_CHILD_OF",
  HAS_TO_BE_DONE_WITH = "HAS_TO_BE_DONE_WITH", // applies both ways
  HAS_TO_BE_DONE_BEFORE = "HAS_TO_BE_DONE_BEFORE",
  HAS_TO_BE_DONE_AFTER = "HAS_TO_BE_DONE_AFTER",
}

export const ItemRelationOpposites: Map<ItemRelationType, ItemRelationType> = new Map([
  [ItemRelationType.RELATES_TO, ItemRelationType.RELATES_TO],
  [ItemRelationType.BLOCKS, ItemRelationType.IS_BLOCKED_BY],
  [ItemRelationType.IS_BLOCKED_BY, ItemRelationType.BLOCKS],
  [ItemRelationType.CLONES, ItemRelationType.IS_CLONED_BY],
  [ItemRelationType.IS_CLONED_BY, ItemRelationType.CLONES],
  [ItemRelationType.DEPENDS_ON, ItemRelationType.IS_DEPENDENCY_FOR],
  [ItemRelationType.IS_DEPENDENCY_FOR, ItemRelationType.DEPENDS_ON],
  [ItemRelationType.DUPLICATES, ItemRelationType.IS_DUPLICATED_BY],
  [ItemRelationType.IS_DUPLICATED_BY, ItemRelationType.DUPLICATES],
  [ItemRelationType.EXECUTES, ItemRelationType.IS_EXECUTED_BY],
  [ItemRelationType.IS_EXECUTED_BY, ItemRelationType.EXECUTES],
  [ItemRelationType.CAUSES, ItemRelationType.IS_CAUSED_BY],
  [ItemRelationType.IS_CAUSED_BY, ItemRelationType.CAUSES],
  [ItemRelationType.SOLVES, ItemRelationType.IS_SOLVED_BY],
  [ItemRelationType.IS_SOLVED_BY, ItemRelationType.SOLVES],
  [ItemRelationType.TESTS, ItemRelationType.IS_TESTED_BY],
  [ItemRelationType.IS_TESTED_BY, ItemRelationType.TESTS],
  [ItemRelationType.VALIDATES, ItemRelationType.IS_VALIDATED_BY],
  [ItemRelationType.IS_VALIDATED_BY, ItemRelationType.VALIDATES],
  [ItemRelationType.IMPLEMENTS, ItemRelationType.IS_IMPLEMENTED_BY],
  [ItemRelationType.IS_IMPLEMENTED_BY, ItemRelationType.IMPLEMENTS],
  [ItemRelationType.DELIVERS, ItemRelationType.IS_DELIVERED_BY],
  [ItemRelationType.IS_DELIVERED_BY, ItemRelationType.DELIVERS],
  [ItemRelationType.AFFECTS, ItemRelationType.IS_AFFECTED_BY],
  [ItemRelationType.IS_AFFECTED_BY, ItemRelationType.AFFECTS],
  [ItemRelationType.IS_PARENT_OF, ItemRelationType.IS_CHILD_OF],
  [ItemRelationType.IS_CHILD_OF, ItemRelationType.IS_PARENT_OF],
  [ItemRelationType.HAS_TO_BE_DONE_WITH, ItemRelationType.HAS_TO_BE_DONE_WITH],
  [ItemRelationType.HAS_TO_BE_DONE_BEFORE, ItemRelationType.HAS_TO_BE_DONE_AFTER],
  [ItemRelationType.HAS_TO_BE_DONE_AFTER, ItemRelationType.HAS_TO_BE_DONE_BEFORE],
]);

export enum ItemPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
  BLOCKER = "BLOCKER",
}

export enum ItemResolution {
  FIXED = "FIXED",
  WONT_FIX = "WONT_FIX",
  DONE = "DONE",
  WONT_DO = "WONT_DO",
  DUPLICATE = "DUPLICATE",
  INCOMPLETE = "INCOMPLETE",
  ISSUES_FOUND = "ISSUES_FOUND",
  NO_ISSUES_FOUND = "NO_ISSUES_FOUND",
  CANNOT_REPRODUCE = "CANNOT_REPRODUCE",
}

export interface IItemRelation {
  type: ItemRelationType;
  itemId: ObjectId;
}

export interface IItemComment {
  _id?: ObjectId;
  userId: ObjectId;
  comment: string;
  timestamp: Date;
}

export interface IAIItemSummary {
  summary: string;
}

export interface IItem {
  projectId: ObjectId;
  sprintId?: ObjectId[];
  code: string;
  name: string;
  description?: string;
  ai_summary?: string;
  type: ItemType;
  reporterId: ObjectId;
  assigneeId?: ObjectId;
  complexity?: number;
  estimate?: number;
  hours_left?: number;
  column?: string;
  priority: ItemPriority;
  labels?: string[];
  resolution?: ItemResolution;
  epicId?: ObjectId;
  relations?: IItemRelation[];
  comments?: IItemComment[];
  done_date?: Date;
  deleted?: boolean;
}

const ItemSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  sprintId: {
    type: Array<mongoose.Schema.Types.ObjectId>,
    required: false,
  },
  code: {
    type: String,
    required: true,
    length: 30,
  },
  name: {
    type: String,
    required: true,
    length: 200,
  },
  description: {
    type: String,
    required: false,
    maxLength: 30000,
  },
  ai_summary: {
    type: String,
    required: false,
    maxLength: 10000,
  },
  type: {
    type: String,
    required: true,
    enum: Object.values(ItemType),
  },
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  assigneeId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  complexity: {
    type: Number,
    required: false,
    min: 0,
    max: 10000,
  },
  estimate: {
    type: Number,
    required: false,
    min: 0,
    max: 10000,
  },
  hours_left: {
    type: Number,
    required: false,
    max: 10000,
  },
  column: {
    type: String,
    required: false,
    length: 30,
  },
  priority: {
    type: String,
    required: true,
    enum: Object.values(ItemPriority),
  },
  labels: {
    type: Array<String>,
    required: false,
    length: 1024,
  },
  resolution: {
    type: String,
    required: false,
    enum: Object.values(ItemResolution),
  },
  epicId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  relations: {
    type: [
      {
        type: {
          type: String,
          required: true,
          enum: Object.values(ItemRelationType),
        },
        itemId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
      },
    ],
    required: false,
  },
  comments: {
    type: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        comment: {
          type: String,
          required: true,
          length: 5000,
        },
        timestamp: {
          type: Date,
          required: true,
        },
      },
    ],
    required: false,
  },
  done_date: {
    type: Date,
    required: false,
  },
  deleted: {
    type: Boolean,
    required: false,
  },
}, {
  timestamps: true,
});

// TODO: Add indexes after performance testing

const Item = mongoose.model<IItem>("item", ItemSchema);
export default Item;

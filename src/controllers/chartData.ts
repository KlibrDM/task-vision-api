import { Request, Response, NextFunction } from 'express';
import Item, { IItem } from "../models/item";
import ChartData, { EventType } from "../models/chartData";
import { ISprint } from "../models/sprint";
import Project from '../models/project';

const trackItemUpdates = (
  newItem: IItem,
  oldItem: IItem | null,
  itemId: string,
  isCreate: boolean = false,
) => {
  // Track estimate updates
  if (newItem?.estimate !== oldItem?.estimate && !isCreate) {
    ChartData.create({
      projectId: newItem.projectId,
      items: [{
        itemId,
        estimate: newItem.estimate,
        old_estimate: oldItem?.estimate,
      }],
      sprintId: newItem.sprintId,
      event_type: EventType.ESTIMATE_UPDATED,
    });
  }

  // Track complexity updates
  if (newItem?.complexity !== oldItem?.complexity && !isCreate) {
    ChartData.create({
      projectId: newItem.projectId,
      items: [{
        itemId,
        complexity: newItem.complexity,
        old_complexity: oldItem?.complexity,
      }],
      sprintId: newItem.sprintId,
      event_type: EventType.COMPLEXITY_UPDATED,
    });
  }

  // Track completion updates
  if (newItem?.done_date !== oldItem?.done_date && !isCreate) {
    ChartData.create({
      projectId: newItem.projectId,
      items: [{
        itemId,
        complexity: newItem.complexity,
        estimate: newItem.estimate,
      }],
      sprintId: newItem.sprintId,
      event_type: EventType.ITEM_COMPLETED,
    });
  }

  // Track sprint add/remove
  if (newItem?.sprintId?.length || oldItem?.sprintId?.length) {
    const newSprintList = newItem.sprintId?.map((sprint) => sprint.toString()) || [];
    const oldSprintList = oldItem?.sprintId?.map((sprint) => sprint.toString()) || [];

    const addedSprints = newSprintList.filter((sprint) => !oldSprintList.includes(sprint));
    const removedSprints = oldSprintList.filter((sprint) => !newSprintList.includes(sprint));

    if (addedSprints.length) {
      ChartData.create({
        projectId: newItem.projectId,
        items: [{
          itemId,
          complexity: newItem.complexity,
          estimate: newItem.estimate,
        }],
        sprintId: addedSprints,
        event_type: EventType.ADDED_TO_SPRINT,
      });
    }

    if (removedSprints.length) {
      ChartData.create({
        projectId: newItem.projectId,
        items: [{
          itemId,
          complexity: newItem.complexity,
          estimate: newItem.estimate,
        }],
        sprintId: removedSprints,
        event_type: EventType.REMOVED_FROM_SPRINT,
      });
    }
  }
}

const trackSprintStart = async (sprint: ISprint, sprintId: string) => {
  // If start event already exists, return
  const existing = await ChartData.findOne({
    projectId: sprint.projectId,
    sprintId: [sprintId],
    event_type: EventType.SPRINT_START,
  });
  if (existing) {
    return;
  }
  const sprintItems = await Item.find({ sprintId: sprintId });
  const items = sprintItems.map((item) => ({
    itemId: item._id,
    complexity: item.complexity,
    estimate: item.estimate,
  }));
  ChartData.create({
    projectId: sprint.projectId,
    items,
    sprintId: sprintId,
    event_type: EventType.SPRINT_START,
  });
}

const trackSprintEnd = async (sprint: ISprint, sprintId: string) => {
  // If end event already exists, return
  const existing = await ChartData.findOne({
    projectId: sprint.projectId,
    sprintId: sprintId,
    event_type: EventType.SPRINT_END,
  });
  if (existing) {
    return;
  }
  const sprintItems = await Item.find({ sprintId: sprintId, done_date: null });
  const items = sprintItems.map((item) => ({
    itemId: item._id,
    complexity: item.complexity,
    estimate: item.estimate,
  }));
  ChartData.create({
    projectId: sprint.projectId,
    items,
    sprintId: [sprintId],
    event_type: EventType.SPRINT_END,
  });
}

const getChartData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;
    const sprintIds = req.query.sprintIds as string[];
    const itemIds = req.query.itemIds as string[];

    const project = await Project.find({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const data = await ChartData.find(
      itemIds?.length
        ? {
            projectId,
            sprintId: { $in: sprintIds },
            'items.itemId': { $in: itemIds }
          }
        : {
            projectId,
            sprintId: { $in: sprintIds }
          },
      null,
      { sort: { createdAt: 1 } }
    );
    if (!data) {
      return res.status(404).json({ message: 'No data found' });
    }
    
    res.send(data);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

export default {
  trackItemUpdates,
  trackSprintStart,
  trackSprintEnd,
  getChartData,
};

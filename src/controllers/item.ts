import { Request, Response, NextFunction } from 'express';
import Project, { ProjectRole } from '../models/project';
import Item, { IItem, IItemComment, IItemRelation, ItemRelationOpposites, ItemType } from '../models/item';
import { ws } from '..';
import { WS_CLIENT_EVENTS } from '../models/ws';
import Logger from './log';
import { LogAction, LogEntities } from '../models/log';
import OpenAI from 'openai';
import { ObjectId } from 'mongoose';

const createItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as IItem;
    const userId = req.headers['id'] as string;

    if (!data.projectId
      || !data.name
      || !data.type
      || !data.reporterId
      || !data.priority
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const project = await Project.findOne({ _id: data.projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // All checks pass -> Go on to item creation
    const itemCount = await Item.countDocuments({ projectId: data.projectId });

    const item = await Item.create({
      projectId: data.projectId,
      sprintId: data.sprintId,
      code: project.code + '-' + (itemCount + 1),
      name: data.name,
      description: data.description,
      ai_summary: data.ai_summary,
      type: data.type,
      reporterId: data.reporterId,
      assigneeId: data.assigneeId,
      complexity: data.complexity,
      estimate: data.estimate,
      hours_left: data.estimate,
      column: data.column,
      priority: data.priority,
      labels: data.labels,
      epicId: data.epicId,
      relations: data.relations,
    });

    // Add all relations to corresponding items
    if (data.relations) {
      for (const relation of data.relations) {
        const relatedItem = await Item.findByIdAndUpdate(
          relation.itemId,
          { $push: { relations: {
            itemId: item._id,
            type: ItemRelationOpposites.get(relation.type)
          } } },
          { new: true }
        );

        // Update related item for all clients
        ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.ITEM_CHANGED, data.projectId.toString(), relatedItem);
      }
    }

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.ITEM_CREATED, data.projectId.toString(), item, userId);

    // Logging
    Logger.logCreate(
      LogEntities.ITEM,
      item._id.toString(),
      `${item.code} - ${item.name}`,
      userId,
      data.projectId.toString()
    );

    // Send response
    return res.status(200).json(item);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const updateItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as IItem;
    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const userId = req.headers['id'] as string;

    if (!projectId
      || !itemId
      || !data.projectId
      || !data.name
      || !data.type
      || !data.reporterId
      || !data.priority
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.estimate !== data.estimate) {
      data.hours_left = data.estimate;
    }

    // Modify updated at
    Object.assign(data, { updatedAt: new Date() });

    // Set done date if item is moved to done column from another column
    if (project.done_column && data.column === project.done_column && data.column !== item.column) {
      data.done_date = new Date();
    }

    // Auto move to QA rule
    if (project.settings.auto_move_to_qa // If setting enabled
      && project.qa_column // If there is QA column
      && data.column !== item.column // If column changed
      && data.column === project.qa_column // If new column is QA
      && data.assigneeId // If it's assigned (not unassigned)
    ) {
      // Get current assignee Role
      const assigneeRole = project.users.find(u => u.userId.toString() === data.assigneeId?.toString())?.role;
      // Get all QA users
      const qaUsers = project.users.filter(u => u.role === ProjectRole.QA);

      if (assigneeRole !== ProjectRole.QA && qaUsers.length > 0) {
        // Set assignee to the QA user with least amount of items that are not in DONE column
        const qaUsersWithItems: {
          userId: ObjectId,
          itemCount: number,
          doneItemCount: number,
        }[]= [];

        for (const user of qaUsers) {
          const itemCount = await Item.find({ projectId, assigneeId: user.userId, sprintId: data.sprintId }).countDocuments();
          let doneItemCount = 0;
          if (project.done_column) {
            doneItemCount = await Item.find({ projectId, assigneeId: user.userId, sprintId: data.sprintId, column: project.done_column }).countDocuments();
          }

          qaUsersWithItems.push({
            userId: user.userId,
            itemCount,
            doneItemCount: doneItemCount ?? 0
          });
        }

        // Sort users by itemCount - doneItemCount
        qaUsersWithItems.sort((a, b) => {
          return (a.itemCount - a.doneItemCount) - (b.itemCount - b.doneItemCount);
        });
        // Set assignee to the first user
        data.assigneeId = qaUsersWithItems[0].userId;
      }
    }

    await item.replaceOne(data);

    const newItem = await Item.findById(itemId);
    if (!newItem) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.ITEM_CHANGED, projectId, newItem, userId);

    // Logging
    Logger.logDifference(
      LogEntities.ITEM,
      newItem._id.toString() ?? itemId,
      `${newItem.code} - ${newItem.name}`,
      LogAction.UPDATE,
      item,
      newItem,
      userId,
      projectId
    );

    // Send response
    return res.status(200).json(newItem);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const getAllItemsForProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.headers['id'] as string;

    const project = await Project.find({ _id: projectId, 'users.userId': userId });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const items = await Item.find({ projectId });
    if (!items) {
      return res.status(404).json({ message: 'No items found' });
    }

    res.send(items);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const getItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const userId = req.headers['id'] as string;

    if (!projectId || !itemId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const project = await Project.find({ _id: projectId, 'users.userId': userId });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const item = await Item.findOne({ _id: itemId });
    if (!item) {
      return res.status(404).json({ message: 'No item found' });
    }

    res.send(item);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const deleteItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const userId = req.headers['id'] as string;

    if (!projectId || !itemId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const item = await Item.findOneAndUpdate(
      { _id: itemId },
      { deleted: true },
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ message: 'No item found' });
    }

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.ITEM_DELETED, projectId, item, userId);

    // Logging
    Logger.logDelete(
      LogEntities.ITEM,
      item._id.toString() ?? itemId,
      `${item.code} - ${item.name}`,
      userId,
      projectId.toString()
    );

    // Send response
    return res.status(200).json(item);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const logHours = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as { hours: number };
    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const userId = req.headers['id'] as string;

    if (!projectId
      || !itemId
      || !data.hours
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const project = await Project.find({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const item = await Item.findByIdAndUpdate(itemId, { $inc: { hours_left: -data.hours } }, { new: true });
    if (!item) {
      return res.status(404).json({ message: 'No item found' });
    }

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.ITEM_CHANGED, projectId, item, userId);

    // Logging
    Logger.log(
      LogEntities.ITEM,
      item._id.toString() ?? itemId,
      `${item.code} - ${item.name}`,
      LogAction.UPDATE,
      'hours_left',
      item.hours_left ? (item.hours_left + data.hours).toString() : '0',
      item.hours_left ? item.hours_left.toString() : '0',
      userId,
      projectId
    );

    // Send response
    return res.status(200).json(item);
  }
  catch (err) {
    return res.status(500).json(err);
  }
}

const addComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as Partial<IItemComment>;
    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const userId = req.headers['id'] as string;

    if (!projectId
      || !itemId
      || !data.comment
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const project = await Project.find({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const item = await Item.findByIdAndUpdate(
      itemId,
      { $push: { comments: {
        comment: data.comment,
        userId,
        timestamp: new Date()
      } } },
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ message: 'No item found' });
    }

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.ITEM_CHANGED, projectId, item, userId);

    // Logging
    Logger.log(
      LogEntities.ITEM,
      item._id.toString() ?? itemId,
      `${item.code} - ${item.name}`,
      LogAction.PUSHED,
      'comments',
      undefined,
      data.comment,
      userId,
      projectId
    );

    // Send response
    return res.status(200).json(item);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const removeComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const commentId = req.params.commentId;
    const userId = req.headers['id'] as string;

    if (!projectId
      || !itemId
      || !commentId
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const project = await Project.find({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const oldItem = await Item.findById(itemId);
    if (!oldItem) {
      return res.status(404).json({ message: 'No item found' });
    }

    const item = await Item.findByIdAndUpdate(
      itemId,
      { $pull: { comments: { _id: commentId } } },
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ message: 'No item found' });
    }

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.ITEM_CHANGED, projectId, item, userId);

    // Logging
    Logger.log(
      LogEntities.ITEM,
      item._id.toString() ?? itemId,
      `${item.code} - ${item.name}`,
      LogAction.PULLED,
      'comments',
      oldItem.comments?.find(c => c._id?.toString() === commentId)?.comment ?? 'Comment not found',
      undefined,
      userId,
      projectId
    );

    // Send response
    return res.status(200).json(item);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const addRelation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as IItemRelation;
    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const userId = req.headers['id'] as string;

    if (!projectId
      || !itemId
      || !data.itemId
      || !data.type
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const project = await Project.find({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const relatedItem = await Item.findOne({ _id: data.itemId });
    if (!relatedItem) {
      return res.status(404).json({ message: 'Related item not found' });
    }

    const item = await Item.findByIdAndUpdate(
      itemId,
      { $push: { relations: data } },
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ message: 'No item found' });
    }

    // Add relation to related item
    const newRelatedItem = await Item.findByIdAndUpdate(
      data.itemId,
      { $push: { relations: {
        itemId,
        type: ItemRelationOpposites.get(data.type)
      } } },
      { new: true }
    );

    // Update item for all clients (except source)
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.ITEM_CHANGED, projectId, item, userId);

    // Update related item for all clients
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.ITEM_CHANGED, projectId, newRelatedItem);

    // Logging
    Logger.logRelationCreate(
      LogEntities.ITEM,
      item._id.toString() ?? itemId,
      `${item.code} - ${item.name}`,
      data.itemId.toString(),
      `${relatedItem.code} - ${relatedItem.name}`,
      userId,
      projectId
    );

    // Send response
    return res.status(200).json(item);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const removeRelation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as IItemRelation;
    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const userId = req.headers['id'] as string;

    if (!projectId
      || !itemId
      || !data.itemId
      || !data.type
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const project = await Project.find({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const relatedItem = await Item.findOne({ _id: data.itemId });
    if (!relatedItem) {
      return res.status(404).json({ message: 'Related item not found' });
    }

    const item = await Item.findByIdAndUpdate(
      itemId,
      { $pull: { relations: data } },
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ message: 'No item found' });
    }

    // Remove relation from related item
    const newRelatedItem = await Item.findByIdAndUpdate(
      data.itemId,
      { $pull: { relations: {
        itemId,
        type: ItemRelationOpposites.get(data.type)
      } } },
      { new: true }
    );

    // Update item for all clients (except source)
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.ITEM_CHANGED, projectId, item, userId);

    // Update related item for all clients
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.ITEM_CHANGED, projectId, newRelatedItem);
  
    // Logging
    Logger.logRelationDelete(
      LogEntities.ITEM,
      item._id.toString() ?? itemId,
      `${item.code} - ${item.name}`,
      data.itemId.toString(),
      `${relatedItem.code} - ${relatedItem.name}`,
      userId,
      projectId
    );

    return res.status(200).json(item);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const getAISummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as { name: string, description: string, type: ItemType, epicId?: string };

    let epicDescription = '';
    if (data.epicId) {
      const epic = await Item.findById(data.epicId);
      if (epic) {
        epicDescription = epic.description ?? '';
      }
    }

    // Get AI Summary
    const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      response_format: { "type":"json_object" },
      messages: [
        {
          role: 'system',
          content: 'You will create a summary of a software development issue. Your summary should not exceed 200 words. You must detect the language used in the task description and write the summary in the same language. You will be given the name of the issue, a description of the issue, the type of issue and an epic description if there is any associated with the task. You will provide a summary of the task that will help developers have a quick understanding of what the task is about and what they are supposed to do. Your response must be a JSON that follows the format: { summary: <<your summary>> }.'
        },
        {
          role: 'user',
          content: `Issue type: ${data.type}. Task name: ${data.name}. Task description: ${data.description}. ${epicDescription ? `Epic description: ${epicDescription}.` : ''}`
        }
      ]
    });

    const aiSummary = JSON.parse(aiResponse.choices[0].message.content || '{ summary: "" }').summary;

    return res.status(200).json({ summary: aiSummary });
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

export default {
  createItem,
  updateItem,
  getAllItemsForProject,
  getItem,
  deleteItem,
  logHours,
  addComment,
  removeComment,
  addRelation,
  removeRelation,
  getAISummary
};

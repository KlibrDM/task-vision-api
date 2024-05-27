import { Request, Response, NextFunction } from 'express';
import Project, { IProject, IProjectUser } from '../models/project';
import { WS_CLIENT_EVENTS } from '../models/ws';
import { ws } from '..';
import Notification, { NotificationType } from '../models/notification';
import { IItem } from '../models/item';
import { Types } from 'mongoose';
import { Document } from 'mongoose';
import { ISprint } from '../models/sprint';
import User from '../models/user';

const sendNotification = async (
  notification_type: string,
  projectId: string,
  userId: string,
  triggerId?: string,
  entityId?: string,
  entity_name?: string,
) => {
  const notification = await Notification.create({
    projectId,
    userId,
    triggerId,
    entityId,
    entity_name,
    notification_type,
    is_read: false
  });

  // Send websocket event
  ws.triggerClientEventForUser(WS_CLIENT_EVENTS.NEW_NOTIFICATION, projectId, userId, notification);
}

const handleItemUpdateNotification = (
  projectId: string,
  triggerId: string,
  oldItem: Document<unknown, {}, IItem> & IItem & { _id: Types.ObjectId },
  newItem: Document<unknown, {}, IItem> & IItem & { _id: Types.ObjectId },
) => {
  // Send item update notification to reporter
  if (newItem.reporterId.toString() !== triggerId) {
    // Send notification to reporter
    sendNotification(
      NotificationType.ITEM,
      projectId,
      newItem.reporterId.toString(),
      triggerId,
      newItem._id.toString(),
      newItem.code + ' - ' + newItem.name,
    );
  }

  // If assignee not changed, send item update notification to assignee
  if (
    newItem.assigneeId
    && newItem.assigneeId.toString() !== triggerId
    && newItem.assigneeId.toString() !== newItem.reporterId.toString()
    && (oldItem.assigneeId?.toString() ?? undefined) === newItem.assigneeId?.toString()
  ) {
    // Send notification to assignee
    sendNotification(
      NotificationType.ITEM,
      projectId,
      newItem.assigneeId.toString(),
      triggerId,
      newItem._id.toString(),
      newItem.code + ' - ' + newItem.name,
    );
  }

  // If assignee changed, send assignment notification to new assignee
  if (
    newItem.assigneeId
    && newItem.assigneeId.toString() !== triggerId
    && (oldItem.assigneeId?.toString() ?? undefined) !== newItem.assigneeId?.toString()
  ) {
    // Send notification to new assignee
    sendNotification(
      NotificationType.ASSIGNMENT,
      projectId,
      newItem.assigneeId.toString(),
      triggerId,
      newItem._id.toString(),
      newItem.code + ' - ' + newItem.name,
    );
  }
}

const handleItemCommentNotification = (
  projectId: string,
  triggerId: string,
  item: Document<unknown, {}, IItem> & IItem & { _id: Types.ObjectId },
) => {
  // Send item comment notification to reporter
  if (item.reporterId.toString() !== triggerId) {
    sendNotification(
      NotificationType.COMMENT,
      projectId,
      item.reporterId.toString(),
      triggerId,
      item._id.toString(),
      item.code + ' - ' + item.name,
    );
  }

  // Send item commment notification to assignee
  if (item.assigneeId && item.assigneeId.toString() !== triggerId) {
    sendNotification(
      NotificationType.COMMENT,
      projectId,
      item.assigneeId.toString(),
      triggerId,
      item._id.toString(),
      item.code + ' - ' + item.name,
    );
  }
}

const handleItemCommentMentionNotification = async (
  projectId: string,
  triggerId: string,
  item: Document<unknown, {}, IItem> & IItem & { _id: Types.ObjectId },
  comment: string,
) => {
  // Extract mentioned user emails from comment
  const mentionedUserEmails = comment.match(/\[~(.*?)\]/g)?.map((mention) => mention.replace(/\[~|]/g, '')) ?? [];

  const mentionedUsers = await User.find({ email: { $in: mentionedUserEmails } });
  const project = await Project.findById(projectId);

  const mentionedUsersInProject = mentionedUsers.filter((user) => project?.users.some((projectUser) => projectUser.userId.toString() === user._id.toString()));
  const mentionedUsersInProjectIds = mentionedUsersInProject.map((user) => user._id.toString());

  // Send item comment mention notification to mentioned users
  for (const userId of mentionedUsersInProjectIds) {
    if (userId !== triggerId) {
      sendNotification(
        NotificationType.MENTION,
        projectId,
        userId,
        triggerId,
        item._id.toString(),
        item.code + ' - ' + item.name,
      );
    }
  }
}

const handleItemDescriptionMentionNotification = async (
  projectId: string,
  triggerId: string,
  item: Document<unknown, {}, IItem> & IItem & { _id: Types.ObjectId },
  oldDescription: string,
  newDescription: string,
) => {
  // Extract mentioned user emails that are in the new description but not in the old description
  const oldMentionedUserEmails = oldDescription.match(/\[~(.*?)\]/g)?.map((mention) => mention.replace(/\[~|]/g, '')) ?? [];
  const newMentionedUserEmails = newDescription.match(/\[~(.*?)\]/g)?.map((mention) => mention.replace(/\[~|]/g, '')) ?? [];
  const mentionedUserEmails = newMentionedUserEmails.filter((email) => !oldMentionedUserEmails.includes(email));

  const mentionedUsers = await User.find({ email: { $in: mentionedUserEmails } });
  const project = await Project.findById(projectId);

  const mentionedUsersInProject = mentionedUsers.filter((user) => project?.users.some((projectUser) => projectUser.userId.toString() === user._id.toString()));
  const mentionedUsersInProjectIds = mentionedUsersInProject.map((user) => user._id.toString());

  // Send item comment mention notification to mentioned users
  for (const userId of mentionedUsersInProjectIds) {
    if (userId !== triggerId) {
      sendNotification(
        NotificationType.MENTION,
        projectId,
        userId,
        triggerId,
        item._id.toString(),
        item.code + ' - ' + item.name,
      );
    }
  }
}

const handleSprintStartNotification = (
  projectId: string,
  projectUsers: IProjectUser[],
  triggerId: string,
  sprint: Document<unknown, {}, ISprint> & ISprint & { _id: Types.ObjectId },
) => {
  for (const user of projectUsers) {
    if (user.userId.toString() !== triggerId) {
      sendNotification(
        NotificationType.SPRINT_START,
        projectId,
        user.userId.toString(),
        triggerId,
        sprint._id.toString(),
        sprint.name,
      );
    }
  }
}

const handleSprintCompleteNotification = (
  projectId: string,
  projectUsers: IProjectUser[],
  triggerId: string,
  sprint: Document<unknown, {}, ISprint> & ISprint & { _id: Types.ObjectId },
) => {
  for (const user of projectUsers) {
    if (user.userId.toString() !== triggerId) {
      sendNotification(
        NotificationType.SPRINT_COMPLETE,
        projectId,
        user.userId.toString(),
        triggerId,
        sprint._id.toString(),
        sprint.name,
      );
    }
  }
}

const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const notifications = await Notification.find({ projectId, userId }, null, { sort: { createdAt: -1 } });

    // Send response
    return res.status(200).json(notifications);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const getUnreadNotificationsCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const notificationsCount = await Notification.countDocuments({ projectId, userId, is_read: false });

    // Send response
    return res.status(200).json({ count: notificationsCount });
  }
  catch (err) {
    return res.status(500).json(err);
  }
}

const markNotificationAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const notifications = await Notification.updateMany(
      { projectId, userId, is_read: false },
      { is_read: true },
    );

    // Send response
    return res.status(200).json(notifications);
  }
  catch (err) {
    return res.status(500).json(err);
  }
}

export default {
  sendNotification,
  handleItemUpdateNotification,
  handleItemCommentNotification,
  handleItemCommentMentionNotification,
  handleItemDescriptionMentionNotification,
  handleSprintStartNotification,
  handleSprintCompleteNotification,
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead
};

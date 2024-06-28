import { NextFunction, Request, Response } from "express";
import Log, { LogAction, LogEntities, LogTrigger } from "../models/log";
import * as _ from 'lodash';
import Project from "../models/project";
import { isValidObjectId } from "mongoose";
import User from "../models/user";

const log = (
  entity: LogEntities,
  entityId: string,
  entityName: string,
  action: LogAction,
  changedField?: string,
  oldValue?: string,
  newValue?: string,
  triggerId?: string,
  projectId?: string,
  description?: string,
  isObject?: boolean,
) => {
  const log = {
    projectId,
    affectedEntity: entity,
    affectedEntityId: entityId,
    affectedEntityName: entityName,
    action,
    logTrigger: triggerId ? LogTrigger.USER : LogTrigger.SYSTEM,
    logTriggerId: triggerId,
    changedField,
    oldValue: oldValue
      ? oldValue.length > 120 && !isObject
        ? oldValue.substring(0, 120) + '...'
        : oldValue
      : undefined,
    newValue: newValue
      ? newValue.length > 120 && !isObject
        ? newValue.substring(0, 120) + '...'
        : newValue
      : undefined,
    description,
  };

  Log.create(log);
}

const logDifference = (
  entity: LogEntities,
  entityId: string,
  entityName: string,
  action: LogAction,
  oldData: any,
  newData: any,
  triggerId?: string,
  projectId?: string,
) => {
  oldData = oldData.toObject();
  newData = newData.toObject();
  const keys = new Set([
    ...Object.keys(oldData).filter((key =>
      key !== '_id'
      && key !== 'createdAt'
      && key !== 'updatedAt'
      && key !== '__v'
    )),
    ...Object.keys(newData).filter((key =>
      key !== '_id'
      && key !== 'createdAt'
      && key !== 'updatedAt'
      && key !== '__v'
    ))
  ]);

  keys.forEach((key) => {
    if (Array.isArray(oldData[key]) && Array.isArray(newData[key])) {
      // Remove ID from array objects (not needed for comparison)
      oldData[key] = oldData[key].map((obj: any) => {
        if (obj._id) {
          delete obj._id;
        }
        return obj;
      });
      newData[key] = newData[key].map((obj: any) => {
        if (obj._id) {
          delete obj._id;
        }
        return obj;
      });
    }
    else if (typeof oldData[key] === 'object' && typeof newData[key] === 'object') {
      // Remove ID from object
      if (oldData[key]._id) {
        delete oldData[key]._id;
      }
      if (newData[key]._id) {
        delete newData[key]._id;
      }
    }

    // Convert ObjectIds to string
    if (typeof oldData[key] === 'object' && isValidObjectId(oldData[key])) {
      oldData[key] = oldData[key].toString();
    }
    if (typeof newData[key] === 'object' && isValidObjectId(newData[key])) {
      newData[key] = newData[key].toString();
    }

    if (!_.isEqual(oldData[key], newData[key])) {
      log(
        entity,
        entityId,
        entityName,
        action,
        key,
        oldData[key]
          ? typeof oldData[key] === 'object'
            ? JSON.stringify(oldData[key])
            : oldData[key].toString()
          : undefined,
        newData[key]
          ? typeof newData[key] === 'object'
            ? JSON.stringify(newData[key])
            : newData[key].toString()
          : undefined,
        triggerId,
        projectId,
        undefined,
        typeof oldData[key] === 'object' || typeof newData[key] === 'object'
      );
    }
  });
}

const logCreate = (
  entity: LogEntities,
  entityId: string,
  entityName: string,
  triggerId?: string,
  projectId?: string,
) => {
  log(entity, entityId, entityName, LogAction.CREATE, undefined, undefined, undefined, triggerId, projectId);
}

const logDelete = (
  entity: LogEntities,
  entityId: string,
  entityName: string,
  triggerId?: string,
  projectId?: string,
) => {
  log(entity, entityId, entityName, LogAction.DELETE, undefined, undefined, undefined, triggerId, projectId);
}

const logRelationCreate = (
  entity: LogEntities,
  sourceId: string,
  sourceName: string,
  linkId: string,
  linkName: string,
  triggerId?: string,
  projectId?: string,
) => {
  log(entity, sourceId, sourceName, LogAction.PUSHED, 'relations', undefined, linkId, triggerId, projectId);
  log(entity, linkId, linkName, LogAction.PUSHED, 'relations', undefined, sourceId, triggerId, projectId);
}

const logRelationDelete = (
  entity: LogEntities,
  sourceId: string,
  sourceName: string,
  linkId: string,
  linkName: string,
  triggerId?: string,
  projectId?: string,
) => {
  log(entity, sourceId, sourceName, LogAction.PULLED, 'relations', linkId, undefined, triggerId, projectId);
  log(entity, linkId, linkName, LogAction.PULLED, 'relations', sourceId, undefined, triggerId, projectId);
}

const getLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entityId = req.params.entityId;
    const limit = parseInt(req.query.limit as string);
    const offset = parseInt(req.query.offset as string);
    const changedField = req.query.changedField as string;
    const userId = req.headers['id'] as string;

    const logsCount = await Log.countDocuments({ affectedEntityId: entityId, changedField });
    const logs = await Log.find(
      { affectedEntityId: entityId, changedField },
      null,
      { limit, skip: offset, sort: { createdAt: -1 } }
    );
    if (!logs.length) {
      // It's perfectly fine to not have logs for a specified query
      return res.status(200).json({ count: 0, logs: [] });
    }

    // If a project is associated with the log, check if the user is a member of the project
    const baseLog = logs[0];
    if (baseLog.projectId) {
      const project = await Project.find({ _id: baseLog.projectId, 'users.userId': userId });
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
    }

    res.send({ count: logsCount, logs });
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const getProjectLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId;
    const limit = parseInt(req.query.limit as string);
    const offset = parseInt(req.query.offset as string);
    const entities = req.query.entities as LogEntities[];
    const userId = req.headers['id'] as string;

    const project = await Project.find({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const logsCount = await Log.countDocuments({ projectId, affectedEntity: { $in: entities } });
    const logs = await Log.find(
      { projectId, affectedEntity: { $in: entities } },
      null,
      { limit, skip: offset, sort: { createdAt: -1 } }
    );
    if (!logs.length) {
      // It's perfectly fine to not have logs for a specified query
      return res.status(200).json({ count: 0, logs: [] });
    }

    res.send({ count: logsCount, logs });
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const getUserLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.headers['id'] as string;
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit as string);
    const offset = parseInt(req.query.offset as string);
    const entities = req.query.entities as LogEntities[];

    // If currentUserId is not in the same organization as userId, return 403
    if (currentUserId !== userId) {
      const user = await User.findById(userId);
      const currentUser = await User.findById(currentUserId);
      if (!user || !currentUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (user?.organizationId !== currentUser?.organizationId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }

    const logsCount = await Log.countDocuments({ logTriggerId: userId, affectedEntity: { $in: entities } });
    const logs = await Log.find(
      { logTriggerId: userId, affectedEntity: { $in: entities } },
      null,
      { limit, skip: offset, sort: { createdAt: -1 } }
    );
    if (!logs.length) {
      // It's perfectly fine to not have logs for a specified query
      return res.status(200).json({ count: 0, logs: [] });
    }

    res.send({ count: logsCount, logs });
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const getFilteredLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;
    const affectedEntities = req.query.affectedEntities as LogEntities[] | undefined;
    const changedFields = req.query.changedFields as string[] | undefined;
    const actions = req.query.actions as LogAction[] | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const logs = await Log.find(
      {
        projectId,
        affectedEntity: affectedEntities ? { $in: affectedEntities } : undefined,
        changedField: changedFields ? { $in: changedFields } : undefined,
        action: actions ? { $in: actions } : undefined,
        createdAt: {
          $gte: startDate ? new Date(startDate) : new Date(0),
          $lt: endDate ? new Date(endDate) : new Date()
        }
      },
      null,
      { sort: { createdAt: 1 } }
    );
    if (!logs.length) {
      return res.status(404).json({ message: 'Logs not found' });
    }

    res.send(logs);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

export default {
  log,
  logDifference,
  logCreate,
  logDelete,
  logRelationCreate,
  logRelationDelete,
  getLogs,
  getProjectLogs,
  getUserLogs,
  getFilteredLogs,
};

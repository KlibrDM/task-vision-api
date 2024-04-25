import { Request, Response, NextFunction } from 'express';
import Project from '../models/project';
import Sprint, { ISprint } from '../models/sprint';
import { WS_CLIENT_EVENTS } from '../models/ws';
import { ws } from '..';
import Logger from './log';
import { LogAction, LogEntities } from '../models/log';

const createSprint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as ISprint;
    const userId = req.headers['id'] as string;

    if (!data.projectId
      || !data.name
      || !data.type
      || !data.start_date
      || !data.end_date
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const project = await Project.findOne({ _id: data.projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const sprint = await Sprint.create({
      projectId: data.projectId,
      name: data.name,
      description: data.description,
      type: data.type,
      start_date: data.start_date,
      end_date: data.end_date,
    });

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.SPRINT_CREATED, data.projectId.toString(), sprint, userId);
    
    // Logging
    Logger.logCreate(
      LogEntities.SPRINT,
      sprint._id.toString(),
      sprint.name,
      userId,
      data.projectId.toString(),
    );

    // Send response
    return res.status(200).json(sprint);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const updateSprint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as ISprint;
    const projectId = req.params.projectId;
    const sprintId = req.params.sprintId;
    const userId = req.headers['id'] as string;

    if (!projectId
      || !sprintId
      || !data.projectId
      || !data.name
      || !data.type
      || !data.start_date
      || !data.end_date
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const project = await Project.find({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const oldSprint = await Sprint.findById(sprintId);
    if (!oldSprint) {
      return res.status(404).json({ message: 'Sprint not found' });
    }

    const sprint = await Sprint.findOneAndUpdate({ _id: sprintId }, data, { new: true });
    if (!sprint) {
      return res.status(404).json({ message: 'Sprint not found' });
    }

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.SPRINT_CHANGED, data.projectId.toString(), sprint, userId);

    // Logging
    Logger.logDifference(
      LogEntities.SPRINT,
      sprint._id.toString() ?? sprintId,
      sprint.name,
      LogAction.UPDATE,
      oldSprint,
      sprint,
      userId,
      projectId.toString(),
    );

    // Send response
    return res.status(200).json(sprint);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const getAllSprintsForProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.headers['id'] as string;

    const project = await Project.find({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const sprints = await Sprint.find({ projectId });
    if (!sprints) {
      return res.status(404).json({ message: 'No sprints found' });
    }

    res.send(sprints);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const completeSprint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId;
    const sprintId = req.params.sprintId;
    const userId = req.headers['id'] as string;

    if (!projectId || !sprintId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const sprint = await Sprint.findOneAndUpdate(
      { _id: sprintId },
      { is_completed: true },
      { new: true }
    );
    if (!sprint) {
      return res.status(404).json({ message: 'Sprint not found' });
    }

    const project = await Project.findOneAndUpdate(
      { _id: projectId, 'users.userId': userId },
      { currentSprintId: null },
      { new: true }
    );
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Send websocket event for project
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.PROJECT_CHANGED, projectId, project, userId);

    // Send websocket event for sprint
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.SPRINT_CHANGED, projectId, sprint, userId);

    // Log project change
    Logger.log(
      LogEntities.PROJECT,
      project._id.toString(),
      project.name,
      LogAction.UPDATE,
      'currentSprintId',
      sprintId,
      undefined,
      userId,
      project._id.toString(),
    );

    // Log sprint change
    Logger.log(
      LogEntities.SPRINT,
      sprint._id.toString(),
      sprint.name,
      LogAction.UPDATE,
      'is_completed',
      'false',
      'true',
      userId,
      projectId,
    );

    // Send response
    return res.status(200).json(project);
  }
  catch (err) {
    return res.status(500).json(err);
  }
}

const activateSprint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId;
    const sprintId = req.params.sprintId;
    const userId = req.headers['id'] as string;

    if (!projectId || !sprintId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const sprint = await Sprint.findById(sprintId);
    if (!sprint) {
      return res.status(404).json({ message: 'Sprint not found' });
    }

    const oldProject = await Project.findById(projectId);
    if (!oldProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const project = await Project.findOneAndUpdate(
      { _id: projectId, 'users.userId': userId },
      { currentSprintId: sprintId },
      { new: true }
    );
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.PROJECT_CHANGED, projectId, project, userId);

    // Logging
    Logger.log(
      LogEntities.PROJECT,
      project._id.toString(),
      project.name,
      LogAction.UPDATE,
      'currentSprintId',
      oldProject.currentSprintId ? oldProject.currentSprintId.toString() : undefined,
      sprintId,
      userId,
      project._id.toString(),
    );

    // Send response
    return res.status(200).json(project);
  }
  catch (err) {
    return res.status(500).json(err);
  }
}

const deleteSprint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId;
    const sprintId = req.params.sprintId;
    const userId = req.headers['id'] as string;

    if (!projectId || !sprintId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.currentSprintId && project.currentSprintId.toString() === sprintId) {
      return res.status(400).json({ message: 'Cannot delete active sprint', code: 'CANNOT_DELETE_ACTIVE_SPRINT' });
    }

    const sprint = await Sprint.findOneAndUpdate(
      { _id: sprintId, projectId },
      { deleted: true },
      { new: true }
    );
    if (!sprint) {
      return res.status(404).json({ message: 'Sprint not found' });
    }

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.SPRINT_CREATED, projectId, sprint, userId);
    
    // Logging
    Logger.logDelete(
      LogEntities.SPRINT,
      sprint._id.toString() ?? sprintId,
      sprint.name,
      userId,
      projectId.toString(),
    );

    // Send response
    return res.status(200).json(sprint);
  }
  catch (err) {
    return res.status(500).json(err);
  }
}

export default { createSprint, updateSprint, getAllSprintsForProject, completeSprint, activateSprint, deleteSprint };

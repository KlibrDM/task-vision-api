import { Request, Response, NextFunction } from 'express';
import User from '../models/user';
import Project, { IProject, OwnerTypes, ProjectRole } from '../models/project';
import Sprint, { SprintType } from '../models/sprint';
import moment from 'moment';
import Logger from './log';
import { LogAction, LogEntities } from '../models/log';
import UploadedDoc from '../models/uploadedDoc';

const createProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as IProject;

    if (
      !data.name
      || !data.code
      || !data.owner_type
      || !data.board_columns
      || !data.settings
      || !data.start_date
      || !data.end_date
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const userId = req.headers['id'] as string;
    const user = data.owner_type === OwnerTypes.USER
      ? await User.findById(userId)
      : null;
    if (!user) {
      return res.status(401).json({ message: 'Invalid user' });
    }

    // Create project
    const project = await Project.create({
      ownerId: user._id,
      users: [{ userId: user._id, role: ProjectRole.OWNER }],
      name: data.name,
      code: data.code,
      description: data.description,
      owner_type: data.owner_type,
      board_columns: data.board_columns,
      qa_column: data.qa_column,
      blocked_column: data.blocked_column,
      done_column: data.done_column,
      settings: data.settings,
      start_date: data.start_date,
      end_date: data.end_date,
    });

    // Create sprint
    const useSprints = data.settings.use_sprints;
    const sprint = await Sprint.create({
      projectId: project._id,
      name: useSprints ? 'Sprint 1' : 'Continuous development',
      type: useSprints ? SprintType.SPRINT: SprintType.CONTINUOUS,
      start_date: data.start_date,
      end_date: useSprints
        ? moment(data.start_date).add(data.settings.sprint_length, 'days').toDate()
        : data.end_date,
    });
    Object.assign(project, { currentSprintId: sprint._id });
    await project.save();

    // Create project folder
    const folder = await UploadedDoc.create({
      ownerId: user._id,
      projectId: project._id,
      name: data.name,
      structure_path: '/',
      file_path: '[FOLDER]',
      size: 0,
      type: 'folder',
      users: [user._id],
      roles: [ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.BOARDMASTER, ProjectRole.QA, ProjectRole.MEMBER],
      is_project_storage_folder: true,
    });

    // Logging
    // Log project create
    Logger.logCreate(
      LogEntities.PROJECT,
      project._id.toString(),
      project.name,
      user._id.toString(),
      project._id.toString(),
    );

    // Log sprint create
    Logger.logCreate(
      LogEntities.SPRINT,
      sprint._id.toString(),
      sprint.name,
      userId,
      project._id.toString(),
    );

    // Log folder create
    Logger.logCreate(
      LogEntities.UPLOADEDDOCS,
      folder._id.toString(),
      `Folder ${folder.structure_path === '/' ? '/' : ('/' + folder.structure_path + '/')}${folder.name}`,
      userId,
      project._id.toString(),
    );

    return res.status(200).json(project);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const getAllProjectsForUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projects = await Project.find({ 'users.userId': userId });

    if (!projects) {
      return res.status(404).json({ message: 'No projects found' });
    }

    res.send(projects);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const getProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id;
    const userId = req.headers['id'] as string;
    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.send(project);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const getProjectUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id;
    const userId = req.headers['id'] as string;
    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const users = await User.find({ _id: { $in: project.users.map(u => u.userId) } } );
    if (!users) {
      return res.status(404).json({ message: 'No users found' });
    }

    res.send(users.map(user => ({
      _id: user._id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      is_organization_controlled: user.is_organization_controlled,
      organizationId: user.organizationId,
      is_active: project.users.find(u => u.userId.toString() === user._id.toString())?.is_active,
      role: project.users.find(u => u.userId.toString() === user._id.toString())?.role,
    })));
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const updateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id;
    const userId = req.headers['id'] as string;
    const projectChanges = req.body as Partial<IProject>;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Unset column types if not present in request
    if (!projectChanges.qa_column || !projectChanges.done_column || !projectChanges.blocked_column) {
      await Project.findByIdAndUpdate(projectId, { $unset: {
        qa_column: projectChanges.qa_column ? '' : false,
        done_column: projectChanges.done_column ? '' : false,
        blocked_column: projectChanges.blocked_column ? '' : false,
      } });
    }

    const updatedProject = await Project.findByIdAndUpdate(projectId,
      projectChanges,
      { new: true }
    );
    if (!updatedProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Logging
    Logger.logDifference(
      LogEntities.PROJECT,
      project._id.toString() ?? projectId,
      project.name,
      LogAction.UPDATE,
      project,
      updatedProject,
      userId,
      projectId.toString(),
    );

    res.send(updatedProject);
  }
  catch (err) {
    return res.status(500).json(err);
  }
}

const addUserToProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.headers['id'] as string;
    const email = req.body.email as string;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const userInProject = project.users.find(u => u.userId.toString() === user._id.toString());

    // If user is already in project and is active, send error
    if (userInProject && userInProject.is_active) {
      return res.status(400).json({ message: 'User already in project', code: 'USER_ALREADY_IN_PROJECT' });
    }
    // If user is already in project but is not active, activate and set role to member (default)
    else if (userInProject && !userInProject.is_active) {
      const updatedProject = await Project.findOneAndUpdate(
        { _id: projectId, 'users.userId': user._id },
        { $set: { 'users.$.is_active': true, 'users.$.role': ProjectRole.MEMBER } },
        { new: true }
      );
  
      if (!updatedProject) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Logging
      Logger.log(
        LogEntities.PROJECT,
        updatedProject._id.toString(),
        updatedProject.name,
        LogAction.PUSHED,
        'users',
        undefined,
        user._id.toString(),
        userId,
        projectId
      );
  
      res.send(updatedProject);
    }
    // If user is not in project, add
    else {
      const updatedProject = await Project.findByIdAndUpdate(projectId,
        {
          $push: { users: { userId: user._id, role: ProjectRole.MEMBER } },
        },
        { new: true }
      );
  
      if (!updatedProject) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Logging
      Logger.log(
        LogEntities.PROJECT,
        updatedProject._id.toString(),
        updatedProject.name,
        LogAction.PUSHED,
        'users',
        undefined,
        user._id.toString(),
        userId,
        projectId
      );
  
      res.send(updatedProject);
    }
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const removeUserFromProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId;
    const removedUserId = req.params.userId as string;
    const userId = req.headers['id'] as string;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const updatedProject = await Project.findOneAndUpdate(
      { _id: projectId, 'users.userId': removedUserId },
      { $set: { 'users.$.is_active': false } },
      { new: true }
    );

    if (!updatedProject) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Logging
    Logger.log(
      LogEntities.PROJECT,
      updatedProject._id.toString(),
      updatedProject.name,
      LogAction.PULLED,
      'users',
      removedUserId.toString(),
      undefined,
      userId,
      projectId
    );

    res.send(updatedProject);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId;
    const updatedUserId = req.params.userId as string;
    const userId = req.headers['id'] as string;
    const role = req.body.role as ProjectRole;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const updatedProject = await Project.findOneAndUpdate(
      { _id: projectId, 'users.userId': updatedUserId },
      { $set: { 'users.$.role': role } },
      { new: true }
    );

    if (!updatedProject) {
      return res.status(404).json({ message: 'User not in project', code: 'USER_NOT_IN_PROJECT' });
    }

    // Logging
    Logger.log(
      LogEntities.PROJECT,
      updatedProject._id.toString(),
      updatedProject.name,
      LogAction.UPDATE,
      'users',
      JSON.stringify(project.users.find(u => u.userId.toString() === updatedUserId)),
      JSON.stringify(updatedProject.users.find(u => u.userId.toString() === updatedUserId)),
      userId,
      projectId
    );

    res.send(updatedProject);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

export default { createProject, getAllProjectsForUser, getProject, getProjectUsers, updateProject, addUserToProject, removeUserFromProject, updateUserRole };

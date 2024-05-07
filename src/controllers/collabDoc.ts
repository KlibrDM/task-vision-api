import { Request, Response, NextFunction } from 'express';
import Project, { ProjectRole } from '../models/project';
import Logger from './log';
import { LogAction, LogEntities } from '../models/log';
import mongoose from 'mongoose';
import { ws } from '..';
import { WS_CLIENT_EVENTS } from '../models/ws';
import CollabDoc from '../models/collabDoc';
import OpenAI from 'openai';

const createDoc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;
    const structurePath = req.body.structurePath as string;
    const docName = req.body.docName as string;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const docExists = await CollabDoc.findOne({ projectId, structure_path: structurePath, name: docName });
    if (docExists) {
      return res.status(409).json({ message: 'Document already exists', code: 'DOC_EXISTS' });
    }

    const doc = await CollabDoc.create({
      ownerId: new mongoose.Types.ObjectId(userId),
      projectId: new mongoose.Types.ObjectId(projectId),
      name: docName,
      structure_path: structurePath,
      is_folder: false,
      users: [new mongoose.Types.ObjectId(userId)],
      roles: [ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.BOARDMASTER, ProjectRole.QA, ProjectRole.MEMBER],
      edit_users: [new mongoose.Types.ObjectId(userId)],
      edit_roles: [ProjectRole.OWNER, ProjectRole.ADMIN],
    });

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.COLLAB_DOC_CREATED, projectId.toString(), doc, userId);

    // Logging
    Logger.logCreate(
      LogEntities.COLLABDOCS,
      doc._id.toString(),
      `${doc.structure_path === '/' ? '/' : ('/' + doc.structure_path + '/')}${doc.name}`,
      userId,
      projectId.toString()
    );

    return res.status(200).json(doc);
  }
  catch (err) {
    return res.status(500).json(err);
  }
}

const createFolder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;
    const structurePath = req.body.structurePath as string;
    const folderName = req.body.folderName as string;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const folderExists = await CollabDoc.findOne({ projectId, structure_path: structurePath, name: folderName });
    if (folderExists) {
      return res.status(409).json({ message: 'Folder already exists', code: 'FOLDER_EXISTS' });
    }

    const folder = await CollabDoc.create({
      ownerId: new mongoose.Types.ObjectId(userId),
      projectId: new mongoose.Types.ObjectId(projectId),
      name: folderName,
      structure_path: structurePath,
      is_folder: true,
      users: [new mongoose.Types.ObjectId(userId)],
      roles: [ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.BOARDMASTER, ProjectRole.QA, ProjectRole.MEMBER],
      edit_users: [new mongoose.Types.ObjectId(userId)],
      edit_roles: [ProjectRole.OWNER, ProjectRole.ADMIN],
    });

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.COLLAB_DOC_CREATED, projectId.toString(), folder, userId);

    // Logging
    Logger.logCreate(
      LogEntities.COLLABDOCS,
      folder._id.toString(),
      `Folder ${folder.structure_path === '/' ? '/' : ('/' + folder.structure_path + '/')}${folder.name}`,
      userId,
      projectId.toString()
    );

    return res.status(200).json(folder);
  }
  catch (err) {
    return res.status(500).json(err);
  }
}

const getDocs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;
    const structurePath = req.query.structurePath as string;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const userRole = project.users.find(user => user.userId.toString() === userId)?.role;

    const docs = await CollabDoc.find({
      projectId,
      structure_path: structurePath,
      $or: [
        { users: userId },
        userRole === ProjectRole.OWNER ? { _id: { $exists: true } } : { roles: userRole },
      ]
    }).select('-content'); // Don't send content with file list
    if (!docs) {
      // It's okay to not have any docs
      return res.status(200).json([]);
    }

    res.send(docs);
  }
  catch (err) {
    return res.status(500).json(err);
  }
}

const getDoc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;
    const docId = req.params.docId;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const doc = await CollabDoc.findById(docId);
    if (!doc) {
      return res.status(404).json({ message: 'Doc not found' });
    }

    res.send(doc);
  }
  catch (err) {
    return res.status(500).json(err);
  }
}

const updateDocAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;
    const docId = req.params.docId;
    const users = req.body.users as string[];
    const roles = req.body.roles as ProjectRole[];
    const editUsers = req.body.editUsers as string[];
    const editRoles = req.body.editRoles as ProjectRole[];

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const oldDoc = await CollabDoc.findById(docId);

    const doc = await CollabDoc.findByIdAndUpdate(docId, {
      users,
      roles,
      edit_users: editUsers,
      edit_roles: editRoles,
    }, { new: true });
    if (!doc) {
      return res.status(404).json({ message: 'Doc not found' });
    }

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.COLLAB_DOC_CHANGED, projectId.toString(), doc, userId);

    // Logging
    Logger.logDifference(
      LogEntities.COLLABDOCS,
      doc._id.toString(),
      `${doc.structure_path === '/' ? '/' : ('/' + doc.structure_path + '/')}${doc.name}`,
      LogAction.UPDATE,
      oldDoc,
      doc,
      userId,
      projectId
    );

    res.send(doc);
  }
  catch (err) {
    return res.status(500).json(err);
  }
}

const deleteDoc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;
    const docId = req.params.docId;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const doc = await CollabDoc.findOneAndDelete({
      _id: docId,
      projectId,
      users: userId,
    });
    if (!doc) {
      return res.status(404).json({ message: 'Doc not found' });
    }

    // If folder, delete contents
    if (doc.is_folder) {
      const documents = await CollabDoc.find({
        projectId,
        structure_path: new RegExp('^' + ((doc.structure_path === '/' ? '' : doc.structure_path + '/') + doc.name))
      });
      await CollabDoc.deleteMany({
        projectId,
        structure_path: new RegExp('^' + ((doc.structure_path === '/' ? '' : doc.structure_path + '/') + doc.name))
      });

      // Logging
      documents.forEach(document => {
        if (!document.is_folder) {
          // Logging
          Logger.logDelete(
            LogEntities.COLLABDOCS,
            document._id.toString(),
            `${document.structure_path === '/' ? '/' : ('/' + document.structure_path + '/')}${document.name}`,
            userId,
            projectId.toString()
          );
        }
      });
    }

    // Logging
    Logger.logDelete(
      LogEntities.COLLABDOCS,
      doc._id.toString(),
      `${doc.structure_path === '/' ? '/' : ('/' + doc.structure_path + '/')}${doc.name}`,
      userId,
      projectId.toString()
    );

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.COLLAB_DOC_DELETED, projectId.toString(), doc, userId);

    res.send(doc);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const updateDoc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;
    const docId = req.params.docId;
    const docName = req.body.name as string;
    const content = req.body.content as string;
    const aiSummary = req.body.aiSummary as string;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const oldDoc = await CollabDoc.findById(docId);

    const doc = await CollabDoc.findByIdAndUpdate(docId, { name: docName, content, ai_summary: aiSummary }, { new: true });
    if (!doc) {
      return res.status(404).json({ message: 'Doc not found' });
    }

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.COLLAB_DOC_CHANGED, projectId.toString(), doc, userId);

    // Logging
    Logger.logDifference(
      LogEntities.COLLABDOCS,
      doc._id.toString(),
      `${doc.structure_path === '/' ? '/' : ('/' + doc.structure_path + '/')}${doc.name}`,
      LogAction.UPDATE,
      oldDoc,
      doc,
      userId,
      projectId
    );

    res.send(doc);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const getAISummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as { name: string, content: string };

    const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      response_format: { "type":"json_object" },
      messages: [
        {
          role: 'system',
          content: 'You will create a summary of a page written in markdown. Your summary should not exceed 400 words. Your summary must be in the same language in which the page content is written. You will be given the name and content of the page. You will provide a summary of the page that will help project members understand what the page is about. Your response must be a JSON that follows the format: { summary: <<your summary>> }.'
        },
        {
          role: 'user',
          content: `Page name: ${data.name}. Page content: ${data.content}.`
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

const setIsEditedBy = async (docId: string, userId?: string) => {
  try {
    if (userId) {
      await CollabDoc.findByIdAndUpdate(docId, { is_edited_by: userId });
    }
    else {
      await CollabDoc.findByIdAndUpdate(docId, { $unset: { is_edited_by: '' } } );
    }
  }
  catch (err) {
    throw err;
  }
}

const getIsEditedBy = async (docId: string) => {
  try {
    const doc = await CollabDoc.findById(docId);
    return doc?.is_edited_by?.toString();
  }
  catch (err) {
    throw err;
  }
};

export default { createDoc, createFolder, getDocs, getDoc, updateDocAccess, deleteDoc, updateDoc, getAISummary, setIsEditedBy, getIsEditedBy };

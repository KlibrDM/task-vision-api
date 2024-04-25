import { Request, Response, NextFunction } from 'express';
import Project, { ProjectRole } from '../models/project';
import Logger from './log';
import { LogAction, LogEntities } from '../models/log';
import UploadedDoc from '../models/uploadedDoc';
import mongoose from 'mongoose';
import fs from 'fs';
import { ws } from '..';
import { WS_CLIENT_EVENTS } from '../models/ws';
import Item from '../models/item';

const uploadDocs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;
    const structurePath = req.query.structurePath as string;
    const files = req.files as Express.Multer.File[];

    if (!files) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const docs = await UploadedDoc.insertMany(files.map(file => ({
      ownerId: new mongoose.Types.ObjectId(userId),
      projectId: new mongoose.Types.ObjectId(projectId),
      name: file.originalname,
      file_path: file.path,
      structure_path: structurePath,
      size: file.size,
      type: file.mimetype,
      users: [new mongoose.Types.ObjectId(userId)],
      roles: [ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.BOARDMASTER, ProjectRole.QA, ProjectRole.MEMBER],
    })));

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.DOCS_CREATED, projectId.toString(), docs, userId);

    // Logging
    docs.forEach(doc => {
      Logger.logCreate(
        LogEntities.UPLOADEDDOCS,
        doc._id.toString(),
        `${doc.structure_path === '/' ? '/' : ('/' + doc.structure_path + '/')}${doc.name}`,
        userId,
        projectId.toString()
      );
    });

    return res.status(200).json(docs);
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

    const folderExists = await UploadedDoc.findOne({ projectId, structure_path: structurePath, name: folderName });
    if (folderExists) {
      return res.status(409).json({ message: 'Folder already exists', code: 'FOLDER_EXISTS' });
    }

    const folder = await UploadedDoc.create({
      ownerId: new mongoose.Types.ObjectId(userId),
      projectId: new mongoose.Types.ObjectId(projectId),
      name: folderName,
      structure_path: structurePath,
      file_path: '[FOLDER]',
      size: 0,
      type: 'folder',
      users: [new mongoose.Types.ObjectId(userId)],
      roles: [ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.BOARDMASTER, ProjectRole.QA, ProjectRole.MEMBER],
    });

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.DOC_CREATED, projectId.toString(), folder, userId);

    // Logging
    Logger.logCreate(
      LogEntities.UPLOADEDDOCS,
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

    const docs = await UploadedDoc.find({
      projectId,
      structure_path: structurePath,
      $or: [
        { users: userId },
        userRole === ProjectRole.OWNER ? { _id: { $exists: true } } : { roles: userRole },
      ]
    });
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

const downloadDoc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;
    const docId = req.params.docId;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const doc = await UploadedDoc.findOne({ _id: docId, projectId });
    if (!doc) {
      return res.status(404).json({ message: 'Doc not found' });
    }

    res.download(doc.file_path, doc.name);
  }
  catch (err) {
    return res.status(500).json(err);
  }
}

const viewDoc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;
    const docId = req.params.docId;
    const docName = req.params.docName;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const doc = await UploadedDoc.findOne({ _id: docId, projectId, name: docName });
    if (!doc) {
      return res.status(404).json({ message: 'Doc not found' });
    }

    res.download(doc.file_path, doc.name);
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

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const oldDoc = await UploadedDoc.findById(docId);

    const doc = await UploadedDoc.findByIdAndUpdate(docId, { users, roles }, { new: true });
    if (!doc) {
      return res.status(404).json({ message: 'Doc not found' });
    }

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.DOC_CHANGED, projectId.toString(), doc, userId);

    // Logging
    Logger.logDifference(
      LogEntities.UPLOADEDDOCS,
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

    const doc = await UploadedDoc.findOneAndDelete({
      _id: docId,
      projectId,
      users: userId,
      is_project_storage_folder: { $exists: false }
    });
    if (!doc) {
      return res.status(404).json({ message: 'Doc not found' });
    }

    if (doc.type === 'folder') {
      const documents = await UploadedDoc.find({
        projectId,
        structure_path: new RegExp('^' + ((doc.structure_path === '/' ? '' : doc.structure_path + '/') + doc.name))
      });
      await UploadedDoc.deleteMany({
        projectId,
        structure_path: new RegExp('^' + ((doc.structure_path === '/' ? '' : doc.structure_path + '/') + doc.name))
      });

      // Delete files from folder
      documents.forEach(document => {
        if (document.file_path !== '[FOLDER]') {
          fs.unlinkSync(document.file_path);

          // Logging
          Logger.logDelete(
            LogEntities.UPLOADEDDOCS,
            document._id.toString(),
            `${document.structure_path === '/' ? '/' : ('/' + document.structure_path + '/')}${document.name}`,
            userId,
            projectId.toString()
          );
        }
      });
    }
    else {
      fs.unlinkSync(doc.file_path);
    }

    // Logging
    Logger.logDelete(
      LogEntities.UPLOADEDDOCS,
      doc._id.toString(),
      `${doc.structure_path === '/' ? '/' : ('/' + doc.structure_path + '/')}${doc.name}`,
      userId,
      projectId.toString()
    );

    // Item Logs
    if (doc.is_project_storage_file) {
      const item = await Item.findOne({ projectId, code: doc.structure_path.split('/').pop() });
      if (item) {
        Logger.log(
          LogEntities.ITEM,
          item._id.toString(),
          item.name,
          LogAction.PULLED,
          'attachments',
          `${doc.structure_path === '/' ? '/' : ('/' + doc.structure_path + '/')}${doc.name}`,
          undefined,
          userId,
          projectId
        );
      }
    }

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.DOC_DELETED, projectId.toString(), doc, userId);

    res.send(doc);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

export const uploadItemAttachments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;

    // If itemId is not provided, use itemCode
    const itemId = req.params.itemId;
    const itemCode = req.params.itemCode;

    const files = req.files as Express.Multer.File[];

    if (!files) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const filterBy = itemId ? { _id: itemId } : { code: itemCode };
    const item = await Item.findOne({ projectId, ...filterBy });
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Check if the item has a folder in the project storage, if not, create one
    const existingFolder = await UploadedDoc.findOne({ projectId, structure_path: `${project.name}`, name: item.code });
    if (!existingFolder) {
      await UploadedDoc.create({
        ownerId: userId,
        projectId: project._id,
        name: item.code,
        structure_path: project.name,
        file_path: '[FOLDER]',
        size: 0,
        type: 'folder',
        users: [userId],
        roles: [ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.BOARDMASTER, ProjectRole.QA, ProjectRole.MEMBER],
        is_project_storage_file: true,
      });
    }

    // Save files to DB
    const docs = await UploadedDoc.insertMany(files.map(file => ({
      ownerId: userId,
      projectId: project._id,
      name: file.originalname,
      file_path: file.path,
      structure_path: project.name + '/' + item.code,
      size: file.size,
      type: file.mimetype,
      users: [userId],
      roles: [ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.BOARDMASTER, ProjectRole.QA, ProjectRole.MEMBER],
      is_project_storage_file: true,
    })));

    // Send websocket event
    ws.triggerClientEventForAllProject(WS_CLIENT_EVENTS.DOCS_CREATED, projectId.toString(), docs, userId);

    // Logging
    docs.forEach(doc => {
      // Doc Logs
      Logger.logCreate(
        LogEntities.UPLOADEDDOCS,
        doc._id.toString(),
        `${doc.structure_path === '/' ? '/' : ('/' + doc.structure_path + '/')}${doc.name}`,
        userId, 
        projectId.toString()
      );

      // Item Logs
      Logger.log(
        LogEntities.ITEM,
        item._id.toString(),
        item.name,
        LogAction.PUSHED,
        'attachments',
        undefined,
        `${doc.structure_path === '/' ? '/' : ('/' + doc.structure_path + '/')}${doc.name}`,
        userId,
        projectId
      );
    });

    return res.status(200).json(docs);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const getItemAttachments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const projectId = req.params.projectId;
    const itemId = req.params.itemId;

    const project = await Project.findOne({ _id: projectId, 'users.userId': userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const docs = await UploadedDoc.find({
      projectId,
      structure_path: project.name + '/' + item.code,
      is_project_storage_file: true,
    });
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

export default { uploadDocs, createFolder, getDocs, downloadDoc, viewDoc, updateDocAccess, deleteDoc, uploadItemAttachments, getItemAttachments };

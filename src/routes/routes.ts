import express from 'express';
import multer from 'multer';
import UserController from '../controllers/user';
import OrganizationController from '../controllers/organization';
import ProjectController from '../controllers/project';
import ItemController from '../controllers/item';
import SprintController from '../controllers/sprint';
import LogController from '../controllers/log';
import ChartDataController from '../controllers/chartData';
import NotificationController from '../controllers/notification';
import UploadedDocsController from '../controllers/uploadedDoc';
import CollabDocsController from '../controllers/collabDoc';
import auth from "../middleware/auth";

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// User
router.post('/user/login', UserController.login);
router.post('/user/logout', auth, UserController.logout);
router.post('/user/register', UserController.register);
router.post('/user/refresh', UserController.refresh);
router.put('/user', auth, UserController.updateUser);
router.put('/user/change-password', auth, UserController.changePassword);
router.get('/who-am-i', auth, UserController.getUser);

// Organization
router.post('/organization/register', OrganizationController.registerOrganization);
router.post('/organization/create-user/:orgId', auth, OrganizationController.createOrganizationUser);
router.put('/organization/update-user-role/:orgId/:userId', auth, OrganizationController.updateOrganizationUserRole);
router.put('/organization/:orgId', auth, OrganizationController.updateOrganization);
router.delete('/organization/delete-user/:orgId/:userId', auth, OrganizationController.deleteOrganizationUser);
router.get('/organization', auth, OrganizationController.getOrganization);
router.get('/organization/users/:orgId', auth, OrganizationController.getOrganizationUsers);

// Project
router.post('/project', auth, ProjectController.createProject);
router.put('/project/:id', auth, ProjectController.updateProject);
router.put('/project/add-user/:projectId', auth, ProjectController.addUserToProject);
router.put('/project/update-user-role/:projectId/:userId', auth, ProjectController.updateUserRole);
router.delete('/project/remove-user/:projectId/:userId', auth, ProjectController.removeUserFromProject);
router.get('/project/:id', auth, ProjectController.getProject);
router.get('/project/users/:id', auth, ProjectController.getProjectUsers);
router.get('/projects', auth, ProjectController.getAllProjectsForUser);

// Project - Sprint actions
router.post('/sprint/complete/:projectId/:sprintId', auth, SprintController.completeSprint);
router.post('/sprint/activate/:projectId/:sprintId', auth, SprintController.activateSprint);

// Item
router.post('/item', auth, ItemController.createItem);
router.put('/item/:projectId/:itemId', auth, ItemController.updateItem);
router.delete('/item/:projectId/:itemId', auth, ItemController.deleteItem);
router.get('/item/:projectId/:itemId', auth, ItemController.getItem);
router.get('/items/:projectId', auth, ItemController.getAllItemsForProject);

// Item Activity
router.post('/item/log-hours/:projectId/:itemId', auth, ItemController.logHours);
router.post('/item/comment/:projectId/:itemId', auth, ItemController.addComment);
router.delete('/item/comment/:projectId/:itemId/:commentId', auth, ItemController.removeComment);
router.post('/item/relation/:projectId/:itemId', auth, ItemController.addRelation);
router.delete('/item/relation/:projectId/:itemId', auth, ItemController.removeRelation);

// Item attachments
router.get('/item/attachments/:projectId/:itemId', auth, UploadedDocsController.getItemAttachments);
router.post('/item/attachments/:projectId/:itemId', auth, upload.array('files'), UploadedDocsController.uploadItemAttachments);
router.post('/item/attachments-by-code/:projectId/:itemCode', auth, upload.array('files'), UploadedDocsController.uploadItemAttachments);

// Sprints
router.post('/sprint', auth, SprintController.createSprint);
router.put('/sprint/:projectId/:sprintId', auth, SprintController.updateSprint);
router.delete('/sprint/:projectId/:sprintId', auth, SprintController.deleteSprint);
router.get('/sprints/:projectId', auth, SprintController.getAllSprintsForProject);

// Logs
router.get('/logs/:entityId', auth, LogController.getLogs);
router.get('/logs/project/:projectId', auth, LogController.getProjectLogs);
router.get('/logs/user/:userId', auth, LogController.getUserLogs);

// Docs
router.post('/docs/:projectId', auth, upload.array('files'), UploadedDocsController.uploadDocs);
router.post('/docs/folder/:projectId', auth, UploadedDocsController.createFolder);
router.get('/docs/:projectId', auth, UploadedDocsController.getDocs);
router.get('/doc/download/:projectId/:docId', auth, UploadedDocsController.downloadDoc);
router.get('/doc/view/:projectId/:docId/:docName', UploadedDocsController.viewDoc);
router.put('/doc/access/:projectId/:docId', auth, UploadedDocsController.updateDocAccess);
router.delete('/doc/:projectId/:docId', auth, UploadedDocsController.deleteDoc);

// Collab Docs
router.post('/collab-docs/:projectId', auth, CollabDocsController.createDoc);
router.post('/collab-docs/folder/:projectId', auth, CollabDocsController.createFolder);
router.get('/collab-docs/:projectId', auth, CollabDocsController.getDocs);
router.get('/collab-doc/:projectId/:docId', auth, CollabDocsController.getDoc);
router.put('/collab-doc/access/:projectId/:docId', auth, CollabDocsController.updateDocAccess);
router.delete('/collab-doc/:projectId/:docId', auth, CollabDocsController.deleteDoc);
router.put('/collab-doc/:projectId/:docId', auth, CollabDocsController.updateDoc);

// Charts
router.get('/chart-data/:projectId', auth, ChartDataController.getChartData);

// Notifications
router.get('/notifications/:projectId', auth, NotificationController.getNotifications);
router.get('/notifications/unread-count/:projectId', auth, NotificationController.getUnreadNotificationsCount);
router.put('/notifications/mark-as-read/:projectId', auth, NotificationController.markNotificationAsRead);

// AI
router.post('/item/ai-summary', auth, ItemController.getAISummary);
router.post('/collab-doc/ai-summary', auth, CollabDocsController.getAISummary);

export = router;

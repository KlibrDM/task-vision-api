export enum WS_SERVER_EVENTS {
  ACTIVE_PROJECT_CHANGED = 'active_project_changed',
  ACTIVE_COLLAB_DOC_CHANGED = 'active_collab_doc_changed',
  ACTIVE_COLLAB_DOC_UNSET = 'active_collab_doc_unset',
  ACTIVE_COLLAB_DOC_EDITED_BY = 'active_collab_doc_edited_by',
}

export enum WS_CLIENT_EVENTS {
  ITEM_CREATED = 'item_created',
  ITEM_CHANGED = 'item_changed',
  ITEM_DELETED = 'item_deleted',
  SPRINT_CREATED = 'sprint_created',
  SPRINT_CHANGED = 'sprint_changed',
  SPRINT_DELETED = 'sprint_deleted',
  PROJECT_CHANGED = 'project_changed',
  DOCS_CREATED = 'docs_created',
  DOC_CREATED = 'doc_created',
  DOC_CHANGED = 'doc_changed',
  DOC_DELETED = 'doc_deleted',
  COLLAB_DOC_CREATED = 'collab_doc_created',
  COLLAB_DOC_CHANGED = 'collab_doc_changed',
  COLLAB_DOC_DELETED = 'collab_doc_deleted',
  ACTIVE_COLLAB_DOC_ACTIVE_USERS = 'active_collab_doc_active_users',
  ACTIVE_COLLAB_DOC_EDITED_BY = 'active_collab_doc_edited_by',
}

export interface IWSData {
  event: WS_SERVER_EVENTS;
  userId: string;
  payload: any;
}

export interface IWSPayload {
  event: WS_CLIENT_EVENTS;
  payload: any;
}

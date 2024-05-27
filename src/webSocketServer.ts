import WebSocket, { WebSocketServer } from "ws";
import { IWSData, WS_CLIENT_EVENTS, WS_SERVER_EVENTS } from "./models/ws";
import { v4 as uuid } from 'uuid';
import CollabDocsController from './controllers/collabDoc';

export class WSS {
  wss: WebSocketServer;

  wsEventRoutes = {
    [WS_SERVER_EVENTS.ACTIVE_PROJECT_CHANGED]: (ws: WebSocket, userId: string, payload: any) => {
      Object.assign(ws, {activeProjectId: payload});
      Object.assign(ws, {userId});
    },
    [WS_SERVER_EVENTS.ACTIVE_COLLAB_DOC_CHANGED]: (ws: WebSocket, userId: string, payload: any) => {
      Object.assign(ws, {activeCollabDocId: payload});
      Object.assign(ws, {userId});

      let usersInDoc: string[] = [];
      this.wss.clients.forEach((client: any) => {
        if (client.activeCollabDocId === payload) {
          usersInDoc.push(client.userId);
        }
      });
      this.triggerClientEventForAllActiveCollabDoc(
        WS_CLIENT_EVENTS.ACTIVE_COLLAB_DOC_ACTIVE_USERS,
        payload,
        usersInDoc,
      );
    },
    [WS_SERVER_EVENTS.ACTIVE_COLLAB_DOC_UNSET]: (ws: WebSocket, userId: string) => {
      // @ts-ignore
      const oldDoc = ws.activeCollabDocId ?? undefined;
      Object.assign(ws, {activeCollabDocId: undefined});
      Object.assign(ws, {userId});

      if (oldDoc) {
        let usersInDoc: string[] = [];
        this.wss.clients.forEach((client: any) => {
          if (client.activeCollabDocId === oldDoc) {
            usersInDoc.push(client.userId);
          }
        });
        this.triggerClientEventForAllActiveCollabDoc(
          WS_CLIENT_EVENTS.ACTIVE_COLLAB_DOC_ACTIVE_USERS,
          oldDoc,
          usersInDoc,
        );
      }
    },
    [WS_SERVER_EVENTS.ACTIVE_COLLAB_DOC_EDITED_BY]: (ws: WebSocket, userId: string, payload: any) => {
      // payload is docId, userId is editedBy
      CollabDocsController.setIsEditedBy(payload, userId);
      this.triggerClientEventForAllActiveCollabDoc(
        WS_CLIENT_EVENTS.ACTIVE_COLLAB_DOC_EDITED_BY,
        payload,
        userId
      );
    },
  };

  constructor() {
    this.wss = new WebSocketServer({ port: 8002 });
    console.log("The WebSocket server is running on port 8002");

    this.wss.on("connection", (ws, req) => {
      // HANDLE USER INSTANCE
      Object.assign(ws, {id: uuid()});
      Object.assign(ws, {userId: ''});
      Object.assign(ws, {activeProjectId: ''});
      Object.assign(ws, {activeCollabDocId: ''});

      // HANDLE RECEIVED MSG
      ws.on("message", msg => {
        const data: IWSData = JSON.parse(msg.toString());
        this.wsEventRoutes[data.event](ws, data.userId, data.payload);
      });

      // HANDLE DISCONNECTION
      ws.on("close", (_ws, req) => {
        // If user was editing active document, remove the user from is_edited_by
        // @ts-ignore
        if (ws.activeCollabDocId) {
          // @ts-ignore
          CollabDocsController.getIsEditedBy(ws.activeCollabDocId).then((editedBy: string | undefined) => {
            // @ts-ignore
            if (editedBy === ws.userId) {
              // @ts-ignore
              CollabDocsController.setIsEditedBy(ws.activeCollabDocId, undefined);
              this.triggerClientEventForAllActiveCollabDoc(
                WS_CLIENT_EVENTS.ACTIVE_COLLAB_DOC_EDITED_BY,
                // @ts-ignore
                ws.activeCollabDocId,
                undefined
              );
            }
          });
        }
      });

      // HANDLE ERRORS
      ws.onerror = (err) => {
        console.log("Websocket Error", err);
      }
    });
  }

  triggerClientEventForUser = (event: WS_CLIENT_EVENTS, projectId: string, userId: string, payload: any) => {
    this.wss.clients.forEach((client: any) => {
      if (client.userId === userId && client.activeProjectId === projectId) {
        client.send(JSON.stringify({event, payload}));
      }
    });
  };

  triggerClientEventForAllProject = (event: WS_CLIENT_EVENTS, projectId: string, payload: any, sourceUserId?: string) => {
    this.wss.clients.forEach((client: any) => {
      if (sourceUserId === client.userId) return;

      if (client.activeProjectId === projectId) {
        client.send(JSON.stringify({event, payload}));
      }
    });
  };

  triggerClientEventForAllActiveCollabDoc = (event: WS_CLIENT_EVENTS, collabDocId: string, payload: any, sourceUserId?: string) => {
    this.wss.clients.forEach((client: any) => {
      if (sourceUserId === client.userId) return;

      if (client.activeCollabDocId === collabDocId) {
        client.send(JSON.stringify({event, payload}));
      }
    });
  };
}

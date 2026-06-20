export interface NewSlackMessagePayload {
  text: string;
  sender: string;
  channelId: string;
  threadTs: string;
  detectedAt: string;
}

export interface NewSlackMessage {
  type: "NEW_SLACK_MESSAGE";
  payload: NewSlackMessagePayload;
}

export interface TaskReplyCompleted {
  type: "TASK_REPLY_COMPLETED";
}

export interface GetPendingTask {
  type: "GET_PENDING_TASK";
}

export interface SendSlackReplyMessage {
  type: "SEND_SLACK_REPLY";
  text: string;
  /** 返信先チャンネル ID（任意。現在開いているスレッドに送る場合は省略） */
  channelId?: string;
  /** 返信先スレッド ts（任意） */
  threadTs?: string;
}

export type ExtensionRuntimeMessage =
  | NewSlackMessage
  | TaskReplyCompleted
  | GetPendingTask
  | SendSlackReplyMessage;

export interface PendingTaskResponse {
  task: NewSlackMessagePayload | null;
}

export interface NotificationSettings {
  enabled: boolean;
  taskDetected: boolean;
  taskCompleted: boolean;
}

export interface SidePanelReadyMessage {
  type: "PANEL_READY";
  windowId?: number;
}

export const SIDE_PANEL_PORT_NAME = "SABOROU_SIDE_PANEL";

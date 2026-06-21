import type {
  ExtensionRuntimeMessage,
  NewSlackMessagePayload,
  PendingTaskResponse,
  SendSlackReplyResponse,
  SidePanelReadyMessage,
} from "@/messages";
import { SIDE_PANEL_PORT_NAME } from "@/messages";
import { loadNotificationSettings } from "@/notifications/settings";

const PENDING_TASK_KEY = "pendingSlackTask";
const NOTIFIED_TASK_KEYS = "notifiedTaskKeys";
const NOTIFICATION_WINDOWS_KEY = "notificationWindows";
const LAST_WINDOW_ID_KEY = "lastSaborouWindowId";
const MAX_DEDUPE_KEYS = 100;

const sidePanelPorts = new Set<chrome.runtime.Port>();
const taskNotificationsInFlight = new Set<string>();

chrome.sidePanel.setOptions({ path: "panel.html", enabled: true });

chrome.action.onClicked.addListener((tab) => {
  if (!tab.windowId) return;
  void rememberWindow(tab.windowId);
  void chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== SIDE_PANEL_PORT_NAME) return;
  registerSidePanelPort(port);
});

export function registerSidePanelPort(port: chrome.runtime.Port): void {
  sidePanelPorts.add(port);
  port.onMessage.addListener((message: SidePanelReadyMessage) => {
    if (message.type === "PANEL_READY" && message.windowId !== undefined) {
      void rememberWindow(message.windowId);
    }
  });
  port.onDisconnect.addListener(() => {
    sidePanelPorts.delete(port);
  });
}

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionRuntimeMessage,
    sender,
    sendResponse: (response: PendingTaskResponse) => void,
  ) => {
    if (message.type === "NEW_SLACK_MESSAGE") {
      void handleNewSlackMessage(message.payload, sender.tab?.windowId);
      return;
    }

    if (message.type === "TASK_REPLY_COMPLETED") {
      void handleTaskReplyCompleted();
      return;
    }

    if (message.type === "GET_PENDING_TASK") {
      void takePendingTask().then(sendResponse);
      return true;
    }

    if (message.type === "SEND_SLACK_REPLY") {
      void forwardSlackReply(message.text).then(
        sendResponse as (response: SendSlackReplyResponse) => void,
      );
      return true;
    }
  },
);

/**
 * 開いている Slack タブを探し、その content script に返信送信を依頼する。
 * Side Panel からの runtime.sendMessage ブロードキャストでは Slack タブが
 * 無いと誰も応答せず undefined になり「タブが見つからない」誤判定になるため、
 * background が明示的に tabs.query → tabs.sendMessage で確実に届ける。
 */
export async function forwardSlackReply(
  text: string,
): Promise<SendSlackReplyResponse> {
  let tabs: chrome.tabs.Tab[];
  try {
    tabs = await chrome.tabs.query({ url: "https://app.slack.com/*" });
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Slack タブの検索に失敗しました",
    };
  }

  if (tabs.length === 0) {
    return {
      ok: false,
      error:
        "Slack タブが見つかりませんでした。隣のブラウザで app.slack.com を開いてください。",
    };
  }

  // アクティブなタブを優先（複数 Slack タブが開いている場合）
  const sorted = [...tabs].sort(
    (a, b) => Number(b.active ?? false) - Number(a.active ?? false),
  );

  let lastError = "Slack タブへの送信に失敗しました";
  for (const tab of sorted) {
    if (tab.id === undefined) continue;
    try {
      const res = (await chrome.tabs.sendMessage(tab.id, {
        type: "SEND_SLACK_REPLY",
        text,
      })) as SendSlackReplyResponse | undefined;
      if (res?.ok) return { ok: true };
      if (res?.error) lastError = res.error;
    } catch (err) {
      // content script 未注入のタブ等。次の候補へ。
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return { ok: false, error: lastError };
}

chrome.notifications.onClicked.addListener((notificationId) => {
  void focusSaborouWindow(notificationId);
});

export function normalizeNotificationPreview(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[メールアドレス]")
    .replace(
      /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[認証情報]",
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function createTaskKey(task: NewSlackMessagePayload): string {
  const source =
    task.threadTs ||
    `${task.channelId}:${task.sender}:${task.text.slice(0, 80)}`;
  let hash = 5381;
  for (const character of source) {
    hash = (hash * 33) ^ character.charCodeAt(0);
  }
  return (hash >>> 0).toString(36);
}

export async function handleNewSlackMessage(
  task: NewSlackMessagePayload,
  windowId?: number,
): Promise<void> {
  if (windowId !== undefined) {
    await rememberWindow(windowId);
  }

  if (sidePanelPorts.size === 0) {
    await chrome.storage.session.set({ [PENDING_TASK_KEY]: task });
  }

  const settings = await loadNotificationSettings();
  if (sidePanelPorts.size > 0 || !settings.enabled || !settings.taskDetected) {
    return;
  }

  const taskKey = createTaskKey(task);
  if (taskNotificationsInFlight.has(taskKey)) return;
  taskNotificationsInFlight.add(taskKey);

  try {
    if (await wasTaskNotified(taskKey)) return;

    const notificationId = `task-detected:${taskKey}`;
    await rememberNotificationWindow(notificationId, windowId);
    await chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "新しいタスクを読み取りました",
      message: `${normalizeNotificationPreview(task.sender)}: ${normalizeNotificationPreview(task.text)}`,
    });
    await markTaskNotified(taskKey);
  } finally {
    taskNotificationsInFlight.delete(taskKey);
  }
}

export async function handleTaskReplyCompleted(): Promise<void> {
  const settings = await loadNotificationSettings();
  if (!settings.enabled || !settings.taskCompleted) return;

  const notificationId = `task-completed:${Date.now()}`;
  await rememberNotificationWindow(notificationId);
  await chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "タスク対応が完了しました",
    message: "Slackへの返信を送信しました",
  });
}

export async function takePendingTask(): Promise<PendingTaskResponse> {
  const stored = await chrome.storage.session.get(PENDING_TASK_KEY);
  const task =
    (stored[PENDING_TASK_KEY] as NewSlackMessagePayload | undefined) ?? null;
  if (task) {
    await chrome.storage.session.remove(PENDING_TASK_KEY);
  }
  return { task };
}

async function wasTaskNotified(taskKey: string): Promise<boolean> {
  const stored = await chrome.storage.session.get(NOTIFIED_TASK_KEYS);
  const keys = (stored[NOTIFIED_TASK_KEYS] as string[] | undefined) ?? [];
  return keys.includes(taskKey);
}

async function markTaskNotified(taskKey: string): Promise<void> {
  const stored = await chrome.storage.session.get(NOTIFIED_TASK_KEYS);
  const keys = (stored[NOTIFIED_TASK_KEYS] as string[] | undefined) ?? [];
  const next = [...keys.filter((key) => key !== taskKey), taskKey].slice(
    -MAX_DEDUPE_KEYS,
  );
  await chrome.storage.session.set({ [NOTIFIED_TASK_KEYS]: next });
}

async function rememberWindow(windowId: number): Promise<void> {
  await chrome.storage.session.set({ [LAST_WINDOW_ID_KEY]: windowId });
}

async function rememberNotificationWindow(
  notificationId: string,
  windowId?: number,
): Promise<void> {
  const stored = await chrome.storage.session.get([
    NOTIFICATION_WINDOWS_KEY,
    LAST_WINDOW_ID_KEY,
  ]);
  const mappings =
    (stored[NOTIFICATION_WINDOWS_KEY] as Record<string, number> | undefined) ??
    {};
  const targetWindowId =
    windowId ?? (stored[LAST_WINDOW_ID_KEY] as number | undefined);

  if (targetWindowId === undefined) return;
  await chrome.storage.session.set({
    [NOTIFICATION_WINDOWS_KEY]: {
      ...mappings,
      [notificationId]: targetWindowId,
    },
  });
}

export async function focusSaborouWindow(
  notificationId: string,
): Promise<void> {
  const stored = await chrome.storage.session.get([
    NOTIFICATION_WINDOWS_KEY,
    LAST_WINDOW_ID_KEY,
  ]);
  const mappings =
    (stored[NOTIFICATION_WINDOWS_KEY] as Record<string, number> | undefined) ??
    {};
  let windowId =
    mappings[notificationId] ??
    (stored[LAST_WINDOW_ID_KEY] as number | undefined);

  if (windowId !== undefined) {
    try {
      await chrome.windows.update(windowId, { focused: true });
    } catch {
      windowId = undefined;
    }
  }

  if (windowId === undefined) {
    try {
      const lastFocused = await chrome.windows.getLastFocused();
      windowId = lastFocused.id;
    } catch {
      windowId = undefined;
    }
  }

  if (windowId === undefined) {
    const created = await chrome.windows.create();
    windowId = created.id;
  }

  if (windowId !== undefined) {
    await rememberWindow(windowId);
    await chrome.sidePanel.open({ windowId });
  }

  const { [notificationId]: _removed, ...remaining } = mappings;
  await chrome.storage.session.set({
    [NOTIFICATION_WINDOWS_KEY]: remaining,
  });
  await chrome.notifications.clear(notificationId);
}

self.addEventListener("install", () => {
  console.info("[SABOROU] Background service worker installed");
});

self.addEventListener("activate", () => {
  console.info("[SABOROU] Background service worker activated");
});

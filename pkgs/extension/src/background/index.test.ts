import type { NewSlackMessagePayload } from "@/messages";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTaskKey,
  focusSaborouWindow,
  handleNewSlackMessage,
  handleTaskReplyCompleted,
  normalizeNotificationPreview,
  registerSidePanelPort,
  takePendingTask,
} from "./index";

const task: NewSlackMessagePayload = {
  text: "  資料を\n今日中に   確認してください  ",
  sender: "山田花子",
  channelId: "C123",
  threadTs: "1717900000.123456",
  detectedAt: "2026-06-15T14:00:00.000Z",
};

const sessionStore: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(sessionStore)) {
    delete sessionStore[key];
  }
  vi.clearAllMocks();

  vi.mocked(chrome.storage.local.get).mockResolvedValue({});
  vi.mocked(chrome.storage.session.get).mockImplementation(async (keys) => {
    const requested = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(
      requested
        .filter((key): key is string => typeof key === "string")
        .map((key) => [key, sessionStore[key]]),
    );
  });
  vi.mocked(chrome.storage.session.set).mockImplementation(async (items) => {
    Object.assign(sessionStore, items);
  });
  vi.mocked(chrome.storage.session.remove).mockImplementation(async (keys) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      delete sessionStore[key];
    }
  });
  vi.mocked(chrome.notifications.create).mockResolvedValue("notification-id");
  vi.mocked(chrome.windows.update).mockResolvedValue({
    id: 7,
  } as chrome.windows.Window);
  vi.mocked(chrome.windows.getLastFocused).mockResolvedValue({
    id: 9,
  } as chrome.windows.Window);
});

describe("background notifications", () => {
  it("通知本文用テキストを空白正規化して80文字に制限する", () => {
    expect(normalizeNotificationPreview("  a\n b   c  ")).toBe("a b c");
    expect(normalizeNotificationPreview("x".repeat(100))).toHaveLength(80);
    expect(
      normalizeNotificationPreview(
        "test@example.com eyJheader.payload.signature",
      ),
    ).toBe("[メールアドレス] [認証情報]");
  });

  it("タスク検知通知を作成し同一タスクを重複通知しない", async () => {
    await Promise.all([
      handleNewSlackMessage(task, 7),
      handleNewSlackMessage(task, 7),
    ]);
    await handleNewSlackMessage(task, 7);

    expect(chrome.notifications.create).toHaveBeenCalledTimes(1);
    expect(chrome.notifications.create).toHaveBeenCalledWith(
      `task-detected:${createTaskKey(task)}`,
      expect.objectContaining({
        title: "新しいタスクを読み取りました",
        message: "山田花子: 資料を 今日中に 確認してください",
      }),
    );
  });

  it("通知設定が無効ならタスク検知通知を作成しない", async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      notificationSettings: {
        enabled: true,
        taskDetected: false,
        taskCompleted: true,
      },
    });

    await handleNewSlackMessage(task, 7);

    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });

  it("Side Panel表示中は検知通知を抑制する", async () => {
    let disconnectListener: (() => void) | undefined;
    const port = {
      name: "SABOROU_SIDE_PANEL",
      onMessage: { addListener: vi.fn() },
      onDisconnect: {
        addListener: vi.fn((listener: () => void) => {
          disconnectListener = listener;
        }),
      },
    } as unknown as chrome.runtime.Port;
    registerSidePanelPort(port);

    await handleNewSlackMessage(task, 7);

    expect(chrome.notifications.create).not.toHaveBeenCalled();
    await handleTaskReplyCompleted();
    expect(chrome.notifications.create).toHaveBeenCalledWith(
      expect.stringMatching(/^task-completed:/),
      expect.any(Object),
    );
    disconnectListener?.();
  });

  it("パネル非表示中のタスクを保存し一度だけ復元する", async () => {
    await handleNewSlackMessage(task, 7);

    await expect(takePendingTask()).resolves.toEqual({ task });
    await expect(takePendingTask()).resolves.toEqual({ task: null });
  });

  it("返信完了通知はタスク検知設定に関係なく作成する", async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      notificationSettings: {
        enabled: true,
        taskDetected: false,
        taskCompleted: true,
      },
    });

    await handleTaskReplyCompleted();

    expect(chrome.notifications.create).toHaveBeenCalledWith(
      expect.stringMatching(/^task-completed:/),
      expect.objectContaining({
        title: "タスク対応が完了しました",
      }),
    );
  });

  it.each([
    {
      enabled: false,
      taskDetected: true,
      taskCompleted: true,
    },
    {
      enabled: true,
      taskDetected: true,
      taskCompleted: false,
    },
  ])("無効な返信完了イベントは通知しない: %o", async (settings) => {
    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      notificationSettings: settings,
    });

    await handleTaskReplyCompleted();

    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });

  it("通知クリックで保存済みウィンドウを前面化してSide Panelを開く", async () => {
    sessionStore.notificationWindows = { "task-detected:abc": 7 };

    await focusSaborouWindow("task-detected:abc");

    expect(chrome.windows.update).toHaveBeenCalledWith(7, { focused: true });
    expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 7 });
    expect(chrome.notifications.clear).toHaveBeenCalledWith(
      "task-detected:abc",
    );
  });

  it("保存済みウィンドウが利用不能なら最後に使用したウィンドウへフォールバックする", async () => {
    sessionStore.notificationWindows = { "task-detected:abc": 7 };
    vi.mocked(chrome.windows.update).mockRejectedValue(
      new Error("window closed"),
    );

    await focusSaborouWindow("task-detected:abc");

    expect(chrome.windows.getLastFocused).toHaveBeenCalled();
    expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 9 });
  });

  it("利用可能な既存ウィンドウが無ければChromeウィンドウを作成する", async () => {
    vi.mocked(chrome.windows.getLastFocused).mockRejectedValue(
      new Error("no windows"),
    );
    vi.mocked(chrome.windows.create).mockResolvedValue({
      id: 11,
    } as chrome.windows.Window);

    await focusSaborouWindow("task-completed:missing");

    expect(chrome.windows.create).toHaveBeenCalled();
    expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 11 });
  });
});

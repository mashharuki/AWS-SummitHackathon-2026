import * as cognitoAuth from "@/auth/cognitoAuth";
import type { NewSlackMessagePayload } from "@/messages";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkActiveTaskScreen,
  createTaskKey,
  focusSaborouWindow,
  handleNewSlackMessage,
  handleRecoveryCheckAlarm,
  handleTaskReplyCompleted,
  normalizeNotificationPreview,
  registerSidePanelPort,
  scheduleRecoveryCheck,
  takePendingTask,
} from "./index";
import { RECOVERY_CHECK_ALARM_NAME } from "./recoveryCheck";

// getValidToken をモックして Vision API 経路を制御する
vi.mock("@/auth/cognitoAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/auth/cognitoAuth")>();
  return { ...actual, getValidToken: vi.fn().mockResolvedValue(null) };
});

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

  // 既定では未認証（Vision を呼ばずタイトル一致にフォールバック）
  vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(null);

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
  vi.mocked(chrome.tabs.query).mockResolvedValue([]);
  vi.mocked(chrome.tabs.captureVisibleTab).mockResolvedValue(
    "data:image/jpeg;base64,test",
  );
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

  it("アクティブタブの画像取得とタイトルで次タスク画面を確認する", async () => {
    sessionStore.lastSaborouWindowId = 7;
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      {
        id: 123,
        windowId: 7,
        active: true,
        title: "AIエージェント改善定例会 - docs",
        url: "https://example.com/tasks/agent-meeting",
      } as chrome.tabs.Tab,
    ]);

    await expect(
      checkActiveTaskScreen("AIエージェント改善定例会"),
    ).resolves.toEqual({
      ok: true,
      matched: true,
      screenshotCaptured: true,
      title: "AIエージェント改善定例会 - docs",
      url: "https://example.com/tasks/agent-meeting",
    });
    expect(chrome.tabs.query).toHaveBeenCalledWith({
      active: true,
      windowId: 7,
    });
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(7, {
      format: "jpeg",
      quality: 45,
    });
  });

  it("認証ありなら Vision API の判定結果を優先する", async () => {
    sessionStore.lastSaborouWindowId = 7;
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      {
        id: 123,
        windowId: 7,
        active: true,
        // タイトルは一致しないが、Vision が matched=true を返す
        title: "無題のドキュメント",
        url: "https://example.com/x",
      } as chrome.tabs.Tab,
    ]);
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("jwt-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ matched: true, confidence: 0.9 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkActiveTaskScreen("AIエージェント改善定例会");
    expect(result.matched).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/vision/analyze-screen"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-token",
        }),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("Vision API が失敗したらタイトル一致へフォールバックする", async () => {
    sessionStore.lastSaborouWindowId = 7;
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      {
        id: 123,
        windowId: 7,
        active: true,
        title: "AIエージェント改善定例会 - docs",
        url: "https://example.com/x",
      } as chrome.tabs.Tab,
    ]);
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("jwt-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );

    // Vision は 503 相当 → タイトル一致で matched=true
    const result = await checkActiveTaskScreen("AIエージェント改善定例会");
    expect(result.matched).toBe(true);
    vi.unstubAllGlobals();
  });

  it("次タスク開始+5分の自動復帰チェックをアラームに予約する", async () => {
    const now = new Date("2026-06-24T10:00:00").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    await scheduleRecoveryCheck("19:30", "AIエージェント改善定例会");

    expect(chrome.alarms.clear).toHaveBeenCalledWith(RECOVERY_CHECK_ALARM_NAME);
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      RECOVERY_CHECK_ALARM_NAME,
      {
        when: new Date("2026-06-24T19:35:00").getTime(),
      },
    );
  });

  it("アラーム発火時に結果を pending へ保存する", async () => {
    sessionStore.recoveryCheckMeta = {
      expectedTitle: "AIエージェント改善定例会",
      scheduledFor: Date.now(),
    };
    sessionStore.lastSaborouWindowId = 7;
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      {
        id: 123,
        windowId: 7,
        active: true,
        title: "AIエージェント改善定例会",
        url: "https://example.com/tasks/agent-meeting",
      } as chrome.tabs.Tab,
    ]);

    await handleRecoveryCheckAlarm();

    expect(sessionStore.pendingRecoveryCheck).toEqual(
      expect.objectContaining({
        ok: true,
        matched: true,
        screenshotCaptured: true,
        title: "AIエージェント改善定例会",
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

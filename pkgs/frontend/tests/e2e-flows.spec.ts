/**
 * E2E フロー統合テスト — SABOROU
 *
 * 外部サービス（Google Calendar / Slack / Cognito）は page.route() で全てモック。
 * 対象フロー:
 *   1. カレンダー予定 → ガント busy ブロック表示
 *   2. Slack 由来タスク → サボり判定 → Slack 共有
 *
 * 実行方法:
 *   pnpm frontend e2e --grep "calendar\|slack"
 *   または: pnpm frontend e2e tests/e2e-flows.spec.ts
 */

import { expect, test } from "@playwright/test";
import type { SaboriSchedule } from "@saboru/shared";

// ─────────────────────────────────────────
// 定数・フィクスチャ
// ─────────────────────────────────────────

const API_BASE = "http://localhost:3000";
const COGNITO_DOMAIN = "https://dummy.auth.ap-northeast-1.amazoncognito.com";

/**
 * base64url エンコードされた JWT ペイロード（テスト用ユーザー情報）
 * デコード: { "sub":"test-user-id", "email":"test@example.com", "name":"テストユーザー" }
 */
const JWT_PAYLOAD_B64 =
  "eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJuYW1lIjoidGVzdFVzZXIifQ";
const MOCK_ID_TOKEN = `eyJhbGciOiJSUzI1NiJ9.${JWT_PAYLOAD_B64}.mock_sig`;
const MOCK_ACCESS_TOKEN = "mock-access-token";
const MOCK_TASK_ID = "task-e2e-001";

// ─────────────────────────────────────────
// フィクスチャ: モック提案データ
// ─────────────────────────────────────────

/** Flow 1 用モック提案（ガントテスト向け。VerdictBox のレンダリングに必要） */
const MOCK_PROPOSAL_FLOW1 = {
  PK: `TASK#${MOCK_TASK_ID}`,
  SK: "PROPOSAL#2026-05-27T09:00:00.000Z",
  taskId: MOCK_TASK_ID,
  userId: "test-user-id",
  verdict: "can_saboru",
  summaryText: "今はサボってOK 🎉",
  reasoning: ["締め切りまで4時間の余裕あり", "担当者は現在別作業中"],
  chatMessage: "大丈夫、余裕あるよ！",
  personaId: "saboru_ottori",
  evaluatedAt: "2026-05-27T09:00:00.000Z",
  nextCheckAt: "2026-05-27T11:00:00.000Z",
  tokenCount: 100,
};

/** Flow 2 用モック提案（Slack タスク向け。SlackShareControl のレンダリングに必要） */
const MOCK_PROPOSAL_SLACK = {
  PK: "TASK#task-slack-001",
  SK: "PROPOSAL#2026-05-27T09:00:00.000Z",
  taskId: "task-slack-001",
  userId: "test-user-id",
  verdict: "can_saboru",
  summaryText: "今はサボってOK！あとで見ればいいよ",
  reasoning: ["田中さんは現在別のMTG中", "急ぎのPRではなく次スプリント対象"],
  chatMessage: "大丈夫大丈夫、田中さん今MTGだし！",
  personaId: "saboru_ottori",
  evaluatedAt: "2026-05-27T09:00:00.000Z",
  nextCheckAt: "2026-05-27T11:00:00.000Z",
  tokenCount: 100,
};

// ─────────────────────────────────────────
// ヘルパー: スケジュールフィクスチャ生成
// ─────────────────────────────────────────

/**
 * 「今日の9:00〜17:00」を視野とする SaboriSchedule を生成する。
 * カレンダー連携済み（calendarUsed: true）で busy ブロックを含む。
 * now 引数は「今日の基準時刻」として使用（テスト内で固定する）。
 */
function buildScheduleWithBusyBlocks(
  taskId: string,
  baseDate: Date,
): SaboriSchedule {
  const at = (h: number, m = 0) => {
    const d = new Date(baseDate);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  return {
    taskId,
    generatedAt: at(9),
    viewStartAt: at(9),
    viewEndAt: at(17),
    deadline: at(16, 30),
    totalSaboruMinutes: 90,
    calendarUsed: true,
    blocks: [
      // さぼろう帯（トップ行）
      {
        stepId: "saboru-row",
        stepLabel: "さぼろう",
        bandType: "saboru",
        startAt: at(9),
        endAt: at(10, 30),
        durationMinutes: 90,
      },
      // 作業ステップ
      {
        stepId: "s1",
        stepLabel: "資料確認",
        bandType: "work",
        startAt: at(10, 30),
        endAt: at(11, 30),
        durationMinutes: 60,
      },
      // カレンダー予定（busy ブロック）← テスト対象
      {
        stepId: "busy-meeting",
        stepLabel: "デザインレビュー会議",
        bandType: "busy",
        startAt: at(11, 30),
        endAt: at(12, 30),
        durationMinutes: 60,
      },
      // 意思決定ステップ
      {
        stepId: "s2",
        stepLabel: "上司に提出",
        bandType: "decision",
        startAt: at(14),
        endAt: at(14, 30),
        durationMinutes: 30,
        decisionAt: at(14),
      },
    ],
  };
}

// ─────────────────────────────────────────
// ヘルパー: 共通 API モック設定
// ─────────────────────────────────────────

async function setupAuthMock(page: import("@playwright/test").Page) {
  // Cognito リフレッシュトークンを localStorage にセット（ページロード前に実行）
  await page.addInitScript(() => {
    localStorage.setItem("saboru_rt", "mock-refresh-token");
    localStorage.setItem("saboru_locale", "ja");
  });

  // Cognito トークンリフレッシュをモック
  await page.route(`${COGNITO_DOMAIN}/oauth2/token`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: MOCK_ACCESS_TOKEN,
        id_token: MOCK_ID_TOKEN,
        expires_in: 3600,
        token_type: "Bearer",
      }),
    });
  });
}

async function setupCommonApiMocks(page: import("@playwright/test").Page) {
  // ユーザー情報
  await page.route(`${API_BASE}/api/users/me`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        userId: "test-user-id",
        email: "test@example.com",
        name: "テストユーザー",
        personaType: "default",
      }),
    });
  });

  // 依存度スコア
  await page.route(`${API_BASE}/api/users/me/dependency-score`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ score: 72 }),
    });
  });

  // タスク候補（空）
  await page.route(`${API_BASE}/api/tasks/candidates`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ candidates: [] }),
    });
  });

  // 本音サマリ
  await page.route(`${API_BASE}/api/users/me/honne/summary`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: 3, lastSubmittedAt: null }),
    });
  });
}

// ─────────────────────────────────────────
// フロー 1: カレンダー予定 → ガント busy ブロック表示
// ─────────────────────────────────────────

test.describe("フロー1: カレンダー予定 → ガント busy ブロック表示", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page);
    await setupCommonApiMocks(page);

    // サービス連携状態: Google Calendar 連携済み・Slack 未連携
    await page.route(`${API_BASE}/api/connections`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { service: "google", status: "connected" },
          { service: "slack", status: "disconnected" },
        ]),
      });
    });

    // タスク一覧（1件）
    await page.route(`${API_BASE}/api/tasks`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tasks: [
            {
              taskId: MOCK_TASK_ID,
              userId: "test-user-id",
              title: "クライアントへの提案書作成",
              description: "月末締め切りの提案書",
              status: "approved",
              source: "manual",
              priority: "medium",
              dueAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // タスク詳細（単一取得）
    await page.route(`${API_BASE}/api/tasks/${MOCK_TASK_ID}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          taskId: MOCK_TASK_ID,
          userId: "test-user-id",
          title: "クライアントへの提案書作成",
          description: "月末締め切りの提案書",
          status: "approved",
          source: "manual",
          priority: "medium",
          dueAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    // 提案 API: GET（非ストリーム）は JSON、POST（?stream=true）は SSE を返す
    await page.route(`${API_BASE}/api/tasks/${MOCK_TASK_ID}/proposal*`, (route) => {
      if (route.request().url().includes("stream=true")) {
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: "data: [DONE]\n\n",
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_PROPOSAL_FLOW1),
        });
      }
    });

    // 本音一覧（空）
    await page.route(`${API_BASE}/api/tasks/${MOCK_TASK_ID}/honne`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ honneList: [] }),
      });
    });
  });

  test("カレンダー由来の busy ブロックがガントに表示される", async ({ page }) => {
    const now = new Date();

    // スケジュール API: カレンダー busy ブロックを含む
    await page.route(
      `${API_BASE}/api/tasks/${MOCK_TASK_ID}/schedule`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            schedule: buildScheduleWithBusyBlocks(MOCK_TASK_ID, now),
          }),
        });
      },
    );

    await page.goto(`/tasks/${MOCK_TASK_ID}`);

    // ガントパネルが読み込まれるまで待機
    await expect(
      page.locator('[aria-label="スケジュールを再計算"]').first(),
    ).toBeVisible({ timeout: 15000 });

    // busy バンドのブロックが少なくとも1つ存在する
    const busyBlocks = page.locator('[data-testid="gantt-block"][data-band-type="busy"]');
    await expect(busyBlocks.first()).toBeVisible({ timeout: 10000 });

    // busy ブロックにカレンダー予定名が表示される（幅が十分あれば可視テキスト）
    await expect(busyBlocks.first()).toHaveAttribute(
      "data-step-label",
      "デザインレビュー会議",
    );
  });

  test("calendarUsed=true のとき「未連携のためサンプル」注釈が非表示", async ({
    page,
  }) => {
    const now = new Date();

    await page.route(
      `${API_BASE}/api/tasks/${MOCK_TASK_ID}/schedule`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            schedule: buildScheduleWithBusyBlocks(MOCK_TASK_ID, now),
          }),
        });
      },
    );

    await page.goto(`/tasks/${MOCK_TASK_ID}`);
    await expect(
      page.locator('[aria-label="スケジュールを再計算"]').first(),
    ).toBeVisible({ timeout: 15000 });

    // calendarUsed=true のため未連携注釈は非表示であること
    await expect(
      page.getByText("カレンダー未連携のためサンプル配置を表示中"),
    ).not.toBeVisible();
  });

  test("カレンダー未連携時はダミーガントが表示されカレンダー注釈が出る", async ({
    page,
  }) => {
    const now = new Date();
    const at = (h: number, m = 0) => {
      const d = new Date(now);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };

    await page.route(
      `${API_BASE}/api/tasks/${MOCK_TASK_ID}/schedule`,
      (route) => {
        // calendarUsed=false / busy ブロックなし
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            schedule: {
              taskId: MOCK_TASK_ID,
              generatedAt: at(9),
              viewStartAt: at(9),
              viewEndAt: at(17),
              deadline: at(16),
              totalSaboruMinutes: 60,
              calendarUsed: false,
              blocks: [
                {
                  stepId: "saboru-row",
                  stepLabel: "さぼろう",
                  bandType: "saboru",
                  startAt: at(9),
                  endAt: at(10),
                  durationMinutes: 60,
                },
                {
                  stepId: "s1",
                  stepLabel: "作業",
                  bandType: "work",
                  startAt: at(10),
                  endAt: at(12),
                  durationMinutes: 120,
                },
              ],
            },
          }),
        });
      },
    );

    await page.goto(`/tasks/${MOCK_TASK_ID}`);
    await expect(
      page.locator('[aria-label="スケジュールを再計算"]').first(),
    ).toBeVisible({ timeout: 15000 });

    // カレンダー未連携の場合は注釈が表示される
    await expect(
      page.getByText(/カレンダー未連携のためサンプル配置を表示中/),
    ).toBeVisible();

    // さぼろう帯は常に表示される
    const saboruBlocks = page.locator(
      '[data-testid="gantt-block"][data-band-type="saboru"]',
    );
    await expect(saboruBlocks.first()).toBeVisible();
  });

  test("スケジュール取得失敗時はダミーガントで代替表示される", async ({
    page,
  }) => {
    // スケジュール API が 500 を返す場合でもガントが壊れないことを確認
    await page.route(
      `${API_BASE}/api/tasks/${MOCK_TASK_ID}/schedule`,
      (route) => {
        route.fulfill({ status: 500, body: "Internal Server Error" });
      },
    );

    await page.goto(`/tasks/${MOCK_TASK_ID}`);

    // エラー時は buildDummySchedule でフォールバック表示
    // GanttPanel が存在（ガントが常に表示される論点3の設計）
    await expect(
      page.locator('[aria-label="スケジュールを再計算"]').first(),
    ).toBeVisible({ timeout: 15000 });

    // さぼろうブロックが表示されること（ダミースケジュール）
    const saboruBlocks = page.locator(
      '[data-testid="gantt-block"][data-band-type="saboru"]',
    );
    await expect(saboruBlocks.first()).toBeVisible({ timeout: 10000 });
  });

  test("再計算ボタン押下で schedule API が再リクエストされる", async ({
    page,
  }) => {
    let callCount = 0;
    const now = new Date();

    await page.route(
      `${API_BASE}/api/tasks/${MOCK_TASK_ID}/schedule`,
      (route) => {
        callCount++;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            schedule: buildScheduleWithBusyBlocks(MOCK_TASK_ID, now),
          }),
        });
      },
    );

    await page.goto(`/tasks/${MOCK_TASK_ID}`);
    await expect(
      page.locator('[aria-label="スケジュールを再計算"]'),
    ).toBeVisible({ timeout: 15000 });

    const initialCount = callCount;

    // 再計算ボタンを押す
    await page.locator('[aria-label="スケジュールを再計算"]').click();

    // API が再度呼ばれること（キャッシュバイパス）
    await expect
      .poll(() => callCount, { timeout: 5000 })
      .toBeGreaterThan(initialCount);
  });
});

// ─────────────────────────────────────────
// フロー 2: Slack 由来タスク → 判定 → Slack 共有
// ─────────────────────────────────────────

test.describe("フロー2: Slack 由来タスク → サボり判定 → Slack 共有", () => {
  const SLACK_TASK_ID = "task-slack-001";

  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page);
    await setupCommonApiMocks(page);

    // サービス連携: Slack 連携済み・Google 未連携
    await page.route(`${API_BASE}/api/connections`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { service: "slack", status: "connected" },
          { service: "google", status: "disconnected" },
        ]),
      });
    });

    // Slack Bot 参加チャンネル一覧
    await page.route(`${API_BASE}/api/slack/channels`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          channels: [
            { id: "C001", name: "general" },
            { id: "C002", name: "dev-team" },
          ],
        }),
      });
    });

    // Slack 由来タスク一覧
    await page.route(`${API_BASE}/api/tasks`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tasks: [
            {
              taskId: SLACK_TASK_ID,
              userId: "test-user-id",
              title: "田中さんから: PRレビューお願いします",
              description: "Slack #dev-team より取り込み",
              status: "active",
              source: "slack",
              priority: "high",
              dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // タスク詳細
    await page.route(`${API_BASE}/api/tasks/${SLACK_TASK_ID}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          taskId: SLACK_TASK_ID,
          userId: "test-user-id",
          title: "田中さんから: PRレビューお願いします",
          description: "Slack #dev-team より取り込み",
          status: "active",
          source: "slack",
          priority: "high",
          dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    // スケジュール API（ガント用・ダミー応答）
    const now = new Date();
    const at = (h: number) => {
      const d = new Date(now);
      d.setHours(h, 0, 0, 0);
      return d.toISOString();
    };
    await page.route(
      `${API_BASE}/api/tasks/${SLACK_TASK_ID}/schedule`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            schedule: {
              taskId: SLACK_TASK_ID,
              generatedAt: at(9),
              viewStartAt: at(9),
              viewEndAt: at(17),
              deadline: at(16),
              totalSaboruMinutes: 45,
              calendarUsed: false,
              blocks: [
                {
                  stepId: "saboru-row",
                  stepLabel: "さぼろう",
                  bandType: "saboru",
                  startAt: at(9),
                  endAt: at(9),
                  durationMinutes: 45,
                },
                {
                  stepId: "s1",
                  stepLabel: "PRレビュー",
                  bandType: "work",
                  startAt: at(10),
                  endAt: at(12),
                  durationMinutes: 120,
                },
              ],
            },
          }),
        });
      },
    );

    // 本音一覧
    await page.route(
      `${API_BASE}/api/tasks/${SLACK_TASK_ID}/honne`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ honneList: [] }),
        });
      },
    );
  });

  test("タスク一覧に Slack 由来タスクが表示される", async ({ page }) => {
    await page.goto("/tasks");

    // タスクタイトルが表示されること
    await expect(
      page.getByText("田中さんから: PRレビューお願いします"),
    ).toBeVisible({ timeout: 15000 });
  });

  test("タスク詳細でサボり判定（can_saboru）が表示される", async ({ page }) => {
    // 判定ストリームをモック
    await page.route(
      `${API_BASE}/api/tasks/${SLACK_TASK_ID}/proposal*`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: [
            `data: ${JSON.stringify({
              type: "proposal",
              proposal: {
                proposalId: "prop-slack-001",
                taskId: SLACK_TASK_ID,
                verdict: "can_saboru",
                reasoning: [
                  "田中さんは現在別のMTG中",
                  "急ぎのPRではなく次スプリント対象",
                ],
                summaryText: "今はサボってOK！あとで見ればいいよ",
                nextCheckOffsetMinutes: 90,
                chatMessage: "大丈夫大丈夫、田中さん今MTGだし！",
                createdAt: new Date().toISOString(),
              },
            })}\n\n`,
            "data: [DONE]\n\n",
          ].join(""),
        });
      },
    );

    await page.goto(`/tasks/${SLACK_TASK_ID}`);

    // VerdictBox が表示されるまで待機（サボり判定）
    await expect(page.getByText("今はサボってOK！あとで見ればいいよ")).toBeVisible({
      timeout: 15000,
    });
  });

  test("Slack 連携済みのとき Slack 共有コントロールが表示される", async ({
    page,
  }) => {
    await page.route(
      `${API_BASE}/api/tasks/${SLACK_TASK_ID}/proposal*`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: `data: [DONE]\n\n`,
        });
      },
    );

    await page.goto(`/tasks/${SLACK_TASK_ID}`);

    // SlackShareControl がチャンネル一覧を取得して表示されること
    // セレクトボックスに #general が表示される
    await expect(page.getByRole("combobox", { name: /チャンネル/ })).toBeVisible(
      { timeout: 15000 },
    );
    await expect(page.getByRole("option", { name: /#general/ })).toBeAttached();
  });

  test("Slack 共有ボタン押下で成功トーストが表示される", async ({ page }) => {
    // 判定ストリーム
    await page.route(
      `${API_BASE}/api/tasks/${SLACK_TASK_ID}/proposal*`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: `data: [DONE]\n\n`,
        });
      },
    );

    // Slack 通知 API
    let notifyPayload: Record<string, unknown> = {};
    await page.route(`${API_BASE}/api/slack/notify-task`, (route) => {
      notifyPayload = JSON.parse(route.request().postData() ?? "{}");
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posted: true, verdict: "can_saboru" }),
      });
    });

    await page.goto(`/tasks/${SLACK_TASK_ID}`);

    // チャンネル選択（#general）
    const channelSelect = page.getByRole("combobox", { name: /チャンネル/ });
    await expect(channelSelect).toBeVisible({ timeout: 15000 });
    await channelSelect.selectOption({ value: "C001" });

    // 共有ボタンをクリック（"Slackに共有" または "共有" ラベル）
    const shareBtn = page.getByRole("button", { name: /Slack|共有/ }).first();
    await shareBtn.click();

    // 成功トーストが表示されること
    await expect(page.getByRole("status")).toBeVisible({ timeout: 5000 });

    // リクエストボディに taskId と channelId が含まれること
    expect(notifyPayload).toMatchObject({
      taskId: SLACK_TASK_ID,
      channelId: "C001",
    });
  });

  test("Slack 共有 API 失敗時にエラートーストが表示される", async ({ page }) => {
    await page.route(
      `${API_BASE}/api/tasks/${SLACK_TASK_ID}/proposal*`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: `data: [DONE]\n\n`,
        });
      },
    );

    // Slack 通知 API が失敗する
    await page.route(`${API_BASE}/api/slack/notify-task`, (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Slack API error" }),
      });
    });

    await page.goto(`/tasks/${SLACK_TASK_ID}`);

    const channelSelect = page.getByRole("combobox", { name: /チャンネル/ });
    await expect(channelSelect).toBeVisible({ timeout: 15000 });

    const shareBtn = page.getByRole("button", { name: /Slack|共有/ }).first();
    await shareBtn.click();

    // エラートーストが表示されること
    await expect(page.getByRole("status")).toBeVisible({ timeout: 5000 });
  });

  test("Slack 未連携時は Slack 共有コントロールが表示されない", async ({
    page,
  }) => {
    // Slack 未連携に上書き
    await page.route(`${API_BASE}/api/connections`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { service: "slack", status: "disconnected" },
          { service: "google", status: "disconnected" },
        ]),
      });
    });

    await page.route(
      `${API_BASE}/api/tasks/${SLACK_TASK_ID}/proposal*`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: `data: [DONE]\n\n`,
        });
      },
    );

    await page.goto(`/tasks/${SLACK_TASK_ID}`);

    // タスク詳細が表示される（ページが正常に開ける）
    await expect(page.getByText("田中さんから: PRレビューお願いします")).toBeVisible(
      { timeout: 15000 },
    );

    // Slack 連携が切れているのでチャンネルセレクトは非表示
    await expect(
      page.getByRole("combobox", { name: /チャンネル/ }),
    ).not.toBeVisible();
  });
});

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

// cognitoAuth をモックして認証状態を制御する
vi.mock("@/auth/cognitoAuth", () => ({
  getValidToken: vi.fn().mockResolvedValue(null),
  parseIdToken: vi.fn().mockReturnValue({
    sub: "u1",
    email: "test@example.com",
    name: "テストユーザー",
  }),
  signIn: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

// agentClient をモックして API 呼び出しを制御する（4タブが初回ロードで叩く）
vi.mock("@/panel/lib/agentClient", () => ({
  judgeTask: vi.fn().mockResolvedValue({
    replyDraft: "了解しました。後ほど確認します。",
    saboriScore: 0.8,
    ttsSummary: "了解しました",
  }),
  sendSlackReply: vi.fn().mockResolvedValue({ ok: true }),
  isMcpAvailable: vi.fn().mockReturnValue(false),
  getCandidates: vi.fn().mockResolvedValue([]),
  getTaskSummaries: vi.fn().mockResolvedValue([]),
  getTask: vi.fn().mockResolvedValue(null),
  getCalendarStatus: vi.fn().mockResolvedValue({ cached: false }),
  getProposal: vi.fn().mockResolvedValue(null),
  getSchedule: vi.fn().mockResolvedValue(null),
  getProgressReport: vi.fn(),
  getGoalAnalysis: vi.fn().mockResolvedValue(null),
  fetchPlanSteps: vi.fn().mockResolvedValue([]),
  approveCandidate: vi.fn(),
  delegateTask: vi.fn().mockResolvedValue({
    ok: true,
    taskId: "t1",
    channelId: "C123",
    ts: "1717900000.222222",
  }),
  decomposeTask: vi.fn().mockResolvedValue({
    goalSummary: "資料確認タスクを完了させる",
    deliverable: "確認結果",
    subtasks: [],
    totalEstimatedMinutes: 15,
    freeTimeMinutes: 0,
    freeTimeSuggestion: "",
    generatedAt: "2026-06-26T00:00:00.000Z",
  }),
  updateSubtaskStatus: vi.fn().mockResolvedValue(undefined),
  // 既定では postChat を失敗させ、チャットはキーワード分岐フォールバックを使う。
  // （実 API 応答を検証するテストは個別に mockResolvedValue で上書きする）
  postChat: vi.fn().mockRejectedValue(new Error("chat unavailable in test")),
  createTask: vi.fn().mockResolvedValue({
    taskId: "created-1",
    title: "作成タスク",
    status: "approved",
  }),
  rejectCandidate: vi.fn().mockResolvedValue(undefined),
}));

import * as cognitoAuth from "@/auth/cognitoAuth";
import * as agentClient from "@/panel/lib/agentClient";

const AUTH = "fake-id-token";

describe("App (4タブ Side Panel)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(null);
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined);
    vi.mocked(agentClient.getCandidates).mockResolvedValue([]);
    vi.mocked(agentClient.getTaskSummaries).mockResolvedValue([]);
    vi.mocked(agentClient.getCalendarStatus).mockResolvedValue({
      cached: false,
    });
    vi.mocked(agentClient.getProposal).mockResolvedValue(null);
    vi.mocked(agentClient.getGoalAnalysis).mockResolvedValue(null);
    vi.mocked(agentClient.getProgressReport).mockResolvedValue({
      taskId: "t1",
      reportText: "APIが生成した進捗報告です。",
      reasoning: "既存 report API のレスポンス",
    });
    vi.mocked(agentClient.delegateTask).mockResolvedValue({
      ok: true,
      taskId: "t1",
      channelId: "C123",
      ts: "1717900000.222222",
    });
    vi.mocked(agentClient.decomposeTask).mockResolvedValue({
      goalSummary: "資料確認タスクを完了させる",
      deliverable: "確認結果",
      subtasks: [],
      totalEstimatedMinutes: 15,
      freeTimeMinutes: 0,
      freeTimeSuggestion: "",
      generatedAt: "2026-06-26T00:00:00.000Z",
    });
  });

  // ---------------------------------------------------------------------------
  // 認証・基本レンダリング
  // ---------------------------------------------------------------------------

  it("ルート要素がレンダリングされる", async () => {
    render(<App />);
    expect(screen.getByTestId("app-root")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );
  });

  it("Saborou ヘッダーが表示される", async () => {
    render(<App />);
    expect(screen.getByText("Saborou")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );
  });

  it("未認証時: ログインボタンと未認証メッセージが表示される", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("sign-in-button")).toBeInTheDocument();
    expect(screen.getByTestId("unauthenticated-message")).toBeInTheDocument();
    // 未認証時はタブバーを出さない
    expect(screen.queryByTestId("tab-bar")).not.toBeInTheDocument();
  });

  it("認証済み時: ユーザー情報とサインアウトボタンが表示される", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("user-info")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("sign-out-button")).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // 4タブ表示・切替
  // ---------------------------------------------------------------------------

  it("認証済み時: 4タブのタブバーが表示される", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("tab-home")).toBeInTheDocument();
    expect(screen.getByTestId("tab-inbox")).toBeInTheDocument();
    expect(screen.getByTestId("tab-working")).toBeInTheDocument();
    expect(screen.getByTestId("tab-slack")).toBeInTheDocument();
  });

  it("認証済み時: 初期タブはホーム", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("home-tab")).toBeInTheDocument(),
    );
  });

  it("依頼整理タブに切り替えられる", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("tab-inbox"));
    expect(screen.getByTestId("inbox-tab")).toBeInTheDocument();
  });

  it("作業中タブに切り替えられる", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("tab-working"));
    expect(screen.getByTestId("working-tab")).toBeInTheDocument();
    expect(screen.queryByText("今日のスケジュール")).not.toBeInTheDocument();
  });

  it("余白タブに切り替えられる", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("tab-slack"));
    expect(screen.getByTestId("slack-tab")).toBeInTheDocument();
    expect(
      screen.queryByTestId("free-time-session-panel"),
    ).not.toBeInTheDocument();
  });

  it("作業中タブは既存GoalAnalysisから実タスク名・余白分数・提案文を表示する", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getTaskSummaries).mockResolvedValue([
      {
        taskId: "t1",
        title: "決勝デモの通し稽古を完了する",
        status: "approved",
        deadline: "2099-01-01T09:30:00.000Z",
      },
      {
        taskId: "t2",
        title: "審査員向けQ&Aを確認する",
        status: "approved",
        deadline: "2099-01-01T10:30:00.000Z",
      },
    ]);
    vi.mocked(agentClient.getGoalAnalysis).mockResolvedValue({
      goalSummary: "決勝デモを安定させる",
      deliverable: "通し稽古メモ",
      subtasks: [],
      totalEstimatedMinutes: 45,
      freeTimeMinutes: 18,
      freeTimeSuggestion: "18分だけ席を立って、戻る前に冒頭だけ確認しよう。",
      generatedAt: "2026-06-26T00:00:00.000Z",
    });
    vi.mocked(agentClient.decomposeTask).mockResolvedValue({
      goalSummary: "決勝デモを安定させる",
      deliverable: "通し稽古メモ",
      subtasks: [],
      totalEstimatedMinutes: 45,
      freeTimeMinutes: 18,
      freeTimeSuggestion: "18分だけ席を立って、戻る前に冒頭だけ確認しよう。",
      generatedAt: "2026-06-26T00:00:00.000Z",
    });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("tab-working"));

    await waitFor(() =>
      expect(screen.getByTestId("free-time-session-message")).toHaveTextContent(
        "決勝デモの通し稽古を完了する",
      ),
    );
    expect(screen.getByTestId("next-task-status")).toHaveTextContent(
      "審査員向けQ&Aを確認する",
    );
    expect(screen.getByTestId("next-task-status")).toHaveTextContent("18分");
    expect(screen.getByTestId("free-time-session-message")).toHaveTextContent(
      "18分だけ席を立って",
    );
  });

  it("既存GoalAnalysisがない場合はdecomposeTaskで余白提案を生成する", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getTaskSummaries).mockResolvedValue([
      {
        taskId: "t1",
        title: "提案スライドを磨く",
        status: "approved",
        deadline: "2099-01-01T09:30:00.000Z",
      },
    ]);
    vi.mocked(agentClient.getGoalAnalysis).mockResolvedValue(null);
    vi.mocked(agentClient.decomposeTask).mockResolvedValue({
      goalSummary: "提案スライドを完成させる",
      deliverable: "最終スライド",
      subtasks: [],
      totalEstimatedMinutes: 30,
      freeTimeMinutes: 12,
      freeTimeSuggestion: "12分だけ首を休めてから、表紙を見直そう。",
      generatedAt: "2026-06-26T00:00:00.000Z",
    });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("tab-working"));

    await waitFor(() =>
      expect(screen.getByTestId("free-time-session-message")).toHaveTextContent(
        "12分だけ首を休めて",
      ),
    );
    expect(agentClient.getGoalAnalysis).toHaveBeenCalledWith("t1", AUTH);
    expect(agentClient.decomposeTask).toHaveBeenCalledWith("t1", AUTH);
  });

  it("AI自動サブタスク完了後に実行結果を余白チャットへ整形表示する", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getTaskSummaries).mockResolvedValue([
      {
        taskId: "t1",
        title: "スイス1週間旅行プランを完成させる",
        status: "approved",
        deadline: "2099-01-01T09:30:00.000Z",
      },
    ]);
    vi.mocked(agentClient.decomposeTask).mockResolvedValue({
      goalSummary: "スイスへの1週間の旅行プランを完成させること",
      deliverable: "旅程・宿泊・交通・予算をまとめたドキュメント",
      subtasks: [
        {
          id: "st-ai-1",
          taskId: "t1",
          title: "1週間分の詳細旅程ドキュメントを作成する",
          description:
            "Day1からDay7の移動時間、観光スポット、食事候補、予算内訳をまとめる",
          estimatedMinutes: 60,
          saborouType: "saboru",
          status: "pending",
          order: 0,
        },
      ],
      totalEstimatedMinutes: 60,
      freeTimeMinutes: 20,
      freeTimeSuggestion: "20分だけ休んで、戻る前に予約候補だけ確認しよう。",
      generatedAt: "2026-06-26T00:00:00.000Z",
    });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("tab-working"));
    await waitFor(() =>
      expect(
        screen.getByText("1週間分の詳細旅程ドキュメントを作成する"),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /代行させる/ }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2200));
    });
    await user.click(screen.getByTestId("tab-slack"));

    await waitFor(() =>
      expect(screen.getByTestId("slack-tab")).toHaveTextContent(
        "AI自動タスクの実行結果をまとめたよ",
      ),
    );
    expect(screen.getByTestId("slack-tab")).toHaveTextContent(
      "完了: 1週間分の詳細旅程ドキュメントを作成する",
    );
    expect(screen.getByTestId("slack-tab")).toHaveTextContent(
      "ゴール: スイスへの1週間の旅行プランを完成させること",
    );
    expect(screen.getByTestId("slack-tab")).toHaveTextContent(
      "成果物: 旅程・宿泊・交通・予算をまとめたドキュメント",
    );
    expect(screen.getByTestId("slack-tab")).toHaveTextContent(
      "目安時間: 1時間",
    );
    expect(screen.getByTestId("slack-tab")).toHaveTextContent(
      "実行内容: Day1からDay7の移動時間、観光スポット、食事候補、予算内訳をまとめる",
    );
    expect(screen.getByTestId("slack-tab")).toHaveTextContent(
      "次の余白: 20分だけ休んで、戻る前に予約候補だけ確認しよう。",
    );
  });

  it("切り替え相談には実際の次タスクを使って復帰チャットを返す", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getTaskSummaries).mockResolvedValue([
      {
        taskId: "t1",
        title: "デモ台本を読み切る",
        status: "approved",
        deadline: "2099-01-01T09:30:00.000Z",
      },
      {
        taskId: "t2",
        title: "スポンサー面談の準備",
        status: "approved",
        deadline: "2099-01-01T10:30:00.000Z",
      },
    ]);
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );

    await user.type(
      screen.getByTestId("chat-input"),
      "19時半のタスクに戻るにはどうしたらいい？",
    );
    await user.click(screen.getByTestId("chat-send"));

    await waitFor(() =>
      expect(screen.getByTestId("slack-tab")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/スポンサー面談の準備に戻る準備/),
    ).toBeInTheDocument();
    expect(screen.getByText(/10分前に関連資料を開いて/)).toBeInTheDocument();
    expect(screen.getAllByText(/開始したら/).length).toBeGreaterThan(0);
  });

  it("サボり相談ではチャットと別のチケットから進捗報告モーダルを開く", async () => {
    const runtimeMessageListeners: Array<(message: unknown) => void> = [];
    vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation(
      (listener) => {
        runtimeMessageListeners.push(listener as (message: unknown) => void);
      },
    );

    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getTaskSummaries).mockResolvedValue([
      {
        taskId: "t1",
        title: "今夜のMTGで余白時間の表示方法を整理する",
        status: "approved",
        deadline: "2099-01-01T09:30:00.000Z",
      },
      {
        taskId: "t2",
        title: "AIエージェント品質レビュー",
        status: "approved",
        deadline: "2099-01-01T10:30:00.000Z",
        plannedSteps: [
          {
            stepId: "step-1",
            stepLabel: "提案品質の観点を確認",
            durationMinutes: 10,
            bandType: "work",
          },
          {
            stepId: "step-2",
            stepLabel: "デモで見せる順番を整理",
            durationMinutes: 10,
            bandType: "work",
          },
        ],
      },
    ]);
    vi.mocked(agentClient.getGoalAnalysis).mockResolvedValue({
      goalSummary: "余白表示の方針を固める",
      deliverable: "MTG整理メモ",
      subtasks: [],
      totalEstimatedMinutes: 20,
      freeTimeMinutes: 25,
      freeTimeSuggestion: "25分だけ休んで、戻る前にメモを一行だけ見よう。",
      generatedAt: "2026-06-26T00:00:00.000Z",
    });
    vi.mocked(agentClient.getProgressReport).mockResolvedValue({
      taskId: "t1",
      reportText:
        "現在、余白時間の表示方針を整理しています。主要な案は比較できる状態になっており、次のMTGで判断しやすい形にまとめています。",
      reasoning: "既存 report API で生成",
    });
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(async (msg) => {
      const runtimeMessage = msg as { type?: unknown } | null;
      if (runtimeMessage?.type === "GET_PENDING_RECOVERY_CHECK") {
        return { result: null };
      }
      return undefined;
    });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );

    await user.type(screen.getByTestId("chat-input"), "やっとサボれる");
    await user.click(screen.getByTestId("chat-send"));

    await waitFor(() =>
      expect(screen.getByTestId("progress-report-ticket")).toHaveTextContent(
        "定期的に進捗報告代行",
      ),
    );
    expect(screen.getByTestId("chat-saborou")).not.toHaveTextContent(
      "定期的に進捗報告代行",
    );
    expect(screen.queryByTestId("open-report")).not.toBeInTheDocument();
    expect(screen.queryByTestId("open-leisure")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("chat-saborou-report"));

    await waitFor(() =>
      expect(screen.getByText("送っていいですか？")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("report-progress")).toHaveTextContent("1/5");
    expect(
      screen.getByText("今夜のMTGで余白時間の表示方法を整理する"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("report-draft")).toHaveValue(
      "現在、余白時間の表示方針を整理しています。主要な案は比較できる状態になっており、次のMTGで判断しやすい形にまとめています。",
    );
    expect(agentClient.getProgressReport).toHaveBeenCalledWith("t1", AUTH);
    expect(screen.getByTestId("progress-report-sent-ticket")).toHaveTextContent(
      "進捗報告完了",
    );
    expect(screen.getByTestId("progress-report-sent-ticket")).toHaveTextContent(
      "送信済み",
    );
    expect(
      screen.queryByText(/進捗報告は送っておいたよ/),
    ).not.toBeInTheDocument();

    await waitFor(() =>
      expect(
        screen.getByText(/定期的な進捗報告は問題ないね/),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId("watch-video-ticket")).toHaveTextContent(
      "アニメの続き",
    );

    await user.click(screen.getByTestId("modal-close"));
    await user.click(screen.getByTestId("chat-saborou-watch-video"));

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "https://www.amazon.co.jp/gp/video/detail/B0B8S2V3V7?qid=1782281464029&pageTypeIdSource=ASIN&ref_=atv_sr_fle_c_Tn74RA_1_1_1&sr=1-1&pageTypeId=B0B8S51G5H",
    });
    expect(screen.getByTestId("watch-video-complete-ticket")).toHaveTextContent(
      "アニメ視聴完了",
    );
    expect(screen.getByTestId("watch-video-complete-ticket")).toHaveTextContent(
      "視聴済み",
    );
    expect(screen.getByTestId("next-task-prep-ticket")).toHaveTextContent(
      "次のタスクは",
    );

    await user.click(screen.getByTestId("chat-saborou-next-task-summary"));

    expect(screen.getByTestId("next-task-summary-card")).toHaveTextContent(
      "AIエージェント品質レビュー",
    );
    expect(screen.getByTestId("next-task-summary-card")).toHaveTextContent(
      "次のタスク概要",
    );
    expect(screen.getByTestId("next-task-summary-card")).toHaveTextContent(
      "開始",
    );
    expect(screen.getByTestId("next-task-summary-card")).toHaveTextContent(
      "今日見ること",
    );
    expect(screen.getByTestId("next-task-summary-card")).toHaveTextContent(
      "提案品質の観点を確認",
    );
    expect(screen.getByTestId("recovery-check-ticket")).toHaveTextContent(
      "自動画面読み取りチェック",
    );
    expect(screen.getByTestId("recovery-check-scheduled")).toBeInTheDocument();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SCHEDULE_RECOVERY_CHECK",
        expectedTitle: "AIエージェント品質レビュー",
      }),
    );

    for (const listener of runtimeMessageListeners) {
      listener({
        type: "RECOVERY_CHECK_RESULT",
        result: {
          ok: true,
          matched: true,
          screenshotCaptured: true,
          title: "AIエージェント品質レビュー - agenda",
          checkedAt: "2026-06-24T12:00:00.000Z",
        },
      });
    }

    await waitFor(() =>
      expect(screen.getByTestId("recovery-check-success")).toHaveTextContent(
        "次の仕事やってるの偉いよ",
      ),
    );
    expect(screen.getByTestId("recovery-check-success")).toHaveTextContent(
      "AIエージェント品質レビュー - agenda",
    );
    expect(
      screen.queryByTestId("chat-saborou-recovery-check"),
    ).not.toBeInTheDocument();
  });

  it("次タスクがない場合は復帰チェックUIを出さず余白提案だけを表示する", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getTaskSummaries).mockResolvedValue([
      {
        taskId: "t1",
        title: "単独タスクの整理",
        status: "approved",
        deadline: "2099-01-01T09:30:00.000Z",
      },
    ]);
    vi.mocked(agentClient.getGoalAnalysis).mockResolvedValue({
      goalSummary: "単独タスクを片付ける",
      deliverable: "整理メモ",
      subtasks: [],
      totalEstimatedMinutes: 15,
      freeTimeMinutes: 10,
      freeTimeSuggestion: "10分だけ目を休めよう。",
      generatedAt: "2026-06-26T00:00:00.000Z",
    });
    vi.mocked(agentClient.decomposeTask).mockResolvedValue({
      goalSummary: "単独タスクを片付ける",
      deliverable: "整理メモ",
      subtasks: [],
      totalEstimatedMinutes: 15,
      freeTimeMinutes: 10,
      freeTimeSuggestion: "10分だけ目を休めよう。",
      generatedAt: "2026-06-26T00:00:00.000Z",
    });

    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("tab-working"));

    await waitFor(() =>
      expect(screen.getByTestId("free-time-session-message")).toHaveTextContent(
        "10分だけ目を休めよう",
      ),
    );
    expect(screen.getByTestId("next-task-status")).toHaveTextContent(
      "次の予定は未検出",
    );
    expect(
      screen.queryByTestId("recovery-check-ticket"),
    ).not.toBeInTheDocument();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "SCHEDULE_RECOVERY_CHECK" }),
    );
  });

  // ---------------------------------------------------------------------------
  // ホームタブ: 指標表示
  // ---------------------------------------------------------------------------

  it("ホームタブに余白・余白必要度・見えるものが表示される", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getCalendarStatus).mockResolvedValue({
      cached: true,
      valid: true,
      busyScore: 0.76,
    });
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("saboru-minutes")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("home-saborou-stage")).toBeInTheDocument();
    expect(screen.getByTestId("home-saborou-image")).toHaveAttribute(
      "src",
      "/images/saborou-ping.svg",
    );
    expect(screen.queryByText("ホーム・依頼整理")).not.toBeInTheDocument();
    expect(screen.getByText("サボローが作った余白")).toBeInTheDocument();
    expect(screen.getByText("余白必要度")).toBeInTheDocument();
    expect(screen.getByTestId("cognitive-score")).toBeInTheDocument();
    expect(screen.getByText("見えるもの")).toBeInTheDocument();
    expect(screen.getByText("カレンダー密度")).toBeInTheDocument();
    expect(screen.getByText("即レス圧")).toBeInTheDocument();
    expect(screen.getByText("連続稼働")).toBeInTheDocument();
    expect(screen.getByText("文書のトゲ")).toBeInTheDocument();
    expect(screen.queryByText("今日の余白")).not.toBeInTheDocument();
    expect(screen.queryByText("認知負荷スコア")).not.toBeInTheDocument();
    expect(screen.queryByText("このまま行くと")).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // 依頼整理タブ: 候補一覧・承認/お断り
  // ---------------------------------------------------------------------------

  it("依頼整理タブに候補カードが表示される", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getCandidates).mockResolvedValue([
      {
        candidateId: "c1",
        title: "資料の確認をお願いします",
        deadline: null,
        requester: "田中太郎",
        description: "資料の確認をお願いします",
        sourceType: "slack",
        slackChannelId: "C123",
        threadTs: "1.1",
      },
    ]);
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("tab-inbox"));
    await waitFor(() =>
      expect(screen.getByTestId("candidate-card")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("candidate-title")).toHaveTextContent(
      "資料の確認をお願いします",
    );
    expect(screen.getByTestId("candidate-approve")).toBeInTheDocument();
    expect(screen.getByTestId("candidate-decline")).toBeInTheDocument();
    expect(screen.getByTestId("candidate-dismiss")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "消去" })).toBeInTheDocument();
    expect(screen.queryByText("消去互換")).not.toBeInTheDocument();
  });

  it("消去互換で候補カードが一覧から消える", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getCandidates).mockResolvedValue([
      {
        candidateId: "c1",
        title: "資料の確認をお願いします",
        deadline: null,
        requester: "田中太郎",
        description: "資料の確認をお願いします",
        sourceType: "slack",
        slackChannelId: "C123",
        threadTs: "1.1",
      },
    ]);
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("tab-inbox"));
    await waitFor(() =>
      expect(screen.getByTestId("candidate-card")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("candidate-dismiss"));
    await waitFor(() =>
      expect(screen.queryByTestId("candidate-card")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("新しい依頼はありません")).toBeInTheDocument();
  });

  it("候補の承認ボタンで進め方モーダルが開く", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getCandidates).mockResolvedValue([
      {
        candidateId: "c1",
        title: "資料の確認をお願いします",
        deadline: null,
        requester: "田中太郎",
        description: "資料の確認をお願いします",
        sourceType: "slack",
        threadTs: "1.1",
      },
    ]);
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("tab-inbox"));
    await waitFor(() =>
      expect(screen.getByTestId("candidate-approve")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("candidate-approve"));
    expect(screen.getByTestId("approach-list")).toBeInTheDocument();
  });

  it("Bias for Action 選択で judge が呼ばれ返信案が表示される", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getCandidates).mockResolvedValue([
      {
        candidateId: "c1",
        title: "資料の件",
        deadline: null,
        requester: "田中太郎",
        description: "資料の件よろしく",
        sourceType: "slack",
        threadTs: "1.1",
      },
    ]);
    vi.mocked(agentClient.judgeTask).mockResolvedValue({
      replyDraft: "承りました。後ほど確認します。",
      saboriScore: 0.7,
      ttsSummary: "承りました",
    });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("tab-inbox"));
    await waitFor(() =>
      expect(screen.getByTestId("candidate-approve")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("candidate-approve"));
    // Bias for Action 型（1番目・enabled）をクリック
    const approaches = screen.getAllByRole("button");
    const biasButton = approaches.find((b) =>
      b.textContent?.includes("Bias for Action"),
    );
    expect(biasButton).toBeDefined();
    await user.click(biasButton as HTMLElement);

    await waitFor(() =>
      expect(agentClient.judgeTask).toHaveBeenCalledWith(
        {
          message: expect.stringContaining("資料の件よろしく"),
          senderName: "田中太郎",
        },
        AUTH,
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId("approval-draft")).toHaveValue(
        "承りました。後ほど確認します。",
      ),
    );
  });

  it("承認モーダルの「この文面で送る」で DOM 送信(SEND_SLACK_REPLY)が呼ばれる", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getCandidates).mockResolvedValue([
      {
        candidateId: "c1",
        title: "資料の件",
        deadline: null,
        requester: "田中太郎",
        description: "資料の件よろしく",
        sourceType: "slack",
        threadTs: "1.1",
      },
    ]);
    vi.mocked(agentClient.judgeTask).mockResolvedValue({
      replyDraft: "承りました。",
      saboriScore: 0.7,
      ttsSummary: "承りました",
    });
    // sendSlackViaDom は chrome.runtime.sendMessage({type:SEND_SLACK_REPLY}) を呼ぶ
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      async (msg: unknown) => {
        if (
          typeof msg === "object" &&
          msg !== null &&
          "type" in msg &&
          msg.type === "SEND_SLACK_REPLY"
        ) {
          return { ok: true };
        }
        return undefined;
      },
    );
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("tab-inbox"));
    await waitFor(() =>
      expect(screen.getByTestId("candidate-approve")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("candidate-approve"));
    const biasButton = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Bias for Action"));
    await user.click(biasButton as HTMLElement);
    await waitFor(() =>
      expect(screen.getByTestId("approval-send")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("approval-send"));

    await waitFor(() =>
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "SEND_SLACK_REPLY",
        text: "承りました。",
      }),
    );
  });

  it("候補承認から代行した最新タスクIDを作業中タブへ引き継ぐ", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getCandidates).mockResolvedValue([
      {
        candidateId: "c-new",
        title: "AWS re:Invent 公式サイトからセッション・展示情報を収集する",
        deadline: null,
        requester: "PM",
        description:
          "AWS re:Invent ラスベガスで参加するセッションと展示ブースの最適な計画を作る",
        sourceType: "slack",
        slackChannelId: "C123",
        threadTs: "1717900000.111111",
      },
    ]);
    vi.mocked(agentClient.getTaskSummaries).mockResolvedValue([
      {
        taskId: "t-old",
        title: "古いタスク: フランス旅行プランを作る",
        status: "approved",
        deadline: null,
      },
    ]);
    vi.mocked(agentClient.approveCandidate).mockResolvedValue({
      taskId: "t-new",
      title: "AWS re:Invent 公式サイトからセッション・展示情報を収集する",
      status: "approved",
      deadline: null,
      description:
        "AWS re:Invent ラスベガスで参加するセッションと展示ブースの最適な計画を作る",
      slackChannelId: "C123",
    });
    vi.mocked(agentClient.delegateTask).mockResolvedValue({
      ok: true,
      taskId: "t-new",
      channelId: "C123",
      ts: "1717900000.222222",
    });
    vi.mocked(agentClient.decomposeTask).mockResolvedValue({
      goalSummary: "AWS re:Invent の参加計画を完成させる",
      deliverable: "セッションリストと展示ブース巡回計画",
      subtasks: [
        {
          id: "st-1",
          taskId: "t-new",
          title: "公式サイトから情報を収集する",
          description: "セッションカタログと展示ホール情報を確認する",
          estimatedMinutes: 15,
          saborouType: "work",
          status: "pending",
          order: 1,
        },
      ],
      totalEstimatedMinutes: 15,
      freeTimeMinutes: 0,
      freeTimeSuggestion: "",
      generatedAt: "2026-06-26T00:00:00.000Z",
    });
    vi.mocked(agentClient.judgeTask).mockResolvedValue({
      replyDraft: "承知しました。まず公式情報を確認します。",
      saboriScore: 0.2,
      ttsSummary: "承知しました",
    });
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      async (msg: unknown) => {
        if (
          typeof msg === "object" &&
          msg !== null &&
          "type" in msg &&
          msg.type === "SEND_SLACK_REPLY"
        ) {
          return { ok: true };
        }
        return undefined;
      },
    );

    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("tab-inbox"));
    await waitFor(() =>
      expect(screen.getByTestId("candidate-approve")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("candidate-approve"));
    const biasButton = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Bias for Action"));
    await user.click(biasButton as HTMLElement);
    await waitFor(() =>
      expect(screen.getByTestId("approval-send")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("approval-send"));
    await waitFor(() =>
      expect(screen.getByTestId("delegate-general")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("delegate-general"));

    await waitFor(
      () => expect(screen.getByTestId("working-tab")).toBeInTheDocument(),
      { timeout: 2500 },
    );
    await waitFor(() =>
      expect(
        screen.getByText("AWS re:Invent の参加計画を完成させる"),
      ).toBeInTheDocument(),
    );
    expect(agentClient.delegateTask).toHaveBeenCalledWith(
      "t-new",
      "C123",
      AUTH,
      {
        instruction: "タスクをAIが代行する",
      },
    );
    expect(screen.queryByText(/古いタスク/)).not.toBeInTheDocument();
  });

  it("同期済みの古い代行タスクIDを固定せず次回は最新タスクを表示する", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getCandidates).mockResolvedValue([
      {
        candidateId: "c-swiss",
        title: "スイス旅行の策定プラン",
        deadline: null,
        requester: "PM",
        description: "スイス旅行の策定プランを作る",
        sourceType: "slack",
        slackChannelId: "C123",
        threadTs: "1717900000.333333",
      },
    ]);
    vi.mocked(agentClient.getTaskSummaries)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          taskId: "t-swiss",
          title: "スイス旅行の策定プラン",
          status: "approved",
          deadline: null,
        },
      ])
      .mockResolvedValue([
        {
          taskId: "t-latest",
          title: "最新タスク: AWS re:Invent 参加計画",
          status: "approved",
          deadline: null,
        },
        {
          taskId: "t-swiss",
          title: "スイス旅行の策定プラン",
          status: "approved",
          deadline: null,
        },
      ]);
    vi.mocked(agentClient.approveCandidate).mockResolvedValue({
      taskId: "t-swiss",
      title: "スイス旅行の策定プラン",
      status: "approved",
      deadline: null,
      description: "スイス旅行の策定プランを作る",
      slackChannelId: "C123",
    });
    vi.mocked(agentClient.delegateTask).mockResolvedValue({
      ok: true,
      taskId: "t-swiss",
      channelId: "C123",
      ts: "1717900000.444444",
    });
    vi.mocked(agentClient.decomposeTask).mockImplementation(
      async (taskId: string) => ({
        goalSummary:
          taskId === "t-latest"
            ? "AWS re:Invent の参加計画を進める"
            : "スイス旅行の策定プランを進める",
        deliverable: "成果物",
        subtasks: [
          {
            id: `${taskId}-st-1`,
            taskId,
            title: "情報を整理する",
            description: "必要な情報を確認する",
            estimatedMinutes: 15,
            saborouType: "work",
            status: "pending",
            order: 1,
          },
        ],
        totalEstimatedMinutes: 15,
        freeTimeMinutes: 0,
        freeTimeSuggestion: "",
        generatedAt: "2026-06-26T00:00:00.000Z",
      }),
    );
    vi.mocked(agentClient.judgeTask).mockResolvedValue({
      replyDraft: "承知しました。まず確認します。",
      saboriScore: 0.2,
      ttsSummary: "承知しました",
    });
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      async (msg: unknown) => {
        if (
          typeof msg === "object" &&
          msg !== null &&
          "type" in msg &&
          msg.type === "SEND_SLACK_REPLY"
        ) {
          return { ok: true };
        }
        return undefined;
      },
    );

    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("tab-inbox"));
    await waitFor(() =>
      expect(screen.getByTestId("candidate-approve")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("candidate-approve"));
    const biasButton = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Bias for Action"));
    await user.click(biasButton as HTMLElement);
    await waitFor(() =>
      expect(screen.getByTestId("approval-send")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("approval-send"));
    await waitFor(() =>
      expect(screen.getByTestId("delegate-travel")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("delegate-travel"));

    await waitFor(() =>
      expect(
        screen.getByText("スイス旅行の策定プランを進める"),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("tab-home"));
    await user.click(screen.getByTestId("tab-working"));

    await waitFor(() =>
      expect(
        screen.getByText("AWS re:Invent の参加計画を進める"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByText("スイス旅行の策定プランを進める"),
    ).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // content script bridge: NEW_SLACK_MESSAGE
  // ---------------------------------------------------------------------------

  it("NEW_SLACK_MESSAGE 受信で依頼整理タブにライブ候補が現れる", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);

    let capturedListener: ((msg: unknown, sender: unknown) => void) | null =
      null;
    const addListenerSpy = vi
      .spyOn(chrome.runtime.onMessage, "addListener")
      .mockImplementation((listener) => {
        capturedListener = listener as typeof capturedListener;
      });

    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );

    act(() => {
      capturedListener?.(
        {
          type: "NEW_SLACK_MESSAGE",
          payload: {
            text: "今日の会議の件ですが",
            sender: "山田花子",
            channelId: "U9876543210",
            threadTs: "1717900000.111111",
            detectedAt: new Date().toISOString(),
          },
        },
        {},
      );
    });

    // 新着で inbox タブに自動遷移
    await waitFor(() =>
      expect(screen.getByTestId("inbox-tab")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("tab-inbox"));
    await waitFor(() =>
      expect(screen.getByTestId("candidate-title")).toHaveTextContent(
        "今日の会議の件ですが",
      ),
    );

    addListenerSpy.mockRestore();
  });
});

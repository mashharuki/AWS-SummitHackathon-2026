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
  fetchPlanSteps: vi.fn().mockResolvedValue([]),
  approveCandidate: vi.fn(),
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
  });

  it("余白タブではAI提案があってもデモ用チャットだけを表示する", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getTaskSummaries).mockResolvedValue([
      {
        taskId: "t1",
        title: "AWS re:Invent ラスベガスで回るセッションと展示ブースを計画する",
        status: "approved",
        deadline: "2026-06-24T10:30:00.000Z",
      },
    ]);
    vi.mocked(agentClient.getProposal).mockResolvedValue({
      taskId: "t1",
      verdict: "can_saboru",
      summaryText: "AIが判断した余白提案",
      reasoning: ["タスクは完了済みで、次の予定まで余白があります"],
      chatMessage: "AIが生成した本来の余白メッセージです。",
    });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("tab-bar")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("tab-slack"));

    await waitFor(() =>
      expect(screen.getByTestId("demo-chat-message")).toHaveTextContent(
        "よく頑張ったよ、ゆーたろ",
      ),
    );
    expect(screen.getByTestId("next-task-status")).toHaveTextContent(
      "19:30から",
    );
    expect(screen.getByTestId("next-task-status")).toHaveTextContent("残り");
    expect(screen.getByTestId("next-task-status")).toHaveTextContent("40分");
    expect(screen.queryByTestId("ai-chat-message")).not.toBeInTheDocument();
    expect(
      screen.queryByText("AIが生成した本来の余白メッセージです。"),
    ).not.toBeInTheDocument();
  });

  it("切り替え相談には段階的な復帰チャットを返す", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
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
    expect(screen.getByText(/10分前に資料だけ開いて/)).toBeInTheDocument();
    expect(screen.getAllByText(/開始時刻になったら/).length).toBeGreaterThan(0);
  });

  it("サボり相談ではチャットと別のチケットから進捗報告モーダルを開く", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(AUTH);
    vi.mocked(agentClient.getTaskSummaries).mockResolvedValue([
      {
        taskId: "t1",
        title: "今夜のMTGで余白時間の表示方法について話し合い",
        status: "approved",
        deadline: "2026-06-24T10:30:00.000Z",
      },
    ]);
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
      screen.getByText(
        "AWS re:Invent ラスベガスで回るセッションと展示ブース計画",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("report-draft")).toHaveValue(
      "現在、AWS re:Inventでどのような出展企業があるのかをリスト化して整理しています。気になる企業や展示ブースを優先度ごとに見られるようにまとめているので、進捗があれば随時共有しますね。",
    );
    expect(agentClient.getProgressReport).not.toHaveBeenCalled();
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
      "あと10分で次のタスクだね",
    );

    await user.click(screen.getByTestId("chat-saborou-next-task-summary"));

    expect(screen.getByTestId("next-task-summary-card")).toHaveTextContent(
      "AIエージェント改善定例会",
    );
    expect(screen.getByTestId("next-task-summary-card")).toHaveTextContent(
      "次のタスク概要",
    );
    expect(screen.getByTestId("next-task-summary-card")).toHaveTextContent(
      "19:30開始",
    );
    expect(screen.getByTestId("next-task-summary-card")).toHaveTextContent(
      "今日見ること",
    );
    expect(screen.getByTestId("next-task-summary-card")).toHaveTextContent(
      "AIエージェントの提案品質を確認",
    );
  });

  // ---------------------------------------------------------------------------
  // ホームタブ: 指標表示
  // ---------------------------------------------------------------------------

  it("ホームタブに余白・認知負荷スコアが表示される", async () => {
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
    expect(screen.getByTestId("cognitive-score")).toBeInTheDocument();
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

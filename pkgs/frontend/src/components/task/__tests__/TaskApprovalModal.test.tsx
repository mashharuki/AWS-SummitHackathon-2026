import { TaskApprovalModal } from "@/components/task/TaskApprovalModal";
import apiClient from "@/lib/apiClient";
import type { ScheduleStep, TaskCandidate } from "@saboru/shared";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const candidate: TaskCandidate = {
  PK: "USER#u1",
  SK: "TASK_CAND#01CAND",
  candidateId: "01CAND",
  title: "議事録の共有",
  deadline: "2026-05-26T09:00:00.000Z",
  requester: "hashed-requester",
  description: "上司確認後の初稿を共有する",
  sourceType: "slack",
  sourceRef: "msg-1",
  status: "pending",
  createdAt: "2026-05-26T00:00:00.000Z",
  ttl: 9999999999,
};

const draftSteps: ScheduleStep[] = [
  {
    stepId: "s1",
    stepLabel: "初稿を起こす",
    durationMinutes: 45,
    bandType: "work",
  },
  {
    stepId: "s2",
    stepLabel: "上司へ確認依頼",
    durationMinutes: 15,
    bandType: "decision",
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TaskApprovalModal", () => {
  it("開いたら候補の内容を表示し、Bedrock ステップ下書きを取得して並べる", async () => {
    vi.spyOn(apiClient, "fetchPlanSteps").mockResolvedValue(draftSteps);
    render(
      <TaskApprovalModal
        candidate={candidate}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    // タイトルが候補の値で初期化される
    const titleInput = screen.getByLabelText(/タスクの内容/);
    expect(titleInput).toHaveValue("議事録の共有");

    // ステップ下書きが「やること」欄に入る
    await waitFor(() => {
      expect(screen.getByDisplayValue("初稿を起こす")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("上司へ確認依頼")).toBeInTheDocument();
  });

  it("requester はハッシュを生表示せず source でマスクする", async () => {
    vi.spyOn(apiClient, "fetchPlanSteps").mockResolvedValue(draftSteps);
    render(
      <TaskApprovalModal
        candidate={candidate}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    const display = screen.getByTestId("requester-display");
    expect(display).toHaveTextContent("Slack のメンバー");
    expect(display).not.toHaveTextContent("hashed-requester");
  });

  it("「確定して承認」で編集後の内容＋確定ステップを overrides として渡す", async () => {
    vi.spyOn(apiClient, "fetchPlanSteps").mockResolvedValue(draftSteps);
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskApprovalModal
        candidate={candidate}
        isOpen
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("初稿を起こす")).toBeInTheDocument();
    });

    // タイトルを編集
    const titleInput = screen.getByLabelText(/タスクの内容/);
    fireEvent.change(titleInput, { target: { value: "編集後タイトル" } });

    fireEvent.click(screen.getByRole("button", { name: "確定して承認" }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    const [candidateId, overrides] = onConfirm.mock.calls[0];
    expect(candidateId).toBe("01CAND");
    expect(overrides.title).toBe("編集後タイトル");
    // ステップは s1..sN に振り直されて渡る
    expect(overrides.plannedSteps).toHaveLength(2);
    expect(overrides.plannedSteps[0].stepId).toBe("s1");
    expect(overrides.plannedSteps[0].stepLabel).toBe("初稿を起こす");
  });

  it("ステップを追加・削除できる", async () => {
    vi.spyOn(apiClient, "fetchPlanSteps").mockResolvedValue([draftSteps[0]]);
    render(
      <TaskApprovalModal
        candidate={candidate}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("初稿を起こす")).toBeInTheDocument();
    });

    // 追加
    fireEvent.click(screen.getByRole("button", { name: "ステップを追加" }));
    const removeButtons = screen.getAllByRole("button", {
      name: "ステップを削除",
    });
    expect(removeButtons).toHaveLength(2);

    // 削除（1件目）
    fireEvent.click(removeButtons[0]);
    expect(screen.queryByDisplayValue("初稿を起こす")).not.toBeInTheDocument();
  });

  it("Bedrock 失敗時はエラー表示＋手動入力フォールバック、再生成できる", async () => {
    const spy = vi
      .spyOn(apiClient, "fetchPlanSteps")
      .mockRejectedValueOnce(new Error("bedrock down"))
      .mockResolvedValueOnce(draftSteps);

    render(
      <TaskApprovalModal
        candidate={candidate}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/段取りの自動生成に失敗しました/),
      ).toBeInTheDocument();
    });

    // 再生成で成功
    fireEvent.click(screen.getByRole("button", { name: /もう一度生成/ }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("初稿を起こす")).toBeInTheDocument();
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("Esc で onClose が呼ばれる", async () => {
    vi.spyOn(apiClient, "fetchPlanSteps").mockResolvedValue(draftSteps);
    const onClose = vi.fn();
    render(
      <TaskApprovalModal
        candidate={candidate}
        isOpen
        onClose={onClose}
        onConfirm={() => {}}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("isOpen=false / candidate=null では何も描画しない", () => {
    const { container } = render(
      <TaskApprovalModal
        candidate={null}
        isOpen={false}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("締切が空のステップ（空ラベル）は確定時に除外される", async () => {
    vi.spyOn(apiClient, "fetchPlanSteps").mockResolvedValue([
      draftSteps[0],
      { ...draftSteps[1], stepLabel: "" },
    ]);
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskApprovalModal
        candidate={candidate}
        isOpen
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    await waitFor(() => {
      expect(screen.getByDisplayValue("初稿を起こす")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "確定して承認" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    const overrides = onConfirm.mock.calls[0][1];
    // 空ラベルが除かれて 1 件
    expect(overrides.plannedSteps).toHaveLength(1);
  });

  it("作業/判断トグルでバンド種別を切り替えられる", async () => {
    vi.spyOn(apiClient, "fetchPlanSteps").mockResolvedValue([draftSteps[0]]);
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskApprovalModal
        candidate={candidate}
        isOpen
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    await waitFor(() => {
      expect(screen.getByDisplayValue("初稿を起こす")).toBeInTheDocument();
    });

    // 最初は work（「作業」ボタン）。クリックで decision へ。
    const list = screen.getByRole("list");
    const toggle = within(list).getByRole("button", { name: "作業" });
    fireEvent.click(toggle);

    fireEvent.click(screen.getByRole("button", { name: "確定して承認" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    const overrides = onConfirm.mock.calls[0][1];
    expect(overrides.plannedSteps[0].bandType).toBe("decision");
  });
});

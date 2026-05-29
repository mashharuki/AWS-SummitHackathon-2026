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
  requester: "山田太郎",
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
    durationMinutes: 10,
    bandType: "decision",
    decisionAt: "2026-05-26T07:00:00.000Z",
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

  it("requester は解決済み表示名をそのまま表示する", async () => {
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
    expect(display).toHaveTextContent("山田太郎");
  });

  it("assignee があれば「{name} 宛」を表示する", async () => {
    vi.spyOn(apiClient, "fetchPlanSteps").mockResolvedValue(draftSteps);
    render(
      <TaskApprovalModal
        candidate={{ ...candidate, assignee: "佐藤花子" }}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByTestId("assignee-display")).toHaveTextContent(
      "佐藤花子 宛",
    );
  });

  it("assignee が無ければ assignee 行を表示しない", async () => {
    vi.spyOn(apiClient, "fetchPlanSteps").mockResolvedValue(draftSteps);
    render(
      <TaskApprovalModal
        candidate={candidate}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByTestId("assignee-display")).not.toBeInTheDocument();
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

  it("所要時間: 編集途中は空欄にでき、即座に5へ強制されない", async () => {
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

    const minutes = screen.getByLabelText("分");
    // 全消し → 空欄を保持できる（5 に勝手に変わらない）
    fireEvent.change(minutes, { target: { value: "" } });
    expect(minutes).toHaveValue(null); // number input の空欄

    // 続けて任意の数字を入力できる
    fireEvent.change(minutes, { target: { value: "9" } });
    expect(minutes).toHaveValue(9);
  });

  it("所要時間: blur で範囲外（4分）は最小5にクランプされる", async () => {
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

    const minutes = screen.getByLabelText("分");
    fireEvent.change(minutes, { target: { value: "4" } });
    fireEvent.blur(minutes);
    expect(minutes).toHaveValue(5);

    fireEvent.click(screen.getByRole("button", { name: "確定して承認" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0][1].plannedSteps[0].durationMinutes).toBe(5);
  });

  it("所要時間: 空欄のまま blur するとデフォルト30に確定する", async () => {
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

    const minutes = screen.getByLabelText("分");
    fireEvent.change(minutes, { target: { value: "" } });
    fireEvent.blur(minutes);
    expect(minutes).toHaveValue(30);

    fireEvent.click(screen.getByRole("button", { name: "確定して承認" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0][1].plannedSteps[0].durationMinutes).toBe(30);
  });

  it("所要時間: 範囲内の有効値はそのまま確定値になる", async () => {
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

    const minutes = screen.getByLabelText("分");
    fireEvent.change(minutes, { target: { value: "90" } });
    fireEvent.blur(minutes);

    fireEvent.click(screen.getByRole("button", { name: "確定して承認" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0][1].plannedSteps[0].durationMinutes).toBe(90);
  });

  it("意思決定ステップは所要分ではなく時刻（time）入力を表示する", async () => {
    vi.spyOn(apiClient, "fetchPlanSteps").mockResolvedValue([draftSteps[1]]);
    render(
      <TaskApprovalModal
        candidate={candidate}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByDisplayValue("上司へ確認依頼")).toBeInTheDocument();
    });
    // decision 行には時刻入力があり、分入力は無い
    const timeInput = screen.getByLabelText("意思決定の時刻");
    expect(timeInput).toHaveProperty("type", "time");
    expect(screen.queryByLabelText("分")).not.toBeInTheDocument();
  });

  it("意思決定の時刻を変更すると decisionAt が overrides に反映される", async () => {
    vi.spyOn(apiClient, "fetchPlanSteps").mockResolvedValue([draftSteps[1]]);
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
      expect(screen.getByDisplayValue("上司へ確認依頼")).toBeInTheDocument();
    });

    const timeInput = screen.getByLabelText("意思決定の時刻");
    fireEvent.change(timeInput, { target: { value: "15:30" } });

    fireEvent.click(screen.getByRole("button", { name: "確定して承認" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    const step = onConfirm.mock.calls[0][1].plannedSteps[0];
    expect(step.bandType).toBe("decision");
    // decisionAt は ISO で、ローカル15:30 を指す
    const d = new Date(step.decisionAt);
    expect(d.getHours()).toBe(15);
    expect(d.getMinutes()).toBe(30);
  });

  it("作業→判断トグルで decisionAt の初期値が入る", async () => {
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

    // work → decision
    const list = screen.getByRole("list");
    fireEvent.click(within(list).getByRole("button", { name: "作業" }));
    // 時刻入力が出る
    expect(screen.getByLabelText("意思決定の時刻")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "確定して承認" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    const step = onConfirm.mock.calls[0][1].plannedSteps[0];
    expect(step.bandType).toBe("decision");
    // 初期 decisionAt が設定されている
    expect(step.decisionAt).toBeTruthy();
  });
});

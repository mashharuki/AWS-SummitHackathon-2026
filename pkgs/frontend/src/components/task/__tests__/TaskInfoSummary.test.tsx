import { TaskInfoSummary } from "@/components/task/TaskInfoSummary";
import type { Task } from "@saboru/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

/** テスト用の承認済みタスクを生成（上書きで各ケースを表現）。 */
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    PK: "USER#u1",
    SK: "TASK#01TASK",
    taskId: "01TASK",
    userId: "u1",
    status: "approved",
    title: "議事録の共有",
    deadline: "2026-05-26T09:00:00.000Z",
    requester: "山田太郎",
    description: "上司確認後の初稿を共有する",
    sourceType: "slack",
    approvedAt: "2026-05-26T00:00:00.000Z",
    updatedAt: "2026-05-26T00:00:00.000Z",
    ...overrides,
  };
}

describe("TaskInfoSummary", () => {
  it("4 項目（内容・締切・詳細・依頼者）を表示する", () => {
    render(<TaskInfoSummary task={makeTask()} />);

    // 1. タスクの内容
    expect(screen.getByText("議事録の共有")).toBeInTheDocument();
    // 2. 締切（formatDeadlineDisplay で整形）
    expect(screen.getByText("2026/5/26")).toBeInTheDocument();
    // 3. 詳細内容
    expect(screen.getByText("上司確認後の初稿を共有する")).toBeInTheDocument();
    // 4. 誰が言っているか
    expect(screen.getByTestId("summary-requester")).toBeInTheDocument();
  });

  it("requester は解決済み表示名をそのまま表示する", () => {
    render(<TaskInfoSummary task={makeTask()} />);

    const requester = screen.getByTestId("summary-requester");
    expect(requester).toHaveTextContent("山田太郎");
  });

  it("requester が空のときは sourceType でフォールバック表示する", () => {
    render(<TaskInfoSummary task={makeTask({ requester: "" })} />);
    expect(screen.getByTestId("summary-requester")).toHaveTextContent(
      "Slack のメンバー",
    );
  });

  it("requester が空 & manual ソースは「手動」でフォールバック表示する", () => {
    render(
      <TaskInfoSummary
        task={makeTask({ requester: "", sourceType: "manual" })}
      />,
    );
    expect(screen.getByTestId("summary-requester")).toHaveTextContent(
      "手動 のメンバー",
    );
  });

  it("assignee があれば「{name} 宛」を表示する", () => {
    render(<TaskInfoSummary task={makeTask({ assignee: "佐藤花子" })} />);
    expect(screen.getByTestId("summary-assignee")).toHaveTextContent(
      "佐藤花子 宛",
    );
  });

  it("assignee が無ければ assignee 行を表示しない", () => {
    render(<TaskInfoSummary task={makeTask()} />);
    expect(screen.queryByTestId("summary-assignee")).not.toBeInTheDocument();
  });

  it("deadline が null のときは「期限未定」を表示する", () => {
    render(<TaskInfoSummary task={makeTask({ deadline: null })} />);
    expect(screen.getByText("期限未定")).toBeInTheDocument();
  });

  it("description が空のときは「詳細なし」をフォールバック表示する", () => {
    render(<TaskInfoSummary task={makeTask({ description: "" })} />);
    expect(screen.getByText("詳細なし")).toBeInTheDocument();
  });

  it("description が空白のみのときも「詳細なし」を表示する", () => {
    render(<TaskInfoSummary task={makeTask({ description: "   " })} />);
    expect(screen.getByText("詳細なし")).toBeInTheDocument();
  });
});

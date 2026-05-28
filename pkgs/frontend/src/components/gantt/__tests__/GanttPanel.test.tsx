import { GanttPanel } from "@/components/gantt/GanttPanel";
import { __clearGanttScheduleCache } from "@/hooks/useGanttSchedule";
import apiClient from "@/lib/apiClient";
import { ToastProvider } from "@/providers/ToastProvider";
import type { SaboriSchedule, Task } from "@saboru/shared";
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Toast を使うため ToastProvider でラップしてレンダリングする */
function render(ui: React.ReactElement) {
  return rtlRender(<ToastProvider>{ui}</ToastProvider>);
}

// ガントは既定で「今日」を表示する（左右無限化）。当日ビューは開始が now に
// 寄るため、現在時刻に依存せず全ブロックが見えるよう「明日」を基準にし、
// レンダリング後に GanttChart の「翌日」ナビで明日へ送ってから検証する。
// 明日は丸1日（00:00〜23:59）が窓になるので 09:00 起点のブロックが必ず入る。
const baseDay = new Date();
baseDay.setDate(baseDay.getDate() + 1);
baseDay.setHours(9, 0, 0, 0);
const VIEW_START = baseDay.toISOString();
const VIEW_END = new Date(baseDay.getTime() + 3 * 60 * 60_000).toISOString();
const vsMs = new Date(VIEW_START).getTime();
const iso = (min: number) => new Date(vsMs + min * 60_000).toISOString();

/** 明日のガント日付ヘッダー文言（GanttChart の formatDateHeader と同形式）。 */
const baseDayHeader = `${baseDay.getFullYear()}年${baseDay.getMonth() + 1}月${baseDay.getDate()}日`;

/** GanttPanel をレンダリングし、「翌日」ナビで baseDay（明日）へ送る。 */
async function gotoBaseDay() {
  // ガントヘッダー（前日/翌日ボタン）が出るまで待ってから翌日へ送る。
  await waitFor(() => {
    expect(screen.getByLabelText("翌日")).toBeInTheDocument();
  });
  fireEvent.click(screen.getByLabelText("翌日"));
}

function makeSchedule(calendarUsed: boolean): SaboriSchedule {
  return {
    taskId: "t1",
    generatedAt: VIEW_START,
    viewStartAt: VIEW_START,
    viewEndAt: VIEW_END,
    deadline: VIEW_END,
    blocks: [
      {
        stepId: "saboru_0",
        stepLabel: "さぼろう",
        bandType: "saboru",
        startAt: iso(0),
        endAt: iso(60),
        durationMinutes: 60,
      },
      {
        stepId: "s1",
        stepLabel: "資料作成",
        bandType: "work",
        startAt: iso(60),
        endAt: iso(90),
        durationMinutes: 30,
      },
    ],
    totalSaboruMinutes: 60,
    calendarUsed,
  };
}

beforeEach(() => {
  // taskId 単位のセッションキャッシュをテスト間で持ち越さない
  __clearGanttScheduleCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GanttPanel", () => {
  it("取得したスケジュールのガントと再計算ボタンを表示する", async () => {
    vi.spyOn(apiClient, "getSchedule").mockResolvedValue(makeSchedule(true));
    render(<GanttPanel taskId="t1" reasoningCount={3} />);

    await gotoBaseDay();
    await waitFor(() => {
      expect(screen.getByText(baseDayHeader)).toBeInTheDocument();
    });
    // 「確保したサボり時間」「サボり盤面評価」表示は撤去済み
    expect(screen.queryByText("確保したサボり時間")).not.toBeInTheDocument();
    expect(screen.queryByText("サボり盤面評価")).not.toBeInTheDocument();
    // 再計算ボタンは残る
    expect(screen.getByLabelText("スケジュールを再計算")).toBeInTheDocument();
    // ステップラベル（明日ビューで全ブロックが見える）
    expect(screen.getByText("資料作成")).toBeInTheDocument();
  });

  it("取得失敗時はダミースケジュールで常時ガントを表示する", async () => {
    vi.spyOn(apiClient, "getSchedule").mockRejectedValue(new Error("fail"));
    render(<GanttPanel taskId="t1" />);

    await waitFor(() => {
      // ダミーのサンプル配置（カレンダー未連携の注記）
      expect(
        screen.getByText(/カレンダー未連携のためサンプル配置/),
      ).toBeInTheDocument();
    });
  });

  it("null（未生成）でもダミーで表示する", async () => {
    vi.spyOn(apiClient, "getSchedule").mockResolvedValue(null);
    render(<GanttPanel taskId="t1" />);
    await waitFor(() => {
      expect(
        screen.getByText(/カレンダー未連携のためサンプル配置/),
      ).toBeInTheDocument();
    });
  });

  it("calendarUsed=true なら未連携注記を出さない", async () => {
    vi.spyOn(apiClient, "getSchedule").mockResolvedValue(makeSchedule(true));
    render(<GanttPanel taskId="t1" />);
    await waitFor(() => {
      expect(screen.getByLabelText("スケジュールを再計算")).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/カレンダー未連携のためサンプル配置/),
    ).not.toBeInTheDocument();
  });

  it("再マウント時はキャッシュから即表示し、再取得（再推論）しない", async () => {
    // タブ切替でアンマウント→再マウントを再現する。
    const spy = vi
      .spyOn(apiClient, "getSchedule")
      .mockResolvedValue(makeSchedule(true));

    // 1回目のマウント: 取得が走る
    const { unmount } = render(<GanttPanel taskId="t1" reasoningCount={3} />);
    await waitFor(() => {
      expect(screen.getByLabelText("スケジュールを再計算")).toBeInTheDocument();
    });
    expect(spy).toHaveBeenCalledTimes(1);

    // 別タブへ移動 = アンマウント
    unmount();

    // ガントタブへ戻る = 再マウント。キャッシュヒットで即表示・再取得しない
    render(<GanttPanel taskId="t1" reasoningCount={3} />);
    expect(screen.getByLabelText("スケジュールを再計算")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1); // 2回目は呼ばれない
  });

  it("再計算ボタンを押すとキャッシュを無視して再取得する", async () => {
    const spy = vi
      .spyOn(apiClient, "getSchedule")
      .mockResolvedValue(makeSchedule(true));
    render(<GanttPanel taskId="t1" reasoningCount={3} />);
    await waitFor(() => {
      expect(screen.getByLabelText("スケジュールを再計算")).toBeInTheDocument();
    });
    expect(spy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText("スケジュールを再計算"));
    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2); // 手動再計算で再取得
    });
  });
});

describe("GanttPanel — 編集の保存", () => {
  /** work + decision を含むスケジュール（編集対象あり） */
  function makeEditableSchedule(): SaboriSchedule {
    return {
      taskId: "t1",
      generatedAt: VIEW_START,
      viewStartAt: VIEW_START,
      viewEndAt: VIEW_END,
      deadline: VIEW_END,
      blocks: [
        {
          stepId: "s1",
          stepLabel: "資料作成",
          bandType: "work",
          startAt: iso(60),
          endAt: iso(90),
          durationMinutes: 30,
        },
        {
          stepId: "s2",
          stepLabel: "上司へ確認",
          bandType: "decision",
          startAt: iso(120),
          endAt: iso(130),
          durationMinutes: 10,
        },
      ],
      totalSaboruMinutes: 60,
      calendarUsed: true,
    };
  }

  it("workリサイズ後、正しい plannedSteps で updatePlannedSteps が呼ばれる", async () => {
    vi.spyOn(apiClient, "getSchedule").mockResolvedValue(
      makeEditableSchedule(),
    );
    const patch = vi
      .spyOn(apiClient, "updatePlannedSteps")
      .mockResolvedValue({} as unknown as Task);

    render(<GanttPanel taskId="t1" reasoningCount={3} />);
    await gotoBaseDay();
    await waitFor(() => {
      expect(screen.getByText("資料作成")).toBeInTheDocument();
    });

    // 右端ハンドルを掴んで +60分（pxPerHour=120 → 120px）伸ばす
    const handle = screen.getByTestId("gantt-resize-end-s1");
    const area = handle.parentElement?.parentElement as HTMLElement;
    fireEvent.pointerDown(handle, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(area, { clientX: 120, pointerId: 1 });
    fireEvent.pointerUp(area, { clientX: 120, pointerId: 1 });

    await waitFor(() => {
      expect(patch).toHaveBeenCalledTimes(1);
    });
    const [taskId, plannedSteps] = patch.mock.calls[0];
    expect(taskId).toBe("t1");
    // work s1: 30分 → 90分、decision s2 は decisionAt 付きで維持
    const s1 = plannedSteps.find((s) => s.stepId === "s1");
    const s2 = plannedSteps.find((s) => s.stepId === "s2");
    expect(s1?.durationMinutes).toBe(90);
    expect(s1?.bandType).toBe("work");
    expect(s2?.bandType).toBe("decision");
    expect(s2?.decisionAt).toBeDefined();
  });

  it("decision移動後、decisionAt を更新した plannedSteps で保存される", async () => {
    vi.spyOn(apiClient, "getSchedule").mockResolvedValue(
      makeEditableSchedule(),
    );
    const patch = vi
      .spyOn(apiClient, "updatePlannedSteps")
      .mockResolvedValue({} as unknown as Task);

    render(<GanttPanel taskId="t1" reasoningCount={3} />);
    await gotoBaseDay();
    await waitFor(() => {
      expect(screen.getByText("上司へ確認")).toBeInTheDocument();
    });

    const block = screen.getByTestId("gantt-block-s2");
    const area = block.parentElement as HTMLElement;
    // -30分（-60px）左へ移動 → decisionAt が iso(90) になる
    fireEvent.pointerDown(block, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(area, { clientX: 40, pointerId: 1 });
    fireEvent.pointerUp(area, { clientX: 40, pointerId: 1 });

    await waitFor(() => {
      expect(patch).toHaveBeenCalledTimes(1);
    });
    const s2 = patch.mock.calls[0][1].find((s) => s.stepId === "s2");
    expect(s2?.decisionAt).toBe(iso(90));
  });

  it("保存失敗時はエラートーストを出す", async () => {
    vi.spyOn(apiClient, "getSchedule").mockResolvedValue(
      makeEditableSchedule(),
    );
    vi.spyOn(apiClient, "updatePlannedSteps").mockRejectedValue(
      new Error("fail"),
    );

    render(<GanttPanel taskId="t1" reasoningCount={3} />);
    await gotoBaseDay();
    await waitFor(() => {
      expect(screen.getByText("資料作成")).toBeInTheDocument();
    });

    const handle = screen.getByTestId("gantt-resize-end-s1");
    const area = handle.parentElement?.parentElement as HTMLElement;
    fireEvent.pointerDown(handle, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(area, { clientX: 120, pointerId: 1 });
    fireEvent.pointerUp(area, { clientX: 120, pointerId: 1 });

    await waitFor(() => {
      expect(screen.getByText(/更新に失敗しました/)).toBeInTheDocument();
    });
  });

  it("ダミー表示（取得失敗）時は編集不可（リサイズハンドルが無い）", async () => {
    vi.spyOn(apiClient, "getSchedule").mockRejectedValue(new Error("fail"));
    render(<GanttPanel taskId="t1" />);
    await waitFor(() => {
      expect(
        screen.getByText(/カレンダー未連携のためサンプル配置/),
      ).toBeInTheDocument();
    });
    // ダミー（editable=false）なのでリサイズハンドルは描画されない
    expect(screen.queryByTestId("gantt-resize-end-s1")).not.toBeInTheDocument();
  });
});

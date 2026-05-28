import { GanttChart } from "@/components/gantt/GanttChart";
import type { SaboriSchedule } from "@saboru/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const VIEW_START = "2026-05-24T05:00:00.000Z";
const VIEW_END = "2026-05-24T08:00:00.000Z";
const vsMs = new Date(VIEW_START).getTime();
const iso = (min: number) => new Date(vsMs + min * 60_000).toISOString();

const schedule: SaboriSchedule = {
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
      stepLabel: "議事録を文字起こし",
      bandType: "work",
      startAt: iso(60),
      endAt: iso(90),
      durationMinutes: 30,
    },
    {
      stepId: "s2",
      stepLabel: "上司へ確認依頼",
      bandType: "decision",
      startAt: iso(90),
      endAt: iso(120),
      durationMinutes: 30,
    },
  ],
  totalSaboruMinutes: 60,
  calendarUsed: true,
};

describe("GanttChart", () => {
  it("日付ヘッダーと凡例を表示する", () => {
    render(<GanttChart schedule={schedule} now={new Date(iso(75))} />);
    expect(screen.getByText("2026年5月24日")).toBeInTheDocument();
    // 凡例（さぼろう/作業/意思決定）
    expect(screen.getAllByText("さぼろう").length).toBeGreaterThan(0);
    expect(screen.getByText("作業")).toBeInTheDocument();
    expect(screen.getByText("意思決定")).toBeInTheDocument();
  });

  it("各ステップのラベルを表示する", () => {
    render(<GanttChart schedule={schedule} now={new Date(iso(75))} />);
    expect(screen.getByText("議事録を文字起こし")).toBeInTheDocument();
    expect(screen.getByText("上司へ確認依頼")).toBeInTheDocument();
  });

  it("now がビュー範囲内なら NOWライン を表示する", () => {
    render(<GanttChart schedule={schedule} now={new Date(iso(75))} />);
    expect(screen.getByTestId("gantt-now-line")).toBeInTheDocument();
  });

  it("表示日が now と別日なら NOWライン を表示しない（左右無限で翌日へ移動）", () => {
    render(<GanttChart schedule={schedule} now={new Date(iso(75))} />);
    // 当日は NOW ライン表示
    expect(screen.getByTestId("gantt-now-line")).toBeInTheDocument();
    // 翌日へ移動すると now はその日の範囲外になり NOW ラインは消える
    fireEvent.click(screen.getByLabelText("翌日"));
    expect(screen.queryByTestId("gantt-now-line")).not.toBeInTheDocument();
  });

  it("締切がビュー範囲内なら締切ラインを表示する", () => {
    render(<GanttChart schedule={schedule} now={new Date(iso(75))} />);
    expect(screen.getByTestId("gantt-deadline-line")).toBeInTheDocument();
  });

  it("締切 null なら締切ラインを表示しない", () => {
    render(
      <GanttChart
        schedule={{ ...schedule, deadline: null }}
        now={new Date(iso(75))}
      />,
    );
    expect(screen.queryByTestId("gantt-deadline-line")).not.toBeInTheDocument();
  });

  it("単日タスクでも日付ナビ（前日/翌日）を常時表示し有効化する（左右無限）", () => {
    render(<GanttChart schedule={schedule} now={new Date(iso(75))} />);
    expect(screen.getByLabelText("前日")).toBeInTheDocument();
    expect(screen.getByLabelText("翌日")).toBeInTheDocument();
    // 左右無限: スケジュール期間に依らず常に有効
    expect(screen.getByLabelText("前日")).toBeEnabled();
    expect(screen.getByLabelText("翌日")).toBeEnabled();
  });
});

describe("GanttChart — 複数日タスクの日付ナビ", () => {
  // ローカルタイムで2日にまたがるスケジュールを構成
  const today = new Date(2026, 4, 26, 9, 0); // 5/26 09:00
  const tomorrow10 = new Date(2026, 4, 27, 10, 0);
  const multiDaySchedule: SaboriSchedule = {
    taskId: "t-multi",
    generatedAt: today.toISOString(),
    viewStartAt: today.toISOString(),
    viewEndAt: new Date(2026, 4, 27, 18, 0).toISOString(),
    deadline: new Date(2026, 4, 27, 18, 0).toISOString(),
    blocks: [
      {
        stepId: "today1",
        stepLabel: "今日の作業",
        bandType: "work",
        startAt: new Date(2026, 4, 26, 10, 0).toISOString(),
        endAt: new Date(2026, 4, 26, 11, 0).toISOString(),
        durationMinutes: 60,
      },
      {
        stepId: "tomorrow1",
        stepLabel: "明日の作業",
        bandType: "work",
        startAt: tomorrow10.toISOString(),
        endAt: new Date(2026, 4, 27, 11, 0).toISOString(),
        durationMinutes: 60,
      },
    ],
    totalSaboruMinutes: 0,
    calendarUsed: false,
  };

  it("複数日タスクでは日付ナビを表示し、初日は当日ブロックのみ見せる", () => {
    render(<GanttChart schedule={multiDaySchedule} now={today} />);
    expect(screen.getByLabelText("前日")).toBeInTheDocument();
    expect(screen.getByLabelText("翌日")).toBeInTheDocument();
    // 初日（5/26）は今日の作業だけ表示、明日の作業は範囲外
    expect(screen.getByText("今日の作業")).toBeInTheDocument();
    expect(screen.queryByText("明日の作業")).not.toBeInTheDocument();
    // 左右無限: スケジュール初日でも前日に戻れる（常時有効）
    expect(screen.getByLabelText("前日")).toBeEnabled();
  });

  it("翌日→を押すと翌日のブロックに切り替わる", () => {
    render(<GanttChart schedule={multiDaySchedule} now={today} />);
    fireEvent.click(screen.getByLabelText("翌日"));
    expect(screen.getByText("明日の作業")).toBeInTheDocument();
    expect(screen.queryByText("今日の作業")).not.toBeInTheDocument();
    // 左右無限: 最終日を超えても翌日に進める（常時有効）
    expect(screen.getByLabelText("翌日")).toBeEnabled();
  });

  it("前日←で過去日（スケジュール期間外）へも遡れる（左右無限）", () => {
    render(<GanttChart schedule={multiDaySchedule} now={today} />);
    fireEvent.click(screen.getByLabelText("前日"));
    // 5/25 はブロックが無いが、空表示で日付ヘッダーが切り替わる
    expect(screen.getByText("2026年5月25日")).toBeInTheDocument();
    expect(screen.queryByText("今日の作業")).not.toBeInTheDocument();
  });
});

describe("GanttChart — 編集（ドラッグ/リサイズ）", () => {
  // work + decision + busy を含むスケジュール
  const editSchedule: SaboriSchedule = {
    taskId: "t-edit",
    generatedAt: VIEW_START,
    viewStartAt: VIEW_START,
    viewEndAt: VIEW_END,
    deadline: VIEW_END,
    blocks: [
      {
        stepId: "s1",
        stepLabel: "資料作成",
        bandType: "work",
        startAt: iso(0),
        endAt: iso(30),
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
      {
        stepId: "busy_0",
        stepLabel: "会議",
        bandType: "busy",
        startAt: iso(60),
        endAt: iso(90),
        durationMinutes: 30,
      },
    ],
    totalSaboruMinutes: 0,
    calendarUsed: true,
  };

  it("editable=false ではリサイズハンドルを描画しない", () => {
    render(<GanttChart schedule={editSchedule} now={new Date(iso(0))} />);
    expect(screen.queryByTestId("gantt-resize-end-s1")).not.toBeInTheDocument();
  });

  it("editable=true なら work にリサイズハンドルを描画する", () => {
    render(
      <GanttChart schedule={editSchedule} now={new Date(iso(0))} editable />,
    );
    expect(screen.getByTestId("gantt-resize-end-s1")).toBeInTheDocument();
    expect(screen.getByTestId("gantt-resize-start-s1")).toBeInTheDocument();
    // decision はリサイズ不可（ハンドル無し）
    expect(screen.queryByTestId("gantt-resize-end-s2")).not.toBeInTheDocument();
  });

  it("work をドラッグ移動しても commit される（型拡張なしのため durationのみ反映）", () => {
    const onCommit = vi.fn();
    render(
      <GanttChart
        schedule={editSchedule}
        now={new Date(iso(0))}
        editable
        onBlocksCommit={onCommit}
      />,
    );
    const block = screen.getByTestId("gantt-block-s1");
    const area = block.parentElement as HTMLElement;
    fireEvent.pointerDown(block, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(area, { clientX: 60, pointerId: 1 });
    fireEvent.pointerUp(area, { clientX: 60, pointerId: 1 });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("decision をドラッグすると開始時刻が変わって commit される", () => {
    const onCommit = vi.fn();
    render(
      <GanttChart
        schedule={editSchedule}
        now={new Date(iso(0))}
        editable
        onBlocksCommit={onCommit}
      />,
    );
    const block = screen.getByTestId("gantt-block-s2");
    const area = block.parentElement as HTMLElement;
    // +30分（+60px @120px/h）右へ移動
    fireEvent.pointerDown(block, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(area, { clientX: 60, pointerId: 1 });
    fireEvent.pointerUp(area, { clientX: 60, pointerId: 1 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    const committed = onCommit.mock.calls[0][0] as SaboriSchedule["blocks"];
    const s2 = committed.find((b) => b.stepId === "s2");
    expect(s2?.startAt).toBe(iso(150)); // 120 + 30
  });

  it("busy はドラッグ不可（pointerDown しても commit されない）", () => {
    const onCommit = vi.fn();
    render(
      <GanttChart
        schedule={editSchedule}
        now={new Date(iso(0))}
        editable
        onBlocksCommit={onCommit}
      />,
    );
    const busy = screen.getByTestId("gantt-block-busy_0");
    const area = busy.parentElement as HTMLElement;
    fireEvent.pointerDown(busy, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(area, { clientX: 60, pointerId: 1 });
    fireEvent.pointerUp(area, { clientX: 60, pointerId: 1 });
    // busy には pointerDown ハンドラが付かないため commit されない
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("work リサイズで duration が変わって commit される", () => {
    const onCommit = vi.fn();
    render(
      <GanttChart
        schedule={editSchedule}
        now={new Date(iso(0))}
        editable
        onBlocksCommit={onCommit}
      />,
    );
    const handle = screen.getByTestId("gantt-resize-end-s1");
    const area = handle.parentElement?.parentElement as HTMLElement;
    // +60分（+120px）伸ばす → 30分 → 90分
    fireEvent.pointerDown(handle, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(area, { clientX: 120, pointerId: 1 });
    fireEvent.pointerUp(area, { clientX: 120, pointerId: 1 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    const committed = onCommit.mock.calls[0][0] as SaboriSchedule["blocks"];
    const s1 = committed.find((b) => b.stepId === "s1");
    expect(s1?.durationMinutes).toBe(90);
  });
});

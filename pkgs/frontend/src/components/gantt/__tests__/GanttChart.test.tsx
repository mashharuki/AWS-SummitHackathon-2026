import { GanttChart } from "@/components/gantt/GanttChart";
import type { SaboriSchedule } from "@saboru/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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

  it("now が当日の表示範囲より前なら NOWライン を表示しない", () => {
    // ビュー開始より前の now（当日の表示開始＝viewStartより手前）
    render(<GanttChart schedule={schedule} now={new Date(iso(-60))} />);
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

  it("単日タスクでは日付ナビ（前日/翌日）を表示しない", () => {
    render(<GanttChart schedule={schedule} now={new Date(iso(75))} />);
    expect(screen.queryByLabelText("前日")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("翌日")).not.toBeInTheDocument();
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
    // 初日は前日に戻れない
    expect(screen.getByLabelText("前日")).toBeDisabled();
  });

  it("翌日→を押すと翌日のブロックに切り替わる", () => {
    render(<GanttChart schedule={multiDaySchedule} now={today} />);
    fireEvent.click(screen.getByLabelText("翌日"));
    expect(screen.getByText("明日の作業")).toBeInTheDocument();
    expect(screen.queryByText("今日の作業")).not.toBeInTheDocument();
    // 最終日なので翌日に進めない
    expect(screen.getByLabelText("翌日")).toBeDisabled();
  });
});

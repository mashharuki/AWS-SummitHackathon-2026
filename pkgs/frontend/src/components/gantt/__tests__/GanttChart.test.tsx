import { GanttChart } from "@/components/gantt/GanttChart";
import type { SaboriSchedule } from "@saboru/shared";
import { render, screen } from "@testing-library/react";
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

  it("now がビュー範囲外なら NOWライン を表示しない", () => {
    // ビュー終了より後
    render(<GanttChart schedule={schedule} now={new Date(iso(999))} />);
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
});

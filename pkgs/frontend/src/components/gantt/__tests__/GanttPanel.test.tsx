import { GanttPanel } from "@/components/gantt/GanttPanel";
import apiClient from "@/lib/apiClient";
import type { SaboriSchedule } from "@saboru/shared";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const VIEW_START = "2026-05-24T05:00:00.000Z";
const VIEW_END = "2026-05-24T08:00:00.000Z";
const vsMs = new Date(VIEW_START).getTime();
const iso = (min: number) => new Date(vsMs + min * 60_000).toISOString();

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GanttPanel", () => {
  it("取得したスケジュールのガントとサボり時間サマリを表示する", async () => {
    vi.spyOn(apiClient, "getSchedule").mockResolvedValue(makeSchedule(true));
    render(<GanttPanel taskId="t1" reasoningCount={3} />);

    await waitFor(() => {
      expect(screen.getByText("2026年5月24日")).toBeInTheDocument();
    });
    // さぼり時間サマリ（60分）
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("確保したサボり時間")).toBeInTheDocument();
    // ステップラベル
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
      expect(screen.getByText("2026年5月24日")).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/カレンダー未連携のためサンプル配置/),
    ).not.toBeInTheDocument();
  });
});

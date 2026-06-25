/**
 * HomeTab — ①現状把握
 *
 * サボローが作った余白 / 余白必要度 を表示する。
 * 数値は CalendarStatus + Proposal(psychSignals) + workHours から拡張側で算出する。
 */

import { useSaborou } from "@/panel/SaborouContext";
import { Card, MetricBar, SectionLabel } from "@/panel/components/ui";
import { getCalendarStatus } from "@/panel/lib/agentClient";
import { type HomeMetrics, computeHomeMetrics } from "@/panel/lib/homeMetrics";
import type { CalendarStatus } from "@/panel/lib/types";
import { formatDuration } from "@/panel/lib/workHours";
import { CalendarDays, Clock, FileWarning, Zap } from "lucide-react";
import { useEffect, useState } from "react";

export function HomeTab() {
  const {
    jwt,
    candidates,
    tasks,
    representativeProposal,
    scheduleSaboruMinutes,
  } = useSaborou();
  const [calendar, setCalendar] = useState<CalendarStatus>({ cached: false });
  const [metrics, setMetrics] = useState<HomeMetrics | null>(null);

  // カレンダー状態を取得
  useEffect(() => {
    if (!jwt) return;
    let cancelled = false;
    void getCalendarStatus(jwt).then((c) => {
      if (!cancelled) setCalendar(c);
    });
    return () => {
      cancelled = true;
    };
  }, [jwt]);

  // 指標を算出（カレンダー / proposal / タスク件数 / スケジュールが変わるたび）
  useEffect(() => {
    const pendingTaskCount = candidates.length + tasks.length;
    setMetrics(
      computeHomeMetrics({
        now: new Date(),
        calendar,
        proposal: representativeProposal,
        pendingTaskCount,
        scheduleSaboruMinutes,
      }),
    );
  }, [
    calendar,
    representativeProposal,
    candidates.length,
    tasks.length,
    scheduleSaboruMinutes,
  ]);

  if (!metrics) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-7 h-7 rounded-full border-2 border-[#f97316] border-t-transparent animate-spin" />
      </div>
    );
  }

  const today = new Date().toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="flex flex-col gap-3 px-3 py-3" data-testid="home-tab">
      <div
        className="relative flex min-h-[226px] items-center justify-center overflow-hidden"
        data-testid="home-saborou-stage"
      >
        <img
          src="/images/saborou-ping.svg"
          alt="サボロー"
          className="saborou-hero-image h-[218px] w-auto max-w-[94%] object-contain"
          data-testid="home-saborou-image"
        />
      </div>

      {/* サボローが作った余白 */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <SectionLabel>サボローが作った余白</SectionLabel>
          <span className="text-[10px] text-[#9ca3af]">{today}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-[34px] font-black text-[#1f2937] leading-none"
            data-testid="saboru-minutes"
          >
            {formatDuration(metrics.saboruMinutesToday)}
          </span>
        </div>
      </Card>

      {/* 余白必要度 */}
      <Card accent="#f97316">
        <div className="flex items-center justify-between mb-1">
          <SectionLabel>余白必要度</SectionLabel>
          <span className="text-[10px] font-bold text-[#f97316]">
            {metrics.cognitiveLoadScore >= 70
              ? "サボロー出動"
              : metrics.cognitiveLoadScore >= 50
                ? "余白ほしい"
                : "まだ余裕"}
          </span>
        </div>
        <div className="flex items-baseline gap-1 mb-2">
          <span
            className="text-[34px] font-black text-[#1f2937] leading-none"
            data-testid="cognitive-score"
          >
            {metrics.cognitiveLoadScore}
          </span>
          <span className="text-sm text-[#9ca3af] font-bold">/ 100</span>
        </div>
        <div>
          <MetricBar
            value={metrics.cognitiveLoadScore}
            color={
              metrics.cognitiveLoadScore >= 70
                ? "#ef4444"
                : metrics.cognitiveLoadScore >= 50
                  ? "#f59e0b"
                  : "#10b981"
            }
          />
          <p className="mt-2 text-[11px] leading-relaxed text-[#6b7280]">
            高いほど、サボローが予定をどかして余白を作る合図。
          </p>
        </div>
      </Card>

      {/* 見えるもの */}
      <div>
        <SectionLabel>見えるもの</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <SignalCard
            icon={<CalendarDays size={13} />}
            label="カレンダー密度"
            value={`${metrics.calendarDensityPct}%`}
            sub="Google Calendar"
            color="#f59e0b"
            barValue={metrics.calendarDensityPct}
          />
          <SignalCard
            icon={<Zap size={13} />}
            label="即レス圧"
            value={`${metrics.responsePressurePct}%`}
            sub="Slack / Gmail"
            color="#ef4444"
            barValue={metrics.responsePressurePct}
          />
          <SignalCard
            icon={<Clock size={13} />}
            label="連続稼働"
            value={formatDuration(metrics.continuousWorkMinutes)}
            sub="作業など"
            color="#6b7280"
            barValue={Math.min(
              100,
              (metrics.continuousWorkMinutes / 480) * 100,
            )}
          />
          <SignalCard
            icon={<FileWarning size={13} />}
            label="文書のトゲ"
            value={
              metrics.documentSharpness === "high"
                ? "注意"
                : metrics.documentSharpness === "mid"
                  ? "やや高"
                  : "安定"
            }
            sub="Amazon Bedrock"
            color={metrics.documentSharpness === "high" ? "#ef4444" : "#f59e0b"}
            barValue={
              metrics.documentSharpness === "high"
                ? 85
                : metrics.documentSharpness === "mid"
                  ? 50
                  : 25
            }
          />
        </div>
      </div>
    </div>
  );
}

function SignalCard({
  icon,
  label,
  value,
  sub,
  color,
  barValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
  barValue: number;
}) {
  return (
    <Card className="p-2.5">
      <div className="flex items-center gap-1 mb-1" style={{ color }}>
        {icon}
        <span className="text-[10px] font-bold text-[#6b7280]">{label}</span>
      </div>
      <p className="text-lg font-black text-[#1f2937] leading-tight">{value}</p>
      <p className="text-[9px] text-[#9ca3af] mb-1.5">{sub}</p>
      <MetricBar value={barValue} color={color} />
    </Card>
  );
}

/**
 * HomeTab — ①現状把握
 *
 * 今日の余白 / 認知負荷スコア / 見えるもの(カレンダー密度・即レス圧・連続稼働・
 * 文書のトゲ) / このまま行くと予測 を表示する。
 * 数値は CalendarStatus + Proposal(psychSignals) + workHours から拡張側で算出する。
 */

import { useSaborou } from "@/panel/SaborouContext";
import { Card, MetricBar, SectionLabel } from "@/panel/components/ui";
import { getCalendarStatus } from "@/panel/lib/agentClient";
import { getSuggestions } from "@/panel/lib/freeSuggestions";
import { type HomeMetrics, computeHomeMetrics } from "@/panel/lib/homeMetrics";
import type { CalendarStatus } from "@/panel/lib/types";
import { formatDuration } from "@/panel/lib/workHours";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  ExternalLink,
  FileWarning,
  Zap,
} from "lucide-react";
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
      {/* 今日の余白 */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <SectionLabel>今日の余白</SectionLabel>
          <span className="text-[10px] text-[#9ca3af]">{today}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-3xl font-black text-[#1f2937]"
            data-testid="saboru-minutes"
          >
            {formatDuration(metrics.saboruMinutesToday)}
          </span>
        </div>
        <p className="mt-1 text-xs text-[#6b7280] leading-relaxed">
          {metrics.comment}
        </p>
      </Card>

      {/* 認知負荷スコア */}
      <Card accent="#f97316">
        <div className="flex items-center justify-between mb-1">
          <SectionLabel>認知負荷スコア</SectionLabel>
          <span className="text-[10px] font-bold text-[#f97316]">
            {metrics.cognitiveLoadScore >= 60 ? "休憩推奨" : "良好"}
          </span>
        </div>
        <div className="flex items-baseline gap-1 mb-2">
          <span
            className="text-3xl font-black text-[#1f2937]"
            data-testid="cognitive-score"
          >
            {metrics.cognitiveLoadScore}
          </span>
          <span className="text-sm text-[#9ca3af] font-bold">/ 100</span>
        </div>
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
        <p className="mt-2 text-[11px] text-[#6b7280]">
          予定密度と即レス圧が高く、余白が削られやすい状態です。
        </p>
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

      {/* 余白の使い方提案 */}
      {metrics.saboruMinutesToday >= 5 && (
        <div>
          <SectionLabel>
            余白 {formatDuration(metrics.saboruMinutesToday)} の使い方
          </SectionLabel>
          <div className="flex flex-col gap-2 mt-1">
            {getSuggestions(metrics.saboruMinutesToday).map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#f9fafb] border border-[#e5e7eb] hover:bg-[#f3f4f6] transition-colors"
              >
                <div>
                  <p className="text-sm font-bold text-[#1f2937]">{s.label}</p>
                  <p className="text-[10px] text-[#9ca3af] mt-0.5">
                    {s.description}
                  </p>
                  <p className="text-[9px] text-[#f97316] font-bold mt-0.5">
                    {s.service}
                  </p>
                </div>
                <ExternalLink
                  size={13}
                  className="text-[#9ca3af] flex-shrink-0 ml-2"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* このまま行くと予測 */}
      <Card accent="#ef4444">
        <div className="flex items-start gap-2">
          <AlertTriangle
            size={16}
            className="text-[#ef4444] mt-0.5 flex-shrink-0"
          />
          <div>
            <p className="text-[10px] font-bold text-[#9ca3af] mb-0.5">
              このまま行くと
            </p>
            <p className="text-sm font-bold text-[#ef4444]">
              {metrics.predictedEndTime} まで作業が伸びる予測
            </p>
            <p className="mt-1 text-[11px] text-[#6b7280]">
              未処理タスク {candidates.length + tasks.length} 件のうち
              一部が定時を後ろに押し込みます。
            </p>
          </div>
        </div>
      </Card>
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

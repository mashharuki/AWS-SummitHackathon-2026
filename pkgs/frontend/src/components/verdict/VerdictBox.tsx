/**
 * 判定ボックス — サボロー判定の色分け表示
 * モックUI saborou_v2_03-detail.png 参照
 */
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import type { Verdict } from "@saboru/shared";

interface VerdictBoxProps {
  verdict: Verdict;
  summaryText: string;
  completionRate?: number;
  /** 今日の一言 */
  todayMessage?: string;
}

const VERDICT_CONFIG = {
  can_saboru: {
    label: "サボれます",
    color: "text-[#4CAF50]",
    bg: "bg-[#F0FFF4]",
    border: "border-[#4CAF50]/30",
    icon: CheckCircle,
  },
  borderline: {
    label: "ボーダーライン",
    color: "text-[#FF9800]",
    bg: "bg-[#FFF8F0]",
    border: "border-[#FF9800]/30",
    icon: AlertTriangle,
  },
  must_do: {
    label: "やらないとまずい",
    color: "text-[#F44336]",
    bg: "bg-[#FFF5F5]",
    border: "border-[#F44336]/30",
    icon: XCircle,
  },
} as const;

export function VerdictBox({
  verdict,
  summaryText,
  completionRate,
  todayMessage,
}: VerdictBoxProps) {
  const config = VERDICT_CONFIG[verdict];
  const Icon = config.icon;

  return (
    <div
      className={`rounded-2xl border p-4 ${config.bg} ${config.border}`}
      role="region"
      aria-label={`サボロー判定: ${config.label}`}
    >
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className={config.color} aria-hidden="true" />
        <span className={`font-semibold text-sm ${config.color}`}>
          {config.label}
        </span>
        {completionRate !== undefined && (
          <span className="ml-auto text-xs text-[#6B7280]">
            達成度 {completionRate}%
          </span>
        )}
      </div>

      {/* サマリーテキスト */}
      <p className="text-sm text-[#1A1A1A] leading-relaxed">{summaryText}</p>

      {/* 今日の一言 */}
      {todayMessage && (
        <p className={`mt-2 text-xs ${config.color} font-medium`}>
          {todayMessage}
        </p>
      )}
    </div>
  );
}

/**
 * SaboriStreakBadge — 連続サボり記録（ストリーク）バッジ
 *
 * 毎日サボると炎が増えていく。損失回避心理を利用して
 * 「ストリークを守るためにサボらなければ」という倒錯した動機を生む。
 *
 * Octalysis:
 *   8（損失回避）: 記録が途切れることへの恐れ
 *   2（達成・進歩）: 連続日数の達成感
 *   6（希少性）: 「7日間達成」などの限定的ステータス
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export interface StreakState {
  /** 現在の連続日数 */
  days: number;
  /** 最後にサボった日付（ISO 8601 date string YYYY-MM-DD） */
  lastSaboriDate: string | null;
  /** ストリーク最長記録 */
  bestStreak: number;
}

const STORAGE_KEY_STREAK = "saborou_streak";

/** ストリーク定義 */
export const STREAK_MILESTONES = [
  {
    days: 3,
    emoji: "🔥",
    label: "先延ばし継続中！",
    sublabel: "3日連続サボり達成",
    color: "#F97316",
    bg: "#FFF7ED",
    border: "#F97316",
  },
  {
    days: 7,
    emoji: "🔥🔥",
    label: "サボり週間達成！",
    sublabel: "称号解除: サボり週間王者",
    color: "#EF4444",
    bg: "#FEF2F2",
    border: "#EF4444",
  },
  {
    days: 14,
    emoji: "🔥🔥🔥",
    label: "慢性的先延ばし者",
    sublabel: "14日連続という偉業",
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#7C3AED",
  },
] as const;

/** 損失回避メッセージ（ストリーク危機通知） */
export function getStreakLossMessage(days: number): string | null {
  if (days >= 14) return "今日サボらないと14日間の記録が消えます...";
  if (days >= 7) return "今日サボらないと7日間の記録が消えます...";
  if (days >= 3) return "今日サボらないと3日間の記録が消えます...";
  return null;
}

/** 現在のミルストーンを取得する */
export function getCurrentMilestone(days: number) {
  // 達成済みの最高ミルストーンを返す
  const achieved = STREAK_MILESTONES.filter((m) => days >= m.days);
  return achieved[achieved.length - 1] ?? null;
}

/** ストリーク状態を localStorage から読み込む */
export function loadStreakState(): StreakState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_STREAK);
    if (stored) return JSON.parse(stored) as StreakState;
  } catch {
    // ignore
  }
  return { days: 0, lastSaboriDate: null, bestStreak: 0 };
}

/** ストリーク状態を localStorage に保存する */
export function saveStreakState(state: StreakState): void {
  try {
    localStorage.setItem(STORAGE_KEY_STREAK, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/** サボり記録でストリークを更新する */
export function updateStreak(currentState: StreakState): StreakState {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  if (!currentState.lastSaboriDate) {
    // 初回
    const next: StreakState = {
      days: 1,
      lastSaboriDate: today,
      bestStreak: 1,
    };
    saveStreakState(next);
    return next;
  }

  const last = new Date(currentState.lastSaboriDate);
  const now = new Date(today);
  const diffDays = Math.round(
    (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24),
  );

  let next: StreakState;
  if (diffDays === 0) {
    // 同日: 変更なし
    next = currentState;
  } else if (diffDays === 1) {
    // 翌日: ストリーク継続
    const newDays = currentState.days + 1;
    next = {
      days: newDays,
      lastSaboriDate: today,
      bestStreak: Math.max(currentState.bestStreak, newDays),
    };
  } else {
    // 2日以上空いた: ストリークリセット
    next = {
      days: 1,
      lastSaboriDate: today,
      bestStreak: currentState.bestStreak,
    };
  }

  saveStreakState(next);
  return next;
}

// ===== コンポーネント =====

interface SaboriStreakBadgeProps {
  /** 現在のストリーク日数 */
  streakDays: number;
  /** 損失回避メッセージを表示するか（タスク詳細ページ用） */
  showLossWarning?: boolean;
  className?: string;
}

export function SaboriStreakBadge({
  streakDays,
  showLossWarning = false,
  className = "",
}: SaboriStreakBadgeProps) {
  const { t } = useTranslation();
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    // マウント時に1回アニメーション
    setAnimated(true);
    const timer = setTimeout(() => setAnimated(false), 600);
    return () => clearTimeout(timer);
  }, [streakDays]);

  if (streakDays === 0) return null;

  const milestone = getCurrentMilestone(streakDays);
  const lossMessage = showLossWarning
    ? streakDays >= 14
      ? t("gamification.streakLossWarning14")
      : streakDays >= 7
        ? t("gamification.streakLossWarning7")
        : streakDays >= 3
          ? t("gamification.streakLossWarning3")
          : null
    : null;

  const color = milestone?.color ?? "#F59E0B";
  const bg = milestone?.bg ?? "#FFFBEB";
  const border = milestone?.border ?? "#F59E0B";
  const emoji = milestone?.emoji ?? "🔥";

  return (
    <div className={`${className}`}>
      {/* ストリークバッジ本体 */}
      <div
        role="status"
        aria-label={t("gamification.streakAriaLabel", { days: streakDays })}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 12,
          border: `2.5px solid ${border}`,
          boxShadow: `0 3px 0 ${border}`,
          background: bg,
          transform: animated ? "scale(1.08)" : "scale(1)",
          transition: "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 14 }}>
          {emoji}
        </span>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              color,
              fontFamily: "Nunito, 'Noto Sans JP', system-ui, sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            {t("gamification.streakContinuing", { days: streakDays })}
          </div>
          {milestone && (
            <div style={{ fontSize: 9, color, opacity: 0.8 }}>
              {t(`gamification.streakMilestones.day${milestone.days}.label`, {
                defaultValue: milestone.label,
              })}
            </div>
          )}
        </div>
      </div>

      {/* 損失回避メッセージ（オプション） */}
      {lossMessage && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            marginTop: 6,
            padding: "5px 10px",
            borderRadius: 8,
            border: `1.5px dashed ${color}`,
            background: bg,
            fontSize: 10,
            fontWeight: 700,
            color,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span aria-hidden="true">⚠️</span>
          {lossMessage}
        </div>
      )}
    </div>
  );
}

/** ストリーク詳細カード（TaskDetailPage 埋め込み用） */
interface StreakDetailCardProps {
  streakDays: number;
  bestStreak: number;
  className?: string;
}

export function StreakDetailCard({
  streakDays,
  bestStreak,
  className = "",
}: StreakDetailCardProps) {
  const { t } = useTranslation();
  const milestone = getCurrentMilestone(streakDays);
  const nextMilestone = STREAK_MILESTONES.find((m) => m.days > streakDays);

  const color = milestone?.color ?? "#6B7280";
  const bg = milestone?.bg ?? "#F9FAFB";
  const border = milestone?.border ?? "#9CA3AF";

  return (
    <div
      className={className}
      style={{
        borderRadius: 14,
        border: `2.5px solid ${border}`,
        boxShadow: `0 3px 0 ${border}`,
        background: bg,
        padding: "12px 14px",
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {t("gamification.streakRecordTitle")}
      </div>

      {/* ストリーク数 */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 4,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 900,
            color,
            fontFamily: "Nunito, system-ui, sans-serif",
            letterSpacing: "-0.03em",
          }}
        >
          {streakDays}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color, opacity: 0.8 }}>
          {t("gamification.streakDayUnit")}
        </span>
        {milestone && (
          <span
            style={{ marginLeft: 4, fontSize: 16 }}
            aria-label={milestone.label}
          >
            {milestone.emoji}
          </span>
        )}
      </div>

      {/* ミルストーンバー */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 8,
        }}
      >
        {STREAK_MILESTONES.map((m) => (
          <div
            key={m.days}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 9999,
              background: streakDays >= m.days ? m.color : "#E5E7EB",
              border: `1.5px solid ${streakDays >= m.days ? m.color : "#D1D5DB"}`,
              transition: "background 0.4s ease",
            }}
            aria-label={
              streakDays >= m.days
                ? t("gamification.streakMilestoneAchieved", { days: m.days })
                : t("gamification.streakMilestoneNotYet", { days: m.days })
            }
          />
        ))}
      </div>

      {/* 次のマイルストーン */}
      {nextMilestone ? (
        <div style={{ fontSize: 10, color: "#6B7280" }}>
          {t("gamification.streakNextMilestone", {
            label: t(
              `gamification.streakMilestones.day${nextMilestone.days}.label`,
              { defaultValue: nextMilestone.label },
            ),
            remaining: nextMilestone.days - streakDays,
          })}
        </div>
      ) : (
        <div style={{ fontSize: 10, color, fontWeight: 700 }}>
          {t("gamification.streakMaxMilestone")}
        </div>
      )}

      {/* ベスト記録 */}
      <div
        style={{
          marginTop: 6,
          fontSize: 9,
          color: "#9CA3AF",
        }}
      >
        {t("gamification.streakBestRecord", { days: bestStreak })}
      </div>
    </div>
  );
}

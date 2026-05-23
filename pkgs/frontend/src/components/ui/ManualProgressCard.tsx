/**
 * ManualProgressCard — 本音取扱説明書の「完成度ゲージ」
 *
 * 本音送信のたびに完成度が +3% アニメーション増加する。
 * 100% になると「完全なるAI依存完成」という逆説的達成演出が発動。
 *
 * Octalysis:
 *   2（達成・進歩）: ゲージが埋まる達成感
 *   8（損失回避）: 「AIにもっと知られてしまう」という侵食感
 *   3（創造・フィードバック）: 各段階のコピーがユーザーを笑わせ・ドキっとさせる
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const STORAGE_KEY_MANUAL = "saborou_manual_progress";
const INCREMENT_PER_SUBMISSION = 3; // 本音送信1回 = +3%

/** 完成度ステージ定義 */
export const MANUAL_STAGES = [
  {
    threshold: 0,
    label: "取扱説明書：真っ白",
    sublabel: "AIはまだあなたを知らない",
    color: "#9CA3AF",
    bg: "#F9FAFB",
    border: "#D1D5DB",
    emoji: "📄",
  },
  {
    threshold: 30,
    label: "サボりの傾向が見えてきた",
    sublabel: "あなたのパターンが記録されています",
    color: "#3B82F6",
    bg: "#EFF6FF",
    border: "#3B82F6",
    emoji: "🔍",
  },
  {
    threshold: 60,
    label: "あなたの行動パターンが把握されました",
    sublabel: "AIはあなたの癖を知っています",
    color: "#F97316",
    bg: "#FFF7ED",
    border: "#F97316",
    emoji: "🧠",
  },
  {
    threshold: 90,
    label: "AIはあなたのことを何でも知っています",
    sublabel: "もう隠せるものはない...",
    color: "#A855F7",
    bg: "#FAF5FF",
    border: "#A855F7",
    emoji: "👁️",
  },
  {
    threshold: 100,
    label: "完全なるAI依存完成。おめでとう！",
    sublabel: "あなたはAIの手のひらで生きています",
    color: "#F59E0B",
    bg: "#FEF3C7",
    border: "#D97706",
    emoji: "👑",
  },
] as const;

/** 現在の完成度ステージを取得 */
export function getManualStage(progress: number) {
  const stages = [...MANUAL_STAGES].reverse();
  return stages.find((s) => progress >= s.threshold) ?? MANUAL_STAGES[0];
}

/** localStorageから完成度を読み込む */
export function loadManualProgress(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MANUAL);
    if (stored !== null)
      return Math.max(0, Math.min(100, parseInt(stored, 10)));
  } catch {
    // ignore
  }
  return 0;
}

/** localStorageに完成度を保存する */
export function saveManualProgress(progress: number): void {
  try {
    localStorage.setItem(STORAGE_KEY_MANUAL, String(progress));
  } catch {
    // ignore
  }
}

/** 本音送信でゲージを増加させる */
export function incrementManualProgress(current: number): number {
  const next = Math.min(100, current + INCREMENT_PER_SUBMISSION);
  saveManualProgress(next);
  return next;
}

// ===== カスタムフック =====

export interface UseManualProgressReturn {
  progress: number;
  stage: (typeof MANUAL_STAGES)[number];
  isComplete: boolean;
  /** 本音送信時に呼ぶ */
  onHonneSubmit: () => void;
  /** 完成時のお祝いが表示済みか */
  completionSeen: boolean;
  clearCompletionSeen: () => void;
}

export function useManualProgress(): UseManualProgressReturn {
  const [progress, setProgress] = useState<number>(() => loadManualProgress());
  const [completionSeen, setCompletionSeen] = useState(false);

  const onHonneSubmit = useCallback(() => {
    setProgress((prev) => {
      const next = incrementManualProgress(prev);
      return next;
    });
  }, []);

  const clearCompletionSeen = useCallback(() => {
    setCompletionSeen(true);
  }, []);

  const stage = getManualStage(progress);
  const isComplete = progress >= 100;

  return {
    progress,
    stage,
    isComplete,
    onHonneSubmit,
    completionSeen,
    clearCompletionSeen,
  };
}

// ===== コンポーネント =====

interface ManualProgressCardProps {
  /** 完成度（0〜100）*/
  progress: number;
  /** アニメーション中か（本音送信直後に true） */
  isAnimating?: boolean;
  /** クリック/タップ時のコールバック（デバッグ・デモ用） */
  onTap?: () => void;
  className?: string;
}

export function ManualProgressCard({
  progress,
  isAnimating = false,
  onTap,
  className = "",
}: ManualProgressCardProps) {
  const { t } = useTranslation();
  const [displayProgress, setDisplayProgress] = useState(progress);
  const stage = getManualStage(displayProgress);

  // progress が変わったとき、アニメーションで表示値を追従させる
  useEffect(() => {
    if (displayProgress === progress) return;
    // 段階的に増やすアニメーション（約300ms で追従）
    const step = progress > displayProgress ? 1 : -1;
    const timer = setInterval(() => {
      setDisplayProgress((prev) => {
        const next = prev + step;
        if ((step > 0 && next >= progress) || (step < 0 && next <= progress)) {
          clearInterval(timer);
          return progress;
        }
        return next;
      });
    }, 15);
    return () => clearInterval(timer);
  }, [progress, displayProgress]);

  const isComplete = displayProgress >= 100;
  const barWidth = `${displayProgress}%`;

  return (
    <div
      className={`${className}`}
      onClick={onTap}
      onKeyDown={onTap ? (e) => e.key === "Enter" && onTap() : undefined}
      role={onTap ? "button" : undefined}
      tabIndex={onTap ? 0 : undefined}
      aria-label={t("gamification.manualAriaLabel", {
        progress: displayProgress,
      })}
      style={{
        borderRadius: 14,
        border: `2.5px solid ${stage.border}`,
        boxShadow: `0 3px 0 ${stage.border}`,
        background: stage.bg,
        padding: "12px 14px",
        cursor: onTap ? "pointer" : undefined,
        transform: isAnimating ? "scale(1.02)" : "scale(1)",
        transition:
          "transform 0.3s ease, border-color 0.4s ease, background 0.4s ease",
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: stage.color,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {t("gamification.manualTitle")}
        </div>
        <span aria-hidden="true" style={{ fontSize: 16 }}>
          {stage.emoji}
        </span>
      </div>

      {/* ゲージ */}
      <div
        style={{
          width: "100%",
          height: 12,
          background: "#E5E7EB",
          borderRadius: 9999,
          border: `2px solid #2B1E16`,
          overflow: "hidden",
          marginBottom: 8,
          position: "relative",
        }}
      >
        <div
          style={{
            width: barWidth,
            height: "100%",
            background: isComplete
              ? "linear-gradient(90deg, #F59E0B, #EF4444, #A855F7)"
              : stage.color,
            borderRadius: 9999,
            transition: "width 0.4s ease-out, background 0.4s ease",
          }}
        />
        {/* ストライプアニメーション（完成後） */}
        {isComplete && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(90deg, transparent 0%, transparent 20%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0.15) 40%)",
              animation: "manual-stripe 1.2s linear infinite",
            }}
          />
        )}
      </div>

      {/* パーセント & ステージラベル */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: stage.color,
            fontFamily: "Nunito, system-ui, sans-serif",
            letterSpacing: "-0.03em",
          }}
        >
          {displayProgress}%
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: stage.color,
          }}
        >
          {t(`gamification.manualStages.s${stage.threshold}.label`, {
            defaultValue: stage.label,
          })}
        </span>
      </div>

      {/* サブラベル */}
      <div
        style={{
          fontSize: 10,
          color: "#6B7280",
        }}
      >
        {t(`gamification.manualStages.s${stage.threshold}.sublabel`, {
          defaultValue: stage.sublabel,
        })}
      </div>

      {/* 完成時の特別メッセージ */}
      {isComplete && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: 8,
            padding: "6px 10px",
            borderRadius: 8,
            background: "#FEF3C7",
            border: "1.5px solid #D97706",
            fontSize: 10,
            fontWeight: 800,
            color: "#D97706",
            textAlign: "center",
          }}
        >
          {t("gamification.manualCompleteMessage")}
        </div>
      )}

      <style>{`
        @keyframes manual-stripe {
          0%   { background-position: 0 0; }
          100% { background-position: 40px 0; }
        }
      `}</style>
    </div>
  );
}

/** コンパクト版（インライン表示用） */
interface ManualProgressInlineProps {
  progress: number;
  className?: string;
}

export function ManualProgressInline({
  progress,
  className = "",
}: ManualProgressInlineProps) {
  const { t } = useTranslation();
  const stage = getManualStage(progress);

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      aria-label={t("gamification.manualInlineAriaLabel", { progress })}
    >
      <span aria-hidden="true" style={{ fontSize: 12 }}>
        {stage.emoji}
      </span>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "#E5E7EB",
          borderRadius: 9999,
          border: "1.5px solid #D1D5DB",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: stage.color,
            borderRadius: 9999,
            transition: "width 0.4s ease-out",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: stage.color,
          minWidth: 28,
          textAlign: "right",
        }}
      >
        {progress}%
      </span>
    </div>
  );
}

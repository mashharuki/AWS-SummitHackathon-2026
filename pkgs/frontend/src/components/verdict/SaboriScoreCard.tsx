/**
 * SaboriScoreCard — サボりスコア即時フィードバックカード（A〜E評価）
 *
 * 各タスクの「サボりやすさ」をA〜Eグレードで即時表示する。
 * A+ ジャックポット演出（金色エフェクト）を含む。
 *
 * Octalysis:
 *   7（予測不能・好奇心）: 毎回異なるグレードが何か期待させる
 *   2（達成感）: A評価を獲得することへの達成感
 */
import {
  type GradeInfo,
  SABORI_GRADES,
  type SaboriGrade,
} from "@/lib/gamificationUtils";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface SaboriScoreCardProps {
  grade: SaboriGrade;
  /** アニメーションをトリガーするか（新規判定結果が来たとき） */
  animate?: boolean;
  /** コンパクト表示（TaskCard等に組み込む場合） */
  compact?: boolean;
  className?: string;
}

export function SaboriScoreCard({
  grade,
  animate = false,
  compact = false,
  className = "",
}: SaboriScoreCardProps) {
  const { t } = useTranslation();
  const info: GradeInfo = SABORI_GRADES[grade];
  const [isVisible, setIsVisible] = useState(!animate);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (animate) {
      // 少し遅らせてスライドイン
      const t1 = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(t1);
    }
  }, [animate]);

  useEffect(() => {
    if (
      animate &&
      (info.intensity === "jackpot" || info.intensity === "high")
    ) {
      const t = setTimeout(() => setShowConfetti(true), 300);
      const t2 = setTimeout(() => setShowConfetti(false), 2000);
      return () => {
        clearTimeout(t);
        clearTimeout(t2);
      };
    }
  }, [animate, info.intensity]);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-extrabold ${className}`}
        style={{
          fontSize: 11,
          background: info.bg,
          color: info.color,
          padding: "2px 8px",
          borderRadius: 9999,
          border: `2px solid ${info.borderColor}`,
          boxShadow: `0 2px 0 ${info.borderColor}`,
        }}
      >
        <span aria-hidden="true">{info.emoji}</span>
        <span>{info.grade}</span>
      </span>
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      role="region"
      aria-label={t("gamification.gradeAriaLabel", {
        grade: info.grade,
        label: info.label,
      })}
      style={{
        borderRadius: 16,
        border: `3px solid ${info.borderColor}`,
        boxShadow: `0 5px 0 ${info.borderColor}`,
        background: info.bg,
        padding: "14px 16px",
        transition: "opacity 0.3s ease, transform 0.3s ease",
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      {/* コンフェッティ演出（A / A+） */}
      {showConfetti && info.intensity !== "none" && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: confetti decorative
              key={i}
              style={{
                position: "absolute",
                left: `${Math.random() * 100}%`,
                top: "-10px",
                fontSize: 14,
                animation: `sabori-confetti-fall ${0.8 + Math.random() * 0.8}s ease-in forwards`,
                animationDelay: `${Math.random() * 0.4}s`,
              }}
            >
              {["✨", "⭐", "🌟", "💫", "🎉"][i % 5]}
            </span>
          ))}
        </div>
      )}

      {/* グレードヘッダー */}
      <div className="flex items-center gap-2 mb-2">
        {/* グレードバッジ */}
        <div
          className="font-black flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: info.color,
            color: "#FFFFFF",
            fontSize: info.grade === "A+" ? 14 : 18,
            border: `2px solid ${info.borderColor}`,
            boxShadow: `0 2px 0 ${info.borderColor}`,
            animation:
              animate && info.intensity === "jackpot"
                ? "saboru-bounce 0.6s ease infinite alternate"
                : animate && info.intensity === "high"
                  ? "saboru-bounce 0.8s ease infinite alternate"
                  : undefined,
          }}
        >
          {info.grade}
        </div>

        <div className="flex-1">
          <div
            className="font-extrabold"
            style={{
              fontSize: 15,
              color: info.color,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            <span aria-hidden="true" style={{ marginRight: 4 }}>
              {info.emoji}
            </span>
            {t(`gamification.gradeLabels.${info.grade}.label`, {
              defaultValue: info.label,
            })}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#6B7280",
              marginTop: 2,
            }}
          >
            {t(`gamification.gradeLabels.${info.grade}.sublabel`, {
              defaultValue: info.sublabel,
            })}
          </div>
        </div>
      </div>

      {/* A+ 特別メッセージ */}
      {info.intensity === "jackpot" && (
        <div
          style={{
            marginTop: 8,
            padding: "6px 10px",
            background: "#FEF3C7",
            borderRadius: 8,
            border: "1.5px solid #F59E0B",
            fontSize: 11,
            color: "#92400E",
            fontWeight: 700,
          }}
        >
          {t("gamification.jackpotCardMessage")}
        </div>
      )}

      <style>{`
        @keyframes saboru-confetti-fall {
          0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(200px) rotate(360deg); opacity: 0; }
        }
        @keyframes saboru-bounce {
          0%   { transform: translateY(0) scale(1); }
          100% { transform: translateY(-4px) scale(1.05); }
        }
      `}</style>
    </div>
  );
}

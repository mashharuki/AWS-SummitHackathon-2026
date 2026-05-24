/**
 * DependencyScoreDisplay — AI依存度スコアの育成ゲーム表示コンポーネント（強化版）
 *
 * 「AI依存度: XX%」を称号付きでリアルタイム表示する。
 * スコアが上がるたびに shake + pulse + フラッシュアニメーションで
 * 「人をダメになっていく」感を演出する。
 *
 * スコア設計（0から上がる育成ゲーム型）:
 *   [0〜20]  "AI見習い"     → 水色
 *   [21〜40] "サボり常習者"  → 黄色
 *   [41〜60] "依存気味"     → オレンジ
 *   [61〜80] "AI奴隷"       → 赤紫
 *   [81〜100] "存在する怠惰" → 金色
 */
import { getTitleInfo } from "@/lib/gamificationUtils";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface DependencyScoreDisplayProps {
  /** AI依存度スコア（0〜100）*/
  score: number;
  /** スコアが増加した直後か（アニメーション用） */
  justIncremented?: boolean;
  /** 後方互換: 旧 justDecremented prop もサポート（deprecated） */
  justDecremented?: boolean;
  className?: string;
}

function getScoreEmoji(score: number): string {
  if (score >= 81) return "👑";
  if (score >= 61) return "🤖";
  if (score >= 41) return "😴";
  if (score >= 21) return "😅";
  return "🧠";
}

export function DependencyScoreDisplay({
  score,
  justIncremented = false,
  justDecremented = false,
  className = "",
}: DependencyScoreDisplayProps) {
  const { t } = useTranslation();
  const displayScore = Math.max(0, Math.round(score));
  const titleInfo = getTitleInfo(displayScore);
  const emoji = getScoreEmoji(displayScore);
  const isAnimating = justIncremented || justDecremented;
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    if (isAnimating) {
      setShowFlash(true);
      const timer = setTimeout(() => setShowFlash(false), 1400);
      return () => clearTimeout(timer);
    }
  }, [isAnimating, score]);

  const isUltimate = displayScore >= 81;

  return (
    <div
      className={`relative flex items-center gap-1.5 ${className}`}
      style={{
        animation: isAnimating
          ? "saboru-shake-pulse 0.6s ease-in-out"
          : isUltimate
            ? "saboru-pulse 2s ease-in-out infinite"
            : undefined,
      }}
    >
      {/* 称号解除フラッシュ */}
      {showFlash && (
        <span
          style={{
            position: "absolute",
            top: -22,
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            fontSize: 9,
            fontWeight: 800,
            color: titleInfo.color,
            background: titleInfo.bg,
            padding: "2px 6px",
            borderRadius: 4,
            border: `1.5px solid ${titleInfo.color}`,
            animation: "saboru-fade-up 1.4s ease-out forwards",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          {t("dependencyScore.flashText", "AI依存度UP！")}
        </span>
      )}

      {/* 称号バッジ（ヘッダー表示用コンパクト版） */}
      <span style={{ fontSize: 13 }}>{emoji}</span>
      <div className="flex flex-col items-end">
        {/* 称号名 */}
        <span
          style={{
            fontSize: 8,
            fontWeight: 800,
            color: titleInfo.color,
            fontFamily: "Nunito, 'Noto Sans JP', system-ui, sans-serif",
            letterSpacing: "-0.01em",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {titleInfo.title}
        </span>
        <div className="flex items-center gap-1">
          {/* プログレスバー（AI依存度が右に伸びる） */}
          <div
            style={{
              width: 48,
              height: 5,
              background: "#E5E7EB",
              borderRadius: 9999,
              border: "1.5px solid #2B1E16",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${displayScore}%`,
                height: "100%",
                background: isUltimate
                  ? "linear-gradient(90deg, #F59E0B, #EF4444)"
                  : titleInfo.color,
                borderRadius: 9999,
                transition: "width 0.4s ease-out, background 0.3s",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: titleInfo.color,
              fontFamily: "Nunito, 'Noto Sans JP', system-ui, sans-serif",
              minWidth: 28,
              textAlign: "right",
            }}
          >
            {displayScore}%
          </span>
        </div>
      </div>

      <style>{`
        @keyframes saboru-shake-pulse {
          0%  { transform: translateX(0) scale(1); }
          15% { transform: translateX(-4px) scale(1.08); }
          30% { transform: translateX(4px) scale(0.95); }
          45% { transform: translateX(-3px) scale(1.05); }
          60% { transform: translateX(3px) scale(0.98); }
          75% { transform: translateX(-1px) scale(1.02); }
          100% { transform: translateX(0) scale(1); }
        }
        @keyframes saboru-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes saboru-fade-up {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          60%  { opacity: 1; transform: translateX(-50%) translateY(-6px); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-12px); }
        }
      `}</style>
    </div>
  );
}

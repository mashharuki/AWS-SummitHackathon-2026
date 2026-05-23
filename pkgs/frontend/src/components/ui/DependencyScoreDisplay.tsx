/**
 * DependencyScoreDisplay — AI依存度スコアの表示コンポーネント（強化版）
 *
 * 「自己判断力: 残り XX%」をリアルタイムで表示する。
 * スコアが下がるたびに shake + pulse + フラッシュアニメーションで
 * 「人をダメにしている」感を演出する。
 *
 * カラーロジック:
 *   80%以上 → 緑（安心）
 *   60-79%  → 黄（注意）
 *   40-59%  → オレンジ（危険）
 *   39%以下 → 赤（末期）
 */
import { useEffect, useState } from "react";

interface DependencyScoreDisplayProps {
  score: number;
  justDecremented: boolean;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#10B981";
  if (score >= 60) return "#F59E0B";
  if (score >= 40) return "#F97316";
  return "#EF4444";
}

function getScoreEmoji(score: number): string {
  if (score >= 80) return "🧠";
  if (score >= 60) return "😅";
  if (score >= 40) return "😰";
  return "🫠";
}

function getStatusLabel(score: number): string {
  if (score >= 80) return "自己判断力";
  if (score >= 60) return "依存が始まっています";
  if (score >= 40) return "AIに支配されています";
  return "判断力を失っています";
}

export function DependencyScoreDisplay({
  score,
  justDecremented,
  className = "",
}: DependencyScoreDisplayProps) {
  const displayScore = Math.max(0, Math.round(score));
  const color = getScoreColor(displayScore);
  const emoji = getScoreEmoji(displayScore);
  const fillPct = displayScore;
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    if (justDecremented) {
      setShowFlash(true);
      const t = setTimeout(() => setShowFlash(false), 1400);
      return () => clearTimeout(t);
    }
  }, [justDecremented, score]);

  const isCritical = displayScore < 40;

  return (
    <div
      className={`relative flex items-center gap-1.5 ${className}`}
      style={{
        animation: justDecremented
          ? "saboru-shake-pulse 0.6s ease-in-out"
          : isCritical
            ? "saboru-pulse 2s ease-in-out infinite"
            : undefined,
      }}
    >
      {/* 判断を手放しました フラッシュ */}
      {showFlash && (
        <span
          style={{
            position: "absolute",
            top: -20,
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            fontSize: 9,
            fontWeight: 800,
            color: "#EF4444",
            background: "#FEF2F2",
            padding: "2px 6px",
            borderRadius: 4,
            border: "1.5px solid #EF4444",
            animation: "saboru-fade-up 1.4s ease-out forwards",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          判断を手放しました
        </span>
      )}
      <span style={{ fontSize: 13 }}>{emoji}</span>
      <div className="flex flex-col items-end">
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            color,
            fontFamily: "Nunito, 'Noto Sans JP', system-ui, sans-serif",
            letterSpacing: "-0.01em",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {getStatusLabel(displayScore)}
        </span>
        <div className="flex items-center gap-1">
          {/* プログレスバー（逆向き：右から減る） */}
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
                width: `${fillPct}%`,
                height: "100%",
                background: color,
                borderRadius: 9999,
                transition: "width 0.4s ease-out, background 0.3s",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              color,
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

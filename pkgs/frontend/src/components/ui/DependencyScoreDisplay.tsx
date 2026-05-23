/**
 * DependencyScoreDisplay — AI依存度スコアの表示コンポーネント
 *
 * 「自己判断力: 残り XX%」をリアルタイムで表示する。
 * スコアが下がるたびにシェイクアニメーションで「ダメになっている感」を演出。
 *
 * カラーロジック:
 *   80%以上 → 緑（安心）
 *   60-79%  → 黄（注意）
 *   40-59%  → オレンジ（危険）
 *   39%以下 → 赤（末期）
 */
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

export function DependencyScoreDisplay({
  score,
  justDecremented,
  className = "",
}: DependencyScoreDisplayProps) {
  const displayScore = Math.max(0, Math.round(score));
  const color = getScoreColor(displayScore);
  const emoji = getScoreEmoji(displayScore);
  const fillPct = displayScore;

  return (
    <div
      className={`flex items-center gap-1.5 ${className}`}
      style={{
        animation: justDecremented
          ? "saboru-shake 0.5s ease-in-out"
          : undefined,
      }}
    >
      <span style={{ fontSize: 13 }}>{emoji}</span>
      <div className="flex flex-col items-end">
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color,
            fontFamily: "Nunito, 'Noto Sans JP', system-ui, sans-serif",
            letterSpacing: "-0.01em",
            lineHeight: 1,
          }}
        >
          自己判断力
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
        @keyframes saboru-shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-3px); }
          40%       { transform: translateX(3px); }
          60%       { transform: translateX(-2px); }
          80%       { transform: translateX(2px); }
        }
      `}</style>
    </div>
  );
}

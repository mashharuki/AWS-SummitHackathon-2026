import { useEffect, useState } from "react";

interface DeferralCountdownProps {
  nextCheckAt: string;
  onRecheck: () => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "再判定のタイミングです";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}時間${m}分後に再判定`;
  if (m > 0) return `${m}分${s}秒後に再判定`;
  return `${s}秒後に再判定`;
}

/**
 * DeferralCountdown — 「時間軸付き先延ばし」の可視化コンポーネント
 *
 * 競合との決定的差別化要素:
 * PrioritAI等は「やる/消す」の2値判定だが、SABOROUは「X分後に再判定」という
 * 時間軸付き延期を提供する唯一のサービス。この優位性を明示する。
 */
export function DeferralCountdown({
  nextCheckAt,
  onRecheck,
}: DeferralCountdownProps) {
  const [remaining, setRemaining] = useState<number>(
    () => new Date(nextCheckAt).getTime() - Date.now(),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(new Date(nextCheckAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [nextCheckAt]);

  const isDue = remaining <= 0;

  return (
    <div
      className="card-brutal p-3 flex items-center gap-3"
      style={{ background: isDue ? "#ECFDF5" : "#FFF7ED" }}
    >
      <span style={{ fontSize: 20 }}>{isDue ? "🔔" : "⏰"}</span>
      <div className="flex-1 min-w-0">
        <p
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: isDue ? "#059669" : "#92400E",
            lineHeight: 1.3,
          }}
        >
          {formatCountdown(remaining)}
        </p>
        <p
          className="mt-0.5 truncate"
          style={{ fontSize: 9, color: isDue ? "#10B981" : "#D97706" }}
        >
          {isDue
            ? "AIが改めてサボれるかを判定します"
            : "永久に先延ばしにはなりません — SABOROUが見届けます"}
        </p>
      </div>
      {isDue && (
        <button
          type="button"
          onClick={onRecheck}
          className="btn-brutal flex-shrink-0"
          style={{
            fontSize: 11,
            fontWeight: 800,
            padding: "6px 14px",
            background: "#10B981",
            color: "#fff",
            border: "2px solid #2B1E16",
            borderRadius: 8,
            boxShadow: "0 3px 0 #2B1E16",
            cursor: "pointer",
          }}
        >
          再判定する
        </button>
      )}
    </div>
  );
}

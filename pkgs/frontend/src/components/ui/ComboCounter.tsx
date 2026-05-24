/**
 * ComboCounter — サボりコンボカウンター
 *
 * 連続して高評価のサボりを実行するとコンボが積み上がる。
 * 画面上部に常時表示することで「コンボを切らしたくない」動機付けを提供。
 *
 * Octalysis:
 *   8（損失回避）: コンボが途切れることへの恐れ
 *   7（予測不能）: 次のサボりでコンボが続くかどうか
 */
import { useTranslation } from "react-i18next";
import type { ComboState } from "@/lib/gamificationUtils";

interface ComboCounterProps {
  combo: ComboState;
  className?: string;
}

export function ComboCounter({ combo, className = "" }: ComboCounterProps) {
  const { t } = useTranslation();
  if (!combo.isActive || combo.count === 0) return null;

  const label =
    combo.count >= 5
      ? t("gamification.comboLabel5")
      : combo.count >= 3
        ? t("gamification.comboLabel3")
        : combo.count >= 2
          ? t("gamification.comboLabel2")
          : null;
  const isHighCombo = combo.count >= 3;
  const isMegaCombo = combo.count >= 5;

  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      role="status"
      aria-label={t("gamification.comboAriaLabel", { count: combo.count })}
      style={{
        animation: isHighCombo
          ? "combo-pulse 1s ease-in-out infinite"
          : undefined,
      }}
    >
      {/* 炎アイコン（コンボ数に応じて増える） */}
      <span
        style={{
          fontSize: 12,
          letterSpacing: -2,
        }}
        aria-hidden="true"
      >
        {combo.count >= 5 ? "🔥🔥🔥" : combo.count >= 3 ? "🔥🔥" : "🔥"}
      </span>

      {/* コンボカウント */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 900,
          color: isMegaCombo ? "#EF4444" : isHighCombo ? "#F97316" : "#F59E0B",
          fontFamily: "Nunito, system-ui, sans-serif",
          letterSpacing: "-0.02em",
        }}
      >
        x{combo.count}
      </span>

      {/* コンボラベル */}
      {label && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: isMegaCombo ? "#EF4444" : "#F97316",
            background: isMegaCombo ? "#FEF2F2" : "#FFF7ED",
            padding: "1px 5px",
            borderRadius: 4,
            border: `1px solid ${isMegaCombo ? "#EF4444" : "#F97316"}`,
          }}
        >
          {label}
        </span>
      )}

      <style>{`
        @keyframes combo-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

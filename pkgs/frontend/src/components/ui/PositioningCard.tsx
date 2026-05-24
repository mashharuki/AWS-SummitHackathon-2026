/**
 * PositioningCard — 競合対比ポジショニングUI（Tier 3 施策7）
 *
 * 「なぜSABOROUは違うのか」を即座に視覚化し、
 * 審査員・ユーザーに差別化を体感させる。
 *
 * Octalysis:
 *   1（意味・使命感）: 「人をダメにする」唯一のサービスという誇り
 *   5（ソーシャル）: 「普通と違う」ことへの優越感
 */
import { useTranslation } from "react-i18next";

// ===== 比較データ定義（emojyのみ保持、ラベルはi18nで管理）=====

const COMPETITOR_EMOJIS = ["📋", "⏰", "💪"] as const;
const COMPETITOR_KEYS = ["doAll", "deadline", "work"] as const;

const FEATURE_EMOJIS = ["🦥", "📈", "🤍"] as const;
const FEATURE_COLORS = ["#10B981", "#A855F7", "#F97316"] as const;
const FEATURE_KEYS = ["reasons", "proud", "affirm"] as const;

// ===== コンポーネント =====

interface PositioningCardProps {
  className?: string;
}

export function PositioningCard({ className = "" }: PositioningCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={className}
      style={{
        borderRadius: 16,
        border: "2.5px solid #2B1E16",
        boxShadow: "0 4px 0 #2B1E16",
        background: "#FFFAF5",
        padding: "16px",
        fontFamily: "Nunito, 'Noto Sans JP', system-ui, sans-serif",
      }}
      aria-label={t("gamification.positioningTitle")}
    >
      {/* ヘッダー */}
      <h3
        style={{
          fontSize: 12,
          fontWeight: 900,
          color: "#9CA3AF",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 12,
        }}
      >
        {t("gamification.positioningTitle")}
      </h3>

      {/* 比較セクション */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* 普通のタスク管理ツール */}
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "#F9FAFB",
            border: "2px solid #E5E7EB",
          }}
          aria-label={t("gamification.regularToolLabel")}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#9CA3AF",
              marginBottom: 6,
              textDecoration: "line-through",
            }}
          >
            {t("gamification.regularToolLabel")}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {COMPETITOR_KEYS.map((key, i) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: "#F3F4F6",
                  border: "1.5px solid #D1D5DB",
                  opacity: 0.6,
                }}
                aria-label={t(`gamification.competitors.${key}`)}
              >
                <span aria-hidden="true" style={{ fontSize: 13 }}>
                  {COMPETITOR_EMOJIS[i]}
                </span>
                <span
                  style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}
                >
                  {t(`gamification.competitors.${key}`)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* VS ラベル */}
        <div
          style={{
            textAlign: "center",
            fontSize: 14,
            fontWeight: 900,
            color: "#2B1E16",
            letterSpacing: "0.05em",
          }}
          aria-hidden="true"
        >
          vs
        </div>

        {/* SABOROU */}
        <div
          style={{
            padding: "12px",
            borderRadius: 10,
            background: "linear-gradient(135deg, #FFF7ED 0%, #FFFBEB 100%)",
            border: "2.5px solid #F97316",
            boxShadow: "0 3px 0 #F97316",
          }}
          aria-label={t("gamification.saborouServiceLabel")}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: "#F97316",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span aria-hidden="true">🦥</span>
            {t("gamification.saborouServiceLabel")}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FEATURE_KEYS.map((key, i) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: "#FFFFFF",
                  border: `1.5px solid ${FEATURE_COLORS[i]}`,
                  boxShadow: `0 2px 0 ${FEATURE_COLORS[i]}`,
                }}
                aria-label={t(`gamification.features.${key}`)}
              >
                <span aria-hidden="true" style={{ fontSize: 13 }}>
                  {FEATURE_EMOJIS[i]}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: FEATURE_COLORS[i],
                  }}
                >
                  {t(`gamification.features.${key}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* キャッチコピー */}
      <div
        style={{
          marginTop: 12,
          padding: "10px 12px",
          borderRadius: 10,
          background: "#2B1E16",
          textAlign: "center",
        }}
        aria-label={t("gamification.positioningCatchphrase")}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: "#FEF3C7",
            margin: 0,
            letterSpacing: "-0.01em",
            lineHeight: 1.5,
          }}
        >
          {t("gamification.positioningCatchphrase")}
        </p>
        <p
          style={{
            fontSize: 10,
            color: "#9CA3AF",
            margin: "4px 0 0",
            fontStyle: "italic",
          }}
        >
          {t("gamification.positioningSubtitle")}
        </p>
      </div>
    </div>
  );
}

// ===== コンパクト版（ヘッダー省略） =====

export function PositioningBanner({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div
      className={className}
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        border: "2px solid #2B1E16",
        boxShadow: "0 3px 0 #2B1E16",
        background: "#2B1E16",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "Nunito, 'Noto Sans JP', system-ui, sans-serif",
      }}
      role="banner"
      aria-label={t("gamification.positioningCatchphrase")}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }} aria-hidden="true">
        🦥
      </span>
      <div>
        <p
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: "#FEF3C7",
            margin: 0,
          }}
        >
          {t("gamification.positioningCatchphrase")}
        </p>
        <p style={{ fontSize: 10, color: "#9CA3AF", margin: "2px 0 0" }}>
          {t("gamification.positioningBannerSub")}
        </p>
      </div>
    </div>
  );
}

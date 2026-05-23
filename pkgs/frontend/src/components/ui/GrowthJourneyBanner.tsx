/**
 * GrowthJourneyBanner — AI依存度フェーズ移行バナー（成長ジャーニー）
 *
 * 称号が解除されたとき（フェーズが移行したとき）に全画面オーバーレイを表示する。
 * 「ステージクリア！」ではなく「あなたはより深くダメになりました」という逆説的演出。
 *
 * Octalysis:
 *   2（達成・進歩）: 新しい段階への到達感
 *   3（創造・フィードバック）: 予期しない結果への驚き
 */
import { type TitleInfo, getTitleInfo } from "@/lib/gamificationUtils";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface GrowthJourneyBannerProps {
  /** 解除された称号情報（null なら非表示） */
  titleInfo: TitleInfo | null;
  /** バナーを閉じたときのコールバック */
  onClose: () => void;
}

export function GrowthJourneyBanner({
  titleInfo,
  onClose,
}: GrowthJourneyBannerProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (titleInfo) {
      setVisible(true);
      // 5秒後に自動クローズ
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300); // フェードアウト後にコールバック
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [titleInfo, onClose]);

  if (!titleInfo) return null;

  const phaseKey = titleInfo.titleKey as
    | "habitual"
    | "dependent"
    | "slave"
    | "ultimate";
  const phaseMsg = t(`gamification.phaseMessages.${phaseKey}`, {
    returnObjects: true,
  }) as { headline: string; body: string } | string;
  const messages =
    typeof phaseMsg === "object"
      ? phaseMsg
      : {
          headline: `${titleInfo.title} になりました`,
          body: titleInfo.description,
        };

  return (
    <div
      aria-live="assertive"
      role="alert"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        transition: "opacity 0.3s ease",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
      onClick={() => {
        setVisible(false);
        setTimeout(onClose, 300);
      }}
    >
      <div
        style={{
          maxWidth: 320,
          width: "90%",
          padding: "28px 24px",
          borderRadius: 24,
          border: `4px solid ${titleInfo.color}`,
          boxShadow: `0 8px 0 ${titleInfo.color}, 0 0 60px ${titleInfo.color}44`,
          background: titleInfo.bg,
          textAlign: "center",
          animation:
            "gj-pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 称号アイコン */}
        <div
          style={{
            fontSize: 48,
            marginBottom: 12,
            animation: "gj-spin 3s linear infinite",
          }}
        >
          {titleInfo.titleKey === "ultimate"
            ? "👑"
            : titleInfo.titleKey === "slave"
              ? "🤖"
              : titleInfo.titleKey === "dependent"
                ? "😴"
                : "🏅"}
        </div>

        {/* 称号バッジ */}
        <div
          style={{
            display: "inline-block",
            padding: "4px 16px",
            borderRadius: 9999,
            border: `2px solid ${titleInfo.color}`,
            background: titleInfo.color,
            color: "#FFFFFF",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: "0.05em",
            marginBottom: 12,
          }}
        >
          {t("gamification.titleUnlocked")}
        </div>

        {/* 称号名 */}
        <h2
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: titleInfo.color,
            fontFamily: "Nunito, 'Noto Sans JP', system-ui, sans-serif",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            marginBottom: 8,
          }}
        >
          「{titleInfo.title}」
        </h2>

        {/* ヘッドライン */}
        <p
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#1F2937",
            marginBottom: 8,
          }}
        >
          {messages.headline}
        </p>

        {/* ボディ */}
        <p
          style={{
            fontSize: 12,
            color: "#6B7280",
            lineHeight: 1.6,
            whiteSpace: "pre-line",
          }}
        >
          {messages.body}
        </p>

        {/* タップで閉じる案内 */}
        <p
          style={{
            fontSize: 10,
            color: "#9CA3AF",
            marginTop: 16,
          }}
        >
          {t("gamification.tapToContinue")}
        </p>
      </div>

      <style>{`
        @keyframes gj-pop-in {
          0%   { transform: scale(0.7) translateY(20px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes gj-spin {
          0%   { transform: rotate(-5deg); }
          50%  { transform: rotate(5deg); }
          100% { transform: rotate(-5deg); }
        }
      `}</style>
    </div>
  );
}

// ===== 称号詳細表示カード（TaskDetailPage に埋め込む小型版）=====

interface TitleDisplayCardProps {
  dependencyScore: number;
  className?: string;
}

export function TitleDisplayCard({
  dependencyScore,
  className = "",
}: TitleDisplayCardProps) {
  const { t } = useTranslation();
  const titleInfo = getTitleInfo(dependencyScore);
  const [min, max] = titleInfo.range;
  const progress =
    max === min
      ? 100
      : Math.round(((dependencyScore - min) / (max - min)) * 100);
  const nextTitle = (() => {
    const TITLE_KEYS = [
      "beginner",
      "habitual",
      "dependent",
      "slave",
      "ultimate",
    ] as const;
    const idx = TITLE_KEYS.indexOf(
      titleInfo.titleKey as (typeof TITLE_KEYS)[number],
    );
    if (idx === -1 || idx >= TITLE_KEYS.length - 1) return null;
    const nextKey = TITLE_KEYS[idx + 1];
    return t(`gamification.titleNames.${nextKey}`, nextKey);
  })();

  return (
    <div
      className={`${className}`}
      style={{
        borderRadius: 16,
        border: `3px solid ${titleInfo.color}`,
        boxShadow: `0 4px 0 ${titleInfo.color}`,
        background: titleInfo.bg,
        padding: "12px 14px",
      }}
    >
      {/* 称号名 & スコア */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: titleInfo.color,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {t("gamification.currentTitle")}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 900,
              color: titleInfo.color,
              fontFamily: "Nunito, 'Noto Sans JP', system-ui, sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            「{titleInfo.title}」
          </div>
        </div>
        <div
          style={{
            textAlign: "right",
            fontSize: 24,
            fontWeight: 900,
            color: titleInfo.color,
            fontFamily: "Nunito, system-ui, sans-serif",
          }}
        >
          {dependencyScore}%
        </div>
      </div>

      {/* プログレスバー */}
      <div
        style={{
          width: "100%",
          height: 8,
          background: "#E5E7EB",
          borderRadius: 9999,
          border: "1.5px solid #2B1E16",
          overflow: "hidden",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: titleInfo.color,
            borderRadius: 9999,
            transition: "width 0.6s ease-out",
          }}
        />
      </div>

      {/* 次の称号まで */}
      {nextTitle && (
        <div style={{ fontSize: 10, color: "#6B7280" }}>
          {t("gamification.nextTitleProgress", {
            title: nextTitle,
            remaining: max - dependencyScore,
          })}
        </div>
      )}
      {!nextTitle && (
        <div style={{ fontSize: 10, color: titleInfo.color, fontWeight: 700 }}>
          {t("gamification.maxTitleReached")}
        </div>
      )}

      {/* 説明 */}
      <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>
        {titleInfo.description}
      </div>
    </div>
  );
}

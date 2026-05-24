/**
 * JackpotOverlay — A+ ジャックポット全画面演出
 *
 * 「完全なるサボり！」レア判定（約5%）が発生したとき、
 * 全画面金色エフェクト + コンフェッティでユーザーを驚かせる。
 *
 * Octalysis:
 *   7（予測不能）: レア判定への興奮
 *   6（希少性）: 全判定の約5%しか出ない特別感
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface JackpotOverlayProps {
  isActive: boolean;
  onClose: () => void;
}

export function JackpotOverlay({ isActive, onClose }: JackpotOverlayProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isActive) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isActive, onClose]);

  if (!isActive && !visible) return null;

  return (
    <div
      aria-live="assertive"
      role="alert"
      aria-label={t("gamification.jackpotAriaLabel")}
      tabIndex={0}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(251, 191, 36, 0.15)",
        backdropFilter: "blur(2px)",
        transition: "opacity 0.3s ease",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
      onClick={() => {
        setVisible(false);
        setTimeout(onClose, 300);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          setVisible(false);
          setTimeout(onClose, 300);
        }
      }}
    >
      {/* コンフェッティ */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        {Array.from({ length: 30 }).map((_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: confetti decorative
            key={i}
            style={{
              position: "absolute",
              left: `${Math.random() * 100}%`,
              top: "-20px",
              fontSize: 18,
              animation: `jp-fall ${1 + Math.random() * 1.5}s ease-in forwards`,
              animationDelay: `${Math.random() * 0.6}s`,
            }}
          >
            {["✨", "⭐", "🌟", "💫", "🎉", "🏆", "👑"][i % 7]}
          </span>
        ))}
      </div>

      {/* メインカード */}
      <div
        style={{
          maxWidth: 300,
          width: "88%",
          padding: "32px 24px",
          borderRadius: 24,
          border: "4px solid #F59E0B",
          boxShadow: "0 8px 0 #D97706, 0 0 80px #F59E0B66",
          background:
            "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 50%, #FDE68A 100%)",
          textAlign: "center",
          animation:
            "jp-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
        }}
      >
        {/* トロフィー */}
        <div
          style={{
            fontSize: 56,
            marginBottom: 8,
            animation: "jp-trophy 1s ease-in-out infinite alternate",
          }}
        >
          🏆
        </div>

        {/* グレードバッジ */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 20px",
            borderRadius: 9999,
            background: "#F59E0B",
            color: "#FFFFFF",
            fontSize: 22,
            fontWeight: 900,
            border: "2px solid #D97706",
            boxShadow: "0 3px 0 #D97706",
            marginBottom: 12,
          }}
        >
          A+
        </div>

        <h2
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: "#92400E",
            fontFamily: "Nunito, 'Noto Sans JP', system-ui, sans-serif",
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          {t("gamification.jackpotTitle")}
        </h2>

        <p
          style={{
            fontSize: 12,
            color: "#B45309",
            lineHeight: 1.6,
          }}
        >
          {t("gamification.jackpotRarity")}
          <br />
          <strong>{t("gamification.jackpotBody")}</strong>
        </p>

        <p style={{ fontSize: 10, color: "#D97706", marginTop: 16 }}>
          {t("gamification.tapToContinue")}
        </p>
      </div>

      <style>{`
        @keyframes jp-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes jp-pop {
          0%   { transform: scale(0.5) rotate(-5deg); opacity: 0; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes jp-trophy {
          0%   { transform: scale(1) rotate(-3deg); }
          100% { transform: scale(1.1) rotate(3deg); }
        }
      `}</style>
    </div>
  );
}

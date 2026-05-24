/**
 * AchievementBadge — サボり実績・称号バッジ
 *
 * 実績アンロック時にポップアップ通知を表示し、
 * 実績一覧画面でコレクションとして表示する。
 *
 * Octalysis:
 *   2（達成・進歩）: コレクション完成への進歩感
 *   4（所有権）: 自分だけの実績バッジへの愛着
 *   6（希少性）: LEGENDARY 実績の限定感
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type Achievement,
  type AchievementCheckParams,
  ACHIEVEMENTS,
  type UnlockedAchievement,
  RARITY_STYLES,
  checkNewAchievements,
  loadUnlockedAchievements,
  unlockAchievement,
} from "@/lib/achievementSystem";

// ===== 実績アンロック通知（トースト風） =====

interface AchievementToastProps {
  achievement: Achievement;
  onClose: () => void;
}

export function AchievementToast({
  achievement,
  onClose,
}: AchievementToastProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const styles = RARITY_STYLES[achievement.rarity];

  useEffect(() => {
    // マウント後にフェードイン
    const fadeIn = requestAnimationFrame(() => setVisible(true));
    // 3.5秒後に自動クローズ
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 350);
    }, 3500);
    return () => {
      cancelAnimationFrame(fadeIn);
      clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-label={`${t("gamification.achievementUnlocked")}: ${achievement.title}`}
      onClick={() => {
        setVisible(false);
        setTimeout(onClose, 350);
      }}
      style={{
        position: "fixed",
        bottom: 80, // BottomNavの上
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? "0" : "20px"})`,
        opacity: visible ? 1 : 0,
        transition:
          "opacity 0.35s ease, transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        zIndex: 9000,
        width: "min(320px, 90vw)",
        padding: "12px 14px",
        borderRadius: 14,
        border: `2.5px solid ${styles.border}`,
        boxShadow: `0 6px 0 ${styles.border}, 0 0 30px ${styles.color}44`,
        background: styles.bg,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* 絵文字アイコン */}
        <div
          style={{
            fontSize: 28,
            flexShrink: 0,
            animation:
              "ach-bounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
          }}
          aria-hidden="true"
        >
          {achievement.emoji}
        </div>

        {/* テキスト */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginBottom: 2,
            }}
          >
            {/* レアリティラベル */}
            <span
              style={{
                fontSize: 8,
                fontWeight: 900,
                color: "#FFFFFF",
                background: styles.color,
                padding: "1px 5px",
                borderRadius: 4,
                letterSpacing: "0.05em",
              }}
            >
              {RARITY_STYLES[achievement.rarity].label}
            </span>
            <span style={{ fontSize: 8, color: "#9CA3AF" }}>
              {t("gamification.achievementUnlocked")}
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: styles.color,
              fontFamily: "Nunito, 'Noto Sans JP', system-ui, sans-serif",
              letterSpacing: "-0.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {achievement.title}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "#6B7280",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {achievement.description}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ach-bounce {
          0%   { transform: scale(0.5) rotate(-10deg); }
          60%  { transform: scale(1.15) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}

// ===== 実績バッジ（コレクション表示用） =====

interface AchievementBadgeProps {
  achievement: Achievement;
  /** アンロック済みかどうか */
  unlocked: boolean;
  /** アンロック日時（表示用） */
  unlockedAt?: string;
  /** 詳細表示（ホバー/タップで展開） */
  showDetail?: boolean;
  className?: string;
}

export function AchievementBadge({
  achievement,
  unlocked,
  unlockedAt,
  showDetail = false,
  className = "",
}: AchievementBadgeProps) {
  const { t } = useTranslation();
  const styles = RARITY_STYLES[achievement.rarity];
  const [expanded, setExpanded] = useState(showDetail);

  const formattedDate = unlockedAt
    ? new Date(unlockedAt).toLocaleDateString("ja-JP", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      className={`${className}`}
      onClick={() => setExpanded((e) => !e)}
      onKeyDown={(e) => e.key === "Enter" && setExpanded((prev) => !prev)}
      role="button"
      tabIndex={0}
      aria-label={`${achievement.title} (${unlocked ? t("gamification.achievementUnlockedStatus") : t("gamification.achievementLockedStatus")})`}
      aria-expanded={expanded}
      style={{
        borderRadius: 12,
        border: `2px solid ${unlocked ? styles.border : "#D1D5DB"}`,
        boxShadow: unlocked ? `0 3px 0 ${styles.border}` : "0 2px 0 #D1D5DB",
        background: unlocked ? styles.bg : "#F9FAFB",
        padding: "10px 12px",
        opacity: unlocked ? 1 : 0.5,
        cursor: "pointer",
        transition: "opacity 0.3s ease, border-color 0.3s ease",
        filter: unlocked ? "none" : "grayscale(0.8)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* 絵文字 */}
        <span style={{ fontSize: 22, flexShrink: 0 }} aria-hidden="true">
          {unlocked ? achievement.emoji : "🔒"}
        </span>

        {/* テキスト */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                fontSize: 8,
                fontWeight: 900,
                color: unlocked ? "#FFFFFF" : "#9CA3AF",
                background: unlocked ? styles.color : "#D1D5DB",
                padding: "1px 4px",
                borderRadius: 3,
                letterSpacing: "0.04em",
              }}
            >
              {RARITY_STYLES[achievement.rarity].label}
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: unlocked ? styles.color : "#6B7280",
              fontFamily: "Nunito, 'Noto Sans JP', system-ui, sans-serif",
            }}
          >
            {unlocked ? achievement.title : "???"}
          </div>
          {unlocked && formattedDate && (
            <div style={{ fontSize: 9, color: "#9CA3AF" }}>
              {t("gamification.achievementUnlockedAt", { date: formattedDate })}
            </div>
          )}
        </div>
      </div>

      {/* 展開詳細 */}
      {expanded && unlocked && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: `1.5px solid ${styles.border}`,
          }}
        >
          <p style={{ fontSize: 11, color: "#374151", marginBottom: 4 }}>
            {achievement.description}
          </p>
          <p style={{ fontSize: 9, color: "#9CA3AF" }}>
            {t("gamification.achievementConditionLabel")}{" "}
            {achievement.condition}
          </p>
        </div>
      )}
    </div>
  );
}

// ===== 実績コレクション一覧 =====

interface AchievementCollectionProps {
  unlockedAchievements: UnlockedAchievement[];
  className?: string;
}

export function AchievementCollection({
  unlockedAchievements,
  className = "",
}: AchievementCollectionProps) {
  const { t } = useTranslation();
  const unlockedIds = new Set(unlockedAchievements.map((a) => a.id));
  const allAchievements = Object.values(ACHIEVEMENTS);
  const unlockedCount = unlockedAchievements.length;
  const totalCount = allAchievements.length;

  // カテゴリごとにグループ化
  const categories: Array<{
    key: Achievement["category"];
    label: string;
    emoji: string;
  }> = [
    {
      key: "first",
      label: t("gamification.achievementCategories.first"),
      emoji: "🎉",
    },
    {
      key: "streak",
      label: t("gamification.achievementCategories.streak"),
      emoji: "🔥",
    },
    {
      key: "time",
      label: t("gamification.achievementCategories.time"),
      emoji: "🌙",
    },
    {
      key: "dependency",
      label: t("gamification.achievementCategories.dependency"),
      emoji: "🤖",
    },
    {
      key: "combo",
      label: t("gamification.achievementCategories.combo"),
      emoji: "👑",
    },
    {
      key: "manual",
      label: t("gamification.achievementCategories.manual"),
      emoji: "📖",
    },
  ];

  return (
    <div className={className}>
      {/* 進捗サマリ */}
      <div
        style={{
          marginBottom: 16,
          padding: "10px 14px",
          borderRadius: 12,
          border: "2.5px solid #2B1E16",
          boxShadow: "0 3px 0 #2B1E16",
          background: "#FFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: "#1F2937",
            }}
          >
            {t("gamification.achievementCollectionTitle")}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: "#F59E0B",
              fontFamily: "Nunito, system-ui, sans-serif",
            }}
          >
            {unlockedCount}/{totalCount}
          </span>
        </div>
        <div
          style={{
            width: "100%",
            height: 8,
            background: "#E5E7EB",
            borderRadius: 9999,
            border: "1.5px solid #2B1E16",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.round((unlockedCount / totalCount) * 100)}%`,
              height: "100%",
              background: "#F59E0B",
              borderRadius: 9999,
              transition: "width 0.6s ease-out",
            }}
          />
        </div>
      </div>

      {/* カテゴリ別リスト */}
      {categories.map((cat) => {
        const catAchievements = allAchievements.filter(
          (a) => a.category === cat.key,
        );
        if (catAchievements.length === 0) return null;

        return (
          <div key={cat.key} style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#6B7280",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span aria-hidden="true">{cat.emoji}</span>
              {cat.label}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {catAchievements.map((ach) => {
                const unlockedEntry = unlockedAchievements.find(
                  (u) => u.id === ach.id,
                );
                return (
                  <AchievementBadge
                    key={ach.id}
                    achievement={ach}
                    unlocked={unlockedIds.has(ach.id)}
                    unlockedAt={unlockedEntry?.unlockedAt}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===== useAchievements カスタムフック =====

export interface UseAchievementsReturn {
  unlockedAchievements: UnlockedAchievement[];
  /** キュー内の次の通知（1件ずつ表示） */
  pendingToast: Achievement | null;
  /** 通知を閉じる */
  dismissToast: () => void;
  /**
   * パラメータを受け取って新しい実績をチェック・アンロックする
   */
  checkAndUnlock: (params: AchievementCheckParams) => void;
}

export function useAchievements(): UseAchievementsReturn {
  const [unlockedAchievements, setUnlockedAchievements] = useState<
    UnlockedAchievement[]
  >(() => loadUnlockedAchievements());
  const [toastQueue, setToastQueue] = useState<Achievement[]>([]);
  const pendingToast = toastQueue[0] ?? null;

  // ストレージ変更を反映（別タブ対応）
  useEffect(() => {
    const handler = () => {
      setUnlockedAchievements(loadUnlockedAchievements());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const unlockedRef = useRef(unlockedAchievements);
  useEffect(() => {
    unlockedRef.current = unlockedAchievements;
  }, [unlockedAchievements]);

  const checkAndUnlock = useCallback((params: AchievementCheckParams) => {
    const triggered = checkNewAchievements(params);
    let current = unlockedRef.current;
    const newToasts: Achievement[] = [];

    for (const id of triggered) {
      const { next, isNew } = unlockAchievement(id, current);
      current = next;
      if (isNew) {
        newToasts.push(ACHIEVEMENTS[id]);
      }
    }

    if (newToasts.length > 0) {
      setUnlockedAchievements(current);
      setToastQueue((q) => [...q, ...newToasts]);
    }
  }, []);

  const dismissToast = useCallback(() => {
    setToastQueue((q) => q.slice(1));
  }, []);

  return {
    unlockedAchievements,
    pendingToast,
    dismissToast,
    checkAndUnlock,
  };
}

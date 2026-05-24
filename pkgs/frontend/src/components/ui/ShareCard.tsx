import i18n from "@/i18n";
/**
 * ShareCard / ShareButton — サボり判定シェアカード（Tier 3 施策6）
 *
 * 判定結果をビジュアルカードとして表示し、X（Twitter）や
 * クリップボードへワンタップでシェアできる。
 *
 * Octalysis:
 *   5（ソーシャル）: シェアで「AI奴隷」を周囲に誇示
 *   6（希少性）: 「A+判定」など珍しい結果を見せたい動機
 *   3（創造・フィードバック）: 自分の判定結果を表現する満足感
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { SaboriGrade } from "@/lib/gamificationUtils";

// ===== Props =====

export interface ShareCardProps {
  verdict: "can_saboru" | "borderline" | "must_do";
  taskTitle: string;
  dependencyScore: number;
  grade: SaboriGrade;
  titleName: string;
  className?: string;
}

// ===== ユーティリティ =====

function buildShareText(props: Omit<ShareCardProps, "className">): string {
  const { taskTitle, grade, dependencyScore, titleName, verdict } = props;
  const t = i18n.t.bind(i18n);
  const verdictLabel = t(`gamification.shareVerdictLabels.${verdict}`, {
    defaultValue: verdict,
  });

  return [
    t("gamification.shareText.header"),
    t("gamification.shareText.taskLine", { title: taskTitle }),
    t("gamification.shareText.verdictLine", { verdict: verdictLabel, grade }),
    t("gamification.shareText.dependencyLine", {
      score: dependencyScore,
      titleName,
    }),
    "",
    t("gamification.shareText.catchphrase"),
    t("gamification.shareText.hashtags"),
  ].join("\n");
}

function openTwitterShare(text: string): void {
  const encoded = encodeURIComponent(text);
  window.open(
    `https://twitter.com/intent/tweet?text=${encoded}`,
    "_blank",
    "noopener,noreferrer",
  );
}

// ===== シェアカード（ビジュアル表示） =====

export function ShareCard({
  verdict,
  taskTitle,
  dependencyScore,
  grade,
  titleName,
  className = "",
}: ShareCardProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const verdictConfig = {
    can_saboru: {
      label: t("gamification.shareCardVerdictLabels.can_saboru"),
      emoji: "✅",
      color: "#10B981",
      bg: "#ECFDF5",
    },
    borderline: {
      label: t("gamification.shareCardVerdictLabels.borderline"),
      emoji: "⚠️",
      color: "#F59E0B",
      bg: "#FFFBEB",
    },
    must_do: {
      label: t("gamification.shareCardVerdictLabels.must_do"),
      emoji: "❌",
      color: "#EF4444",
      bg: "#FEF2F2",
    },
  }[verdict];

  const gradeConfig: Record<SaboriGrade, { color: string; label: string }> = {
    "A+": {
      color: "#F59E0B",
      label: t("gamification.shareCardGradeLabels.A+"),
    },
    A: { color: "#10B981", label: t("gamification.shareCardGradeLabels.A") },
    B: { color: "#3B82F6", label: t("gamification.shareCardGradeLabels.B") },
    C: { color: "#84CC16", label: t("gamification.shareCardGradeLabels.C") },
    D: { color: "#F59E0B", label: t("gamification.shareCardGradeLabels.D") },
    E: { color: "#6B7280", label: t("gamification.shareCardGradeLabels.E") },
  };

  const shareText = buildShareText({
    verdict,
    taskTitle,
    dependencyScore,
    grade,
    titleName,
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: execCommand
      const el = document.createElement("textarea");
      el.value = shareText;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
      aria-label={t("gamification.shareCardAriaLabel")}
    >
      {/* ヘッダー */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: "2px solid #2B1E16",
        }}
      >
        <span style={{ fontSize: 20 }} aria-hidden="true">
          🦥
        </span>
        <span
          style={{
            fontWeight: 900,
            fontSize: 13,
            color: "#2B1E16",
            letterSpacing: "-0.01em",
          }}
        >
          {t("gamification.shareCardTitle")}
        </span>
      </div>

      {/* タスク名 */}
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>
          {t("gamification.shareCardTaskLabel")}
        </span>
        <p
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#2B1E16",
            margin: "2px 0 0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          「{taskTitle}」
        </p>
      </div>

      {/* 判定結果 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 10,
          background: verdictConfig.bg,
          border: `2px solid ${verdictConfig.color}`,
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 18 }} aria-hidden="true">
          {verdictConfig.emoji}
        </span>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: verdictConfig.color,
            }}
          >
            {t("gamification.shareCardGradeLabel", { grade })}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2B1E16" }}>
            {gradeConfig[grade].label}
          </div>
        </div>
      </div>

      {/* AI依存度 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          borderRadius: 10,
          background: "#F3E8FF",
          border: "2px solid #A855F7",
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 12, color: "#7C3AED", fontWeight: 700 }}>
          {t("gamification.shareCardDependencyLabel")}
        </span>
        <span style={{ fontSize: 14, color: "#7C3AED", fontWeight: 900 }}>
          {dependencyScore}%「{titleName}」
        </span>
      </div>

      {/* キャッチコピー */}
      <p
        style={{
          fontSize: 11,
          color: "#6B7280",
          textAlign: "center",
          fontStyle: "italic",
          marginBottom: 14,
        }}
      >
        {t("gamification.shareCardCatchphrase")}
      </p>

      {/* シェアボタン群 */}
      <ShareButtonGroup
        onTwitter={() => openTwitterShare(shareText)}
        onCopy={() => void handleCopy()}
        copied={copied}
      />
    </div>
  );
}

// ===== シェアボタン群 =====

interface ShareButtonGroupProps {
  onTwitter: () => void;
  onCopy: () => void;
  copied: boolean;
}

export function ShareButtonGroup({
  onTwitter,
  onCopy,
  copied,
}: ShareButtonGroupProps) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {/* X (Twitter) シェアボタン */}
      <button
        type="button"
        onClick={onTwitter}
        style={{
          flex: 1,
          padding: "9px 12px",
          borderRadius: 10,
          border: "2px solid #2B1E16",
          boxShadow: "0 3px 0 #2B1E16",
          background: "#000000",
          color: "#FFFFFF",
          fontSize: 12,
          fontWeight: 900,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          transition: "transform 0.1s ease, box-shadow 0.1s ease",
          fontFamily: "inherit",
        }}
        onMouseDown={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform =
            "translateY(2px)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 1px 0 #2B1E16";
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "";
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 3px 0 #2B1E16";
        }}
        aria-label={t("gamification.shareToX")}
      >
        <span aria-hidden="true" style={{ fontSize: 14 }}>
          𝕏
        </span>
        {t("gamification.shareToX")}
      </button>

      {/* コピーボタン */}
      <button
        type="button"
        onClick={onCopy}
        style={{
          flex: 1,
          padding: "9px 12px",
          borderRadius: 10,
          border: "2px solid #2B1E16",
          boxShadow: copied ? "0 1px 0 #2B1E16" : "0 3px 0 #2B1E16",
          background: copied ? "#ECFDF5" : "#F3F4F6",
          color: copied ? "#059669" : "#374151",
          fontSize: 12,
          fontWeight: 900,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          transition: "all 0.2s ease",
          transform: copied ? "translateY(2px)" : "",
          fontFamily: "inherit",
        }}
        aria-label={
          copied ? t("gamification.copiedButton") : t("gamification.copyButton")
        }
      >
        <span aria-hidden="true">{copied ? "✅" : "📋"}</span>
        {copied ? t("gamification.copiedButton") : t("gamification.copyButton")}
      </button>
    </div>
  );
}

// ===== ShareButton（コンパクト版・他コンポーネント埋め込み用） =====

interface ShareButtonProps {
  verdict: "can_saboru" | "borderline" | "must_do";
  taskTitle: string;
  dependencyScore: number;
  grade: SaboriGrade;
  titleName: string;
  /** true: カード展開UI、false: コンパクトボタンのみ */
  expanded?: boolean;
}

export function ShareButton({
  verdict,
  taskTitle,
  dependencyScore,
  grade,
  titleName,
  expanded = false,
}: ShareButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(expanded);

  if (open) {
    return (
      <div style={{ marginTop: 4 }}>
        <ShareCard
          verdict={verdict}
          taskTitle={taskTitle}
          dependencyScore={dependencyScore}
          grade={grade}
          titleName={titleName}
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            marginTop: 8,
            width: "100%",
            padding: "6px",
            borderRadius: 8,
            border: "1.5px solid #D1D5DB",
            background: "transparent",
            color: "#9CA3AF",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          aria-label={t("gamification.closeShareCard")}
        >
          {t("gamification.closeShareCard")}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      style={{
        width: "100%",
        padding: "10px 14px",
        borderRadius: 12,
        border: "2px solid #2B1E16",
        boxShadow: "0 3px 0 #2B1E16",
        background: "#FEF3C7",
        color: "#2B1E16",
        fontSize: 13,
        fontWeight: 900,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "transform 0.1s ease, box-shadow 0.1s ease",
        fontFamily: "inherit",
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform =
          "translateY(2px)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow =
          "0 1px 0 #2B1E16";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "";
        (e.currentTarget as HTMLButtonElement).style.boxShadow =
          "0 3px 0 #2B1E16";
      }}
      aria-label={t("gamification.openShareButton")}
    >
      <span aria-hidden="true">🦥</span>
      {t("gamification.openShareButton")}
      <span aria-hidden="true">→</span>
    </button>
  );
}

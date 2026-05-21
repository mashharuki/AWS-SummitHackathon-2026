import { VERDICT_META } from "@/lib/verdictMeta";
/**
 * VerdictBox — サボロー判定の色分け表示
 * U-06-ui-redesign Phase 5 改修版（ネオブルータリズム）
 */
import type { Verdict } from "@saboru/shared";
import { useTranslation } from "react-i18next";

interface VerdictBoxProps {
  verdict: Verdict;
  summaryText: string;
  /** AI が評価した時刻（任意） */
  evaluatedAt?: string;
}

export function VerdictBox({
  verdict,
  summaryText,
  evaluatedAt,
}: VerdictBoxProps) {
  const { t } = useTranslation();
  const meta = VERDICT_META[verdict];
  const verdictLabel =
    verdict === "can_saboru"
      ? t("verdict.canSaboru")
      : verdict === "borderline"
        ? t("verdict.borderline")
        : t("verdict.mustDo");

  return (
    <div
      role="region"
      aria-label={`Saborou verdict: ${verdictLabel}`}
      className="card-brutal p-3.5"
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="font-extrabold tracking-wider flex items-center gap-1"
          style={{
            fontSize: 11,
            background: meta.color,
            color: "#FFFFFF",
            padding: "3px 10px",
            borderRadius: 9999,
            border: "2px solid #2B1E16",
            boxShadow: "0 2px 0 #2B1E16",
          }}
        >
          <span aria-hidden="true">{meta.emoji}</span>
          {verdictLabel}
        </span>
      </div>

      <p className="text-saboru-ink leading-relaxed" style={{ fontSize: 13 }}>
        {summaryText}
      </p>

      {evaluatedAt && (
        <p
          className="text-saboru-ink-muted mt-2 flex items-center justify-between pt-2"
          style={{
            fontSize: 9,
            borderTop: "1px solid #F3F4F6",
          }}
        >
          <span>{t("verdict.aiSource")}</span>
          <span>{evaluatedAt}</span>
        </p>
      )}
    </div>
  );
}

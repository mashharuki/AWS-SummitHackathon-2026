import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScheduleStep } from "@saboru/shared";
/**
 * StepEditor — 承認モーダルの「やること」欄（作業ステップ一覧の編集 UI）
 *
 * - AI（Bedrock）が下書きしたステップを編集できる: ラベル・所要時間・種別（作業/判断）
 * - 追加・削除が可能（1〜8 件、ApproveOverridesSchema の制約に合わせる）
 * - ローディング中はスケルトン、生成失敗時はエラー文＋再生成ボタンを出す
 *   （実際のローディング/エラー状態とフェッチは親 = TaskApprovalModal が管理する）
 */
import { Plus, RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";

/** ステップ件数の上限（ApproveOverridesSchema.plannedSteps の max と揃える） */
export const MAX_STEPS = 8;

interface StepEditorProps {
  steps: ScheduleStep[];
  onChange: (steps: ScheduleStep[]) => void;
  /** Bedrock 下書き生成中 */
  isLoading?: boolean;
  /** 下書き生成に失敗したか */
  hasError?: boolean;
  /** 再生成ボタン押下時（任意。未指定なら再生成ボタンを出さない） */
  onRetry?: () => void;
}

/** 新規ステップのデフォルト値。stepId はクライアント側で一意採番する。 */
function makeNewStep(index: number): ScheduleStep {
  return {
    stepId: `local_${Date.now()}_${index}`,
    stepLabel: "",
    durationMinutes: 30,
    bandType: "work",
  };
}

export function StepEditor({
  steps,
  onChange,
  isLoading = false,
  hasError = false,
  onRetry,
}: StepEditorProps) {
  const { t } = useTranslation();

  const updateStep = (index: number, patch: Partial<ScheduleStep>) => {
    onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const removeStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const addStep = () => {
    if (steps.length >= MAX_STEPS) return;
    onChange([...steps, makeNewStep(steps.length)]);
  };

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <p className="text-xs text-[#9CA3AF]">
          {t("approvalModal.stepsLoading")}
        </p>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-10 rounded-xl bg-[#F3F4F6] animate-pulse"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hasError && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-[#FEF2F2] px-3 py-2">
          <p className="text-xs text-[#EF4444]">
            {t("approvalModal.stepsError")}
          </p>
          {onRetry && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-7 shrink-0 gap-1 text-[#EF4444]"
            >
              <RefreshCw size={12} aria-hidden="true" />
              {t("approvalModal.retry")}
            </Button>
          )}
        </div>
      )}

      {steps.length === 0 && !hasError && (
        <p className="text-xs text-[#9CA3AF]">
          {t("approvalModal.stepsEmpty")}
        </p>
      )}

      <ul className="space-y-2">
        {steps.map((step, index) => (
          <li
            key={step.stepId}
            className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white p-2"
          >
            {/* 作業 / 判断 トグル */}
            <button
              type="button"
              onClick={() =>
                updateStep(index, {
                  bandType: step.bandType === "work" ? "decision" : "work",
                })
              }
              className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors"
              style={
                step.bandType === "decision"
                  ? { background: "#FEF3C7", color: "#B45309" }
                  : { background: "#F3F4F6", color: "#6B7280" }
              }
              aria-label={
                step.bandType === "work"
                  ? t("approvalModal.stepKindWork")
                  : t("approvalModal.stepKindDecision")
              }
            >
              {step.bandType === "work"
                ? t("approvalModal.stepKindWork")
                : t("approvalModal.stepKindDecision")}
            </button>

            {/* ステップ名 */}
            <Input
              value={step.stepLabel}
              onChange={(e) => updateStep(index, { stepLabel: e.target.value })}
              placeholder={t("approvalModal.stepLabelPlaceholder")}
              maxLength={60}
              className="h-9 flex-1"
              aria-label={t("approvalModal.stepLabelPlaceholder")}
            />

            {/* 所要時間（分） */}
            <div className="flex shrink-0 items-center gap-1">
              <Input
                type="number"
                value={String(step.durationMinutes)}
                onChange={(e) =>
                  updateStep(index, {
                    durationMinutes: clampMinutes(e.target.value),
                  })
                }
                min={5}
                max={480}
                step={5}
                className="h-9 w-16 text-center"
                aria-label={t("approvalModal.stepMinutes")}
              />
              <span className="text-[10px] text-[#9CA3AF]">
                {t("approvalModal.stepMinutes")}
              </span>
            </div>

            {/* 削除 */}
            <button
              type="button"
              onClick={() => removeStep(index)}
              aria-label={t("approvalModal.removeStep")}
              className="shrink-0 rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#EF4444]"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {steps.length < MAX_STEPS && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addStep}
          className="h-8 w-full gap-1 border border-dashed border-[#E5E7EB] text-[#6B7280]"
        >
          <Plus size={14} aria-hidden="true" />
          {t("approvalModal.addStep")}
        </Button>
      )}
    </div>
  );
}

/** 入力された分数を 5〜480 の整数にクランプする。空入力時は 5 を返す。 */
function clampMinutes(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return 5;
  return Math.min(480, Math.max(5, n));
}

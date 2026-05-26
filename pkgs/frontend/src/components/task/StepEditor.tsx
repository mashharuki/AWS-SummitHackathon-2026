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
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/** ステップ件数の上限（ApproveOverridesSchema.plannedSteps の max と揃える） */
export const MAX_STEPS = 8;

/** 所要時間（分）の許容範囲。ScheduleStepSchema と揃える。 */
const MIN_MINUTES = 5;
const MAX_MINUTES = 480;
/** 空欄を確定したときに使うデフォルト分数。 */
const DEFAULT_MINUTES = 30;

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
          <StepRow
            key={step.stepId}
            step={step}
            onPatch={(patch) => updateStep(index, patch)}
            onRemove={() => removeStep(index)}
          />
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

interface StepRowProps {
  step: ScheduleStep;
  onPatch: (patch: Partial<ScheduleStep>) => void;
  onRemove: () => void;
}

/**
 * StepRow — ステップ1行。所要時間の入力は編集途中の空文字を許容するため
 * ローカル文字列 state で管理し、blur 時に 5〜480 へ正規化して親へ確定する。
 * （onChange で即クランプすると「数字を全部消すと 5 になり消せない」UX になるため）
 */
function StepRow({ step, onPatch, onRemove }: StepRowProps) {
  const { t } = useTranslation();
  // 分入力の生文字列。空文字や編集途中の値をそのまま保持できる。
  const [minutesText, setMinutesText] = useState(String(step.durationMinutes));

  // 親の値が外から変わったら（再生成など）入力欄に同期する。
  // durationMinutes はこの行以外の操作では変わらないため、値が変わったときのみ追従する。
  useEffect(() => {
    setMinutesText(String(step.durationMinutes));
  }, [step.durationMinutes]);

  const handleMinutesChange = (raw: string) => {
    setMinutesText(raw);
    // 有効な数値がそのまま範囲内なら即座に親へ反映（プレビュー追従）。
    // 空・範囲外・編集途中はここでは確定せず、blur で正規化する。
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= MIN_MINUTES && n <= MAX_MINUTES) {
      onPatch({ durationMinutes: n });
    }
  };

  const handleMinutesBlur = () => {
    const normalized = clampMinutes(minutesText);
    setMinutesText(String(normalized));
    if (normalized !== step.durationMinutes) {
      onPatch({ durationMinutes: normalized });
    }
  };

  const isDecision = step.bandType === "decision";

  return (
    <li className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white p-2">
      {/* 作業 / 判断 トグル */}
      <button
        type="button"
        onClick={() => onPatch({ bandType: isDecision ? "work" : "decision" })}
        className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors"
        style={
          isDecision
            ? { background: "#FEF3C7", color: "#B45309" }
            : { background: "#F3F4F6", color: "#6B7280" }
        }
        aria-label={
          isDecision
            ? t("approvalModal.stepKindDecision")
            : t("approvalModal.stepKindWork")
        }
      >
        {isDecision
          ? t("approvalModal.stepKindDecision")
          : t("approvalModal.stepKindWork")}
      </button>

      {/* ステップ名 */}
      <Input
        value={step.stepLabel}
        onChange={(e) => onPatch({ stepLabel: e.target.value })}
        placeholder={t("approvalModal.stepLabelPlaceholder")}
        maxLength={60}
        className="h-9 flex-1"
        aria-label={t("approvalModal.stepLabelPlaceholder")}
      />

      {/* 所要時間（分） */}
      <div className="flex shrink-0 items-center gap-1">
        <Input
          type="number"
          inputMode="numeric"
          value={minutesText}
          onChange={(e) => handleMinutesChange(e.target.value)}
          onBlur={handleMinutesBlur}
          min={MIN_MINUTES}
          max={MAX_MINUTES}
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
        onClick={onRemove}
        aria-label={t("approvalModal.removeStep")}
        className="shrink-0 rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#EF4444]"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * 入力された分数を 5〜480 の整数にクランプする。
 * 空・非数値のときはデフォルト（30 分）を返す。
 */
function clampMinutes(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return DEFAULT_MINUTES;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, n));
}

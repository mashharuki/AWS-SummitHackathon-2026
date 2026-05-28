import { StepEditor } from "@/components/task/StepEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import apiClient, { type ApproveOverridesPayload } from "@/lib/apiClient";
import { formatRequester } from "@/lib/utils";
import type { ScheduleStep, TaskCandidate } from "@saboru/shared";
import { X } from "lucide-react";
/**
 * TaskApprovalModal — 承認前の確認・編集モーダル
 *
 * 候補カードの「承認する」押下時に開く。ユーザーが内容を確認・編集し
 * 「確定して承認」するとガント生成へ進む。確定済みステップ（やること）は
 * Task に保存され、ガント生成時の Bedrock 再推論をスキップして精度を最大化する。
 *
 * 構成（モック準拠の4欄）:
 *   1. タスクの内容（title）
 *   2. 締切（deadline）
 *   3. やること（plannedSteps / StepEditor）— 開いた瞬間に Bedrock 下書きを取得
 *   4. 誰が言っているか（requester / sourceType の masked 表示）
 *
 * 実装方針: 既存 TaskAddModal の <dialog> + フォーカストラップ + Esc を踏襲。
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface TaskApprovalModalProps {
  candidate: TaskCandidate | null;
  isOpen: boolean;
  onClose: () => void;
  /** 「確定して承認」押下時。overrides を渡す（楽観的更新は呼び出し側で行う） */
  onConfirm: (
    candidateId: string,
    overrides: ApproveOverridesPayload,
  ) => Promise<void> | void;
}

/** ISO 8601 を date input 用（YYYY-MM-DD）に変換。null/不正時は空文字。 */
function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.split("T")[0] ?? "";
}

/**
 * 確定時にステップを正規化:
 * - 空ラベルを除去
 * - stepId を s1..sN に振り直す
 * - durationMinutes を 5〜480 にクランプ（blur 前に確定されても破綻しない保険）
 */
function normalizeSteps(steps: ScheduleStep[]): ScheduleStep[] {
  return steps
    .filter((s) => s.stepLabel.trim().length > 0)
    .map((s, i) => ({
      ...s,
      stepId: `s${i + 1}`,
      stepLabel: s.stepLabel.trim(),
      durationMinutes: Math.min(
        480,
        Math.max(5, Math.round(s.durationMinutes)),
      ),
    }));
}

export function TaskApprovalModal({
  candidate,
  isOpen,
  onClose,
  onConfirm,
}: TaskApprovalModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDialogElement>(null);

  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<ScheduleStep[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const candidateId = candidate?.candidateId ?? null;

  // モーダルが開いた／対象候補が変わったら、候補の値でフォームを初期化し
  // Bedrock のステップ下書きを取得する。
  useEffect(() => {
    if (!isOpen || !candidate) return;

    setTitle(candidate.title);
    setDeadline(isoToDateInput(candidate.deadline));
    setDescription(candidate.description);
    setSteps([]);
    setStepsError(false);
    setStepsLoading(true);

    let cancelled = false;
    apiClient
      .fetchPlanSteps(candidate.candidateId)
      .then((draft) => {
        if (cancelled) return;
        setSteps(draft);
        setStepsError(false);
      })
      .catch(() => {
        if (cancelled) return;
        // 失敗時はスケルトンを消して手動入力にフォールバックさせる
        setSteps([]);
        setStepsError(true);
      })
      .finally(() => {
        if (!cancelled) setStepsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, candidate]);

  // Esc で閉じる + Tab フォーカストラップ（TaskAddModal と同方針）
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (
          e.shiftKey
            ? document.activeElement === first
            : document.activeElement === last
        ) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !candidate || !candidateId) return null;

  // 依頼者は users.info 解決済みの表示名を生表示する（formatRequester に集約）。
  const requesterText = formatRequester(
    candidate.requester,
    candidate.sourceType,
    t,
  );

  const handleRetry = () => {
    setStepsError(false);
    setStepsLoading(true);
    apiClient
      .fetchPlanSteps(candidateId)
      .then((draft) => {
        setSteps(draft);
        setStepsError(false);
      })
      .catch(() => {
        setSteps([]);
        setStepsError(true);
      })
      .finally(() => setStepsLoading(false));
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isApproving) return;

    const normalized = normalizeSteps(steps);
    const overrides: ApproveOverridesPayload = {
      title: title.trim(),
      deadline: deadline ? new Date(deadline).toISOString() : null,
      description: description.trim(),
      // 空ラベルを除いた確定ステップが無ければ送らない → Bedrock 分解へフォールバック
      ...(normalized.length > 0 ? { plannedSteps: normalized } : {}),
    };

    setIsApproving(true);
    try {
      await onConfirm(candidateId, overrides);
      onClose();
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <dialog
      open
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      aria-labelledby="approve-task-title"
      style={{ border: "none", maxWidth: "none", margin: 0, padding: 0 }}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* ヘッダー（モック準拠: eyebrow + タイトル、温かみのある背景） */}
        <div
          className="flex items-start justify-between p-4"
          style={{ background: "#FFFBEB", borderBottom: "1px solid #FDE68A" }}
        >
          <div>
            <p
              className="font-bold tracking-wide"
              style={{ fontSize: 11, color: "#D97706" }}
            >
              {t("approvalModal.eyebrow")}
            </p>
            <h2
              id="approve-task-title"
              className="mt-0.5 font-bold text-[#1A1A1A]"
              style={{ fontSize: 18 }}
            >
              {t("approvalModal.title")}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t("common.close")}
            className="h-8 w-8 shrink-0"
          >
            <X size={16} />
          </Button>
        </div>

        {/* 本体（スクロール可能） */}
        <form
          onSubmit={(e) => void handleConfirm(e)}
          className="flex-1 space-y-4 overflow-y-auto p-4"
        >
          {/* 1. タスクの内容 */}
          <div>
            <label
              htmlFor="approve-title"
              className="mb-1 block text-xs font-medium text-[#6B7280]"
            >
              {t("approvalModal.taskContent")} <span aria-hidden="true">*</span>
            </label>
            <Input
              id="approve-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("approvalModal.taskContentPlaceholder")}
              required
              maxLength={200}
            />
          </div>

          {/* 締切 */}
          <div>
            <label
              htmlFor="approve-deadline"
              className="mb-1 block text-xs font-medium text-[#6B7280]"
            >
              {t("approvalModal.deadline")}
            </label>
            <Input
              id="approve-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <p className="mt-1 text-[10px] text-[#9CA3AF]">
              {t("approvalModal.deadlineHint")}
            </p>
          </div>

          {/* 3. やること（ステップ） */}
          <div>
            <span className="mb-1 block text-xs font-medium text-[#6B7280]">
              {t("approvalModal.steps")}
            </span>
            <p className="mb-2 text-[10px] text-[#9CA3AF]">
              {t("approvalModal.todoHint")}
            </p>
            <StepEditor
              steps={steps}
              onChange={setSteps}
              // decision の時刻は締切と同じ日に置く（編集中の締切を優先）。
              baseDateIso={
                deadline ? new Date(deadline).toISOString() : candidate.deadline
              }
              isLoading={stepsLoading}
              hasError={stepsError}
              onRetry={handleRetry}
            />
          </div>

          {/* 内容・メモ（description） */}
          <div>
            <label
              htmlFor="approve-description"
              className="mb-1 block text-xs font-medium text-[#6B7280]"
            >
              {t("taskForm.content")}
            </label>
            <Textarea
              id="approve-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("taskForm.contentPlaceholder")}
              rows={2}
              maxLength={1000}
            />
          </div>

          {/* 4. 誰が言っているか（表示のみ） */}
          <div>
            <span className="mb-1 block text-xs font-medium text-[#6B7280]">
              {t("approvalModal.requester")}
            </span>
            <p
              className="rounded-xl bg-[#F9FAFB] px-3 py-2 text-sm text-[#6B7280]"
              data-testid="requester-display"
            >
              {requesterText}
            </p>
          </div>

          {/* 5. 誰宛か（assignee がある場合のみ表示） */}
          {candidate.assignee && (
            <div>
              <span className="mb-1 block text-xs font-medium text-[#6B7280]">
                {t("approvalModal.assignee")}
              </span>
              <p
                className="rounded-xl bg-[#F9FAFB] px-3 py-2 text-sm text-[#6B7280]"
                data-testid="assignee-display"
              >
                {t("approvalModal.assigneeValue", { name: candidate.assignee })}
              </p>
            </div>
          )}
        </form>

        {/* フッター */}
        <div className="flex justify-end gap-2 border-t border-[#E5E7EB] p-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isApproving}
          >
            {t("approvalModal.cancel")}
          </Button>
          <Button
            type="button"
            onClick={(e) => void handleConfirm(e)}
            disabled={isApproving || !title.trim()}
          >
            {isApproving
              ? t("approvalModal.approving")
              : t("approvalModal.confirm")}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

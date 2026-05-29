import { formatDeadlineDisplay, formatRequester } from "@/lib/utils";
import type { Task } from "@saboru/shared";
import { CalendarDays, FileText, ListChecks, UserRound } from "lucide-react";
/**
 * TaskInfoSummary — タスク詳細画面のサマリカード
 *
 * 承認モーダル（TaskApprovalModal）で確認する 4 項目を、後からでも一目で
 * 振り返れるよう一元表示する。配置はガントチャートの直下（PC / スマホ共通）。
 *
 * 表示する 4 項目:
 *   1. タスクの内容（title）
 *   2. 締切（deadline / formatDeadlineDisplay で整形。null は「期限未定」）
 *   3. 詳細内容・メモ（description / 空なら「詳細なし」）
 *   4. 誰が言っているか（requester を formatRequester で表示）
 *   5. 誰宛か（assignee がある場合のみ）
 *
 * 表示方針: requester / assignee は users.info で解決した表示名を生表示する
 * （formatRequester に集約。承認モーダルと同一の流儀。旧ハッシュ化は廃止）。
 *
 * デザイン: 既存トーン（card-brutal / saboru-* カラー）を踏襲し、ガント下部の
 * サボり時間サマリと調和させる。各項目はアイコン + ラベル + 値の三層構成。
 */
import { useTranslation } from "react-i18next";

interface TaskInfoSummaryProps {
  task: Task;
}

/** サマリ 1 行ぶんの行レイアウト（アイコン + ラベル + 値）。 */
function SummaryRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-saboru-orange-light text-saboru-orange-dark"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold tracking-wide text-saboru-ink-muted">
          {label}
        </p>
        <div className="mt-0.5 text-sm text-saboru-ink">{children}</div>
      </div>
    </div>
  );
}

export function TaskInfoSummary({ task }: TaskInfoSummaryProps) {
  const { t } = useTranslation();

  const requesterText = formatRequester(task.requester, task.sourceType, t);
  const hasDescription = task.description.trim().length > 0;

  return (
    <section
      className="card-brutal p-3.5"
      aria-label={t("taskInfoSummary.heading")}
      data-testid="task-info-summary"
    >
      {/* 見出し（ガント下部サマリと同じトーンの eyebrow 風） */}
      <div className="mb-3 flex items-center gap-1.5">
        <ListChecks
          size={15}
          className="text-saboru-orange"
          aria-hidden="true"
        />
        <h2 className="text-[11px] font-bold tracking-wide text-saboru-orange-dark">
          {t("taskInfoSummary.heading")}
        </h2>
      </div>

      <div className="flex flex-col gap-3">
        {/* 1. タスクの内容 */}
        <SummaryRow
          icon={<FileText size={15} aria-hidden="true" />}
          label={t("taskInfoSummary.taskContent")}
        >
          <p
            className="font-bold leading-snug"
            style={{ letterSpacing: "-0.01em" }}
          >
            {task.title}
          </p>
        </SummaryRow>

        {/* 2. 締切 */}
        <SummaryRow
          icon={<CalendarDays size={15} aria-hidden="true" />}
          label={t("taskInfoSummary.deadline")}
        >
          <p>{formatDeadlineDisplay(task.deadline)}</p>
        </SummaryRow>

        {/* 3. 詳細内容・メモ（空なら「詳細なし」をくすませて表示） */}
        <SummaryRow
          icon={<FileText size={15} aria-hidden="true" />}
          label={t("taskInfoSummary.description")}
        >
          {hasDescription ? (
            <p className="whitespace-pre-wrap break-words leading-relaxed">
              {task.description}
            </p>
          ) : (
            <p className="italic text-saboru-ink-muted">
              {t("taskInfoSummary.descriptionEmpty")}
            </p>
          )}
        </SummaryRow>

        {/* 4. 誰が言っているか（解決済み表示名） */}
        <SummaryRow
          icon={<UserRound size={15} aria-hidden="true" />}
          label={t("taskInfoSummary.requester")}
        >
          <p data-testid="summary-requester">{requesterText}</p>
        </SummaryRow>

        {/* 5. 誰宛か（assignee がある場合のみ） */}
        {task.assignee && (
          <SummaryRow
            icon={<UserRound size={15} aria-hidden="true" />}
            label={t("taskInfoSummary.assignee")}
          >
            <p data-testid="summary-assignee">
              {t("approvalModal.assigneeValue", { name: task.assignee })}
            </p>
          </SummaryRow>
        )}
      </div>
    </section>
  );
}

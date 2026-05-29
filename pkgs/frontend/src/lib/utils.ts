import i18n from "@/i18n";
import type { SourceType } from "@saboru/shared";
import { type ClassValue, clsx } from "clsx";
import type { TFunction } from "i18next";
import { twMerge } from "tailwind-merge";

/** Tailwind CSS クラス名マージ */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 日付を日本語フォーマットで表示 */
export function formatDateJa(isoString: string | null): string {
  if (!isoString) return "未定";
  const date = new Date(isoString);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)}日超過`;
  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "明日";
  return `${diffDays}日後`;
}

/** 期限の表示テキスト（フォーマット済み） */
export function formatDeadlineDisplay(isoString: string | null): string {
  if (!isoString) return "期限未定";
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}/${month}/${day}`;
}

/**
 * 依頼者の表示テキストを整形して返す。
 *
 * requester は users.info で解決した表示名を生で保存する方針に変更したため、
 * そのまま表示する（旧仕様のハッシュ化＋マスクは廃止。実名表示を優先）。
 * requester が空（未記録）の場合は取り込み元（sourceType）でフォールバック表示する。
 *
 * 承認モーダル（TaskApprovalModal）とタスク情報サマリ（TaskInfoSummary）で
 * 同一の流儀を担保するため共通化している。
 *
 * @param requester 解決済み表示名（空文字なら未記録扱い）
 * @param sourceType 取り込み元（slack / gmail / calendar / manual）
 * @param t react-i18next の翻訳関数
 */
export function formatRequester(
  requester: string,
  sourceType: SourceType,
  t: TFunction,
): string {
  if (requester) {
    return requester;
  }
  // 未記録時のみ取り込み元ラベルでフォールバック（誰からか分からない場合）
  const sourceLabel: Record<SourceType, string> = {
    slack: "Slack",
    gmail: t("approvalModal.sourceGmail"),
    calendar: t("approvalModal.sourceCalendar"),
    manual: t("tasks.manual"),
  };
  return t("approvalModal.requesterMasked", {
    source: sourceLabel[sourceType],
  });
}

/** 期限が過ぎているか */
export function isOverdue(isoString: string | null): boolean {
  if (!isoString) return false;
  return new Date(isoString) < new Date();
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * UUID形式の name をメールアドレスのプレフィックスで補完して表示名を返す
 * Cognito 初回ログイン時に name が未設定だと userId (UUID) が保存されてしまうケースを補正する
 */
export function getDisplayName(user: {
  name: string;
  email: string;
}): string {
  if (UUID_PATTERN.test(user.name)) {
    return user.email ? user.email.split("@")[0] : "ユーザー";
  }
  return user.name;
}

/** APIエラーメッセージをユーザー向けに変換 */
export function toUserMessage(error: unknown): string {
  if (error instanceof Error) {
    if (
      error.message.includes("401") ||
      error.message.includes("Unauthorized")
    ) {
      return i18n.language.startsWith("ja")
        ? "セッションが切れました。再ログインしてください"
        : "Session expired. Please sign in again.";
    }
    if (error.message.includes("404") || error.message.includes("Not Found")) {
      return i18n.language.startsWith("ja")
        ? "データが見つかりませんでした"
        : "Data was not found.";
    }
    if (error.message.includes("5")) {
      return i18n.language.startsWith("ja")
        ? "サーバーエラーが発生しました。再試行してください"
        : "Server error occurred. Please retry.";
    }
  }
  if (error instanceof TypeError) {
    return i18n.language.startsWith("ja")
      ? "接続できませんでした。再試行してください"
      : "Connection failed. Please retry.";
  }
  return i18n.language.startsWith("ja")
    ? "予期しないエラーが発生しました"
    : "An unexpected error occurred.";
}

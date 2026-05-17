import { type ClassValue, clsx } from "clsx";
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

/** 期限が過ぎているか */
export function isOverdue(isoString: string | null): boolean {
  if (!isoString) return false;
  return new Date(isoString) < new Date();
}

/** APIエラーメッセージをユーザー向けに変換 */
export function toUserMessage(error: unknown): string {
  if (error instanceof Error) {
    if (
      error.message.includes("401") ||
      error.message.includes("Unauthorized")
    ) {
      return "セッションが切れました。再ログインしてください";
    }
    if (error.message.includes("404") || error.message.includes("Not Found")) {
      return "データが見つかりませんでした";
    }
    if (error.message.includes("5")) {
      return "サーバーエラーが発生しました。再試行してください";
    }
  }
  if (error instanceof TypeError) {
    return "接続できませんでした。再試行してください";
  }
  return "予期しないエラーが発生しました";
}

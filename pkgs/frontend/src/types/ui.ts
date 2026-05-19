import type { Verdict } from "@saboru/shared";

/** Toast 通知メッセージ */
export interface ToastMessage {
  id: string;
  message: string;
  variant?: "success" | "error" | "info" | "warning";
}

/** チャットメッセージ */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/** サボローチャットの表示状態 */
export interface ChatPaneState {
  messages: ChatMessage[];
  isStreaming: boolean;
  verdict: Verdict | null;
}

/** タスク一覧ページのフィルタ */
export type TaskFilter = "all" | "pending" | "approved";

/** ナビゲーションアイテム */
export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

import { QUICK_REPLY_LABELS } from "@/lib/verdictMeta";
/**
 * QuickReplyButtons — クイックリプライ
 * U-06-ui-redesign Phase 5 改修版（ネオブルータリズム）
 *
 * API 固定 4 値（QuickReplyType）を UI 表示文言にマッピング
 */
import type { QuickReplyType } from "@saboru/shared";

const QUICK_REPLIES: { type: QuickReplyType; label: string }[] = (
  [
    "truly_tired",
    "actually_important",
    "agree_with_ai",
    "disagree_with_ai",
  ] as const
).map((t) => ({ type: t, label: QUICK_REPLY_LABELS[t] }));

interface QuickReplyButtonsProps {
  onSelect: (type: QuickReplyType, label: string) => void;
  disabled?: boolean;
}

export function QuickReplyButtons({
  onSelect,
  disabled = false,
}: QuickReplyButtonsProps) {
  return (
    <div
      role="group"
      aria-label="クイックリプライ"
      className="flex flex-wrap gap-1.5 py-2"
    >
      {QUICK_REPLIES.map((reply) => (
        <button
          key={reply.type}
          type="button"
          onClick={() => onSelect(reply.type, reply.label)}
          disabled={disabled}
          className="hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed transition-transform"
          style={{
            background: "#FFFFFF",
            border: "2.5px solid #2B1E16",
            color: "#EA580C",
            fontSize: 11,
            padding: "7px 12px",
            borderRadius: 9999,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 3px 0 #2B1E16",
            fontFamily: "Nunito, 'Noto Sans JP', system-ui, sans-serif",
          }}
        >
          {reply.label}
        </button>
      ))}
    </div>
  );
}

/**
 * クイックリプライボタン
 * モックUI saborou_v2_03-detail.png 参照
 */
import { Button } from "@/components/ui/button";
import type { QuickReplyType } from "@saboru/shared";

const QUICK_REPLIES: { type: QuickReplyType; label: string }[] = [
  { type: "truly_tired", label: "確かに、もう少し寝かせよう" },
  { type: "actually_important", label: "でもこのタスク急ぎかも..." },
  { type: "agree_with_ai", label: "15分だけやってみる" },
  { type: "disagree_with_ai", label: "完全に無視したい" },
];

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
      className="flex flex-wrap gap-2 py-2"
      role="group"
      aria-label="クイックリプライ"
    >
      {QUICK_REPLIES.map((reply) => (
        <Button
          key={reply.type}
          variant="outline"
          size="sm"
          onClick={() => onSelect(reply.type, reply.label)}
          disabled={disabled}
          className="text-xs rounded-full border-[#FF6B2B]/50 text-[#FF6B2B] hover:bg-[#FF6B2B]/5"
        >
          {reply.label}
        </Button>
      ))}
    </div>
  );
}

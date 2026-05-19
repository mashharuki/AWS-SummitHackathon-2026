/**
 * 自由記述入力フォーム
 */
import { Send } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface FreeTextInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function FreeTextInput({
  onSend,
  disabled = false,
  placeholder = "サボろうについて質問...",
}: FreeTextInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2 p-3 border-t border-[#E5E7EB] bg-white rounded-b-2xl">
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="resize-none min-h-[36px] max-h-28 text-sm"
        aria-label="サボローへのメッセージ"
      />
      <Button
        onClick={handleSend}
        size="icon"
        disabled={disabled || !text.trim()}
        aria-label="送信"
        className="h-9 w-9 shrink-0 rounded-full"
      >
        <Send size={15} />
      </Button>
    </div>
  );
}

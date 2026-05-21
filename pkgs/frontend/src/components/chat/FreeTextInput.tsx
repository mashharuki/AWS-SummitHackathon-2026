/**
 * 自由記述入力フォーム
 * U-06-ui-redesign Phase 5 改修版（ネオブルータリズム）
 */
import { Send } from "lucide-react";
import { useRef, useState } from "react";

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
    <div
      className="flex items-end gap-2 px-3 py-2.5 bg-saboru-paper"
      style={{ borderTop: "3px solid #2B1E16" }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="input-brutal resize-none flex-1"
        style={{
          minHeight: 36,
          maxHeight: 112,
          fontSize: 12,
        }}
        aria-label="サボローへのメッセージ"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        aria-label="送信"
        className="flex items-center justify-center disabled:opacity-50"
        style={{
          background: "#F97316",
          border: "none",
          color: "#FFFFFF",
          width: 36,
          height: 36,
          borderRadius: 18,
          cursor: text.trim() && !disabled ? "pointer" : "not-allowed",
          flexShrink: 0,
        }}
      >
        <Send size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

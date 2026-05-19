/**
 * チャット吹き出しコンポーネント
 * モックUI saborou_v2_03-detail.png 参照
 */
import type { ChatMessage as ChatMessageType } from "@/types/ui";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={cn("flex", isAssistant ? "justify-start" : "justify-end")}>
      {isAssistant && (
        <div
          className="w-7 h-7 rounded-full bg-[#FF6B2B] flex items-center justify-center mr-2 shrink-0 mt-auto"
          aria-hidden="true"
        >
          <span className="text-white text-xs font-bold">S</span>
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isAssistant
            ? "bg-white border border-[#E5E7EB] text-[#1A1A1A] rounded-bl-sm"
            : "bg-[#FF6B2B] text-white rounded-br-sm",
        )}
        role="article"
        aria-label={isAssistant ? "サボローのメッセージ" : "あなたのメッセージ"}
      >
        {message.content}
      </div>
    </div>
  );
}

/** ストリーミング中のタイピングインジケーター */
export function TypingIndicator() {
  return (
    <div
      className="flex justify-start"
      aria-live="polite"
      aria-label="サボローが入力中"
    >
      <div
        className="w-7 h-7 rounded-full bg-[#FF6B2B] flex items-center justify-center mr-2 shrink-0"
        aria-hidden="true"
      >
        <span className="text-white text-xs font-bold">S</span>
      </div>
      <div className="bg-white border border-[#E5E7EB] rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

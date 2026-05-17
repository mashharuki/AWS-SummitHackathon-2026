/**
 * チャットペイン全体 — タスク詳細ページの右側
 * モックUI saborou_v2_03-detail.png 参照
 */
import { useEffect, useRef } from "react";
import type { QuickReplyType } from "@saboru/shared";
import type { ChatMessage as ChatMessageType } from "@/types/ui";
import { ChatMessage, TypingIndicator } from "./ChatMessage";
import { FreeTextInput } from "./FreeTextInput";
import { QuickReplyButtons } from "./QuickReplyButtons";

interface ChatPaneProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
  onQuickReply: (type: QuickReplyType, label: string) => void;
  onFreeText: (text: string) => void;
  showQuickReplies?: boolean;
}

export function ChatPane({
  messages,
  isStreaming,
  onQuickReply,
  onFreeText,
  showQuickReplies = true,
}: ChatPaneProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 新しいメッセージが来たら最下部にスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const mappedMessages: ChatMessageType[] = messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    timestamp: m.timestamp ?? new Date().toISOString(),
  }));

  return (
    <div
      className="flex flex-col h-full bg-[#F5F4F0] rounded-2xl overflow-hidden border border-[#E5E7EB]"
      role="region"
      aria-label="おっとりサボロー チャット"
    >
      {/* タイトル */}
      <div className="px-4 py-3 bg-white border-b border-[#E5E7EB]">
        <h2 className="font-semibold text-[#1A1A1A] text-sm">
          おっとりサボロー
        </h2>
      </div>

      {/* メッセージエリア */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        role="log"
        aria-label="チャットメッセージ"
        aria-live="polite"
      >
        {mappedMessages.length === 0 && !isStreaming && (
          <p className="text-center text-sm text-[#9CA3AF] py-8">
            サボロー判定を開始します...
          </p>
        )}

        {mappedMessages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isStreaming && <TypingIndicator />}

        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* クイックリプライ */}
      {showQuickReplies && mappedMessages.length > 0 && (
        <div className="px-4 bg-white border-t border-[#E5E7EB]">
          <QuickReplyButtons onSelect={onQuickReply} disabled={isStreaming} />
        </div>
      )}

      {/* テキスト入力 */}
      <FreeTextInput
        onSend={onFreeText}
        disabled={isStreaming}
        placeholder="サボろうについて質問..."
      />
    </div>
  );
}

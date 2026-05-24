import type { ChatMessage as ChatMessageType } from "@/types/ui";
/**
 * ChatPane — タスク詳細のチャットエリア
 * U-06-ui-redesign Phase 5 改修版（ネオブルータリズム）
 */
import type { QuickReplyType } from "@saboru/shared";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <section
      aria-label={t("chat.paneAria")}
      className="card-brutal flex flex-col h-full overflow-hidden"
    >
      {/* タイトル */}
      <header
        className="bg-saboru-paper px-4 py-3"
        style={{ borderBottom: "3px solid #2B1E16" }}
      >
        <h2 className="font-bold text-saboru-ink" style={{ fontSize: 13 }}>
          {t("chat.title")}
        </h2>
      </header>

      {/* メッセージエリア */}
      <div
        role="log"
        aria-label={t("chat.logAria")}
        aria-live="polite"
        className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2"
        style={{ background: "#FFFAF5" }}
      >
        {messages.length === 0 && !isStreaming && (
          <p
            className="text-center text-saboru-ink-muted py-8"
            style={{ fontSize: 12 }}
          >
            {t("chat.startMessage")}
          </p>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isStreaming && <TypingIndicator />}

        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* クイックリプライ */}
      {showQuickReplies && messages.length > 0 && (
        <div
          className="px-3 bg-saboru-paper"
          style={{ borderTop: "1px solid #F3F4F6" }}
        >
          <QuickReplyButtons onSelect={onQuickReply} disabled={isStreaming} />
        </div>
      )}

      {/* テキスト入力 */}
      <FreeTextInput
        onSend={onFreeText}
        disabled={isStreaming}
        placeholder={t("chat.messagePlaceholder")}
      />
    </section>
  );
}

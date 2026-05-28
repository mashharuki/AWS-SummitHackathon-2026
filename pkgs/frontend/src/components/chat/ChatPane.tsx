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

interface ChatPaneProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
  /**
   * クイックリプライ選択ハンドラ。
   * ボタン UI は撤去したが、将来再導入できるよう型・配線は残置している。
   */
  onQuickReply?: (type: QuickReplyType, label: string) => void;
  onFreeText: (text: string) => void;
  /** 旧クイックリプライ表示フラグ（UI 撤去済みのため現在は未使用・後方互換で受容）。 */
  showQuickReplies?: boolean;
}

export function ChatPane({ messages, isStreaming, onFreeText }: ChatPaneProps) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom triggered by messages change
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

      {/* テキスト入力（チャット欄の最下部に常駐） */}
      <div className="sticky bottom-0 z-10 bg-saboru-paper">
        <FreeTextInput
          onSend={onFreeText}
          disabled={isStreaming}
          placeholder={t("chat.messagePlaceholder")}
        />
      </div>
    </section>
  );
}

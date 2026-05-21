/**
 * チャットメッセージバブル
 * U-06-ui-redesign Phase 5 改修版（ネオブルータリズム + SaborouAvatar）
 */
import { SaborouAvatar } from "@/components/character/SaborouAvatar";
import type { ChatMessage as ChatMessageType } from "@/types/ui";
import { useTranslation } from "react-i18next";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { t } = useTranslation();
  const isAssistant = message.role === "assistant";

  return (
    <div
      className="flex gap-2"
      style={{
        justifyContent: isAssistant ? "flex-start" : "flex-end",
        animation: "fadeSlide 0.3s ease",
      }}
    >
      {isAssistant && <SaborouAvatar size={28} />}
      <div
        role="article"
        aria-label={
          isAssistant ? t("chat.assistantMessage") : t("chat.userMessage")
        }
        style={{
          maxWidth: "80%",
          background: isAssistant ? "#FFFFFF" : "#F97316",
          color: isAssistant ? "#1F2937" : "#FFFFFF",
          border: isAssistant ? "3px solid #2B1E16" : "2.5px solid #2B1E16",
          borderRadius: 18,
          padding: "9px 13px",
          fontSize: 12,
          lineHeight: 1.5,
          boxShadow: "0 3px 0 #2B1E16",
        }}
      >
        {isAssistant && (
          <p
            className="font-bold"
            style={{ fontSize: 9, color: "#EA580C", marginBottom: 2 }}
          >
            {t("chat.title")}
          </p>
        )}
        {message.content}
      </div>
    </div>
  );
}

/** タイピングインジケータ */
export function TypingIndicator() {
  const { t } = useTranslation();
  return (
    <div
      className="flex justify-start gap-2"
      aria-live="polite"
      aria-label={t("chat.typing")}
    >
      <SaborouAvatar size={28} />
      <div
        style={{
          background: "#FFFFFF",
          border: "3px solid #2B1E16",
          borderRadius: 18,
          padding: "10px 14px",
          boxShadow: "0 3px 0 #2B1E16",
          display: "flex",
          alignItems: "center",
          gap: 3,
        }}
      >
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            aria-hidden="true"
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              background: "#9CA3AF",
              animation: `dotPulse 1.2s infinite ${delay}ms`,
            }}
          />
        ))}
        <style>{`
          @keyframes dotPulse {
            0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
            40% { opacity: 1; transform: translateY(-3px); }
          }
        `}</style>
      </div>
    </div>
  );
}

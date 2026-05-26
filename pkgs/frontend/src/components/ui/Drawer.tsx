import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Drawer — 画面端からスライドインするパネル
 *
 * ゲーミフィケーション要素（実績/ストリーク/ギルド等）を「押下して開く」
 * UX のための再利用部品。PC は端からスライド、スマホでも破綻しないレスポンシブ。
 *
 * - role="dialog" aria-modal、Esc クローズ、オーバーレイクリックで閉じる
 * - open 時に body スクロールロック
 * - prefers-reduced-motion 配慮（transition は motion-reduce で無効化）
 */
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** スライドイン方向（デフォルト right） */
  side?: "left" | "right";
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = "right",
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Esc クローズ + フォーカストラップ
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (
          e.shiftKey
            ? document.activeElement === first
            : document.activeElement === last
        ) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // body スクロールロック
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="presentation">
      {/* オーバーレイ */}
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-saboru-heavy/40 motion-safe:animate-[fadeIn_0.15s_ease]"
      />

      {/* パネル */}
      <div
        ref={panelRef}
        // biome-ignore lint/a11y/useSemanticElements: <dialog> の showModal/フォーカス制御は本用途（端スライド・オーバーレイ自前制御）と相性が悪く、aria-modal + フォーカストラップを手実装する方針
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "パネル"}
        className={cn(
          "absolute top-0 bottom-0 w-[88vw] max-w-[360px] bg-saboru-paper",
          "border-saboru-heavy flex flex-col motion-safe:transition-transform",
          side === "right"
            ? "right-0 border-l-[3px] motion-safe:animate-[slideInRight_0.2s_ease]"
            : "left-0 border-r-[3px] motion-safe:animate-[slideInLeft_0.2s_ease]",
        )}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b-[3px] border-saboru-heavy px-4 py-3 shrink-0">
          <h2 className="text-saboru-ink font-extrabold text-base">
            {title ?? ""}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="p-1.5 text-saboru-ink-soft hover:text-saboru-ink rounded"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

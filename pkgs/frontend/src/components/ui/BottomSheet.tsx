import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

/**
 * BottomSheet — 下からスライドアップするシート（スマホ前提）
 *
 * ゲーミフィケーション要素を「押下して開く」ためのモバイル向け部品。
 * 上部にドラッグハンドル（見た目）、オーバーレイ/Esc で閉じる。
 */
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

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
    <div className="fixed inset-0 z-50 flex items-end" role="presentation">
      {/* オーバーレイ */}
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-saboru-heavy/40 motion-safe:animate-[fadeIn_0.15s_ease]"
      />

      {/* シート */}
      <div
        ref={panelRef}
        // biome-ignore lint/a11y/useSemanticElements: <dialog> の showModal/フォーカス制御は本用途（下スライド・オーバーレイ自前制御）と相性が悪く、aria-modal を手実装する方針
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "シート"}
        className={cn(
          "relative w-full max-h-[85vh] bg-saboru-paper",
          "border-t-[3px] border-saboru-heavy rounded-t-3xl flex flex-col",
          "motion-safe:animate-[slideUp_0.22s_ease]",
        )}
      >
        {/* ドラッグハンドル（見た目） */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-saboru-ink-muted/40" />
        </div>

        {title && (
          <div className="px-4 pb-2 shrink-0">
            <h2 className="text-saboru-ink font-extrabold text-base">
              {title}
            </h2>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-6">{children}</div>
      </div>
    </div>
  );
}

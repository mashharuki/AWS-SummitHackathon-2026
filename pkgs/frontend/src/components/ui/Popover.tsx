import { cn } from "@/lib/utils";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Popover — トリガー近傍に開く軽量ポップオーバー
 *
 * 補足情報（根拠/心理シグナル/共有など）を「押下して開く」ための部品。
 * 外側クリック / Esc で閉じる。新規依存なしの自前実装。
 */
interface PopoverProps {
  /** クリックで開閉するトリガー要素 */
  trigger: React.ReactNode;
  children: React.ReactNode;
  /** 開く方向（デフォルト bottom） */
  placement?: "top" | "bottom";
  /** 水平方向の揃え（デフォルト start） */
  align?: "start" | "center" | "end";
}

export function Popover({
  trigger,
  children,
  placement = "bottom",
  align = "start",
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // 外側クリック / Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const alignClass =
    align === "center"
      ? "left-1/2 -translate-x-1/2"
      : align === "end"
        ? "right-0"
        : "left-0";

  const placementClass =
    placement === "top" ? "bottom-full mb-2" : "top-full mt-2";

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="cursor-pointer"
      >
        {trigger}
      </button>

      {open && (
        <div
          id={panelId}
          className={cn(
            "absolute z-40 min-w-[220px] max-w-[88vw]",
            "card-brutal p-3 motion-safe:animate-[popIn_0.14s_ease]",
            placementClass,
            alignClass,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
